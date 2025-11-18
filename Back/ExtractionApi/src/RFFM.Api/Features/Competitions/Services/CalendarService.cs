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
                    if (calendar != null)
                    {
                        // Compute active jornada/round according to rule:
                        // "Por defecto que muestre el tab con la jornada actual. Se considera actual a partir del lunes la que toca el próximo sábado o domingo"
                        ComputeActiveRound(calendar);
                    }
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

        private static void ComputeActiveRound(Calendar calendar)
        {
            var rounds = calendar.EffectiveRounds;
            if (rounds == null || !rounds.Any())
            {
                calendar.ActiveJornada = 0;
                calendar.ActiveRoundIndex = -1;
                return;
            }

            var formats = new[] { "dd/MM/yyyy", "dd/MM/yyyy HH:mm", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd", "dd-MM-yyyy", "dd-MM-yyyy HH:mm" };
            var culture = System.Globalization.CultureInfo.GetCultureInfo("es-ES");

            // compute max date per round
            var roundDates = new List<(int Index, string Cod, DateTime? MinDate, DateTime? MaxDate)>();
            for (int i = 0; i < rounds.Count; i++)
            {
                var r = rounds[i];
                var matches = r?.EffectiveMatches ?? new List<CalendarMatch>();
                DateTime? minDate = null;
                DateTime? maxDate = null;
                foreach (var m in matches)
                {
                    if (string.IsNullOrWhiteSpace(m.Fecha)) continue;
                    if (DateTime.TryParseExact(m.Fecha.Trim(), formats, culture, System.Globalization.DateTimeStyles.AssumeLocal, out var dt) ||
                        DateTime.TryParse(m.Fecha.Trim(), culture, System.Globalization.DateTimeStyles.AssumeLocal, out dt) ||
                        DateTime.TryParse(m.Fecha.Trim(), System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeLocal, out dt))
                    {
                        var d = dt.Date;
                        if (!minDate.HasValue || d < minDate.Value) minDate = d;
                        if (!maxDate.HasValue || d > maxDate.Value) maxDate = d;
                    }
                }
                roundDates.Add((i, r?.CodJornada ?? string.Empty, minDate, maxDate));
            }

            var today = DateTime.Now.Date;

            // Determine weekend (Saturday-Sunday) to consider: if today is Sunday, consider this weekend (Saturday = today-1)
            DateTime saturday;
            if (today.DayOfWeek == DayOfWeek.Sunday)
            {
                saturday = today.AddDays(-1);
            }
            else
            {
                int daysToSat = ((int)DayOfWeek.Saturday - (int)today.DayOfWeek + 7) % 7;
                saturday = today.AddDays(daysToSat);
            }
            var sunday = saturday.AddDays(1);

            // First try: find a round that has any match date on that weekend (sat or sun)
            var weekendRound = roundDates.FirstOrDefault(rd => (rd.MinDate.HasValue && (rd.MinDate.Value == saturday || rd.MinDate.Value == sunday)) || (rd.MaxDate.HasValue && (rd.MaxDate.Value == saturday || rd.MaxDate.Value == sunday)) || (rd.MinDate.HasValue && rd.MaxDate.HasValue && (rd.MinDate.Value <= sunday && rd.MaxDate.Value >= saturday)) );
            if (weekendRound.Index != 0 || weekendRound.Cod != "")
            {
                // found
                calendar.ActiveRoundIndex = weekendRound.Index;
                if (int.TryParse(weekendRound.Cod, out var jid)) calendar.ActiveJornada = jid;
                else calendar.ActiveJornada = 0;
                return;
            }

            // Fallback: use latest round whose max date <= today
            var pastOrToday = roundDates.Where(rd => rd.MaxDate.HasValue && rd.MaxDate.Value <= today).OrderByDescending(rd => rd.MaxDate).FirstOrDefault();
            if (pastOrToday.Index != 0 || pastOrToday.Cod != "")
            {
                calendar.ActiveRoundIndex = pastOrToday.Index;
                if (int.TryParse(pastOrToday.Cod, out var jid2)) calendar.ActiveJornada = jid2;
                else calendar.ActiveJornada = 0;
                return;
            }

            // Fallback: first round with any date
            var anyRoundWithDate = roundDates.FirstOrDefault(rd => rd.MinDate.HasValue || rd.MaxDate.HasValue);
            if (anyRoundWithDate.Index != 0 || anyRoundWithDate.Cod != "")
            {
                calendar.ActiveRoundIndex = anyRoundWithDate.Index;
                if (int.TryParse(anyRoundWithDate.Cod, out var jid3)) calendar.ActiveJornada = jid3;
                else calendar.ActiveJornada = 0;
                return;
            }

            // as last resort, keep defaults
            calendar.ActiveRoundIndex = 0;
            if (rounds.Count > 0 && int.TryParse(rounds[0].CodJornada, out var firstJ)) calendar.ActiveJornada = firstJ;
        }
    }
}
