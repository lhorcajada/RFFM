using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using static RFFM.Api.Features.Federation.Competitions.Queries.GetScores;

namespace RFFM.Api.Features.Federation.Competitions.Services
{
    public interface ICompetitionService
    {
        Task<ResponseCompetition[]> GetCompetitionsAsync(CancellationToken cancellationToken = default);
        Task<ResponseGroup[]> GetGroupsAsync(string competitionId, CancellationToken cancellationToken = default);

        Task<ResponseScores[]> GetScoresAsync(string competitionId, string groupId,
            CancellationToken cancellationToken = default);

        Task<ClassificationResponse> GetClassification(int groupId,
            CancellationToken cancellationToken);
    }

    public record ResponseCompetition(int CompetitionId, string Name, int MatchTime);
    public record ResponseGroup(int Id, string Name, int WorkingDays);

    public class CompetitionService : ICompetitionService
    {
        private readonly HttpClient _http;
        private readonly HtmlFetcher _fetcher;
        private readonly IMatchDayService _matchDayService;
        private const string CompetitionsUrl = "https://www.rffm.es/api/competitions";
        private const string GroupsUrl = "https://www.rffm.es/api/groups";
        private const string ScoresUrl = "https://www.rffm.es/api/scorers";
        private const string StandingsUrl = "https://www.rffm.es/api/standings";

        public CompetitionService(HttpClient http, IMatchDayService matchDayService)
        {
            _http = http;
            _matchDayService = matchDayService;
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");
            _fetcher = new HtmlFetcher(http);
        }

        public async Task<ResponseCompetition[]> GetCompetitionsAsync(CancellationToken cancellationToken = default)
        {
            var competitionsUrl = $"{CompetitionsUrl}?temporada=21&tipojuego=1";
            var content = await _fetcher.FetchAsync(competitionsUrl, cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(content))
                return [];

            try
            {
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var dtos = JsonSerializer.Deserialize<List<CompetitionRffm>>(content, options);
                if (dtos == null || dtos.Count == 0)
                    return [];

                var result = dtos
                    .Where(d => !string.IsNullOrWhiteSpace(d.CompetitionId) && !string.IsNullOrWhiteSpace(d.Name))
                    .Select(d => new ResponseCompetition(Convert.ToInt32(d.CompetitionId), d.Name.Trim(), Convert.ToInt32(d.MatchTime)))
                    .ToArray();

                return result;
            }
            catch
            {
                return [];
            }
        }

        public async Task<ResponseGroup[]> GetGroupsAsync(string competitionId, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(competitionId))
                return [];

            try
            {
                var apiUrl = $"{GroupsUrl}?competicion={Uri.EscapeDataString(competitionId)}";
                using var resp = await _http.GetAsync(apiUrl, cancellationToken).ConfigureAwait(false);
                if (!resp.IsSuccessStatusCode)
                    return [];

                var json = await resp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                if (string.IsNullOrWhiteSpace(json))
                    return [];

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var dtos = JsonSerializer.Deserialize<List<GroupRffm>>(json, options);
                if (dtos == null || dtos.Count == 0)
                    return [];

                var result = dtos
                    .Where(d => !string.IsNullOrWhiteSpace(d.Codigo) && !string.IsNullOrWhiteSpace(d.Nombre))
                    .Select(d => new ResponseGroup(Convert.ToInt32(d.Codigo), d.Nombre.Trim(), Convert.ToInt32(d.Jornadas)))
                    .ToArray();

                return result;
            }
            catch
            {
                return [];
            }
        }

        public async Task<ResponseScores[]> GetScoresAsync(string competitionId, string groupId, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(competitionId) || string.IsNullOrEmpty(groupId))
                return [];

