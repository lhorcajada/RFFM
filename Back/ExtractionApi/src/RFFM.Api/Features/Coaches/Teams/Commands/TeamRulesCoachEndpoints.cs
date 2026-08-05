using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Mobile.Teams.Commands;
using RFFM.Api.Features.Mobile.Teams.Queries;

namespace RFFM.Api.Features.Coaches.Teams.Commands
{
    /// <summary>
    /// Coach-app (Front SPA) route namespace for team rules ("Normas del equipo"). Registers
    /// <c>api/coaches/teams/{teamId}/rules</c> GET/PUT/DELETE, delegating to the exact same
    /// Mediator command/query types as the Mobile namespace
    /// (<see cref="RFFM.Api.Features.Mobile.Teams.Queries.GetTeamRules"/>,
    /// <see cref="SaveTeamRules"/>, <see cref="DeleteTeamRules"/>) — no duplicated business logic,
    /// per design.md Decision 2 of the <c>structured-team-rules</c> openspec change.
    /// </summary>
    public class TeamRulesCoachEndpoints : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("api/coaches/teams/{teamId}/rules",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new GetTeamRules.GetTeamRulesQuery { TeamId = teamId };
                        var result = await mediator.Send(query, cancellationToken);
                        return result != null ? Results.Ok(result) : Results.NoContent();
                    })
                .WithName("GetTeamRulesForCoach")
                .WithTags(TeamConstants.TeamFeature)
                .RequireAuthorization()
                .Produces<GetTeamRules.TeamRulesDto>(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status404NotFound);

            app.MapPut("api/coaches/teams/{teamId}/rules",
                    async (string teamId, SaveTeamRules.SaveTeamRulesCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(command with { TeamId = teamId }, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName("SaveTeamRulesForCoach")
                .WithTags(TeamConstants.TeamFeature)
                .RequireAuthorization()
                .Produces<GetTeamRules.TeamRulesDto>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);

            app.MapDelete("api/coaches/teams/{teamId}/rules",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(new DeleteTeamRules.DeleteTeamRulesCommand { TeamId = teamId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName("DeleteTeamRulesForCoach")
                .WithTags(TeamConstants.TeamFeature)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }
}
