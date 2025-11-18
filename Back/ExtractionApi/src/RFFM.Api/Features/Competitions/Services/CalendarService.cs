using RFFM.Api.Features.Competitions.Models;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace RFFM.Api.Features.Competitions.Services
{
    public interface ICalendarService
    {
        Task<Calendar?> GetCalendarAsync(int temporada, int competicion, int grupo, int? jornada, int tipojuego, CancellationToken cancellationToken = default);
    }

    public class CalendarService : ICalendarService
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public CalendarService(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<Calendar?> GetCalendarAsync(int temporada, int competicion, int grupo, int? jornada, int tipojuego, CancellationToken cancellationToken = default)
        {
            // Construir URL: omitir jornada cuando es nula o <= 0 para solicitar todas las jornadas
            var baseUrl = $"https://www.rffm.es/competicion/calendario?temporada={temporada}&competicion={competicion}&grupo={grupo}&tipojuego={tipojuego}";
            var url = (jornada.HasValue && jornada.Value > 0) ? baseUrl + $"&jornada={jornada.Value}" : baseUrl;

            using var http = _httpClientFactory.CreateClient();
            http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");
            var fetcher = new HtmlFetcher(http);
            var html = await fetcher.FetchAsync(url, cancellationToken);
            if (string.IsNullOrWhiteSpace(html))
                return null;

            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            try
            {
                // Buscar script de tipo application/ld+json que normalmente contiene los eventos

                try
                {
                    var calendarElement = CalendarService.ExtractCalendarFromHtml(html);
                    var calendar = JsonSerializer.Deserialize<Calendar>(calendarElement.GetRawText(), options);
                    return calendar;
                }
                catch (JsonException)
                {
                    // No se pudo deserializar el bloque JSON a CalendarEvent[]
                    return null;
                }
            }
            catch
            {
                // En caso de cualquier otro error al extraer el script
                return null;
            }
        }

        public static JsonElement ExtractCalendarFromHtml(string html)
        {
            if (string.IsNullOrEmpty(html)) throw new ArgumentNullException(nameof(html));

            var regex = new Regex(
                @"<script[^>]*\bid\s*=\s*[""']__NEXT_DATA__[""'][^>]*\btype\s*=\s*[""']application/json[""'][^>]*>(.*?)</script>",
                RegexOptions.Singleline | RegexOptions.IgnoreCase);

            var m = regex.Match(html);
            if (!m.Success)
                throw new InvalidOperationException("No se encontró el <script id=\"__NEXT_DATA__\" type=\"application/json\">.");

            var jsonText = m.Groups[1].Value.Trim();
            using var doc = JsonDocument.Parse(jsonText);
            var root = doc.RootElement;

            // Navegar a props.pageProps.calendar
            if (root.TryGetProperty("props", out var propsElem) &&
                propsElem.TryGetProperty("pageProps", out var pagePropsElem) &&
                pagePropsElem.TryGetProperty("calendar", out var calendarElem))
            {
                return calendarElem.Clone();
            }

            throw new InvalidOperationException("No se encontró el objeto 'calendar' en props.pageProps.");
        }
    }
}
