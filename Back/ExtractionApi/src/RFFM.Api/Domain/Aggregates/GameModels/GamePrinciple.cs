namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// A Principio (title + description) grouping one or more scenarios inside a specific
    /// game moment + zone combination.
    /// e.g. Defensa Organizada / Zona de Iniciación / "El rival juega por bandas"
    /// </summary>
    public class GamePrinciple : BaseEntity
    {
        public string GameModelId { get; private set; } = null!;
        public int GameMomentId { get; private set; }
        public int GameZoneId { get; private set; }
        public int Order { get; private set; }
        public string Title { get; private set; } = null!;
        public string Description { get; private set; } = string.Empty;

        public GameModel GameModel { get; private set; } = null!;
        public GameMoment GameMoment { get; private set; } = null!;
        public GameZone GameZone { get; private set; } = null!;

        public List<GameScenario> Scenarios { get; private set; } = new();

        private GamePrinciple() { }

        public GamePrinciple(string gameModelId, int gameMomentId, int gameZoneId, int order, string title, string description)
        {
            GameModelId = gameModelId;
            GameMomentId = gameMomentId;
            GameZoneId = gameZoneId;
            Order = order;
            UpdateTitle(title);
            Description = description ?? string.Empty;
        }

        public void UpdateTitle(string title)
        {
            if (string.IsNullOrWhiteSpace(title))
                throw new ArgumentException("Principle title cannot be empty.", nameof(title));
            Title = title.Trim();
        }

        public void UpdateDescription(string description) => Description = description ?? string.Empty;

        public void UpdateOrder(int order) => Order = order;
    }
}
