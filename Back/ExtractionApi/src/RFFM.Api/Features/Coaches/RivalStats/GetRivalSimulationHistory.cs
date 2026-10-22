using System.Text.Json;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Domain.Services.MatchSimulation;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.RivalStats.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.RivalStats
{
    /// <summary>
    /// GET /api/teams/{teamId}/rival-stats/simulation/rounds — simulaciones guardadas por jornada frente a los
    /// resultados reales (acierto 1X2) y clasificación proyectada de cada jornada (design.md D4).
    /// IRequest (no IQueryApp): cambia con cada resultado y no debe cachearse.
    /// </summary>
    public class GetRivalSimulationHistory : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/rival-stats/simulation/rounds",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                        Results.Ok(await mediator.Send(new RivalSimulationHistoryQuery(teamId), cancellationToken)))
                .WithName(nameof(GetRivalSimulationHistory))
                .WithTags(RivalStatsConstants.Feature)
                .Produces<RivalSimulationHistoryResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .RequireAuthorization();
        }

        public record RivalSimulationHistoryQuery(string TeamId) : IRequest<RivalSimulationHistoryResponse>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record RivalSimulationHistoryResponse(string? OwnTeamCode, int TotalHits, int TotalEvaluated, List<RoundSimulationResponse> Rounds);

        public record RoundSimulationResponse(int Round, DateOnly? Date, string Status, bool IsFrozen, bool IsBackfilled, DateTime ComputedAt,
            int PlayedMatchesUsed, bool UsesSquadStrength, int Hits, int Evaluated,
            List<RoundMatchResponse> Matches, List<RoundStandingResponse> Standings);

        public record RoundMatchResponse(int Round, DateOnly? Date,
            string LocalTeamCode, string LocalTeamName, string? LocalShieldUrl,
            string VisitorTeamCode, string VisitorTeamName, string? VisitorShieldUrl,
            double LocalWinProbability, double DrawProbability, double VisitorWinProbability,
            double LocalExpectedGoals, double VisitorExpectedGoals, int MostLikelyLocalGoals, int MostLikelyVisitorGoals,
            string PredictedOutcome, int? ActualLocalGoals, int? ActualVisitorGoals, string? ActualOutcome, bool? Hit);

        public record RoundStandingResponse(string TeamCode, string TeamName, string? ShieldUrl,
            int CurrentPosition, int CurrentPoints, double ExpectedPoints, int MostLikelyPosition,
            double ChampionProbability, List<double> PositionProbabilities,
            double Attack, double Defense, double SquadStrength, int? ActualPosition, int? ActualPoints);

        public class Handler(AppDbContext appDb, FederationDbContext db, RivalSimulationInputLoader loader,
            IOptions<RffmOptions> rffmOptions, TimeProvider timeProvider)
            : IRequestHandler<RivalSimulationHistoryQuery, RivalSimulationHistoryResponse>
        {
            public async ValueTask<RivalSimulationHistoryResponse> Handle(RivalSimulationHistoryQuery request, CancellationToken cancellationToken)
            {
                var league = await RivalStatsLeague.ResolveAsync(appDb, request.TeamId, rffmOptions.Value, cancellationToken);

                var data = await loader.LoadAsync(league, cancellationToken);
                if (data is null) return new RivalSimulationHistoryResponse(league.OwnTeamCode, 0, 0, []);

                var simulations = await db.RffmRoundSimulations
                    .AsNoTracking()
                    .Where(s => s.GroupCode == league.GroupCode)
                    .OrderBy(s => s.Round)
                    .ToListAsync(cancellationToken);

                var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
                var calendar = data.Input.Calendar;
                var actualStandings = SeasonSimulator.CurrentStandings(data.Input).ToDictionary(s => s.TeamCode);

                var rounds = simulations.Select(s => ToRound(s, calendar, actualStandings, today)).ToList();
                return new RivalSimulationHistoryResponse(league.OwnTeamCode, rounds.Sum(r => r.Hits), rounds.Sum(r => r.Evaluated), rounds);
            }

            private static RoundSimulationResponse ToRound(RffmRoundSimulation simulation, IReadOnlyList<SimMatch> calendar,
                IReadOnlyDictionary<string, CurrentStanding> actualStandings, DateOnly today)
            {
                var roundMatches = calendar.Where(m => m.Round == simulation.Round).ToList();
                var date = roundMatches.Where(m => m.Date.HasValue).Select(m => m.Date).Min();

                var matches = Deserialize<MatchPredictionResponse>(simulation.MatchesJson)
                    .Select(p => ToMatch(p, roundMatches.FirstOrDefault(m => m.LocalCode == p.LocalTeamCode && m.VisitorCode == p.VisitorTeamCode)))
                    .ToList();
                var standings = Deserialize<ProjectedStandingResponse>(simulation.StandingsJson)
                    .Select(s => ToStanding(s, actualStandings.GetValueOrDefault(s.TeamCode)))
                    .ToList();

                return new RoundSimulationResponse(simulation.Round, date, RoundSimulationPolicy.Status(roundMatches, today).ToString(),
                    simulation.IsFrozen, simulation.IsBackfilled, simulation.ComputedAt, simulation.PlayedMatchesUsed, simulation.UsesSquadStrength,
                    matches.Count(m => m.Hit == true), matches.Count(m => m.Hit.HasValue), matches, standings);
            }

            private static RoundMatchResponse ToMatch(MatchPredictionResponse p, SimMatch? actual)
            {
                var predicted = RoundSimulationPolicy.PredictedOutcome(
                    new MatchOutcome(p.LocalWinProbability, p.DrawProbability, p.VisitorWinProbability, p.MostLikelyLocalGoals, p.MostLikelyVisitorGoals));
                MatchOutcomeKind? actualOutcome = actual is { HasResult: true }
                    ? RoundSimulationPolicy.ActualOutcome(actual.LocalGoals!.Value, actual.VisitorGoals!.Value)
                    : null;

                return new RoundMatchResponse(p.Round, p.Date,
                    p.LocalTeamCode, p.LocalTeamName, p.LocalShieldUrl,
                    p.VisitorTeamCode, p.VisitorTeamName, p.VisitorShieldUrl,
                    p.LocalWinProbability, p.DrawProbability, p.VisitorWinProbability,
                    p.LocalExpectedGoals, p.VisitorExpectedGoals, p.MostLikelyLocalGoals, p.MostLikelyVisitorGoals,
                    predicted.ToString(),
                    actualOutcome.HasValue ? actual!.LocalGoals : null,
                    actualOutcome.HasValue ? actual!.VisitorGoals : null,
                    actualOutcome?.ToString(),
                    actualOutcome.HasValue ? actualOutcome == predicted : null);
            }

            private static RoundStandingResponse ToStanding(ProjectedStandingResponse s, CurrentStanding? actual) => new(
                s.TeamCode, s.TeamName, s.ShieldUrl, s.CurrentPosition, s.CurrentPoints, s.ExpectedPoints, s.MostLikelyPosition,
                s.ChampionProbability, s.PositionProbabilities, s.Attack, s.Defense, s.SquadStrength,
                actual?.Position, actual?.Points);

            private static List<T> Deserialize<T>(string json) =>
                JsonSerializer.Deserialize<List<T>>(json, RivalRoundSimulationService.JsonOptions) ?? [];
        }
    }
}
