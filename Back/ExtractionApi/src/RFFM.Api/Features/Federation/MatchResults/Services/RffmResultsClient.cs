using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;

namespace RFFM.Api.Features.Federation.MatchResults.Services
{
    public record RffmCompetitionDuration(int Minutes, int Parts);

    /// <summary>
    /// Acceso a la RFFM desde peticiones de usuario: sin reintentos ni throttling (el usuario espera y,
    /// si falla, se sirven los datos guardados). Lanza HttpRequestException si la RFFM no responde.
    /// </summary>
    public interface IRffmResultsClient
    {
        Task<CalendarRffm?> GetRoundAsync(string groupCode, int round, CancellationToken cancellationToken);

        Task<RffmCompetitionDuration?> GetCompetitionDurationAsync(int seasonId, string competitionCode,
            CancellationToken cancellationToken);
    }

    public class RffmResultsClient(IHttpClientFactory httpClientFactory) : IRffmResultsClient
    {
        public const string ClientName = "RffmResults";
        private static readonly JsonSerializerOptions SerializerOptions = new() { PropertyNameCaseInsensitive = true };

        public static IHttpClientBuilder AddRffmResultsHttpClient(IServiceCollection services) =>
            services.AddHttpClient(ClientName, c =>
            {
                c.BaseAddress = new Uri("https://www.rffm.es/");
                c.Timeout = TimeSpan.FromSeconds(10);
                c.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");
            });

        public Task<CalendarRffm?> GetRoundAsync(string groupCode, int round, CancellationToken cancellationToken) =>
            GetJsonAsync<CalendarRffm>($"api/results?idGroup={Uri.EscapeDataString(groupCode)}&round={round}", cancellationToken);

        public async Task<RffmCompetitionDuration?> GetCompetitionDurationAsync(int seasonId, string competitionCode,
            CancellationToken cancellationToken)
        {
            var competitions = await GetJsonAsync<List<CompetitionRffm>>(
                $"api/competitions?temporada={seasonId}&tipojuego=1", cancellationToken);
            var competition = competitions?.FirstOrDefault(c => c.CompetitionId?.Trim() == competitionCode.Trim());
            if (competition == null) return null;

            var hasMinutes = int.TryParse(competition.MatchTime?.Trim(), out var minutes) && minutes > 0;
            var hasParts = int.TryParse(competition.MatchParts?.Trim(), out var parts) && parts > 0;
            return hasMinutes ? new RffmCompetitionDuration(minutes, hasParts ? parts : 2) : null;
        }

        private async Task<T?> GetJsonAsync<T>(string relativeUrl, CancellationToken cancellationToken) where T : class
        {
            var http = httpClientFactory.CreateClient(ClientName);
            using var response = await http.GetAsync(relativeUrl, cancellationToken);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync(cancellationToken);
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
    }
}
