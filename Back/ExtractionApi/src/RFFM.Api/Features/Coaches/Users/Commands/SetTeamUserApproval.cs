using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Users.Commands
{
    public class SetTeamUserApproval : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/coaches/team-users/{membershipId}/approval",
                    async (string membershipId, SetApprovalRequest request, IMediator mediator,
                           HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var command = new Command
                        {
                            CallerUserId = userId,
                            MembershipId = membershipId,
                            Approved = request.Approved
                        };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(SetTeamUserApproval))
                .WithTags(UserConstants.UserFeature)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status402PaymentRequired)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        public record SetApprovalRequest(bool Approved);

        public class Command : IRequest<IResult>
        {
            public string CallerUserId { get; set; } = string.Empty;
            public string MembershipId { get; set; } = string.Empty;
            public bool Approved { get; set; }
        }

        public class Handler : IRequestHandler<Command, IResult>
        {
            private readonly AppDbContext _db;
            private readonly UserManager<IdentityUser> _userManager;
            private readonly IScopeAuthorizationService _scopeAuth;

            public Handler(AppDbContext db, UserManager<IdentityUser> userManager, IScopeAuthorizationService scopeAuth)
            {
                _db = db;
                _userManager = userManager;
                _scopeAuth = scopeAuth;
            }

            public async ValueTask<IResult> Handle(Command request, CancellationToken cancellationToken)
            {
                if (string.IsNullOrWhiteSpace(request.MembershipId))
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "MembershipId requerido",
                        Detail = "El identificador del miembro es obligatorio."
                    });
                }

                var teamTarget = await _db.UserTeams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(ut => ut.Id == request.MembershipId, cancellationToken);

                var clubTarget = teamTarget is null
                    ? await _db.UserClubs
                        .AsNoTracking()
                        .FirstOrDefaultAsync(uc => uc.Id == request.MembershipId, cancellationToken)
                    : null;

                if (teamTarget is null && clubTarget is null)
                {
                    return Results.NotFound(new ProblemDetails
                    {
                        Title = "Miembro no encontrado",
                        Detail = "No se encontró el vínculo indicado."
                    });
                }

                var targetApplicationUserId = teamTarget?.ApplicationUserId ?? clubTarget!.ApplicationUserId;
                var targetRoleId = teamTarget?.RoleId ?? clubTarget!.RoleId;

                if (targetApplicationUserId == request.CallerUserId)
                {
                    return Results.BadRequest(new ProblemDetails
                    {
                        Title = "No puedes cambiar tu propia aprobación",
                        Detail = "No es posible aprobar o desaprobar tu propia cuenta desde esta pantalla."
                    });
                }

                var isCoachTier = targetRoleId == Membership.Coach.Id || targetRoleId == Membership.Directive.Id;

                var auth = teamTarget is not null
                    ? isCoachTier
                        ? await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Team, teamTarget.TeamId, cancellationToken)
                        : await _scopeAuth.EnsureMemberAsync(request.CallerUserId, ScopeKinds.Team, teamTarget.TeamId, cancellationToken)
                    : isCoachTier
                        ? await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Club, clubTarget!.ClubId, cancellationToken)
                        : await _scopeAuth.EnsureMemberAsync(request.CallerUserId, ScopeKinds.Club, clubTarget!.ClubId, cancellationToken);
                if (!auth.Authorized)
                {
                    var detail = isCoachTier
                        ? "Solo el creador del espacio puede aprobar o desaprobar a otro entrenador."
                        : auth.Detail;
                    return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: detail);
                }

                var eviction = await _scopeAuth.EnsureSubscriptionActiveOrEvictAsync(auth.Scope!, cancellationToken);
                if (!eviction.IsActive)
                {
                    return Results.Problem(statusCode: eviction.Status, title: eviction.Title, detail: eviction.Detail);
                }

                var identityUser = await _userManager.FindByIdAsync(targetApplicationUserId);
                if (identityUser is null)
                {
                    return Results.NotFound(new ProblemDetails
                    {
                        Title = "Usuario no encontrado",
                        Detail = "No se encontró la cuenta asociada a este miembro."
                    });
                }

                identityUser.EmailConfirmed = request.Approved;
                await _userManager.UpdateAsync(identityUser);

                return Results.NoContent();
            }
        }
    }
}
