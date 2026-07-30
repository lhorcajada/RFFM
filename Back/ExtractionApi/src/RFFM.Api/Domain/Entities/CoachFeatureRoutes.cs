namespace RFFM.Api.Domain.Entities
{
    /// <summary>
    /// Stable logical identifiers for Coach-app feature areas, used as FeaturePermission.FeatureRoute.
    /// These are NOT literal frontend URLs — they are agreed-upon logical route identifiers shared
    /// between backend enforcement and (eventually) frontend card visibility.
    /// </summary>
    public static class CoachFeatureRoutes
    {
        // Allowed for Player (Read-only)
        public const string Squad = "/coach/squad";
        public const string Events = "/coach/attendance";
        public const string AttendanceSummary = "/coach/attendance/summary";
        public const string Convocations = "/coach/convocations";
        public const string Injured = "/coach/injured";
        public const string Sanctions = "/coach/sanctions";
        public const string Lottery = "/coach/lottery";
        public const string News = "/coach/news";
        public const string AttendanceConfirmation = "/mobile/attendance";
        public const string PlayerSeasonCards = "/mobile/season-cards";
        public const string CompetitionData = "/mobile/competition-data";
        public const string TeamRulesDocument = "/mobile/team-rules";

        // Blocked for Player
        public const string Rivals = "/coach/rivals";
        public const string Trainings = "/coach/trainings";
        public const string GameModel = "/coach/game-model";
        public const string SeasonAccess = "/coach/season-access";
        public const string Settings = "/coach/settings";
        public const string ClubManagement = "/coach/clubs";
        public const string ClubPlayers = "/coach/clubs/players";
        public const string ClubTeams = "/coach/clubs/teams";
        public const string ClubRegistrations = "/coach/clubs/registrations";
    }
}
