namespace RFFM.Api.Domain.Services.MatchSimulation
{
    public enum RoundStatus { Upcoming, InProgress, Played }

    public enum MatchOutcomeKind { Home, Draw, Away }

    /// <summary>Estado de las jornadas y resultado 1X2 de predicciones y partidos (design.md D2).</summary>
    public static class RoundSimulationPolicy
    {
        public static RoundStatus Status(IReadOnlyList<SimMatch> roundMatches, DateOnly today)
        {
            if (roundMatches.Count > 0 && roundMatches.All(m => m.HasResult))
                return RoundStatus.Played;

            var hasAnyResult = roundMatches.Any(m => m.HasResult);
            var firstDate = roundMatches.Where(m => m.Date.HasValue).Select(m => m.Date!.Value).DefaultIfEmpty(DateOnly.MaxValue).Min();
            return hasAnyResult || firstDate <= today ? RoundStatus.InProgress : RoundStatus.Upcoming;
        }

        public static IReadOnlyList<int> RoundsToSimulate(IReadOnlyList<SimMatch> calendar, DateOnly today)
        {
            var rounds = new List<int>();
            foreach (var round in calendar.GroupBy(m => m.Round).OrderBy(g => g.Key))
            {
                rounds.Add(round.Key);
                if (Status(round.ToList(), today) == RoundStatus.Upcoming)
                    break;
            }
            return rounds;
        }

        public static MatchOutcomeKind PredictedOutcome(MatchOutcome outcome)
        {
            if (outcome.Draw >= outcome.Home && outcome.Draw >= outcome.Away) return MatchOutcomeKind.Draw;
            return outcome.Home >= outcome.Away ? MatchOutcomeKind.Home : MatchOutcomeKind.Away;
        }

        public static MatchOutcomeKind ActualOutcome(int localGoals, int visitorGoals) =>
            localGoals > visitorGoals ? MatchOutcomeKind.Home
            : localGoals < visitorGoals ? MatchOutcomeKind.Away
            : MatchOutcomeKind.Draw;
    }
}
