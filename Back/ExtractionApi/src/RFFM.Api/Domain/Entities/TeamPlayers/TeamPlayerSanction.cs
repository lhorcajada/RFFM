namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public class TeamPlayerSanction : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;
        public SanctionCategory Category { get; private set; } = null!;
        public DateTime StartDate { get; private set; }
        public string SanctionType { get; private set; } = null!;
        public string? Description { get; private set; }
        public string? EstimatedEnd { get; private set; }
        public DateTime? EndDate { get; private set; }

        /// <summary>True when this sanction was created automatically by the system (5-yellow-card
        /// cycle or a red card in a league match), as opposed to created manually by the coach.</summary>
        public bool IsAutomatic { get; private set; }

        /// <summary>Optional fine amount associated with the sanction (editable by the coach even
        /// for automatic sanctions).</summary>
        public decimal? Fine { get; private set; }

        /// <summary>SportEvent.Id that triggered an automatic sanction. Null for manual sanctions.
        /// Used for idempotency: re-saving the same finished match must not duplicate the sanction.</summary>
        public string? SourceEventId { get; private set; }

        public TeamPlayer TeamPlayer { get; private set; } = null!;

        private TeamPlayerSanction() { }

        public static TeamPlayerSanction Create(
            string teamPlayerId, SanctionCategory category, DateTime startDate, string sanctionType,
            string? description, string? estimatedEnd, decimal? fine = null)
        {
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("El jugador es obligatorio.");
            if (category is null)
                throw new ArgumentException("La categoría de la sanción es obligatoria.");
            if (string.IsNullOrWhiteSpace(sanctionType))
                throw new ArgumentException("El tipo de sanción es obligatorio.");

            return new TeamPlayerSanction
            {
                TeamPlayerId = teamPlayerId,
                Category = category,
                StartDate = startDate.Kind == DateTimeKind.Utc ? startDate : DateTime.SpecifyKind(startDate, DateTimeKind.Utc),
                SanctionType = sanctionType,
                Description = description,
                EstimatedEnd = estimatedEnd,
                EndDate = null,
                IsAutomatic = false,
                Fine = fine,
                SourceEventId = null
            };
        }

        /// <summary>
        /// Creates a sanction generated automatically by the system when a player reaches their
        /// 5th cyclic yellow card or receives a red card in a league match ("Partido").
        /// </summary>
        public static TeamPlayerSanction CreateAutomatic(
            string teamPlayerId, SanctionCategory category, DateTime startDate, string sanctionType,
            string description, string sourceEventId)
        {
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("El jugador es obligatorio.");
            if (category is null)
                throw new ArgumentException("La categoría de la sanción es obligatoria.");
            if (string.IsNullOrWhiteSpace(sanctionType))
                throw new ArgumentException("El tipo de sanción es obligatorio.");
            if (string.IsNullOrWhiteSpace(sourceEventId))
                throw new ArgumentException("El evento de origen es obligatorio para una sanción automática.");

            return new TeamPlayerSanction
            {
                TeamPlayerId = teamPlayerId,
                Category = category,
                StartDate = startDate.Kind == DateTimeKind.Utc ? startDate : DateTime.SpecifyKind(startDate, DateTimeKind.Utc),
                SanctionType = sanctionType,
                Description = description,
                EstimatedEnd = null,
                EndDate = null,
                IsAutomatic = true,
                Fine = null,
                SourceEventId = sourceEventId
            };
        }

        public void Update(
            SanctionCategory category, DateTime startDate, string sanctionType,
            string? description, string? estimatedEnd, DateTime? endDate, decimal? fine = null)
        {
            if (category is null)
                throw new ArgumentException("La categoría de la sanción es obligatoria.");
            if (string.IsNullOrWhiteSpace(sanctionType))
                throw new ArgumentException("El tipo de sanción es obligatorio.");

            Category = category;
            StartDate = startDate.Kind == DateTimeKind.Utc ? startDate : DateTime.SpecifyKind(startDate, DateTimeKind.Utc);
            SanctionType = sanctionType;
            Description = description;
            EstimatedEnd = estimatedEnd;
            EndDate = endDate.HasValue
                ? (endDate.Value.Kind == DateTimeKind.Utc ? endDate.Value : DateTime.SpecifyKind(endDate.Value, DateTimeKind.Utc))
                : null;
            Fine = fine;
        }
    }
}
