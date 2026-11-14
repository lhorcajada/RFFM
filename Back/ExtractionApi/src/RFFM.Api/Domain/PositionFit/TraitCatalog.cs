using RFFM.Api.Domain.Entities.TeamPlayers;

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

    public static class TraitPhaseKeys
    {
        public static TraitPhase? TryParse(string? key) => key switch
        {
            "withBall" => TraitPhase.WithBall,
            "withoutBall" => TraitPhase.WithoutBall,
            "transitions" => TraitPhase.Transitions,
            "transversal" => TraitPhase.Transversal,
            _ => null,
        };
    }

    /// <summary>Trait keys of a team: <c>Visible</c> are asked in new ratings, <c>All</c> also includes the hidden ones.</summary>
    public record EffectiveTraitKeys(IReadOnlySet<string> Visible, IReadOnlySet<string> All);

    public static class EffectiveTraitCatalog
    {
        /// <summary>
        /// Default traits plus the traits created by the team, minus the hidden ones for <c>Visible</c>.
        /// A customization row of a key that is neither a default nor a custom trait is ignored.
        /// </summary>
        public static EffectiveTraitKeys Resolve(IEnumerable<TeamTraitDefinition> customizations)
        {
            var all = TraitCatalog.All.Select(t => t.Key).ToHashSet();
            var hidden = new HashSet<string>();

            foreach (var row in customizations)
            {
                var known = row.IsCustom || TraitCatalog.IsKnown(row.Key);
                if (!known) continue;
                all.Add(row.Key);
                if (row.IsHidden) hidden.Add(row.Key);
            }

            return new EffectiveTraitKeys(all.Where(key => !hidden.Contains(key)).ToHashSet(), all);
        }
    }
}
