namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    /// <summary>
    /// A team's structured "Normas de equipo" (rules) set: metadata (title/subtitle/notes) plus an
    /// ordered list of <see cref="TeamRule"/>s. One per <see cref="Team"/> (0..1, unique
    /// <see cref="TeamId"/>). Edited as a whole aggregate (see <see cref="ReplaceRules"/>),
    /// mirroring <c>GameModel</c>/<c>GamePrinciple</c>'s full-aggregate-save shape.
    /// </summary>
    public class TeamRulesSet : BaseEntity, IAggregateRoot
    {
        public string TeamId { get; private set; } = null!;
        public string Title { get; private set; } = null!;
        public string Subtitle { get; private set; } = null!;
        public string IntroNote { get; private set; } = null!;
        public string? ClosingNote { get; private set; }
        public string? ApplicationNote { get; private set; }
        public DateTime UpdatedAt { get; private set; }

        public List<TeamRule> Rules { get; private set; } = new();

        private TeamRulesSet() { }

        private TeamRulesSet(string teamId, string title, string subtitle, string introNote, string? closingNote, string? applicationNote)
        {
            SetTeamId(teamId);
            SetMetadata(title, subtitle, introNote, closingNote, applicationNote);
            UpdatedAt = DateTime.UtcNow;
        }

        public static TeamRulesSet Create(
            string teamId, string title, string subtitle, string introNote, string? closingNote, string? applicationNote)
            => new(teamId, title, subtitle, introNote, closingNote, applicationNote);

        public void UpdateMetadata(string title, string subtitle, string introNote, string? closingNote, string? applicationNote)
        {
            SetMetadata(title, subtitle, introNote, closingNote, applicationNote);
            UpdatedAt = DateTime.UtcNow;
        }

        /// <summary>
        /// Clears and rebuilds <see cref="Rules"/> from <paramref name="rules"/>, deriving a
        /// contiguous 1..N <c>Order</c> from array position — never trusts a client-sent order.
        /// </summary>
        public void ReplaceRules(IEnumerable<TeamRuleInput> rules)
        {
            var list = rules.ToList();
            if (list.Count == 0)
                throw new ArgumentException("A team rules set must contain at least one rule.", nameof(rules));

            Rules.Clear();

            for (var i = 0; i < list.Count; i++)
            {
                var input = list[i];
                Rules.Add(new TeamRule(
                    Id,
                    i + 1,
                    input.ShortTitle,
                    input.Highlight,
                    input.ViolationSummary,
                    input.ConsequenceSummary,
                    input.LongDescription,
                    input.BulletPoints,
                    input.ConsequenceDetail));
            }

            UpdatedAt = DateTime.UtcNow;
        }

        private void SetTeamId(string teamId)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("TeamId cannot be empty.", nameof(teamId));
            TeamId = teamId;
        }

        private void SetMetadata(string title, string subtitle, string introNote, string? closingNote, string? applicationNote)
        {
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("Title cannot be empty.", nameof(title));
            if (string.IsNullOrWhiteSpace(subtitle))
                throw new ArgumentException("Subtitle cannot be empty.", nameof(subtitle));
            if (string.IsNullOrWhiteSpace(introNote))
                throw new ArgumentException("IntroNote cannot be empty.", nameof(introNote));

            Title = title.Trim();
            Subtitle = subtitle.Trim();
            IntroNote = introNote.Trim();
            ClosingNote = string.IsNullOrWhiteSpace(closingNote) ? null : closingNote.Trim();
            ApplicationNote = string.IsNullOrWhiteSpace(applicationNote) ? null : applicationNote.Trim();
        }
    }
}
