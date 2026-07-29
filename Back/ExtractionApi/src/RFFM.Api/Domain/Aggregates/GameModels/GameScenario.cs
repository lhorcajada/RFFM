namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// A scenario inside a specific game moment + zone combination.
    /// e.g. Defensa Organizada / Zona de Iniciación / Escenario 1: El rival juega por bandas
    /// </summary>
    public class GameScenario : BaseEntity
    {
        public string GameModelId { get; private set; } = null!;
        public int GameMomentId { get; private set; }
        public int GameZoneId { get; private set; }
        public int Order { get; private set; }
        public string Name { get; private set; } = null!;
        public string Context { get; private set; } = string.Empty;
        public string? MediaUrl { get; private set; }
        public string? MediaType { get; private set; } // "image" | "video"

        public GameModel GameModel { get; private set; } = null!;
        public GameMoment GameMoment { get; private set; } = null!;
        public GameZone GameZone { get; private set; } = null!;

        public List<ScenarioTacticalPrinciple> TacticalPrinciples { get; private set; } = new();
        public List<SubPrinciple> SubPrinciples { get; private set; } = new();

        private GameScenario() { }

        public GameScenario(string gameModelId, int gameMomentId, int gameZoneId, int order, string name, string context)
        {
            GameModelId = gameModelId;
            GameMomentId = gameMomentId;
            GameZoneId = gameZoneId;
            Order = order;
            UpdateName(name);
            Context = context;
        }

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Scenario name cannot be empty.", nameof(name));
            Name = name.Trim();
        }

        public void UpdateContext(string context) => Context = context;

        public void UpdateOrder(int order) => Order = order;
        public void UpdateMomentAndZone(int momentId, int zoneId)
        {
            GameMomentId = momentId;
            GameZoneId = zoneId;
        }

        public void UpdateMedia(string url, string mediaType)
        {
            if (string.IsNullOrWhiteSpace(url))
                throw new ArgumentException("Media url cannot be empty.", nameof(url));
            if (mediaType != "image" && mediaType != "video")
                throw new ArgumentException("Invalid media type.", nameof(mediaType));
            MediaUrl = url;
            MediaType = mediaType;
        }

        public void ClearMedia()
        {
            MediaUrl = null;
            MediaType = null;
        }
    }
}
