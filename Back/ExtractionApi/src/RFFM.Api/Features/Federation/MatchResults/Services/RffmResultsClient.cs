using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;

namespace RFFM.Api.Features.Federation.MatchResults.Services
{
    public record RffmCompetitionInfo(int SeasonId, int Minutes, int Parts, RffmPointsSystem Points);

    /// <summary>
    /// Acceso a la RFFM desde peticiones de usuario: sin reintentos ni throttling (el usuario espera y,
    /// si falla, se sirven los datos guardados). Lanza HttpRequestException si la RFFM no responde.
    /// </summary>
    public interface IRffmResultsClient
    {
        Task<CalendarRffm?> GetRoundAsync(string groupCode, int round, CancellationToken cancellationToken);

        /// <summary>Busca la competición en las temporadas indicadas, por orden; null si no aparece.</summary>
        Task<RffmCompetitionInfo?> FindCompetitionAsync(string competitionCode, IReadOnlyList<int> seasonIds,
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

        public async Task<RffmCompetitionInfo?> FindCompetitionAsync(string competitionCode, IReadOnlyList<int> seasonIds,
            CancellationToken cancellationToken)
        {
            foreach (var seasonId in seasonIds.Distinct())
            {
                var competitions = await GetJsonAsync<List<CompetitionRffm>>(
                    $"api/competitions?temporada={seasonId}&tipojuego=1", cancellationToken);
                var competition = competitions?.FirstOrDefault(c => c.CompetitionId?.Trim() == competitionCode.Trim());
                if (competition == null) continue;

                var points = new RffmPointsSystem(
                    ParseOr(competition.PointsWin, RffmPointsSystem.Default.Win),
                    ParseOr(competition.PointsDraw, RffmPointsSystem.Default.Draw),
                    ParseOr(competition.PointsLoss, RffmPointsSystem.Default.Loss));
                return new RffmCompetitionInfo(seasonId, ParseOr(competition.MatchTime, 0), ParseOr(competition.MatchParts, 0), points);
            }

            return null;
        }

        private static int ParseOr(string? value, int fallback) =>
            int.TryParse(value?.Trim(), out var parsed) ? parsed : fallback;

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
