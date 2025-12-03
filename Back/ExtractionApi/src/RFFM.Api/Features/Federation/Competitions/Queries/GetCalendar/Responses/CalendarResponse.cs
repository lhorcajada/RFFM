namespace RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses
{
    public class CalendarResponse
    {
       public List<CalendarMatchDayResponse> MatchDays { get; set; } = new();
    }

    public class CalendarMatchDayResponse
    {
        // Keep date as string because the API returns dates in formats like "22/11/2025"
        public DateTime Date { get; set; }
        public int MatchDayNumber { get; set; }
        public List<MatchResponse> Matches { get; set; } = new();
    }
}
