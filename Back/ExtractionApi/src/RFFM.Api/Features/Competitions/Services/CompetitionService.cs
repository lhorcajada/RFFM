using RFFM.Api.Features.Competitions.Models;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace RFFM.Api.Features.Competitions.Services
{
    public interface ICompetitionService
    {
        Task<ResponseCompetition[]> GetCompetitionsAsync(CancellationToken cancellationToken = default);
        Task<ResponseGroup[]> GetGroupsAsync(string competitionId, CancellationToken cancellationToken = default);
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

        // DTO matching API response for groups
        private class GroupDto
        {
            [JsonPropertyName("codigo")]
            public string Codigo { get; set; }

            [JsonPropertyName("nombre")]
            public string Nombre { get; set; }

            // other fields are ignored
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

    }
}
