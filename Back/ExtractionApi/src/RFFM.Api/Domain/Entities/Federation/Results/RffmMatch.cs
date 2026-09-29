using System.Globalization;

namespace RFFM.Api.Domain.Entities.Federation.Results
{
    public class RffmMatch
    {
        private static readonly string[] DateFormats = ["dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "yyyy-MM-dd"];
        private static readonly string[] TimeFormats = ["HH:mm", "H:mm", "HH:mm:ss"];

        public string Id { get; private set; } = Guid.NewGuid().ToString();
        public string RffmRoundId { get; private set; } = null!;
        public string RecordCode { get; private set; } = null!;
        public DateOnly? MatchDate { get; private set; }
        public TimeOnly? KickoffTime { get; private set; }
        public int SortOrder { get; private set; }
        public DateTime UpdatedAt { get; private set; }

        public string HasRecords { get; private set; } = string.Empty;
        public string RecordClosed { get; private set; } = string.Empty;
        public string GameSituation { get; private set; } = string.Empty;
        public string Observations { get; private set; } = string.Empty;
        public string Date { get; private set; } = string.Empty;
        public string Time { get; private set; } = string.Empty;
        public string Field { get; private set; } = string.Empty;
        public string FieldCode { get; private set; } = string.Empty;
        public string Status { get; private set; } = string.Empty;
        public string StatusReason { get; private set; } = string.Empty;
        public string MatchInProgress { get; private set; } = string.Empty;
        public string ProvisionalResult { get; private set; } = string.Empty;
        public string Referee { get; private set; } = string.Empty;
        public string Penalties { get; private set; } = string.Empty;
        public string ExtraTimeWin { get; private set; } = string.Empty;
        public string ExtraTimeWinnerTeam { get; private set; } = string.Empty;
        public string LocalTeamCode { get; private set; } = string.Empty;
        public string LocalTeamName { get; private set; } = string.Empty;
        public string LocalTeamImageUrl { get; private set; } = string.Empty;
        public string LocalTeamWithdrawn { get; private set; } = string.Empty;
        public string LocalGoals { get; private set; } = string.Empty;
        public string LocalPenalties { get; private set; } = string.Empty;
        public string VisitorTeamCode { get; private set; } = string.Empty;
        public string VisitorTeamName { get; private set; } = string.Empty;
        public string VisitorTeamImageUrl { get; private set; } = string.Empty;
        public string VisitorTeamWithdrawn { get; private set; } = string.Empty;
        public string VisitorGoals { get; private set; } = string.Empty;
        public string VisitorPenalties { get; private set; } = string.Empty;
        public string OriginRecordCode { get; private set; } = string.Empty;

        public bool IsFinal => RecordClosed == "1";

        public bool HasSchedule => MatchDate.HasValue && KickoffTime.HasValue;

        private RffmMatch() { }

        internal static RffmMatch Create(string roundId, RffmMatchSnapshot snapshot, DateTime now)
        {
            var match = new RffmMatch { RffmRoundId = roundId, RecordCode = snapshot.RecordCode.Trim() };
            match.Apply(snapshot, now);
            return match;
        }

        /// <returns>true si algún dato ha cambiado.</returns>
        internal bool Apply(RffmMatchSnapshot snapshot, DateTime now)
        {
            var normalized = Normalize(snapshot);
            if (ToSnapshot() == normalized)
                return false;

            HasRecords = normalized.HasRecords;
            RecordClosed = normalized.RecordClosed;
            GameSituation = normalized.GameSituation;
            Observations = normalized.Observations;
            Date = normalized.Date;
            Time = normalized.Time;
            Field = normalized.Field;
            FieldCode = normalized.FieldCode;
            Status = normalized.Status;
            StatusReason = normalized.StatusReason;
            MatchInProgress = normalized.MatchInProgress;
            ProvisionalResult = normalized.ProvisionalResult;
            Referee = normalized.Referee;
            Penalties = normalized.Penalties;
            ExtraTimeWin = normalized.ExtraTimeWin;
            ExtraTimeWinnerTeam = normalized.ExtraTimeWinnerTeam;
            LocalTeamCode = normalized.LocalTeamCode;
            LocalTeamName = normalized.LocalTeamName;
            LocalTeamImageUrl = normalized.LocalTeamImageUrl;
            LocalTeamWithdrawn = normalized.LocalTeamWithdrawn;
            LocalGoals = normalized.LocalGoals;
            LocalPenalties = normalized.LocalPenalties;
            VisitorTeamCode = normalized.VisitorTeamCode;
            VisitorTeamName = normalized.VisitorTeamName;
            VisitorTeamImageUrl = normalized.VisitorTeamImageUrl;
            VisitorTeamWithdrawn = normalized.VisitorTeamWithdrawn;
            VisitorGoals = normalized.VisitorGoals;
            VisitorPenalties = normalized.VisitorPenalties;
            OriginRecordCode = normalized.OriginRecordCode;
            MatchDate = ParseDate(Date);
            KickoffTime = ParseTime(Time);
            UpdatedAt = now;
            return true;
        }

        internal void SetSortOrder(int sortOrder) => SortOrder = sortOrder;

        public RffmMatchSnapshot ToSnapshot() => new()
        {
            RecordCode = RecordCode,
            HasRecords = HasRecords,
            RecordClosed = RecordClosed,
            GameSituation = GameSituation,
            Observations = Observations,
            Date = Date,
            Time = Time,
            Field = Field,
            FieldCode = FieldCode,
            Status = Status,
            StatusReason = StatusReason,
            MatchInProgress = MatchInProgress,
            ProvisionalResult = ProvisionalResult,
            Referee = Referee,
            Penalties = Penalties,
            ExtraTimeWin = ExtraTimeWin,
            ExtraTimeWinnerTeam = ExtraTimeWinnerTeam,
            LocalTeamCode = LocalTeamCode,
            LocalTeamName = LocalTeamName,
            LocalTeamImageUrl = LocalTeamImageUrl,
            LocalTeamWithdrawn = LocalTeamWithdrawn,
            LocalGoals = LocalGoals,
            LocalPenalties = LocalPenalties,
            VisitorTeamCode = VisitorTeamCode,
            VisitorTeamName = VisitorTeamName,
            VisitorTeamImageUrl = VisitorTeamImageUrl,
            VisitorTeamWithdrawn = VisitorTeamWithdrawn,
            VisitorGoals = VisitorGoals,
            VisitorPenalties = VisitorPenalties,
            OriginRecordCode = OriginRecordCode
        };

        private static RffmMatchSnapshot Normalize(RffmMatchSnapshot s) => s with
        {
            RecordCode = Clean(s.RecordCode),
            HasRecords = Clean(s.HasRecords),
            RecordClosed = Clean(s.RecordClosed),
            GameSituation = Clean(s.GameSituation),
            Observations = Clean(s.Observations),
            Date = Clean(s.Date),
            Time = Clean(s.Time),
            Field = Clean(s.Field),
            FieldCode = Clean(s.FieldCode),
            Status = Clean(s.Status),
            StatusReason = Clean(s.StatusReason),
            MatchInProgress = Clean(s.MatchInProgress),
            ProvisionalResult = Clean(s.ProvisionalResult),
            Referee = Clean(s.Referee),
            Penalties = Clean(s.Penalties),
            ExtraTimeWin = Clean(s.ExtraTimeWin),
            ExtraTimeWinnerTeam = Clean(s.ExtraTimeWinnerTeam),
            LocalTeamCode = Clean(s.LocalTeamCode),
            LocalTeamName = Clean(s.LocalTeamName),
            LocalTeamImageUrl = Clean(s.LocalTeamImageUrl),
            LocalTeamWithdrawn = Clean(s.LocalTeamWithdrawn),
            LocalGoals = Clean(s.LocalGoals),
            LocalPenalties = Clean(s.LocalPenalties),
            VisitorTeamCode = Clean(s.VisitorTeamCode),
            VisitorTeamName = Clean(s.VisitorTeamName),
            VisitorTeamImageUrl = Clean(s.VisitorTeamImageUrl),
            VisitorTeamWithdrawn = Clean(s.VisitorTeamWithdrawn),
            VisitorGoals = Clean(s.VisitorGoals),
            VisitorPenalties = Clean(s.VisitorPenalties),
            OriginRecordCode = Clean(s.OriginRecordCode)
        };

        private static string Clean(string? value) => value?.Trim() ?? string.Empty;

        private static DateOnly? ParseDate(string value) =>
            DateOnly.TryParseExact(value, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                ? date
                : null;

        private static TimeOnly? ParseTime(string value) =>
            TimeOnly.TryParseExact(value, TimeFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var time)
                ? time
                : null;
    }
}
