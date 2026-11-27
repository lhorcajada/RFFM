using System.Text.Json;

namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Propuesta de desconvocatoria que el entrenador guarda para un partido: los jugadores que saldrían,
    /// en orden. La lista se lee y escribe siempre entera, por eso se guarda como un documento JSON.
    /// </summary>
    public class DeconvocationSavedProposal : BaseEntity
    {
        public const int MaxNameLength = 60;
        public const int MaxPerEvent = 10;

        public string SportEventId { get; private set; } = null!;

        public string Name { get; private set; } = null!;

        public string TeamPlayerIdsJson { get; private set; } = "[]";

        public DateTime CreatedOn { get; private set; }

        private DeconvocationSavedProposal() { }

        public IReadOnlyList<string> TeamPlayerIds => JsonSerializer.Deserialize<List<string>>(TeamPlayerIdsJson) ?? [];

        public static DeconvocationSavedProposal Create(string sportEventId, string name, IReadOnlyCollection<string> teamPlayerIds)
        {
            if (string.IsNullOrWhiteSpace(sportEventId))
                throw new ArgumentException("sportEventId cannot be empty.", nameof(sportEventId));
            if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > MaxNameLength)
                throw new ArgumentException($"name must have 1 to {MaxNameLength} characters.", nameof(name));
            if (teamPlayerIds.Count == 0)
                throw new ArgumentException("A proposal needs at least one player.", nameof(teamPlayerIds));

            return new DeconvocationSavedProposal
            {
                SportEventId = sportEventId,
                Name = name.Trim(),
                TeamPlayerIdsJson = JsonSerializer.Serialize(teamPlayerIds),
                CreatedOn = DateTime.UtcNow
            };
        }
    }
}
