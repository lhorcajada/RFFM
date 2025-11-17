using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Teams.Models;
using RFFM.Api.Features.Teams.Services;

namespace RFFM.Api.Features.Teams.Queries
{
    public class GetTeam : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams/{teamId}",
                    async (IMediator mediator, CancellationToken cancellationToken, int teamId) =>
                    {
                        var request = new Query(teamId);

                        var response = await mediator.Send(request, cancellationToken);

                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName(nameof(GetTeam))
                .WithTags(TeamsConstants.TeamsFeature)
                .Produces<Team>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record Query(int TeamId) : Common.IQuery<Team>
        {

        }

        public class RequestHandler : IRequestHandler<Query, Team>
        {
            private readonly ITeamService _teamService;

            public RequestHandler(ITeamService teamService)
            {
                _teamService = teamService;
            }

            public async ValueTask<Team> Handle(Query request, CancellationToken cancellationToken)
            {
                return await _teamService.GetTeamDetailsAsync(request.TeamId.ToString(), cancellationToken);
            }
        };
    }
}
