using System.Text.Json;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay.Responses;
using RFFM.Api.Infrastructure.Helpers;

namespace RFFM.Api.Features.Federation.MatchResults.Services
{
    public record RffmRoundInfo(int Number, string Name, DateOnly? Date);

    /// <summary>
    /// Traduce entre la respuesta de la RFFM, las entidades guardadas y la respuesta de
    /// <c>GET /calendar/matchday</c>, que se mantiene idéntica a cuando se leía directamente de la RFFM.
    /// </summary>
    public static class RffmMatchDayMapper
    {
        private const string ShieldBaseUrl = "https://appweb.rffm.es/";
        private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

        public static IReadOnlyList<RffmRoundInfo> ToRoundInfos(CalendarRffm calendar) =>
            (calendar.MatchdayList?.FirstOrDefault()?.Matchdays ?? [])
                .Select(md => int.TryParse(md.MatchdayCode?.Trim(), out var number)
                    ? new RffmRoundInfo(number, md.Name?.Trim() ?? string.Empty, ToDateOnly(md.Date))
                    : null)
                .OfType<RffmRoundInfo>()
                .ToList();

        public static IReadOnlyList<RffmMatchSnapshot> ToSnapshots(CalendarRffm calendar) =>
            (calendar.Matches ?? [])
                .Select(m => new RffmMatchSnapshot
                {
                    RecordCode = m.MatchRecordCode,
                    HasRecords = m.HasRecords,
                    RecordClosed = m.RecordClosed,
                    GameSituation = m.GameSituation,
                    Observations = m.Observations,
                    Date = m.Date,
                    Time = m.Time,
                    Field = m.Field,
                    FieldCode = m.FieldCode,
                    Status = m.Status,
                    StatusReason = m.StatusReason,
                    MatchInProgress = m.MatchInProgress,
                    ProvisionalResult = m.ProvisionalResult,
                    Referee = m.Referee,
                    Penalties = m.Penalties,
                    ExtraTimeWin = m.ExtraTimeWin,
                    ExtraTimeWinnerTeam = m.ExtraTimeWinnerTeam,
                    LocalTeamCode = m.LocalTeamCode,
                    LocalTeamName = m.LocalTeamName,
                    LocalTeamImageUrl = m.LocalTeamImageUrl,
                    LocalTeamWithdrawn = m.LocalTeamWithdrawn,
                    LocalGoals = m.LocalGoals,
                    LocalPenalties = m.LocalPenalties,
                    VisitorTeamCode = m.VisitorTeamCode,
                    VisitorTeamName = m.VisitorTeamName,
                    VisitorTeamImageUrl = m.VisitorTeamImageUrl,
                    VisitorTeamWithdrawn = m.VisitorTeamWithdrawn,
                    VisitorGoals = m.VisitorGoals,
                    VisitorPenalties = m.VisitorPenalties,
                    OriginRecordCode = m.OriginRecordCode
                })
                .ToList();

        public static CalendarMatchDayWithRoundsResponse ToResponse(int groupId, int round, RffmCompetitionGroup group,
            IReadOnlyCollection<RffmRound> rounds)
        {
            var positions = ParsePositions(group.StandingsJson);
            var selected = rounds.FirstOrDefault(r => r.Number == round);
            var matches = (selected?.Matches ?? [])
                .OrderBy(m => m.SortOrder)
                .Select(m => ToMatchResponse(m, positions))
                .ToList();

            return new CalendarMatchDayWithRoundsResponse
            {
                Round = round,
                GroupId = groupId,
                CompetitionName = group.CompetitionName,
                GroupName = group.GroupName,
                Rounds = rounds
                    .OrderBy(r => r.Number)
                    .Select(r => new CalendarRoundInfoResponse
                    {
                        MatchDayNumber = r.Number,
                        Name = r.Name,
                        Date = r.Date?.ToDateTime(TimeOnly.MinValue) ?? DateTime.MinValue
                    })
                    .ToList(),
                MatchDay = new CalendarMatchDayResponse
                {
                    Matches = matches,
                    Date = matches.Count > 0 ? matches[0].Date : DateTime.MinValue,
                    MatchDayNumber = round
                }
            };
        }

        public static string SerializeStandings(IReadOnlyList<TeamResponse> teams) => JsonSerializer.Serialize(teams);

        private static IReadOnlyDictionary<string, int> ParsePositions(string? standingsJson)
        {
            var positions = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(standingsJson))
                return positions;

            List<TeamResponse>? teams;
            try
            {
                teams = JsonSerializer.Deserialize<List<TeamResponse>>(standingsJson, JsonOptions);
            }
            catch (JsonException)
            {
                return positions;
            }

            foreach (var team in teams ?? [])
            {
                if (string.IsNullOrWhiteSpace(team.TeamId)) continue;
                positions[team.TeamId.Trim()] = int.TryParse(team.Position, out var position) ? position : 0;
            }

            return positions;
        }

        private static MatchResponse ToMatchResponse(RffmMatch m, IReadOnlyDictionary<string, int> positions) => new()
        {
            MatchRecordCode = m.RecordCode,
            HasRecords = m.HasRecords,
            RecordClosed = m.RecordClosed,
            GameSituation = m.GameSituation,
            Observations = m.Observations,
            Date = DateTimeParser.ParseOrMinValue(m.Date),
            Time = m.Time,
            Field = m.Field,
            FieldCode = m.FieldCode,
            Status = m.Status,
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
            LocalTeamPosition = positions.GetValueOrDefault(m.LocalTeamCode),
            VisitorTeamPosition = positions.GetValueOrDefault(m.VisitorTeamCode)
        };

        private static DateOnly? ToDateOnly(string? value) =>
            DateTimeParser.TryParseDate(value, out var date) ? DateOnly.FromDateTime(date) : null;
    }
}
