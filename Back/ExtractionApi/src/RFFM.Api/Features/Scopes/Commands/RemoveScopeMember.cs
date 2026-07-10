using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Scopes.Commands
{
    public class RemoveScopeMember : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/scopes/members/{membershipId}",
                    async (string membershipId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }

                        var command = new RemoveScopeMemberCommand
                        {
                            CallerUserId = userId,
                            MembershipId = membershipId
                        };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(RemoveScopeMember))
                .WithTags(ScopesConstants.ScopesFeature)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status402PaymentRequired)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class RemoveScopeMemberCommand : IRequest<IResult>
    {
        public string CallerUserId { get; set; } = string.Empty;
        public string MembershipId { get; set; } = string.Empty;
    }

    public class RemoveScopeMemberHandler : IRequestHandler<RemoveScopeMemberCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;

        public RemoveScopeMemberHandler(AppDbContext db, IScopeAuthorizationService scopeAuth)
        {
            _db = db;
            _scopeAuth = scopeAuth;
        }

        public async ValueTask<IResult> Handle(RemoveScopeMemberCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.MembershipId))
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "MembershipId requerido",
                    Detail = "El identificador del miembro es obligatorio."
                });
            }

            var clubLink = await _db.UserClubs
                .FirstOrDefaultAsync(uc => uc.Id == request.MembershipId, cancellationToken);
            if (clubLink is not null)
            {
                return await RemoveFromClubAsync(clubLink, request.CallerUserId, cancellationToken);
            }

            var teamLink = await _db.UserTeams
                .FirstOrDefaultAsync(ut => ut.Id == request.MembershipId, cancellationToken);
            if (teamLink is not null)
            {
                return await RemoveFromTeamAsync(teamLink, request.CallerUserId, cancellationToken);
            }

            return Results.NotFound(new ProblemDetails
            {
                Title = "Miembro no encontrado",
                Detail = "No se encontró el vínculo indicado."
            });
        }

        private async Task<IResult> RemoveFromClubAsync(
            Domain.Aggregates.UserClubs.UserClub link, string callerUserId, CancellationToken cancellationToken)
        {
            if (link.ApplicationUserId == callerUserId)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "No puedes desvincularte a ti mismo",
                    Detail = "Utiliza el endpoint de abandono de espacio en su lugar."
                });
            }

            if (link.IsCreator)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "No se puede desvincular a un creador",
                    Detail = "No es posible desvincular a un creador del scope."
                });
            }

            var auth = await _scopeAuth.EnsureCreatorAsync(callerUserId, ScopeKinds.Club, link.ClubId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            var eviction = await _scopeAuth.EnsureSubscriptionActiveOrEvictAsync(auth.Scope!, cancellationToken);
            if (!eviction.IsActive)
            {
                return Results.Problem(statusCode: eviction.Status, title: eviction.Title, detail: eviction.Detail);
            }

            _db.UserClubs.Remove(link);
            await _db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        }

        private async Task<IResult> RemoveFromTeamAsync(
            Domain.Aggregates.UserClubs.UserTeam link, string callerUserId, CancellationToken cancellationToken)
        {
            if (link.ApplicationUserId == callerUserId)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "No puedes desvincularte a ti mismo",
                    Detail = "Utiliza el endpoint de abandono de espacio en su lugar."
                });
            }

            if (link.IsCreator)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "No se puede desvincular a un creador",
                    Detail = "No es posible desvincular a un creador del scope."
                });
            }

            var auth = await _scopeAuth.EnsureCreatorAsync(callerUserId, ScopeKinds.Team, link.TeamId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            var eviction = await _scopeAuth.EnsureSubscriptionActiveOrEvictAsync(auth.Scope!, cancellationToken);
            if (!eviction.IsActive)
            {
                return Results.Problem(statusCode: eviction.Status, title: eviction.Title, detail: eviction.Detail);
            }

            _db.UserTeams.Remove(link);
            await _db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        }
    }
}
