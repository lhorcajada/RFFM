namespace RFFM.Api.Domain.Services.MatchSimulation
{
    /// <summary>
    /// Fuerza relativa de cada plantilla (1 = media de la liga) a partir de la temporada anterior de sus
    /// jugadores, ponderada por su implicación en la temporada actual (design.md D2).
    /// </summary>
    public static class SquadStrengthCalculator
    {
        public const double MinStrength = 0.6;
        public const double MaxStrength = 1.6;

        private const double PositionWeight = 0.60;
        private const double StarterWeight = 0.25;
        private const double GoalsWeight = 0.15;
        private const double MaxGoalsPerMatch = 1.5;
        private const double NewPlayerFactor = 0.95;
        private const double NeutralQuality = 0.5;
        private const int MinGroupSize = 10;
        private const double BaseCurrentWeight = 0.25;
        private const double SubstituteWeight = 0.5;

        public static IReadOnlyDictionary<string, double> Calculate(IReadOnlyCollection<string> teamCodes,
            IReadOnlyDictionary<string, IReadOnlyList<SimPlayer>> squads)
        {
            var squadsWithPlayers = teamCodes
                .Where(code => squads.TryGetValue(code, out var players) && players.Count > 0)
                .ToDictionary(code => code, code => squads[code]);

            var allPlayers = squadsWithPlayers.Values.SelectMany(p => p).ToList();
            var groupSizes = allPlayers
                .SelectMany(p => p.PreviousParticipations)
                .GroupBy(GroupKey)
                .ToDictionary(g => g.Key, g => g.Max(p => p.TeamPosition));

            var veteranQualities = allPlayers.Where(p => p.HasPreviousSeason).Select(p => VeteranQuality(p, groupSizes)).ToList();
            var leagueQuality = veteranQualities.Count > 0 ? veteranQualities.Average() : NeutralQuality;

            var teamQualities = squadsWithPlayers.ToDictionary(
                s => s.Key,
                s => WeightedQuality(s.Value, groupSizes, leagueQuality));
            var meanQuality = teamQualities.Count > 0 ? teamQualities.Values.Average() : 0;

            return teamCodes.Distinct().ToDictionary(code => code, code =>
            {
                var hasSquad = teamQualities.TryGetValue(code, out var quality) && meanQuality > 0;
                return hasSquad ? Math.Clamp(quality / meanQuality, MinStrength, MaxStrength) : 1d;
            });
        }

        private static double WeightedQuality(IReadOnlyList<SimPlayer> players, IReadOnlyDictionary<string, int> groupSizes,
            double leagueQuality)
        {
            var weighted = players.Select(p => (
                Weight: BaseCurrentWeight + p.CurrentStarter + SubstituteWeight * p.CurrentSubstitute,
                Quality: p.HasPreviousSeason ? VeteranQuality(p, groupSizes) : NewPlayerFactor * leagueQuality)).ToList();

            return weighted.Sum(w => w.Weight * w.Quality) / weighted.Sum(w => w.Weight);
        }

        private static double VeteranQuality(SimPlayer player, IReadOnlyDictionary<string, int> groupSizes)
        {
            var positionScore = player.PreviousParticipations.Count > 0
                ? player.PreviousParticipations.Average(p => PositionScore(p, groupSizes))
                : NeutralQuality;
            var starterRate = player.PreviousCalled > 0 ? (double)player.PreviousStarter / player.PreviousCalled : 0;
            var goalRate = player.PreviousPlayed > 0
                ? Math.Min((double)player.PreviousGoals / player.PreviousPlayed, MaxGoalsPerMatch) / MaxGoalsPerMatch
                : 0;

            return PositionWeight * positionScore + StarterWeight * Math.Min(starterRate, 1) + GoalsWeight * goalRate;
        }

        private static double PositionScore(SimPlayerParticipation participation, IReadOnlyDictionary<string, int> groupSizes)
        {
            if (participation.TeamPosition <= 0) return NeutralQuality;

            var groupSize = Math.Max(groupSizes.GetValueOrDefault(GroupKey(participation)), Math.Max(participation.TeamPosition, MinGroupSize));
            return 1 - (double)(participation.TeamPosition - 1) / (groupSize - 1);
        }

        private static string GroupKey(SimPlayerParticipation participation) =>
            $"{participation.CompetitionName.Trim()}|{participation.GroupName.Trim()}".ToUpperInvariant();
    }
}
