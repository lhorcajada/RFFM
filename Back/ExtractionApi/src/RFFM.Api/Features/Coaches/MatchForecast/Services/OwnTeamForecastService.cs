#nullable enable
using Microsoft.Extensions.Options;
using RFFM.Api.Domain.Services.MatchSimulation;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.MatchForecast.Services
{
    public sealed record OwnTeamForecast(IReadOnlyList<ForecastMatch> PendingMatches, int? ProjectedPosition);

    /// <summary>
    /// A pending match of the own team. Probabilities follow the fixture (home = local team), as in the
    /// rival-simulation response, rounded the same way.
    /// </summary>
    public sealed record ForecastMatch(DateOnly? Date, string Opponent, double HomeWinProbability, double DrawProbability, double AwayWinProbability);

    /// <summary>
    /// The own team's pending-match predictions and projected position, from the same simulation that
    /// backs GET /api/teams/{teamId}/match-forecast/simulation.
    /// </summary>
    public sealed class OwnTeamForecastService(AppDbContext appDb, FederationDbContext db, IOptions<RffmOptions> rffmOptions)
    {
        /// <returns>null when the league has no federation calendar yet.</returns>
        public async Task<OwnTeamForecast?> GetAsync(string teamId, CancellationToken ct)
        {
            var simulation = await SimulateAsync(teamId, ct);
            return simulation is null ? null : Project(simulation);
        }

        /// <summary>League, loaded inputs and full simulation result. Null when there is no calendar yet.</summary>
        internal async Task<OwnTeamSimulation?> SimulateAsync(string teamId, CancellationToken ct)
        {
            var league = await RivalStatsLeague.ResolveAsync(appDb, teamId, rffmOptions.Value, ct);
            var data = await new RivalSimulationInputLoader(db, rffmOptions).LoadAsync(league, ct);
            if (data is null) return null;

            return new OwnTeamSimulation(league, data, SeasonSimulator.Run(data.Input));
        }

        private static OwnTeamForecast Project(OwnTeamSimulation simulation)
        {
            var ownCode = simulation.League.OwnTeamCode;
            if (ownCode is null)
                return new OwnTeamForecast([], null);

            var pendingMatches = simulation.Result.Predictions
                .Where(p => p.Match.LocalCode == ownCode || p.Match.VisitorCode == ownCode)
                .Select(p => ToForecastMatch(p, ownCode, simulation.Data.Teams))
                .ToList();

            // The response lists standings in projected order (expected points), so the index is the projected position.
            var standingIndex = simulation.Result.Standings.ToList().FindIndex(s => s.TeamCode == ownCode);
            return new OwnTeamForecast(pendingMatches, standingIndex < 0 ? null : standingIndex + 1);
        }

        private static ForecastMatch ToForecastMatch(MatchPrediction prediction, string ownCode, IReadOnlyDictionary<string, SimTeam> teams)
        {
            var opponentCode = prediction.Match.LocalCode == ownCode ? prediction.Match.VisitorCode : prediction.Match.LocalCode;
            return new ForecastMatch(
                prediction.Match.Date,
                teams[opponentCode].Name,
                Probability(prediction.Outcome.Home),
                Probability(prediction.Outcome.Draw),
                Probability(prediction.Outcome.Away));
        }

        private static double Probability(double value) => Math.Round(value, 4);
    }

    internal sealed record OwnTeamSimulation(RivalStatsLeague League, RivalSimulationData Data, SimulationResult Result);
}
