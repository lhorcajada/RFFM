namespace RFFM.Api.Domain.Aggregates.SeasonPlans
{
    /// <summary>
    /// Aggregate root for a team's season training plan (one per team per season).
    /// Macrociclo → Mesociclo → Microciclo, per design.md Decision 1.
    /// </summary>
    public class SeasonPlan : BaseEntity, IAggregateRoot
    {
        public string TeamId { get; private set; } = null!;
        public string SeasonId { get; private set; } = null!;

        public List<Macrociclo> Macrociclos { get; private set; } = new();

        private SeasonPlan() { }

        public SeasonPlan(string teamId, string seasonId)
        {
            UpdateTeamId(teamId);
            UpdateSeasonId(seasonId);
        }

        private void UpdateTeamId(string teamId)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("TeamId cannot be empty.", nameof(teamId));
            TeamId = teamId;
        }

        private void UpdateSeasonId(string seasonId)
        {
            if (string.IsNullOrWhiteSpace(seasonId))
                throw new ArgumentException("SeasonId cannot be empty.", nameof(seasonId));
            SeasonId = seasonId;
        }
    }
}
