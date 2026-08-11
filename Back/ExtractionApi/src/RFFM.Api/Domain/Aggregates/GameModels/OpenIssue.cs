namespace RFFM.Api.Domain.Aggregates.GameModels
{
    /// <summary>
    /// A pending decision tracked against the game model (spec §7). Importing an unresolved
    /// OpenIssue is valid — it does not block the rest of the import.
    /// </summary>
    public class OpenIssue : BaseEntity
    {
        public static readonly IReadOnlySet<string> Statuses = new HashSet<string> { "open", "resolved" };

        public string GameModelId { get; private set; } = null!;
        public string Topic { get; private set; } = null!;
        public string Description { get; private set; } = string.Empty;
        public string Status { get; private set; } = "open";

        public GameModel GameModel { get; private set; } = null!;

        private OpenIssue() { }

        public OpenIssue(string gameModelId, string topic, string description, string status = "open")
        {
            if (string.IsNullOrWhiteSpace(gameModelId))
                throw new ArgumentException("GameModelId cannot be empty.", nameof(gameModelId));

            GameModelId = gameModelId;
            UpdateTopic(topic);
            Description = description ?? string.Empty;
            UpdateStatus(status);
        }

        public void UpdateTopic(string topic)
        {
            if (string.IsNullOrWhiteSpace(topic))
                throw new ArgumentException("Topic cannot be empty.", nameof(topic));
            Topic = topic.Trim();
        }

        public void UpdateDescription(string description) => Description = description ?? string.Empty;

        public void UpdateStatus(string status)
        {
            if (string.IsNullOrWhiteSpace(status) || !Statuses.Contains(status))
                throw new ArgumentException($"'{status}' is not a valid OpenIssue status.", nameof(status));
            Status = status;
        }
    }
}
