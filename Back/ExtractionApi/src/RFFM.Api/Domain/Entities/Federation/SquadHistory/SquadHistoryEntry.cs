namespace RFFM.Api.Domain.Entities.Federation.SquadHistory
{
    public class SquadHistoryEntry : BaseEntity
    {
        public string ReportId { get; private set; } = null!;
        public string PlayerCode { get; private set; } = null!;
        public string PlayerName { get; private set; } = null!;
        public int SeasonId { get; private set; }
        public string SeasonName { get; private set; } = null!;
        public string CompetitionCode { get; private set; } = null!;
        public string CompetitionName { get; private set; } = null!;
        public string GroupCode { get; private set; } = null!;
        public string GroupName { get; private set; } = null!;
        public string TeamCode { get; private set; } = null!;
        public string TeamName { get; private set; } = null!;
        public string ClubName { get; private set; } = null!;
        public string? TeamShieldUrl { get; private set; }
        public int TeamPoints { get; private set; }
        public int TeamPosition { get; private set; }
        public int Goals { get; private set; }
        public int YellowCards { get; private set; }
        public int RedCards { get; private set; }
        public int? Starts { get; private set; }
        public int? CallUps { get; private set; }
        public SquadHistorySource Source { get; private set; } = null!;
        public bool IsIncomplete { get; private set; }
        public int? BirthYear { get; private set; }
        public string? OriginTeamName { get; private set; }

        private SquadHistoryEntry() { }

        public static SquadHistoryEntry Create(
            string playerCode, string playerName, int seasonId, string seasonName,
            string competitionCode, string competitionName, string groupCode, string groupName,
            string teamCode, string teamName, string clubName, string? teamShieldUrl,
            int teamPoints, int teamPosition, int goals, int yellowCards, int redCards,
            int? starts, int? callUps, SquadHistorySource source, bool isIncomplete,
            int? birthYear = null, string? originTeamName = null)
        {
            if (string.IsNullOrWhiteSpace(playerCode))
                throw new ArgumentException("El jugador es obligatorio.");

            return new SquadHistoryEntry
            {
                PlayerCode = playerCode,
                PlayerName = playerName ?? string.Empty,
                SeasonId = seasonId,
                SeasonName = seasonName ?? string.Empty,
                CompetitionCode = competitionCode ?? string.Empty,
                CompetitionName = competitionName ?? string.Empty,
                GroupCode = groupCode ?? string.Empty,
                GroupName = groupName ?? string.Empty,
                TeamCode = teamCode ?? string.Empty,
                TeamName = teamName ?? string.Empty,
                ClubName = clubName ?? string.Empty,
                TeamShieldUrl = teamShieldUrl,
                TeamPoints = teamPoints,
                TeamPosition = teamPosition,
                Goals = goals,
                YellowCards = yellowCards,
                RedCards = redCards,
                Starts = starts,
                CallUps = callUps,
                Source = source,
                IsIncomplete = isIncomplete,
                BirthYear = birthYear is > 0 ? birthYear : null,
                OriginTeamName = string.IsNullOrWhiteSpace(originTeamName) ? null : originTeamName.Trim()
            };
        }
    }
}