            try
            {
                var apiUrl = $"{ScoresUrl}?idGroup={Uri.EscapeDataString(groupId)}&idCompetition={Uri.EscapeDataString(competitionId)}";
                using var resp = await _http.GetAsync(apiUrl, cancellationToken).ConfigureAwait(false);
                if (!resp.IsSuccessStatusCode)
                    return [];

                var json = await resp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                if (string.IsNullOrWhiteSpace(json))
                    return [];

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var dtos = JsonSerializer.Deserialize<GoalsRffm>(json, options);
                if (dtos == null)
                    return [];

                var result = dtos.Goals
                    .Select(g => new ResponseScores
                    {
                        TeamId = g.TeamCode,
                        TeamName = g.TeamName,
                        AverageScores = string.IsNullOrEmpty(g.GoalsPerMatch) ? 0 : Convert.ToDecimal(g.GoalsPerMatch),
                        MatchesPlayed = string.IsNullOrEmpty(g.MatchesPlayed) ? 0 : Convert.ToInt32(g.MatchesPlayed),
                        PenaltyScores = string.IsNullOrEmpty(g.PenaltyGoals) ? 0 : Convert.ToInt32(g.PenaltyGoals),
                        PlayerId = g.PlayerCode,
                        PlayerName = g.PlayerName,
                        Scores = string.IsNullOrEmpty(g.Goals) ? 0 : Convert.ToInt32(g.Goals)
                    })
                    .ToArray();

                return result;
            }
            catch
            {
                return [];
            }
        }

        public async Task<ClassificationResponse> GetClassification(int groupId, CancellationToken cancellationToken)
        {
            var activeMatchDay = await _matchDayService.GetActiveMatchDay(groupId, cancellationToken);
            if (activeMatchDay == null)
                return new ClassificationResponse();
            var url =
                $"{StandingsUrl}?idGroup={groupId}&round={activeMatchDay.MatchDayNumber}";

            using var resp = await _http.GetAsync(url, cancellationToken).ConfigureAwait(false);
            if (!resp.IsSuccessStatusCode)
                return new ClassificationResponse();

            var json = await resp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(json))
                return new ClassificationResponse();

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var dtos = JsonSerializer.Deserialize<StandingRffm>(json, options);
            if (dtos == null)
                return new ClassificationResponse();

            var teams = dtos.Classification
                .Select(d => new TeamResponse
                {
                    Color = d.Color?.Trim() ?? string.Empty,
                    Position = d.Position?.Trim() ?? string.Empty,
                    ImageUrl = d.ImageUrl?.Trim() ?? string.Empty,
                    TeamId = d.TeamId?.Trim() ?? string.Empty,
                    TeamName = d.TeamName?.Trim() ?? string.Empty,
                    Played = d.Played?.Trim() ?? string.Empty,
                    Won = d.Won?.Trim() ?? string.Empty,
                    Lost = d.Lost?.Trim() ?? string.Empty,
                    Drawn = d.Drawn?.Trim() ?? string.Empty,
                    Penalties = d.Penalties?.Trim() ?? string.Empty,
                    GoalsFor = d.GoalsFor?.Trim() ?? string.Empty,
                    GoalsAgainst = d.GoalsAgainst?.Trim() ?? string.Empty,
                    HomePlayed = d.HomePlayed?.Trim() ?? string.Empty,
                    HomeWon = d.HomeWon?.Trim() ?? string.Empty,
                    HomeDrawn = d.HomeDrawn?.Trim() ?? string.Empty,
                    HomePenaltyWins = d.HomePenaltyWins?.Trim() ?? string.Empty,
                    HomeLost = d.HomeLost?.Trim() ?? string.Empty,
                    AwayPlayed = d.AwayPlayed?.Trim() ?? string.Empty,
                    AwayWon = d.AwayWon?.Trim() ?? string.Empty,
                    AwayDrawn = d.AwayDrawn?.Trim() ?? string.Empty,
                    AwayPenaltyWins = d.AwayPenaltyWins?.Trim() ?? string.Empty,
                    AwayLost = d.AwayLost?.Trim() ?? string.Empty,
                    Points = d.Points?.Trim() ?? string.Empty,
                    SanctionPoints = d.SanctionPoints?.Trim() ?? string.Empty,
                    HomePoints = d.HomePoints?.Trim() ?? string.Empty,
                    AwayPoints = d.AwayPoints?.Trim() ?? string.Empty,
                    ShowCoefficient = d.ShowCoefficient?.Trim() ?? string.Empty,
                    Coefficient = d.Coefficient?.Trim() ?? string.Empty,
                    MatchStreaks = d.MatchStreaks?.Select(ms => new MatchStreakResponse
                    {
                        Type = ms.Type?.Trim() ?? string.Empty
                    }).ToList() ?? []

                })
                .ToList();

            return new ClassificationResponse
            {
                Teams = teams
            };


        }


    }
}
