using System.Net;
using System.Text.Json;
using RFFM.Api.Features.Federation.Clubs.Models;
using RFFM.Api.Features.Federation.Clubs.Services;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Helpers;

namespace RFFM.Api.Features.Federation.SquadHistory.Services
{
    public record RffmGroupMatch(string RecordCode, string LocalTeamCode, string VisitorTeamCode);

    public record RffmCompetition(string Code, string Name, string CategoryGroup);

    public record RffmGroup(string Code, string Name);

    public record RffmGroupTeam(string TeamCode, string TeamName);

    public interface IRffmBackgroundClient
    {
        Task<TeamRffm?> GetTeamRosterAsync(string teamCode, CancellationToken cancellationToken);

        Task<IReadOnlyList<ClubTeamDirectoryItem>> GetClubTeamsAsync(string clubCode, int seasonId, CancellationToken cancellationToken);

        Task<IReadOnlyList<RffmCompetition>> GetCompetitionsAsync(int seasonId, CancellationToken cancellationToken);

        Task<IReadOnlyList<RffmGroup>> GetGroupsAsync(string competitionCode, CancellationToken cancellationToken);

        Task<IReadOnlyList<RffmGroupTeam>> GetGroupTeamsAsync(string groupCode, CancellationToken cancellationToken);

        Task<Player?> GetPlayerSheetAsync(string playerCode, int seasonId, CancellationToken cancellationToken);

        Task<IReadOnlyList<RffmGroupMatch>> GetGroupPlayedMatchesAsync(string groupCode, CancellationToken cancellationToken);

        /// <summary>Últimos <paramref name="count"/> partidos con acta del equipo en el grupo, del más reciente al más antiguo.</summary>
        Task<IReadOnlyList<RffmGroupMatch>> GetTeamLastPlayedMatchesAsync(string groupCode, string teamCode, int count,
            CancellationToken cancellationToken);

        Task<MatchRffm?> GetActaAsync(string recordCode, int seasonId, string competitionCode, string groupCode,
            CancellationToken cancellationToken);

        /// <summary>Clasificación del grupo tras la jornada indicada; null si la RFFM no la devuelve.</summary>
        Task<IReadOnlyList<TeamResponse>?> GetStandingsAsync(string groupCode, int round, CancellationToken cancellationToken);
    }

    /// <summary>
    /// Acceso a la RFFM para procesos en segundo plano: usa el cliente con reintentos y throttling.
    /// Devuelve null cuando el recurso no existe o no se puede interpretar; lanza HttpRequestException
    /// cuando el error de red persiste tras los reintentos.
    /// </summary>
    public class RffmBackgroundClient(IHttpClientFactory httpClientFactory, TimeProvider timeProvider) : IRffmBackgroundClient
    {
        private static readonly JsonSerializerOptions SerializerOptions = new() { PropertyNameCaseInsensitive = true };

        public async Task<TeamRffm?> GetTeamRosterAsync(string teamCode, CancellationToken cancellationToken)
        {
            var html = await GetStringOrNullAsync($"fichaequipo/{Uri.EscapeDataString(teamCode)}", cancellationToken);
            return html == null ? null : TeamSheetParser.Parse(html);
        }

        public async Task<IReadOnlyList<ClubTeamDirectoryItem>> GetClubTeamsAsync(string clubCode, int seasonId, CancellationToken cancellationToken)
        {
            var html = await GetStringOrNullAsync($"fichaclub/{Uri.EscapeDataString(clubCode)}?temporada={seasonId}", cancellationToken);
            return html == null ? [] : ClubSheetParser.ParseTeams(html);
        }

        public async Task<IReadOnlyList<RffmCompetition>> GetCompetitionsAsync(int seasonId, CancellationToken cancellationToken)
        {
            var competitions = await GetJsonAsync<List<CompetitionRffm>>($"api/competitions?temporada={seasonId}&tipojuego=1", cancellationToken);
            return (competitions ?? [])
                .Where(c => !string.IsNullOrWhiteSpace(c.CompetitionId))
                .Select(c => new RffmCompetition(c.CompetitionId.Trim(), c.Name?.Trim() ?? string.Empty, c.CategoryGroup?.Trim() ?? string.Empty))
                .ToList();
        }

        public async Task<IReadOnlyList<RffmGroup>> GetGroupsAsync(string competitionCode, CancellationToken cancellationToken)
        {
            var groups = await GetJsonAsync<List<GroupRffm>>($"api/groups?competicion={Uri.EscapeDataString(competitionCode)}", cancellationToken);
            return (groups ?? [])
                .Where(g => !string.IsNullOrWhiteSpace(g.Codigo))
                .Select(g => new RffmGroup(g.Codigo.Trim(), g.Nombre?.Trim() ?? string.Empty))
                .ToList();
        }

        public async Task<IReadOnlyList<RffmGroupTeam>> GetGroupTeamsAsync(string groupCode, CancellationToken cancellationToken)
        {
            var firstRound = await GetRoundAsync(groupCode, 1, cancellationToken);
            return (firstRound?.Matches ?? [])
                .SelectMany(m => new[]
                {
                    new RffmGroupTeam(m.LocalTeamCode?.Trim() ?? string.Empty, m.LocalTeamName?.Trim() ?? string.Empty),
                    new RffmGroupTeam(m.VisitorTeamCode?.Trim() ?? string.Empty, m.VisitorTeamName?.Trim() ?? string.Empty)
                })
                .Where(t => !string.IsNullOrWhiteSpace(t.TeamCode))
                .GroupBy(t => t.TeamCode)
                .Select(g => g.First())
                .ToList();
        }

