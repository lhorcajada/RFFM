using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services.MatchSimulation;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.RivalStats.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.RivalStats
{
    /// <summary>
    /// GET /api/teams/{teamId}/rival-stats/simulation — predicción de los partidos pendientes de la liga del
    /// equipo y clasificación proyectada (design.md D6).
    /// IRequest (no IQueryApp): cambia con cada sincronización de resultados y no debe cachearse.
    /// </summary>
    public class GetRivalSimulation : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/rival-stats/simulation",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new RivalSimulationQuery(teamId), cancellationToken);
                        return result is null
                            ? Results.Problem(
                                title: "Calendario no disponible",
                                detail: "Todavía no se ha descargado el calendario de esta liga.",
                                statusCode: StatusCodes.Status404NotFound)
                            : Results.Ok(result);
                    })
                .WithName(nameof(GetRivalSimulation))
                .WithTags(RivalStatsConstants.Feature)
                .Produces<RivalSimulationResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .RequireAuthorization();
        }

        public record RivalSimulationQuery(string TeamId) : IRequest<RivalSimulationResponse?>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record RivalSimulationResponse(int PlayedMatches, int PendingMatches, bool UsesSquadStrength, string? OwnTeamCode,
            int Iterations, List<MatchPredictionResponse> Matches, List<ProjectedStandingResponse> Standings);

        public class Handler(AppDbContext appDb, FederationDbContext db, IOptions<RffmOptions> rffmOptions)
            : IRequestHandler<RivalSimulationQuery, RivalSimulationResponse?>
        {
            public async ValueTask<RivalSimulationResponse?> Handle(RivalSimulationQuery request, CancellationToken cancellationToken)
            {
                var league = await RivalStatsLeague.ResolveAsync(appDb, request.TeamId, rffmOptions.Value, cancellationToken);

                var data = await new RivalSimulationInputLoader(db, rffmOptions).LoadAsync(league, cancellationToken);
                if (data is null) return null;

                var result = SeasonSimulator.Run(data.Input);

                return new RivalSimulationResponse(
                    result.PlayedMatches,
                    result.PendingMatches,
                    data.UsesSquadStrength,
                    league.OwnTeamCode,
                    SeasonSimulator.DefaultIterations,
                    result.Predictions.Select(p => RivalSimulationMapper.ToMatchResponse(p, data.Teams)).ToList(),
                    result.Standings.Select(s => RivalSimulationMapper.ToStandingResponse(s, data.Teams[s.TeamCode])).ToList());
            }
        }
    }
}
