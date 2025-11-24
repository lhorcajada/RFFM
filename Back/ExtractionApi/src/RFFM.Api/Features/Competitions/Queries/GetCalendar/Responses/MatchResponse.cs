namespace RFFM.Api.Features.Competitions.Queries.GetCalendar.Responses
{
    public class MatchResponse
    {
        public string MatchRecordCode { get; set; } = string.Empty;
        public string HasRecords { get; set; } = string.Empty;
        public string RecordClosed { get; set; } = string.Empty;
        public string GameSituation { get; set; } = string.Empty;
        public string Observations { get; set; } = string.Empty;
        // Keep date as string because the API returns dates in formats like "22/11/2025"
        public DateTime Date { get; set; } 
        public string Time { get; set; } = string.Empty;
        public string Field { get; set; } = string.Empty;
        public string FieldCode { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string StatusReason { get; set; } = string.Empty;
        public string MatchInProgress { get; set; } = string.Empty;
        public string ProvisionalResult { get; set; } = string.Empty;
        public string Referee { get; set; } = string.Empty;
        public string Penalties { get; set; } = string.Empty;
        public string ExtraTimeWin { get; set; } = string.Empty;
        public string ExtraTimeWinnerTeam { get; set; } = string.Empty;
        public string LocalTeamCode { get; set; } = string.Empty;
        public string LocalTeamName { get; set; } = string.Empty;
        public string LocalTeamImageUrl { get; set; } = string.Empty;
        public string LocalTeamWithdrawn { get; set; } = string.Empty;
        public string LocalGoals { get; set; } = string.Empty;
        public string LocalPenalties { get; set; } = string.Empty;
        public string VisitorTeamCode { get; set; } = string.Empty;
        public string VisitorTeamName { get; set; } = string.Empty;
        public string VisitorTeamImageUrl { get; set; } = string.Empty;
        public string VisitorTeamWithdrawn { get; set; } = string.Empty;
        public string VisitorGoals { get; set; } = string.Empty;
        public string VisitorPenalties { get; set; } = string.Empty;
        public string OriginRecordCode { get; set; } = string.Empty;
    }
}
