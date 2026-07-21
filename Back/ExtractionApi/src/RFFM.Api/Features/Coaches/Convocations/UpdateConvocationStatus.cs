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
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
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
                }

                // Validate status
                var status = ConvocationStatus.From(request.NewStatusId);
                conv.SetConvocationStatusId(request.NewStatusId);

                if (status.Name.Equals("Deconvoke", StringComparison.OrdinalIgnoreCase))
                {
                    // Keep provided ExcuseTypeId; fall back to 'Decisión técnica' (id 7) if none supplied
                    conv.SetExcuseTypeId(request.ExcuseTypeId ?? 7);
                }
                else
                {
                    conv.SetExcuseTypeId(null);
                }

                await _db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
