using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// One row per team describing its injury-response protocol (rich-text content) plus the
    /// reference PDFs attached to it (see add-injury-protocol-and-documents-tabs, design.md
    /// Decisión 2). TeamId is unique — a team has at most one protocol row, created lazily on
    /// first write (see SetTeamInjuryProtocol's upsert PUT).
    /// </summary>
    public class TeamInjuryProtocol : BaseEntity
    {
        public string TeamId { get; private set; } = null!;
        public string? Content { get; private set; }
        public DateTime UpdatedAt { get; private set; }
        public string? UpdatedByUserId { get; private set; }

        public Team Team { get; private set; } = null!;

        private readonly List<TeamInjuryProtocolAttachment> _attachments = new();
        public IReadOnlyCollection<TeamInjuryProtocolAttachment> Attachments => _attachments.AsReadOnly();

        private TeamInjuryProtocol() { }

        public static TeamInjuryProtocol Create(string teamId)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("El equipo es obligatorio.");

            return new TeamInjuryProtocol
            {
                TeamId = teamId,
                Content = null,
                UpdatedAt = DateTime.UtcNow,
                UpdatedByUserId = null
            };
        }

        /// <summary>Upserts the protocol's rich-text content (design.md Decisión 3's PUT).</summary>
        public void UpdateContent(string content, string? userId)
        {
            if (string.IsNullOrWhiteSpace(content))
                throw new ArgumentException("El contenido del protocolo es obligatorio.");

            Content = content;
            UpdatedByUserId = userId;
            UpdatedAt = DateTime.UtcNow;
        }

        /// <summary>"Eliminar el protocolo" clears the text but keeps the row and its attachments
        /// (design.md Decisión 2's DELETE).</summary>
        public void ClearContent(string? userId)
        {
            Content = null;
            UpdatedByUserId = userId;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
