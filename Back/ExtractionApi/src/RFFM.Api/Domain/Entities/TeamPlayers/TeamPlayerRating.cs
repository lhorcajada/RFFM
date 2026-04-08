namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public class TeamPlayerRating : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;
        public byte Technical { get; private set; }
        public byte Tactical { get; private set; }
        public byte Physical { get; private set; }
        public byte Competitiveness { get; private set; }
        public DateTime RatedAt { get; private set; }
        public string? Notes { get; private set; }

        public TeamPlayer TeamPlayer { get; private set; } = null!;

        private TeamPlayerRating() { }

        public static TeamPlayerRating Create(
            string teamPlayerId,
            byte technical,
            byte tactical,
            byte physical,
            byte competitiveness,
            string? notes = null)
        {
            ValidateRating(technical, nameof(technical));
            ValidateRating(tactical, nameof(tactical));
            ValidateRating(physical, nameof(physical));
            ValidateRating(competitiveness, nameof(competitiveness));

            return new TeamPlayerRating
            {
                TeamPlayerId = teamPlayerId,
                Technical = technical,
                Tactical = tactical,
                Physical = physical,
                Competitiveness = competitiveness,
                RatedAt = DateTime.UtcNow,
                Notes = notes
            };
        }

        private static void ValidateRating(byte value, string field)
        {
            if (value < 1 || value > 5)
                throw new ArgumentException($"La valoración de '{field}' debe estar entre 1 y 5.");
        }
    }
}
