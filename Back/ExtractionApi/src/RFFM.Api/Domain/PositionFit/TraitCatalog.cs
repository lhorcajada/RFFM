namespace RFFM.Api.Domain.PositionFit
{
    public enum TraitPhase
    {
        WithBall = 1,
        WithoutBall = 2,
        Transitions = 3,
        Transversal = 4,
    }

    public record TraitDefinition(string Key, TraitPhase Phase);

    public static class TraitCatalog
    {
        public const int MinLevel = 1;
        public const int MaxLevel = 5;

        public static readonly IReadOnlyList<TraitDefinition> All = new List<TraitDefinition>
        {
            new("traitOccupiesZone", TraitPhase.WithBall),
            new("traitBuildsUnderPressure", TraitPhase.WithBall),
            new("traitBreaksLines", TraitPhase.WithBall),
            new("traitBeatsOneOnOne", TraitPhase.WithBall),
            new("traitArrivesAndFinishes", TraitPhase.WithBall),
            new("traitCoverage", TraitPhase.WithoutBall),
            new("traitPressing", TraitPhase.WithoutBall),
            new("traitDuels", TraitPhase.WithoutBall),
            new("traitReactsToLoss", TraitPhase.Transitions),
            new("traitFirstActionAfterRecovery", TraitPhase.Transitions),
            new("traitRoleDiscipline", TraitPhase.Transversal),
            new("traitSustainedIntensity", TraitPhase.Transversal),
        };

        private static readonly HashSet<string> Keys = All.Select(t => t.Key).ToHashSet();

        public static bool IsKnown(string traitKey) => Keys.Contains(traitKey);

        public static bool IsValidLevel(int level) => level is >= MinLevel and <= MaxLevel;
    }
}
