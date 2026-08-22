using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Commands;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    public class GetTeamPlayerLinkCode : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/team-players/{teamPlayerId}/link-code",
                    async (string teamPlayerId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        return await mediator.Send(new GetTeamPlayerLinkCodeQuery
                        {
                            TeamPlayerId = teamPlayerId,
                            CallerUserId = userId
                        }, cancellationToken);
                    })
                .WithName(nameof(GetTeamPlayerLinkCode))
                .WithTags("TeamPlayerLinkRequestsFeature")
                .RequireAuthorization()
                .Produces<TeamPlayerLinkCodeResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class GetTeamPlayerLinkCodeQuery : IRequest<IResult>, IRequireFeaturePermission
    {
        public string TeamPlayerId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.TeamPlayerLinkRequests;
        public string RequiredPermission => "Read";
    }

    public class GetTeamPlayerLinkCodeHandler : IRequestHandler<GetTeamPlayerLinkCodeQuery, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;

        public GetTeamPlayerLinkCodeHandler(AppDbContext db, IScopeAuthorizationService scopeAuth)
        {
            _db = db;
            _scopeAuth = scopeAuth;
        }

        public async ValueTask<IResult> Handle(GetTeamPlayerLinkCodeQuery request, CancellationToken cancellationToken)
        {
            var teamPlayer = await _db.TeamPlayers.FirstOrDefaultAsync(tp => tp.Id == request.TeamPlayerId, cancellationToken);
            if (teamPlayer is null)
            {
                return Results.NotFound(new ProblemDetails
                {
                    Title = "Jugador no encontrado",
                    Detail = "No existe el jugador indicado."
                });
            }

            var auth = await _scopeAuth.EnsureMemberAsync(request.CallerUserId, ScopeKinds.Team, teamPlayer.TeamId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            // Lazy generation: if no LinkCode yet, generate and persist
            if (teamPlayer.LinkCode is null)
            {
                teamPlayer.GenerateLinkCode();
                await _db.SaveChangesAsync(cancellationToken);
            }

            return Results.Ok(new TeamPlayerLinkCodeResponse { TeamPlayerId = teamPlayer.Id, LinkCode = teamPlayer.LinkCode });
        }
    }
}
