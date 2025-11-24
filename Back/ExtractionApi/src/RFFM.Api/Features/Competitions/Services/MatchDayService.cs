using RFFM.Api.Features.Competitions.Models;
using RFFM.Api.Features.Competitions.Models.ApiRffm;
using RFFM.Api.Features.Teams.Models;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Globalization;

namespace RFFM.Api.Features.Competitions.Services
{
    public interface IMatchDayService
    {
        Task<List<MatchDayResponse>> GetMatchDays(int groupId, CancellationToken cancellationToken);
        Task<MatchDayResponse?> GetActiveMatchDay(int groupId, CancellationToken cancellationToken);
    }
    public class MatchDayService : IMatchDayService
    {
        private const string GroupRoundsUrl = "https://www.rffm.es/api/group-rounds";
        private readonly HttpClient _http;
        private readonly HtmlFetcher _fetcher;

        public async Task<List<MatchDayResponse>> GetMatchDays(int groupId, CancellationToken cancellationToken)
        {
            var url = $"{GroupRoundsUrl}?idGroup={groupId}&fetchBy=standings";
            using var http = new HttpClient();
            // add a simple User-Agent to avoid some servers rejecting the request
            http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

            var htmlFetcher = new HtmlFetcher(http);
            var content = await htmlFetcher.FetchAsync(url, cancellationToken);
            if (string.IsNullOrWhiteSpace(content))
                return new List<MatchDayResponse>();


            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var dtos = JsonSerializer.Deserialize<GroupRoundRffm>(content, options);
            return dtos.MatchDays.Select(m => new MatchDayResponse
            {
                MatchDayDate = DateTimeParser.ParseOrMinValue(m.MatchDayDate),
                MatchDayNumber = Convert.ToInt32(m.MatchDayCode)
            }).ToList();

        }

        public async Task<MatchDayResponse?> GetActiveMatchDay(int groupId, CancellationToken cancellationToken)
        {
            var matchDays = await GetMatchDays(groupId, cancellationToken);
            if (matchDays.Count == 0)
                return null;

            // Compute local week range: Monday 00:00 .. Sunday 23:59:59.999
            var now = DateTime.Now;
            var day = (int)now.DayOfWeek; // 0 = Sunday, 1 = Monday ...
            var diffToMonday = day == 0 ? -6 : 1 - day;
            var monday = now.Date.AddDays(diffToMonday);
            var sunday = monday.AddDays(6);

            // Find match days with a valid date inside current Monday..Sunday
            var inWeek = matchDays
                .Where(m => m.MatchDayDate != DateTime.MinValue)
                .Where(m => m.MatchDayDate.Date >= monday && m.MatchDayDate.Date <= sunday)
                .OrderBy(m => m.MatchDayDate)
                .ToList();

            if (inWeek.Any())
            {
                // If multiple, return the last (most recent in that week)
                return inWeek.Last();
            }

            // Fallback: prefer the next upcoming jornada (after this week)
            var upcoming = matchDays
                .Where(m => m.MatchDayDate != DateTime.MinValue && m.MatchDayDate.Date > sunday)
                .OrderBy(m => m.MatchDayDate)
                .FirstOrDefault();
            if (upcoming != null) return upcoming;

            // Otherwise return the most recent past jornada
            var lastPast = matchDays
                .Where(m => m.MatchDayDate != DateTime.MinValue && m.MatchDayDate.Date < monday)
                .OrderByDescending(m => m.MatchDayDate)
                .FirstOrDefault();

            return lastPast;
        }


    }
}
