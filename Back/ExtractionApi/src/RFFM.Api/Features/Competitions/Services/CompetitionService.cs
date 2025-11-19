using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Text.Json.Serialization;
using static RFFM.Api.Features.Competitions.Queries.GetScores;

namespace RFFM.Api.Features.Competitions.Services
{
    public interface ICompetitionService
    {
        Task<ResponseCompetition[]> GetCompetitionsAsync(CancellationToken cancellationToken = default);
        Task<ResponseGroup[]> GetGroupsAsync(string competitionId, CancellationToken cancellationToken = default);

        Task<ResponseScores[]> GetScoresAsync(string competitionId, string groupId,
            CancellationToken cancellationToken = default);
    }

    public record ResponseCompetition(string Id, string Name);
    public record ResponseGroup(string Id, string Name);

    public class CompetitionService : ICompetitionService
    {
        private readonly HttpClient _http;
        private readonly HtmlFetcher _fetcher;
        private const string BaseUrl = "https://www.rffm.es/api/competitions";

        public CompetitionService(HttpClient http)
        {
            _http = http;
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");
            _fetcher = new HtmlFetcher(http);
        }

        // DTO matching API/embedded JSON response for competitions
        private class CompetitionDto
        {
            [JsonPropertyName("codigo")]
            public string Codigo { get; set; }

            [JsonPropertyName("nombre")]
            public string Nombre { get; set; }

            // other fields ignored
        }

        public async Task<ResponseCompetition[]> GetCompetitionsAsync(CancellationToken cancellationToken = default)
        {
            var competitionsUrl = $"{BaseUrl}?temporada=21&tipojuego=1";
            var content = await _fetcher.FetchAsync(competitionsUrl, cancellationToken).ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(content))
                return Array.Empty<ResponseCompetition>();

            try
            {
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var dtos = JsonSerializer.Deserialize<List<CompetitionDto>>(content, options);
                if (dtos == null || dtos.Count == 0)
                    return Array.Empty<ResponseCompetition>();

                var result = dtos
                    .Where(d => !string.IsNullOrWhiteSpace(d.Codigo) && !string.IsNullOrWhiteSpace(d.Nombre))
                    .Select(d => new ResponseCompetition(d.Codigo.Trim(), d.Nombre.Trim()))
                    .ToArray();

                return result;
            }
            catch
            {
                return Array.Empty<ResponseCompetition>();
            }
        }

        public async Task<ResponseGroup[]> GetGroupsAsync(string competitionId, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(competitionId))
                return Array.Empty<ResponseGroup>();

            try
            {
                var apiUrl = $"https://www.rffm.es/api/groups?competicion={Uri.EscapeDataString(competitionId)}";
                using var resp = await _http.GetAsync(apiUrl, cancellationToken).ConfigureAwait(false);
                if (!resp.IsSuccessStatusCode)
                    return Array.Empty<ResponseGroup>();

                var json = await resp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                if (string.IsNullOrWhiteSpace(json))
                    return Array.Empty<ResponseGroup>();

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var dtos = JsonSerializer.Deserialize<List<GroupDto>>(json, options);
                if (dtos == null || dtos.Count == 0)
                    return Array.Empty<ResponseGroup>();

                var result = dtos
                    .Where(d => !string.IsNullOrWhiteSpace(d.Codigo) && !string.IsNullOrWhiteSpace(d.Nombre))
                    .Select(d => new ResponseGroup(d.Codigo.Trim(), d.Nombre.Trim()))
                    .ToArray();

                return result;
            }
            catch
            {
                return Array.Empty<ResponseGroup>();
            }
        }

        // DTO matching API response for groups
        private class GroupDto
        {
            [JsonPropertyName("codigo")]
            public string Codigo { get; set; }

            [JsonPropertyName("nombre")]
            public string Nombre { get; set; }

            // other fields are ignored
        }

        public class GoalsRffm
        {
            [JsonPropertyName("estado")]
            public string Status { get; set; } = string.Empty;

            [JsonPropertyName("sesion_ok")]
            public string SessionOk { get; set; } = string.Empty;

            [JsonPropertyName("competicion")]
            public string Competition { get; set; } = string.Empty;

            [JsonPropertyName("grupo")]
            public string Group { get; set; } = string.Empty;

            [JsonPropertyName("goles")]
            public List<GoalStat> Goals { get; set; } = new();
        }

        public class GoalStat
        {
            [JsonPropertyName("codigo_jugador")]
            public string PlayerCode { get; set; } = string.Empty;

            [JsonPropertyName("foto")]
            public string Photo { get; set; } = string.Empty;

            [JsonPropertyName("jugador")]
            public string PlayerName { get; set; } = string.Empty;

            [JsonPropertyName("escudo_equipo")]
            public string TeamShield { get; set; } = string.Empty;

            [JsonPropertyName("nombre_equipo")]
            public string TeamName { get; set; } = string.Empty;

            [JsonPropertyName("codigo_equipo")]
            public string TeamCode { get; set; } = string.Empty;

            [JsonPropertyName("partidos_jugados")]
            public string MatchesPlayed { get; set; } = string.Empty;

            [JsonPropertyName("goles")]
            public string Goals { get; set; } = string.Empty;

            [JsonPropertyName("goles_penalti")]
            public string PenaltyGoals { get; set; } = string.Empty;

            [JsonPropertyName("goles_por_partidos")]
            public string GoalsPerMatch { get; set; } = string.Empty;
        }


        public async Task<ResponseScores[]> GetScoresAsync(string competitionId, string groupId, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(competitionId) || string.IsNullOrEmpty(groupId))
                return Array.Empty<ResponseScores>();

            try
            {
                var apiUrl = $"https://www.rffm.es/api/scorers?idGroup={Uri.EscapeDataString(groupId)}&idCompetition={Uri.EscapeDataString(competitionId)}";
                using var resp = await _http.GetAsync(apiUrl, cancellationToken).ConfigureAwait(false);
                if (!resp.IsSuccessStatusCode)
                    return Array.Empty<ResponseScores>();

                var json = await resp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                if (string.IsNullOrWhiteSpace(json))
                    return Array.Empty<ResponseScores>();

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var dtos = JsonSerializer.Deserialize<GoalsRffm>(json, options);
                if (dtos == null)
                    return Array.Empty<ResponseScores>();

                var result = dtos.Goals
                    .Select(g => new ResponseScores
                    {
                        TeamId = g.TeamCode,
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
                return Array.Empty<ResponseScores>();
            }
        }



    }
}
