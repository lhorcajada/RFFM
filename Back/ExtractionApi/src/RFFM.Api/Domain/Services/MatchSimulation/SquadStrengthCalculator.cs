namespace RFFM.Api.Domain.Services.MatchSimulation
{
    /// <summary>
    /// Fuerza relativa de cada plantilla (1 = media de la liga) a partir de la temporada anterior de sus
    /// jugadores: nivel de la competición en que jugaron + puesto en su grupo, ponderado por su implicación
    /// en la temporada actual (design.md D2 de rival-simulation-competition-level).
    /// </summary>
    public static class SquadStrengthCalculator
    {
        public const double MinStrength = 0.5;
        public const double MaxStrength = 2;

        private const double StrengthSpread = 0.6;
        private const double BestParticipationWeight = 0.7;
        private const double StarterWeight = 0.2;
        private const double GoalsWeight = 0.1;
        private const double MaxGoalsPerMatch = 1.5;
        private const double NewPlayerPenalty = 0.25;
        private const int MinGroupSize = 16;
        private const double BaseCurrentWeight = 0.25;
        private const double SubstituteWeight = 0.5;

        public static IReadOnlyDictionary<string, double> Calculate(IReadOnlyCollection<string> teamCodes,
            IReadOnlyDictionary<string, IReadOnlyList<SimPlayer>> squads)
        {
            var squadsWithPlayers = teamCodes
                .Where(code => squads.TryGetValue(code, out var players) && players.Count > 0)
                .ToDictionary(code => code, code => squads[code]);

            var allPlayers = squadsWithPlayers.Values.SelectMany(p => p).ToList();
            var participations = allPlayers.SelectMany(p => p.PreviousParticipations).ToList();
            var context = new LeagueContext(
                participations.GroupBy(GroupKey).ToDictionary(g => g.Key, g => g.Max(p => p.TeamPosition)),
                participations
                    .Select(p => CompetitionLevel.AgeCategory(p.CompetitionName))
                    .Where(age => age.HasValue)
                    .GroupBy(age => age!.Value)
                    .OrderByDescending(g => g.Count())
                    .Select(g => g.Key)
                    .FirstOrDefault());

            var knownValues = allPlayers.Select(p => PlayerValue(p, context)).Where(v => v.HasValue).Select(v => v!.Value).ToList();
            var newPlayerValue = (knownValues.Count > 0 ? knownValues.Average() : 0) - NewPlayerPenalty;

            var teamValues = squadsWithPlayers.ToDictionary(
                s => s.Key,
                s => WeightedValue(s.Value, context, newPlayerValue));
            var meanValue = teamValues.Count > 0 ? teamValues.Values.Average() : 0;

            return teamCodes.Distinct().ToDictionary(code => code, code =>
                teamValues.TryGetValue(code, out var value)
                    ? Math.Clamp(Math.Exp(StrengthSpread * (value - meanValue)), MinStrength, MaxStrength)
                    : 1d);
        }

        private sealed record LeagueContext(IReadOnlyDictionary<string, int> GroupSizes, int DefaultAgeCategory);

        private static double WeightedValue(IReadOnlyList<SimPlayer> players, LeagueContext context, double newPlayerValue)
        {
            var weighted = players.Select(p => (
                Weight: BaseCurrentWeight + p.CurrentStarter + SubstituteWeight * p.CurrentSubstitute,
                Value: PlayerValue(p, context) ?? newPlayerValue)).ToList();

            return weighted.Sum(w => w.Weight * w.Value) / weighted.Sum(w => w.Weight);
        }

        /// <returns>null si el jugador no tiene temporada anterior con alguna participación de nivel reconocible.</returns>
        private static double? PlayerValue(SimPlayer player, LeagueContext context)
        {
            if (!player.HasPreviousSeason) return null;

            var values = player.PreviousParticipations
                .Select(p => ParticipationValue(p, context))
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();
            if (values.Count == 0) return null;

            var starterRate = player.PreviousCalled > 0 ? Math.Min((double)player.PreviousStarter / player.PreviousCalled, 1) : 0;
            var goalRate = player.PreviousPlayed > 0
                ? Math.Min((double)player.PreviousGoals / player.PreviousPlayed, MaxGoalsPerMatch) / MaxGoalsPerMatch
                : 0;

            return BestParticipationWeight * values.Max() + (1 - BestParticipationWeight) * values.Average()
                   + StarterWeight * starterRate + GoalsWeight * goalRate;
        }

        private static double? ParticipationValue(SimPlayerParticipation participation, LeagueContext context)
        {
            var division = CompetitionLevel.Division(participation.CompetitionName);
            if (division is null) return null;

            var level = division.Value + (CompetitionLevel.AgeCategory(participation.CompetitionName) ?? context.DefaultAgeCategory);
            return level + PositionScore(participation, context);
        }

        private static double PositionScore(SimPlayerParticipation participation, LeagueContext context)
        {
            if (participation.TeamPosition <= 0) return 0.5;

            var groupSize = Math.Max(context.GroupSizes.GetValueOrDefault(GroupKey(participation)),
                Math.Max(participation.TeamPosition, MinGroupSize));
            return 1 - (double)(participation.TeamPosition - 1) / (groupSize - 1);
        }

        private static string GroupKey(SimPlayerParticipation participation) =>
            $"{participation.CompetitionName.Trim()}|{participation.GroupName.Trim()}".ToUpperInvariant();
    }
}
