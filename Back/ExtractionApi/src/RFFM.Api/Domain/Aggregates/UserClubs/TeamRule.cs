namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    /// <summary>
    /// Immutable input used to (re)build a <see cref="TeamRule"/> via
    /// <see cref="TeamRulesSet.ReplaceRules"/>. <see cref="Id"/> is informational only (present
    /// when the client is editing an existing rule) — it is never used to preserve identity, since
    /// <see cref="TeamRulesSet.ReplaceRules"/> always clears and rebuilds the whole list.
    /// </summary>
    public record TeamRuleInput(
        string? Id,
        string ShortTitle,
        string? Highlight,
        string ViolationSummary,
        string ConsequenceSummary,
        string? LongDescription,
        List<string>? BulletPoints,
        string? ConsequenceDetail);

    /// <summary>
    /// A single team rule (short title, violation/consequence summary, optional long-form detail)
    /// owned by a <see cref="TeamRulesSet"/>. Constructed only via
    /// <see cref="TeamRulesSet.ReplaceRules"/> — no independent public factory, mirroring
    /// <c>GameScenario</c>'s ownership by <c>GamePrinciple</c>.
    /// </summary>
    public class TeamRule : BaseEntity
    {
        public string TeamRulesSetId { get; private set; } = null!;
        public int Order { get; private set; }
        public string ShortTitle { get; private set; } = null!;
        public string? Highlight { get; private set; }
        public string ViolationSummary { get; private set; } = null!;
        public string ConsequenceSummary { get; private set; } = null!;
        public string? LongDescription { get; private set; }
        public List<string>? BulletPoints { get; private set; }
        public string? ConsequenceDetail { get; private set; }

        public TeamRulesSet TeamRulesSet { get; private set; } = null!;

        private TeamRule() { }

        internal TeamRule(
            string teamRulesSetId,
            int order,
            string shortTitle,
            string? highlight,
            string violationSummary,
            string consequenceSummary,
            string? longDescription,
            List<string>? bulletPoints,
            string? consequenceDetail)
        {
            if (string.IsNullOrWhiteSpace(teamRulesSetId))
                throw new ArgumentException("TeamRulesSetId cannot be empty.", nameof(teamRulesSetId));
            if (string.IsNullOrWhiteSpace(shortTitle))
                throw new ArgumentException("Rule short title cannot be empty.", nameof(shortTitle));
            if (string.IsNullOrWhiteSpace(violationSummary))
                throw new ArgumentException("Rule violation summary cannot be empty.", nameof(violationSummary));
            if (string.IsNullOrWhiteSpace(consequenceSummary))
                throw new ArgumentException("Rule consequence summary cannot be empty.", nameof(consequenceSummary));

            TeamRulesSetId = teamRulesSetId;
            Order = order;
            ShortTitle = shortTitle.Trim();
            Highlight = string.IsNullOrWhiteSpace(highlight) ? null : highlight.Trim();
            ViolationSummary = violationSummary.Trim();
            ConsequenceSummary = consequenceSummary.Trim();
            LongDescription = string.IsNullOrWhiteSpace(longDescription) ? null : longDescription.Trim();
            BulletPoints = bulletPoints is { Count: > 0 } ? bulletPoints : null;
            ConsequenceDetail = string.IsNullOrWhiteSpace(consequenceDetail) ? null : consequenceDetail.Trim();
        }
    }
}
