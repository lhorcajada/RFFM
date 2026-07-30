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

        public TeamPlayer TeamPlayer { get; private set; } = null!;

        private TeamPlayerSanction() { }

        public static TeamPlayerSanction Create(
            string teamPlayerId, SanctionCategory category, DateTime startDate, string sanctionType,
            string? description, string? estimatedEnd)
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
                EndDate = null
            };
        }

        public void Update(
            SanctionCategory category, DateTime startDate, string sanctionType,
            string? description, string? estimatedEnd, DateTime? endDate)
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
        }
    }
}