        public async Task<Player?> GetPlayerSheetAsync(string playerCode, int seasonId, CancellationToken cancellationToken)
        {
            var html = await GetStringOrNullAsync($"fichajugador/{Uri.EscapeDataString(playerCode)}?temporada={seasonId}", cancellationToken);
            return html == null ? null : PlayerSheetParser.Parse(html, playerCode, seasonId);
        }

        public async Task<IReadOnlyList<RffmGroupMatch>> GetGroupPlayedMatchesAsync(string groupCode, CancellationToken cancellationToken)
        {
            var firstRound = await GetRoundAsync(groupCode, 1, cancellationToken);
            if (firstRound == null) return [];

            var matches = new List<RffmGroupMatch>(ToPlayedMatches(firstRound));
            var today = timeProvider.GetLocalNow().Date;

            foreach (var round in GetPastRoundNumbers(firstRound, today).Where(r => r != 1))
            {
                var calendar = await GetRoundAsync(groupCode, round, cancellationToken);
                if (calendar != null) matches.AddRange(ToPlayedMatches(calendar));
            }

            return matches
                .GroupBy(m => m.RecordCode, StringComparer.OrdinalIgnoreCase)
                .Select(g => g.First())
                .ToList();
        }

        public async Task<IReadOnlyList<RffmGroupMatch>> GetTeamLastPlayedMatchesAsync(string groupCode, string teamCode, int count,
            CancellationToken cancellationToken)
        {
            var firstRound = await GetRoundAsync(groupCode, 1, cancellationToken);
            if (firstRound == null) return [];

            teamCode = teamCode.Trim();
            var today = timeProvider.GetLocalNow().Date;
            var matches = new List<RffmGroupMatch>();
            foreach (var round in GetPastRoundNumbers(firstRound, today).OrderByDescending(r => r))
            {
                var calendar = round == 1 ? firstRound : await GetRoundAsync(groupCode, round, cancellationToken);
                if (calendar == null) continue;

                matches.AddRange(ToPlayedMatches(calendar).Where(m =>
                    string.Equals(m.LocalTeamCode, teamCode, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(m.VisitorTeamCode, teamCode, StringComparison.OrdinalIgnoreCase)));
                if (matches.Count >= count) break;
            }

            return matches.Take(count).ToList();
        }

        public async Task<MatchRffm?> GetActaAsync(string recordCode, int seasonId, string competitionCode, string groupCode,
            CancellationToken cancellationToken)
        {
            var url = $"acta-partido/{Uri.EscapeDataString(recordCode)}?temporada={seasonId}" +
                      $"&competicion={Uri.EscapeDataString(competitionCode)}&grupo={Uri.EscapeDataString(groupCode)}";
            var html = await GetStringOrNullAsync(url, cancellationToken);
            return html == null ? null : ActaParser.Parse(html);
        }

        public async Task<IReadOnlyList<TeamResponse>?> GetStandingsAsync(string groupCode, int round, CancellationToken cancellationToken)
        {
            var standings = await GetJsonAsync<StandingRffm>(
                $"api/standings?idGroup={Uri.EscapeDataString(groupCode)}&round={round}", cancellationToken);
            return standings == null ? null : StandingsMapper.ToTeams(standings);
        }

        private Task<CalendarRffm?> GetRoundAsync(string groupCode, int round, CancellationToken cancellationToken) =>
            GetJsonAsync<CalendarRffm>($"api/results?idGroup={Uri.EscapeDataString(groupCode)}&round={round}", cancellationToken);

        private async Task<T?> GetJsonAsync<T>(string relativeUrl, CancellationToken cancellationToken) where T : class
        {
            var json = await GetStringOrNullAsync(relativeUrl, cancellationToken);
            if (string.IsNullOrWhiteSpace(json)) return null;

            try
            {
                return JsonSerializer.Deserialize<T>(json, SerializerOptions);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static IEnumerable<int> GetPastRoundNumbers(CalendarRffm calendar, DateTime today)
        {
            var entries = calendar.MatchdayList.FirstOrDefault()?.Matchdays ?? [];
            foreach (var entry in entries)
            {
                if (!int.TryParse(entry.MatchdayCode?.Trim(), out var number)) continue;
                var isFuture = DateTimeParser.TryParseDate(entry.Date, out var date) && date.Date > today;
                if (!isFuture) yield return number;
            }
        }

        private static IEnumerable<RffmGroupMatch> ToPlayedMatches(CalendarRffm calendar) =>
            (calendar.Matches ?? [])
                .Where(m => !string.IsNullOrWhiteSpace(m.MatchRecordCode) && IsTruthy(m.HasRecords))
                .Select(m => new RffmGroupMatch(m.MatchRecordCode.Trim(), m.LocalTeamCode.Trim(), m.VisitorTeamCode.Trim()));

        private static bool IsTruthy(string? value)
        {
            var normalized = value?.Trim().ToLowerInvariant();
            return normalized is "1" or "true" or "si" or "s";
        }

        private async Task<string?> GetStringOrNullAsync(string relativeUrl, CancellationToken cancellationToken)
        {
            var http = httpClientFactory.CreateClient(RffmBackgroundHttp.ClientName);
            using var response = await http.GetAsync(relativeUrl, cancellationToken);
            if (response.StatusCode == HttpStatusCode.NotFound) return null;
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync(cancellationToken);
        }
    }
}
