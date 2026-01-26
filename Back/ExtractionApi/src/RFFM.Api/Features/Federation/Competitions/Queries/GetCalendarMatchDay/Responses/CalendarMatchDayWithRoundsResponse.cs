using System;
using System.Collections.Generic;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;

namespace RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay.Responses
{
    public class CalendarMatchDayWithRoundsResponse
    {
        public int Round { get; set; }
        public string CompetitionName { get; set; } = string.Empty;
        public string GroupName { get; set; } = string.Empty;
        public int GroupId { get; set; }

        public List<CalendarRoundInfoResponse> Rounds { get; set; } = new();
        public CalendarMatchDayResponse MatchDay { get; set; } = new();
    }

    public class CalendarRoundInfoResponse
    {
        public int MatchDayNumber { get; set; }
        public DateTime Date { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}
