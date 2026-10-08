using RFFM.Api.Features.Coaches.SportEvents.Queries;

namespace RFFM.Api.Features.Coaches.MatchReports
{
    /// <summary>
    /// Single source of truth for when a match report ("Ver acta") is available.
    /// </summary>
    public static class MatchReportRules
    {
        public const string FinishedPhase = "finished";

        public static bool HasFederationReport(int eventTypeId, string? codActa, string? localGoals, string? visitorGoals)
            => eventTypeId == SportEventsConstants.MatchEventTypeId
               && !string.IsNullOrWhiteSpace(codActa)
               && !string.IsNullOrWhiteSpace(localGoals)
               && !string.IsNullOrWhiteSpace(visitorGoals);

        public static string? MatchCategory(int eventTypeId) => eventTypeId switch
        {
            SportEventsConstants.MatchEventTypeId => "League",
            SportEventsConstants.FriendlyEventTypeId => "Friendly",
            SportEventsConstants.TournamentEventTypeId => "Tournament",
            _ => null
        };
    }
}
