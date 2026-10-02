namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>
    /// Comentario evaluable del catálogo de un equipo (p. ej. «Implicación defensiva»): se reutiliza en
    /// los seguimientos de varias sesiones para ver su evolución.
    /// See openspec/changes/player-session-tracking-comments-api/design.md → D1.
    /// </summary>
    public class TrackingComment : BaseEntity
    {
        public static class Rules
        {
            public const int TitleMaxLength = 100;
            public const int DescriptionMaxLength = 500;
        }

        public string TeamId { get; private set; } = null!;
        public string Title { get; private set; } = null!;
        public string? Description { get; private set; }
        public string CreatedByUserId { get; private set; } = null!;
        public DateTime CreatedAt { get; private set; }

        private TrackingComment() { }

        public static TrackingComment Create(string teamId, string title, string? description, string createdByUserId)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("TeamId cannot be empty.", nameof(teamId));
            if (string.IsNullOrWhiteSpace(createdByUserId))
                throw new ArgumentException("CreatedByUserId cannot be empty.", nameof(createdByUserId));
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("Title cannot be empty.", nameof(title));

            var trimmedTitle = title.Trim();
            if (trimmedTitle.Length > Rules.TitleMaxLength)
                throw new ArgumentException($"Title cannot exceed {Rules.TitleMaxLength} characters.", nameof(title));

            var trimmedDescription = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
            if (trimmedDescription?.Length > Rules.DescriptionMaxLength)
                throw new ArgumentException($"Description cannot exceed {Rules.DescriptionMaxLength} characters.", nameof(description));

            return new TrackingComment
            {
                TeamId = teamId,
                Title = trimmedTitle,
                Description = trimmedDescription,
                CreatedByUserId = createdByUserId,
                CreatedAt = DateTime.UtcNow
            };
        }
    }
}
