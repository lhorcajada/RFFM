namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// A scenario inside a specific GamePrinciple.
    /// e.g. Defensa Organizada / Zona de Iniciación / El rival juega por bandas / Escenario 1
    /// </summary>
    public class GameScenario : BaseEntity
    {
        public string GamePrincipleId { get; private set; } = null!;
        public int Order { get; private set; }
        public string Name { get; private set; } = null!;
        public string Context { get; private set; } = string.Empty;
        public string? MediaUrl { get; private set; }
        public string? MediaType { get; private set; } // "image" | "video"

        public GamePrinciple GamePrinciple { get; private set; } = null!;

        public List<SubPrinciple> SubPrinciples { get; private set; } = new();

        private GameScenario() { }

        public GameScenario(string gamePrincipleId, int order, string name, string context)
        {
            GamePrincipleId = gamePrincipleId;
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

        public void ReparentTo(string gamePrincipleId) => GamePrincipleId = gamePrincipleId;

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
