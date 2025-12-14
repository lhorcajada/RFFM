using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;

namespace RFFM.Api.Features.Federation.Competitions.Services
{
    public interface ICalendarService
    {
        Task<CalendarResponse> GetCalendarAsync(int competicion, int groupId,
            CancellationToken cancellationToken = default);
    }

    public class CalendarService(
        IHttpClientFactory httpClientFactory,
        ICompetitionService competitionService)
        : ICalendarService
    {
        private const string ShieldBaseUrl = "https://appweb.rffm.es/";

        public async Task<CalendarResponse> GetCalendarAsync(int competicion, int groupId,
            CancellationToken cancellationToken = default)
        {
            var groups = await competitionService.GetGroupsAsync(competicion.ToString(), cancellationToken);
            var workingDays = groups.First(g => g.Id == groupId).WorkingDays;

            // Load classification once for the group to retrieve team positions
            var classification = await competitionService.GetClassification(groupId, cancellationToken);
            var positions = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var t in classification.Teams ?? new())
            {
                if (string.IsNullOrWhiteSpace(t.TeamId)) continue;
                if (int.TryParse(t.Position, out var p))
                    positions[t.TeamId.Trim()] = p;
                else
                    positions[t.TeamId.Trim()] = 0;
            }

            var calendarResponse = new CalendarResponse();
            for (var workingDayNumber = 1; workingDayNumber < workingDays; workingDayNumber++)
            {
                var workingDay = await GetWorkingDayAsync(groupId, workingDayNumber, positions, cancellationToken);
                calendarResponse.MatchDays.Add(workingDay);

            }
            return calendarResponse;
        }

        private async Task<CalendarMatchDayResponse> GetWorkingDayAsync(int groupId, int workingDayNumber, IReadOnlyDictionary<string,int> positions, CancellationToken cancellationToken = default)
        {
            // Construir URL: omitir jornada cuando es nula o <= 0 para solicitar todas las jornadas
            var url = $"https://www.rffm.es/api/results?idGroup={groupId}&round={workingDayNumber}";

            using var http = httpClientFactory.CreateClient();
            http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");
            var fetcher = new HtmlFetcher(http);
            var response = await fetcher.FetchAsync(url, cancellationToken);
            if (string.IsNullOrWhiteSpace(response))
                return new CalendarMatchDayResponse();

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            try
            {
                var calendarRffm = JsonSerializer.Deserialize<CalendarRffm>(response, options);
                var matches = new List<MatchResponse>();
                if (calendarRffm != null)
                {
                    matches.AddRange(calendarRffm.Matches.Select(m => new MatchResponse
                    {
                        MatchRecordCode = m.MatchRecordCode,
                        HasRecords = m.HasRecords,
                        RecordClosed = m.RecordClosed,
                        GameSituation = m.GameSituation,
                        Observations = m.Observations,
                        Date = DateTimeParser.ParseOrMinValue(m.Date),
                        Time = m.Time,
                        Field = m.Field,
                        FieldCode = m.FieldCode,
                        Status = m.Status, //1: Active, 0: Inactive
                        StatusReason = m.StatusReason,
                        MatchInProgress = m.MatchInProgress,
                        ProvisionalResult = m.ProvisionalResult,
                        Referee = m.Referee,
                        Penalties = m.Penalties,
                        ExtraTimeWin = m.ExtraTimeWin,
                        ExtraTimeWinnerTeam = m.ExtraTimeWinnerTeam,
                        LocalTeamCode = m.LocalTeamCode,
                        LocalTeamName = m.LocalTeamName,
                        LocalTeamImageUrl = $"{ShieldBaseUrl}{m.LocalTeamImageUrl}",
                        LocalTeamWithdrawn = m.LocalTeamWithdrawn,
                        LocalGoals = m.LocalGoals,
                        LocalPenalties = m.LocalPenalties,
                        VisitorTeamCode = m.VisitorTeamCode,
                        VisitorTeamName = m.VisitorTeamName,
                        VisitorTeamImageUrl = $"{ShieldBaseUrl}{m.VisitorTeamImageUrl}",
                        VisitorTeamWithdrawn = m.VisitorTeamWithdrawn,
                        VisitorGoals = m.VisitorGoals,
                        VisitorPenalties = m.VisitorPenalties,
                        OriginRecordCode = m.OriginRecordCode,

                        // Fill positions from classification (0 when unknown)
                        LocalTeamPosition = (m.LocalTeamCode != null && positions.TryGetValue(m.LocalTeamCode.Trim(), out var lp)) ? lp : 0,
                        VisitorTeamPosition = (m.VisitorTeamCode != null && positions.TryGetValue(m.VisitorTeamCode.Trim(), out var vp)) ? vp : 0
                    }));
                }

                return new CalendarMatchDayResponse
                {
                    Matches = matches,
                    Date = matches.Count > 0 ? matches[0].Date : DateTime.MinValue,
                    MatchDayNumber = workingDayNumber
                };
            }
            catch (JsonException)
            {
                return new CalendarMatchDayResponse();
            }
          
        }
    }
}
