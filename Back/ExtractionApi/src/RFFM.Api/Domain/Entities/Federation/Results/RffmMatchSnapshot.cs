namespace RFFM.Api.Domain.Entities.Federation.Results
{
    /// <summary>Partido tal como lo devuelve la RFFM en <c>api/results</c> (valores en crudo).</summary>
    public record RffmMatchSnapshot
    {
        public string RecordCode { get; init; } = string.Empty;
        public string HasRecords { get; init; } = string.Empty;
        public string RecordClosed { get; init; } = string.Empty;
        public string GameSituation { get; init; } = string.Empty;
        public string Observations { get; init; } = string.Empty;
        public string Date { get; init; } = string.Empty;
        public string Time { get; init; } = string.Empty;
        public string Field { get; init; } = string.Empty;
        public string FieldCode { get; init; } = string.Empty;
        public string Status { get; init; } = string.Empty;
        public string StatusReason { get; init; } = string.Empty;
        public string MatchInProgress { get; init; } = string.Empty;
        public string ProvisionalResult { get; init; } = string.Empty;
        public string Referee { get; init; } = string.Empty;
        public string Penalties { get; init; } = string.Empty;
        public string ExtraTimeWin { get; init; } = string.Empty;
        public string ExtraTimeWinnerTeam { get; init; } = string.Empty;
        public string LocalTeamCode { get; init; } = string.Empty;
        public string LocalTeamName { get; init; } = string.Empty;
        public string LocalTeamImageUrl { get; init; } = string.Empty;
        public string LocalTeamWithdrawn { get; init; } = string.Empty;
        public string LocalGoals { get; init; } = string.Empty;
        public string LocalPenalties { get; init; } = string.Empty;
        public string VisitorTeamCode { get; init; } = string.Empty;
        public string VisitorTeamName { get; init; } = string.Empty;
        public string VisitorTeamImageUrl { get; init; } = string.Empty;
        public string VisitorTeamWithdrawn { get; init; } = string.Empty;
        public string VisitorGoals { get; init; } = string.Empty;
        public string VisitorPenalties { get; init; } = string.Empty;
        public string OriginRecordCode { get; init; } = string.Empty;
    }
}
