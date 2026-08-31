namespace RFFM.Api.Features.Coaches.SportEvents.Queries
{
    public static class SportEventsConstants
    {
        public const string SportEventsFeature = "SportEventsFeature";
        public const string CachePrefix = SportEventsFeature;
        /// <summary>SportEventType.Id for "Partido" (match).</summary>
        public const int MatchEventTypeId = 1;
        /// <summary>SportEventType.Id for "Amistoso" (friendly match).</summary>
        public const int FriendlyEventTypeId = 4;
        /// <summary>SportEventType.Id for "Torneo" (tournament).</summary>
        public const int TournamentEventTypeId = 6;
    }
}