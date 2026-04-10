namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public class TeamPlayerInjury : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;
        public DateTime StartDate { get; private set; }
        public string InjuryType { get; private set; } = null!;
        public string? Description { get; private set; }
        public string? EstimatedRecovery { get; private set; }
        public DateTime? EndDate { get; private set; }

        public TeamPlayer TeamPlayer { get; private set; } = null!;

        private TeamPlayerInjury() { }

        public static TeamPlayerInjury Create(string teamPlayerId, DateTime startDate, string injuryType, string? description, string? estimatedRecovery)
        {
            if (string.IsNullOrWhiteSpace(teamPlayerId))
                throw new ArgumentException("El jugador es obligatorio.");
            if (string.IsNullOrWhiteSpace(injuryType))
                throw new ArgumentException("El tipo de lesión es obligatorio.");

            return new TeamPlayerInjury
            {
                TeamPlayerId = teamPlayerId,
                StartDate = startDate.Kind == DateTimeKind.Utc ? startDate : DateTime.SpecifyKind(startDate, DateTimeKind.Utc),
                InjuryType = injuryType,
                Description = description,
                EstimatedRecovery = estimatedRecovery,
                EndDate = null
            };
        }

        public void Update(DateTime startDate, string injuryType, string? description, string? estimatedRecovery, DateTime? endDate)
        {
            if (string.IsNullOrWhiteSpace(injuryType))
                throw new ArgumentException("El tipo de lesión es obligatorio.");

            StartDate = startDate.Kind == DateTimeKind.Utc ? startDate : DateTime.SpecifyKind(startDate, DateTimeKind.Utc);
            InjuryType = injuryType;
            Description = description;
            EstimatedRecovery = estimatedRecovery;
            EndDate = endDate.HasValue
                ? (endDate.Value.Kind == DateTimeKind.Utc ? endDate.Value : DateTime.SpecifyKind(endDate.Value, DateTimeKind.Utc))
                : null;
        }

        public void Discharge()
        {
            EndDate = DateTime.UtcNow;
        }
    }
}
