namespace RFFM.Api.Domain.Entities.Federation.Results
{
    public class RffmCompetitionGroup : BaseEntity
    {
        public static class Rules
        {
            public const int CodeMaxLength = 50;
            public const int NameMaxLength = 256;
            public const int DefaultMatchMinutes = 90;
            public const int DefaultMatchParts = 2;
        }

        public string GroupCode { get; private set; } = null!;
        public int SeasonId { get; private set; }
        public string CompetitionCode { get; private set; } = string.Empty;
        public string CompetitionName { get; private set; } = string.Empty;
        public string GroupName { get; private set; } = string.Empty;
        public int MatchMinutes { get; private set; }
        public int MatchParts { get; private set; }
        /// <summary>Clasificación completa del grupo tal como la devuelve la RFFM (jsonb).</summary>
        public string? StandingsJson { get; private set; }
        public DateTime? StandingsSyncedAt { get; private set; }
        public DateTime CreatedAt { get; private set; }

        private RffmCompetitionGroup() { }

        public static RffmCompetitionGroup Create(string groupCode, int seasonId, string competitionCode, string competitionName,
            string groupName, int? matchMinutes, int? matchParts, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(groupCode))
                throw new ArgumentException("El grupo es obligatorio.");

            return new RffmCompetitionGroup
            {
                GroupCode = groupCode.Trim(),
                SeasonId = seasonId,
                CompetitionCode = (competitionCode ?? string.Empty).Trim(),
                CompetitionName = (competitionName ?? string.Empty).Trim(),
                GroupName = (groupName ?? string.Empty).Trim(),
                MatchMinutes = matchMinutes is > 0 ? matchMinutes.Value : Rules.DefaultMatchMinutes,
                MatchParts = matchParts is > 0 ? matchParts.Value : Rules.DefaultMatchParts,
                CreatedAt = now
            };
        }

        public void UpdateStandings(string standingsJson, DateTime now)
        {
            StandingsJson = standingsJson;
            StandingsSyncedAt = now;
        }
    }
}
