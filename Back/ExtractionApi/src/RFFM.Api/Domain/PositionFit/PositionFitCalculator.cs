namespace RFFM.Api.Domain.PositionFit
{
    /// <summary>How much a trait counts for a position. The numeric value is the weight used in the fit.</summary>
    public enum TraitWeight
    {
        Indifferent = 0,
        Sum = 1,
        Key = 3,
    }

    public static class TraitWeightKeys
    {
        public static string ToKey(TraitWeight weight) => weight switch
        {
            TraitWeight.Key => "key",
            TraitWeight.Sum => "sum",
            _ => "indifferent",
        };

        public static TraitWeight? TryParse(string? key) => key switch
        {
            "key" => TraitWeight.Key,
            "sum" => TraitWeight.Sum,
            "indifferent" => TraitWeight.Indifferent,
            _ => null,
        };
    }

    public static class DefaultTraitWeights
    {
        private const TraitWeight K = TraitWeight.Key;
        private const TraitWeight S = TraitWeight.Sum;
        private const TraitWeight I = TraitWeight.Indifferent;

        // Order follows TraitCatalog.All:
        // OccupiesZone, BuildsUnderPressure, BreaksLines, BeatsOneOnOne, ArrivesAndFinishes,
        // Coverage, Pressing, Duels, ReactsToLoss, FirstActionAfterRecovery, RoleDiscipline, SustainedIntensity
        private static readonly Dictionary<FitPosition, TraitWeight[]> Matrix = new()
        {
            [FitPosition.CenterBack] =          [K, K, S, I, I, K, S, K, K, S, K, S],
            [FitPosition.FullBack] =            [K, S, S, K, S, K, S, S, K, K, K, K],
            [FitPosition.DefensiveMidfielder] = [K, K, S, I, I, K, K, K, K, S, K, S],
            [FitPosition.Midfielder] =          [S, S, K, S, K, S, K, S, K, K, K, K],
            [FitPosition.AttackingMidfielder] = [S, S, K, K, K, I, S, I, S, K, S, K],
            [FitPosition.Winger] =              [S, I, S, K, K, S, K, S, K, K, S, K],
            [FitPosition.Forward] =             [S, I, S, K, K, I, K, K, S, K, S, K],
        };

        public static IReadOnlyDictionary<string, TraitWeight> For(FitPosition position)
        {
            if (!Matrix.TryGetValue(position, out var weights))
                return new Dictionary<string, TraitWeight>();

            return TraitCatalog.All
                .Select((trait, index) => (trait.Key, Weight: weights[index]))
                .ToDictionary(item => item.Key, item => item.Weight);
        }
    }

    public static class PositionFitCalculator
    {
        /// <summary>
        /// Weighted average of the trait levels (1–5) using the position weights. Indifferent traits and
        /// traits without a level are ignored. Returns null when no counting trait has a level.
        /// </summary>
        public static decimal? Calculate(
            IReadOnlyDictionary<string, int> levels,
            IReadOnlyDictionary<string, TraitWeight> weights)
        {
            decimal weightedSum = 0m;
            decimal totalWeight = 0m;

            foreach (var (traitKey, weight) in weights)
            {
                if (weight == TraitWeight.Indifferent || !levels.TryGetValue(traitKey, out var level))
                    continue;

                weightedSum += level * (int)weight;
                totalWeight += (int)weight;
            }

            return totalWeight == 0m
                ? null
                : Math.Round(weightedSum / totalWeight, 1, MidpointRounding.AwayFromZero);
        }
    }
}
