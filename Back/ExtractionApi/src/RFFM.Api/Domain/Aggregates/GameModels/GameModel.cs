namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// Aggregate root for a team's game model (one per team per season).
    /// </summary>
    public class GameModel : BaseEntity, IAggregateRoot
    {
        public string TeamId { get; private set; } = null!;
        public string Name { get; private set; } = null!;
        public string Season { get; private set; } = null!;

        public List<GamePrinciple> Principles { get; private set; } = new();

        private GameModel() { }

        public GameModel(string teamId, string name, string season)
        {
            UpdateTeamId(teamId);
            UpdateName(name);
            UpdateSeason(season);
        }

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Game model name cannot be empty.", nameof(name));
            Name = name.Trim();
        }

        public void UpdateSeason(string season)
        {
            if (string.IsNullOrWhiteSpace(season))
                throw new ArgumentException("Season cannot be empty.", nameof(season));
            Season = season.Trim();
        }

        private void UpdateTeamId(string teamId)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("TeamId cannot be empty.", nameof(teamId));
            TeamId = teamId;
        }
    }
}
