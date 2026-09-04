namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    /// <summary>
    /// A free-text note shown on a team's convocation report (popup + WhatsApp export), e.g.
    /// kit/espinilleras reminders. Independent, directly-queryable per-team items (not an
    /// owned/rebuilt-as-a-whole collection like <see cref="TeamRule"/>) — created, edited and
    /// deleted individually, ordered by <see cref="Order"/> (assigned once at creation, never
    /// renumbered on delete).
    /// </summary>
    public class TeamNote : BaseEntity
    {
        public string TeamId { get; private set; } = null!;
        public string Text { get; private set; } = null!;
        public int Order { get; private set; }

        public Team Team { get; private set; } = null!;

        private TeamNote() { }

        public static TeamNote Create(string teamId, string text, int order)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("TeamId cannot be empty.", nameof(teamId));
            if (string.IsNullOrWhiteSpace(text))
                throw new ArgumentException("Text cannot be empty.", nameof(text));

            return new TeamNote
            {
                TeamId = teamId,
                Text = text.Trim(),
                Order = order
            };
        }

        public void UpdateText(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
                throw new ArgumentException("Text cannot be empty.", nameof(text));
            Text = text.Trim();
        }
    }
}
