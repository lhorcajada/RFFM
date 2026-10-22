using RFFM.Api.Domain.Services.MatchSimulation;

namespace RFFM.Api.Features.Coaches.RivalStats
{
    public record MatchPredictionResponse(int Round, DateOnly? Date,
        string LocalTeamCode, string LocalTeamName, string? LocalShieldUrl,
        string VisitorTeamCode, string VisitorTeamName, string? VisitorShieldUrl,
        double LocalWinProbability, double DrawProbability, double VisitorWinProbability,
        double LocalExpectedGoals, double VisitorExpectedGoals, int MostLikelyLocalGoals, int MostLikelyVisitorGoals);

    public record ProjectedStandingResponse(string TeamCode, string TeamName, string? ShieldUrl,
        int CurrentPosition, int CurrentPoints, double ExpectedPoints, int MostLikelyPosition,
        double ChampionProbability, List<double> PositionProbabilities,
        double Attack, double Defense, double SquadStrength);

    /// <summary>Convierte el resultado del simulador en los contratos de la API (con sus redondeos).</summary>
    public static class RivalSimulationMapper
    {
        public static MatchPredictionResponse ToMatchResponse(MatchPrediction p, IReadOnlyDictionary<string, SimTeam> teams)
        {
            var local = teams[p.Match.LocalCode];
            var visitor = teams[p.Match.VisitorCode];
            return new MatchPredictionResponse(p.Match.Round, p.Match.Date,
                local.Code, local.Name, local.ShieldUrl,
                visitor.Code, visitor.Name, visitor.ShieldUrl,
                Probability(p.Outcome.Home), Probability(p.Outcome.Draw), Probability(p.Outcome.Away),
                Rating(p.LocalExpectedGoals), Rating(p.VisitorExpectedGoals),
                p.Outcome.MostLikelyLocalGoals, p.Outcome.MostLikelyVisitorGoals);
        }

        public static ProjectedStandingResponse ToStandingResponse(ProjectedStanding s, SimTeam team) => new(
            team.Code, team.Name, team.ShieldUrl,
            s.CurrentPosition, s.CurrentPoints, Rating(s.ExpectedPoints), s.MostLikelyPosition,
            Probability(s.ChampionProbability), s.PositionProbabilities.Select(Probability).ToList(),
            Rating(s.Attack), Rating(s.Defense), Rating(s.SquadStrength));

        private static double Probability(double value) => Math.Round(value, 4);

        private static double Rating(double value) => Math.Round(value, 2);
    }
}
