using RFFM.Api.Domain.PositionFit;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public static class RatingConfigRules
    {
        public const string CustomKeyPrefix = "custom-";
        public const int MaxKeyLength = 50;
        public const int MaxLabelLength = 80;
        public const int MaxTextLength = 200;
        public const int CapacityLevelCount = 10;

        public const string FieldSheet = "field";
        public const string GoalkeeperSheet = "goalkeeper";

        public static readonly IReadOnlySet<string> Sheets = new HashSet<string> { FieldSheet, GoalkeeperSheet };

        public static readonly IReadOnlySet<string> Categories =
            new HashSet<string> { "physical", "technical", "tactical", "competitiveness" };

        public static string NewCustomKey() => CustomKeyPrefix + Guid.NewGuid().ToString("N");

        public static bool IsCustomKey(string key) => key.StartsWith(CustomKeyPrefix, StringComparison.Ordinal);

        public static string RequiredText(string? value, int maxLength, string field)
        {
            if (string.IsNullOrWhiteSpace(value))
                throw new ArgumentException($"{field} must not be empty.", field);
            var trimmed = value.Trim();
            if (trimmed.Length > maxLength)
                throw new ArgumentException($"{field} must have at most {maxLength} characters.", field);
            return trimmed;
        }
    }

    /// <summary>
    /// Team customization of a behavior trait: a customized default (same key, only the changed texts are set)
    /// or a trait created by the team. A team without rows sees the default catalog.
    /// </summary>
    public class TeamTraitDefinition : BaseEntity
    {
        public string TeamId { get; private set; } = null!;
        public string Key { get; private set; } = null!;
        public bool IsCustom { get; private set; }
        public bool IsHidden { get; private set; }
        public string? Label { get; private set; }
        public string? Phase { get; private set; }
        public string? Anchor1 { get; private set; }
        public string? Anchor3 { get; private set; }
        public string? Anchor5 { get; private set; }

        private TeamTraitDefinition() { }

        public static TeamTraitDefinition CreateCustom(string teamId, string label, string phase, string anchor1, string anchor3, string anchor5)
        {
            if (TraitPhaseKeys.TryParse(phase) is null)
                throw new ArgumentException($"Unknown phase '{phase}'.", nameof(phase));

            return new TeamTraitDefinition
            {
                TeamId = teamId,
                Key = RatingConfigRules.NewCustomKey(),
                IsCustom = true,
                Label = RatingConfigRules.RequiredText(label, RatingConfigRules.MaxLabelLength, nameof(label)),
                Phase = phase,
                Anchor1 = RatingConfigRules.RequiredText(anchor1, RatingConfigRules.MaxTextLength, nameof(anchor1)),
                Anchor3 = RatingConfigRules.RequiredText(anchor3, RatingConfigRules.MaxTextLength, nameof(anchor3)),
                Anchor5 = RatingConfigRules.RequiredText(anchor5, RatingConfigRules.MaxTextLength, nameof(anchor5)),
            };
        }

        public static TeamTraitDefinition ForDefault(string teamId, string key)
        {
            if (!TraitCatalog.IsKnown(key))
                throw new ArgumentException($"Unknown default trait '{key}'.", nameof(key));
            return new TeamTraitDefinition { TeamId = teamId, Key = key };
        }

        /// <summary>Changes the given texts; null leaves a value as it is.</summary>
        public void Update(string? label, string? phase, string? anchor1, string? anchor3, string? anchor5)
        {
            if (phase is not null && TraitPhaseKeys.TryParse(phase) is null)
                throw new ArgumentException($"Unknown phase '{phase}'.", nameof(phase));

            if (label is not null) Label = RatingConfigRules.RequiredText(label, RatingConfigRules.MaxLabelLength, nameof(label));
            if (phase is not null) Phase = phase;
            if (anchor1 is not null) Anchor1 = RatingConfigRules.RequiredText(anchor1, RatingConfigRules.MaxTextLength, nameof(anchor1));
            if (anchor3 is not null) Anchor3 = RatingConfigRules.RequiredText(anchor3, RatingConfigRules.MaxTextLength, nameof(anchor3));
            if (anchor5 is not null) Anchor5 = RatingConfigRules.RequiredText(anchor5, RatingConfigRules.MaxTextLength, nameof(anchor5));
        }

        public void SetHidden(bool hidden) => IsHidden = hidden;
    }

    /// <summary>
    /// Team customization of a rating capacity (characteristic of the sheet): a customized default or a capacity
    /// created by the team. The server does not own the default texts, so a customized default only stores what changed.
    /// </summary>
    public class TeamCapacityDefinition : BaseEntity
    {
        public string TeamId { get; private set; } = null!;
        public string Key { get; private set; } = null!;
        public bool IsCustom { get; private set; }
        public bool IsHidden { get; private set; }
        public string Sheet { get; private set; } = null!;
        public string CategoryKey { get; private set; } = null!;
        public string? Label { get; private set; }
        public List<string>? LevelTexts { get; private set; }

        private TeamCapacityDefinition() { }

        private static void ValidateSheetAndCategory(string sheet, string categoryKey)
        {
            if (!RatingConfigRules.Sheets.Contains(sheet))
                throw new ArgumentException($"Unknown sheet '{sheet}'.", nameof(sheet));
            if (!RatingConfigRules.Categories.Contains(categoryKey))
                throw new ArgumentException($"Unknown category '{categoryKey}'.", nameof(categoryKey));
        }

        private static List<string> ValidateLevelTexts(IReadOnlyList<string> levelTexts)
        {
            if (levelTexts.Count != RatingConfigRules.CapacityLevelCount)
                throw new ArgumentException($"Exactly {RatingConfigRules.CapacityLevelCount} level texts are required.", nameof(levelTexts));
            return levelTexts
                .Select((text, index) => RatingConfigRules.RequiredText(text, RatingConfigRules.MaxTextLength, $"levelTexts[{index}]"))
                .ToList();
        }

        public static TeamCapacityDefinition CreateCustom(string teamId, string sheet, string categoryKey, string label, IReadOnlyList<string> levelTexts)
        {
            ValidateSheetAndCategory(sheet, categoryKey);
            return new TeamCapacityDefinition
            {
                TeamId = teamId,
                Key = RatingConfigRules.NewCustomKey(),
                IsCustom = true,
                Sheet = sheet,
                CategoryKey = categoryKey,
                Label = RatingConfigRules.RequiredText(label, RatingConfigRules.MaxLabelLength, nameof(label)),
                LevelTexts = ValidateLevelTexts(levelTexts),
            };
        }

        public static TeamCapacityDefinition ForDefault(string teamId, string key, string sheet, string categoryKey)
        {
            if (string.IsNullOrWhiteSpace(key) || key.Length > RatingConfigRules.MaxKeyLength || RatingConfigRules.IsCustomKey(key))
                throw new ArgumentException($"Invalid default capacity key '{key}'.", nameof(key));
            ValidateSheetAndCategory(sheet, categoryKey);
            return new TeamCapacityDefinition { TeamId = teamId, Key = key, Sheet = sheet, CategoryKey = categoryKey };
        }

        /// <summary>Changes the label and the level texts; null leaves a value as it is. Sheet and category never change.</summary>
        public void Update(string? label, IReadOnlyList<string>? levelTexts)
        {
            if (label is not null) Label = RatingConfigRules.RequiredText(label, RatingConfigRules.MaxLabelLength, nameof(label));
            if (levelTexts is not null) LevelTexts = ValidateLevelTexts(levelTexts);
        }

        public void SetHidden(bool hidden) => IsHidden = hidden;
    }
}
