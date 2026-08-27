using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Domain.Aggregates.Training
{
    public class TrainingSession : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan? EndTime { get; set; }
        public string Location { get; set; } = string.Empty;
        public string? SportEventId { get; set; }
        public string TeamId { get; set; } = string.Empty;
        public string? UrlImage { get; set; }

        /// <summary>Optional, explicit association to a season-plan week. A Coach decides at
        /// creation/edit time whether the session belongs to a plan week or is independent.</summary>
        public string? MicrocicloId { get; set; }

        /// <summary>Free text, meaningful with or without a plan association.</summary>
        public string? ObjetivoGeneral { get; set; }

        /// <summary>Text placeholder/caption for the session's overall field-setup map ("Mapa
        /// de campo general") — the image itself, if any, uses <see cref="UrlImage"/>.</summary>
        public string? MapaCampoTexto { get; set; }

        public Team Team { get; set; } = null!;
        public SportEvent? SportEvent { get; set; }
        public List<SessionBlock> Blocks { get; set; } = new();
    }
}
