using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities.TeamPlayers;
using System.Linq;

namespace RFFM.Api.Features.Coaches.Convocations
{
    public class UpdateConvocationStatus : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/events/{eventId}/convocations/{convocationId}/status",
                    [Authorize(Roles = "Coach,Administrator,Player,FamilyMember")] async (string eventId, string convocationId, UpdateStatusRequest request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        request.EventId = eventId;
                        request.ConvocationId = convocationId;
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateConvocationStatus))
                .WithTags("Convocations")
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpdateStatusRequest : IRequest<Unit>
        {
            public string EventId { get; set; } = null!;
            public string ConvocationId { get; set; } = null!;
            public int NewStatusId { get; set; }
            public int? ExcuseTypeId { get; set; }
        }

        public class Handler : IRequestHandler<UpdateStatusRequest, Unit>
        {
            // Deconvocations reasoned as "Decisión técnica" are a coach-only call: once a coach
            // has set this reason, the associated Player/FamilyMember must not be able to change
            // the reason nor the status (including reactivation), even on a training event.
            private static readonly int TechnicalDecisionExcuseTypeId = ExcuseTypes.FromId(7)!.Id;

            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;
            private readonly ISanctionConvocationEnforcementService _enforcementService;

            public Handler(AppDbContext db, ICurrentUserService currentUser, ISanctionConvocationEnforcementService enforcementService)
            {
                _db = db;
                _currentUser = currentUser;
                _enforcementService = enforcementService;
            }

            public async ValueTask<Unit> Handle(UpdateStatusRequest request, CancellationToken cancellationToken = default)
            {
                var conv = await _db.Convocations
                    .Include(c => c.SportEvent)
                    .FirstOrDefaultAsync(c => c.Id == request.ConvocationId && c.SportEventId == request.EventId, cancellationToken);
                if (conv == null) throw new ArgumentException("Convocation not found");

                var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException("Usuario no autenticado");

                // Coach/Administrator manage any convocation; Player/FamilyMember may only manage
                // the convocation of the player associated with their own account. Base the role
                // check on the authenticated JWT roles (not the self-reported UserProfile.RoleName)
                // so it can't drift from the identity that actually authorized the request.
                var roles = _currentUser.Roles ?? Enumerable.Empty<string>();
                var isPlayerOrFamilyRole = roles.Any(r =>
                    r.Equals("Player", StringComparison.OrdinalIgnoreCase) ||
                    r.Equals("FamilyMember", StringComparison.OrdinalIgnoreCase));

                if (isPlayerOrFamilyRole)
                {
                    var profile = await _db.UserProfiles
                        .AsNoTracking()
                        .FirstOrDefaultAsync(p => p.ApplicationUserId == userId, cancellationToken);

                    // UserProfile.PlayerId stores the TeamPlayer.Id the account was linked to during
                    // onboarding (see VerifyPlayerIdentity), the same ID space as Convocation.TeamPlayerId.
                    if (profile is null ||
                        string.IsNullOrWhiteSpace(profile.PlayerId) ||
                        !string.Equals(profile.PlayerId, conv.TeamPlayerId, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new ForbiddenAccessException("No autorizado para responder la convocatoria de otro jugador.");
                    }

                    // A convocation deconvoked by the coach as "Decisión técnica" is off-limits to
                    // Player/FamilyMember: they cannot change the reason nor the status (including
                    // reactivation), regardless of event type.
                    var isCurrentlyDeconvokedByTechnicalDecision =
                        conv.ConvocationStatusId == ConvocationStatus.FromName("Deconvoke").Id
                        && conv.ExcuseTypeId == TechnicalDecisionExcuseTypeId;

                    if (isCurrentlyDeconvokedByTechnicalDecision)
                    {
                        throw new ForbiddenAccessException("No se puede modificar una desconvocatoria por decisión técnica.");
                    }

                    // Player/FamilyMember may reactivate their own player's Deconvoked convocation
                    // (back to Pending/Accepted) only when the event is a training session. This is
                    // an allow-list check (== TrainingId), so it blocks Match, FriendlyMatch,
                    // Meeting, AccessTrials, Tournament, and any future SportEventType by
                    // construction, without needing to enumerate them.
                    var isReactivatingFromDeconvoke = conv.ConvocationStatusId == ConvocationStatus.FromName("Deconvoke").Id;
                    var targetIsPendingOrAccepted = request.NewStatusId == ConvocationStatus.FromName("Pending").Id
                        || request.NewStatusId == ConvocationStatus.FromName("Accepted").Id;
                    var isTrainingEvent = conv.SportEvent.EventTypeId == SportEventType.TrainingId;

                    if (isReactivatingFromDeconvoke && targetIsPendingOrAccepted && !isTrainingEvent)
                    {
                        throw new ForbiddenAccessException("Solo se puede reactivar una convocatoria desconvocada en eventos de tipo entrenamiento.");
                    }
                }

                // Validate status
                var status = ConvocationStatus.From(request.NewStatusId);
                var wasDeconvoke = conv.ConvocationStatusId == ConvocationStatus.FromName("Deconvoke").Id;
                var isNowDeconvoke = status.Name.Equals("Deconvoke", StringComparison.OrdinalIgnoreCase);

                if (isNowDeconvoke)
                {
                    // Keep provided ExcuseTypeId; fall back to 'Decisión técnica' (id 7) if none
                    // supplied. Delegated to the shared enforcement service (design.md Decisión 4)
                    // so both this manual path and the sanction-triggered path share one code path.
                    await _enforcementService.ForceDeconvocationAsync(
                        conv.TeamPlayerId, conv.SportEventId, request.ExcuseTypeId ?? 7, cancellationToken);

                    // Defensive/legacy-data auto-fulfillment path (design.md Decisión 4): normally
                    // a Deconvocation-type sanction already forced this transition at creation
                    // time, but this covers sanctions created before this capability existed, or
                    // whose forced convocation was later reverted by hand outside the delete/edit
                    // flow.
                    var pendingSportiveSanction = await _db.TeamPlayerSanctions.FirstOrDefaultAsync(s =>
                        s.TeamPlayerId == conv.TeamPlayerId &&
                        s.TargetEventId == conv.SportEventId &&
                        s.SportivePunishmentType == SanctionSportivePunishmentType.Deconvocation &&
                        s.EndDate == null, cancellationToken);
                    if (pendingSportiveSanction is not null)
                    {
                        pendingSportiveSanction.MarkFulfilled(DateTime.UtcNow);
                        conv.SetExcuseTypeId(ExcuseTypes.SportiveSanction.Id);
                    }
                }
                else
                {
                    conv.SetConvocationStatusId(request.NewStatusId);
                    conv.SetExcuseTypeId(null);

                    // Reverse coupling (design.md Decisión 11): reopen a Fulfilled Deconvocation
                    // sanction whenever the convocation it forced is transitioned away from
                    // Deconvoke through this normal endpoint. Allowed even for a past event.
                    if (wasDeconvoke)
                    {
                        var fulfilledSanction = await _db.TeamPlayerSanctions.FirstOrDefaultAsync(s =>
                            s.TeamPlayerId == conv.TeamPlayerId &&
                            s.TargetEventId == conv.SportEventId &&
                            s.SportivePunishmentType == SanctionSportivePunishmentType.Deconvocation &&
                            s.EndDate != null, cancellationToken);
                        fulfilledSanction?.Reopen();
                    }
                }

                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
