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
        public int PointsWin { get; private set; } = RffmPointsSystem.Default.Win;
        public int PointsDraw { get; private set; } = RffmPointsSystem.Default.Draw;
        public int PointsLoss { get; private set; } = RffmPointsSystem.Default.Loss;
        /// <summary>Clasificación vigente (calculada o, si se ha conciliado, oficial) en formato de respuesta (jsonb).</summary>
        public string? StandingsJson { get; private set; }
        public int? StandingsRound { get; private set; }
        public DateTime? StandingsSyncedAt { get; private set; }
        /// <summary>Última clasificación oficial de la RFFM (jsonb): puntos de sanción y colores de las franjas.</summary>
        public string? OfficialStandingsJson { get; private set; }
        public int? OfficialStandingsRound { get; private set; }
        public DateTime CreatedAt { get; private set; }

        public RffmPointsSystem Points => new(PointsWin, PointsDraw, PointsLoss);

        private RffmCompetitionGroup() { }

        public static RffmCompetitionGroup Create(string groupCode, int seasonId, string competitionCode, string competitionName,
            string groupName, int? matchMinutes, int? matchParts, RffmPointsSystem? points, DateTime now)
        {
            if (string.IsNullOrWhiteSpace(groupCode))
                throw new ArgumentException("El grupo es obligatorio.");

            var pointsSystem = points ?? RffmPointsSystem.Default;
            return new RffmCompetitionGroup
            {
                GroupCode = groupCode.Trim(),
                SeasonId = seasonId,
                CompetitionCode = (competitionCode ?? string.Empty).Trim(),
                CompetitionName = (competitionName ?? string.Empty).Trim(),
                GroupName = (groupName ?? string.Empty).Trim(),
                MatchMinutes = matchMinutes is > 0 ? matchMinutes.Value : Rules.DefaultMatchMinutes,
                MatchParts = matchParts is > 0 ? matchParts.Value : Rules.DefaultMatchParts,
                PointsWin = pointsSystem.Win,
                PointsDraw = pointsSystem.Draw,
                PointsLoss = pointsSystem.Loss,
                CreatedAt = now
            };
        }

        public void UpdateStandings(string standingsJson, int? round, DateTime now)
        {
            StandingsJson = standingsJson;
            StandingsRound = round;
            StandingsSyncedAt = now;
        }

        public void UpdateOfficialStandings(string officialStandingsJson, int round)
        {
            OfficialStandingsJson = officialStandingsJson;
            OfficialStandingsRound = round;
        }
    }
}
