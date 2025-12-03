using System.Text.Json;
using System.Text.RegularExpressions;
using RFFM.Api.Features.Federation.Teams.Models;

namespace RFFM.Api.Features.Federation.Teams.Services
{
    public class ActaService : IActaService
    {
        private readonly IHttpClientFactory _httpClientFactory;

        public ActaService(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<MatchRffm?> GetMatchFromActaAsync(string codActa, int temporada, int competicion, int grupo, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(codActa)) return null;
            var http = _httpClientFactory.CreateClient();
            http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

            var url = $"https://www.rffm.es/acta-partido/{codActa}?temporada={temporada}&competicion={competicion}&grupo={grupo}";
            var res = await http.GetAsync(url, cancellationToken);
            if (!res.IsSuccessStatusCode) return null;
            var html = await res.Content.ReadAsStringAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(html)) return null;

            JsonElement? actaJsonElement = null;

            try
            {
                var nextRegex = new Regex(@"<script[^>]*\bid\s*=\s*['""']__NEXT_DATA__['""'][^>]*>(.*?)</script>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
                var nm = nextRegex.Match(html);
                string? jsonText = null;
                if (nm.Success)
                {
                    jsonText = nm.Groups[1].Value.Trim();
                }
                else
                {
                    var marker = "__NEXT_DATA__";
                    var pos = html.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
                    if (pos >= 0)
                    {
                        var scriptOpen = html.LastIndexOf("<script", pos, StringComparison.OrdinalIgnoreCase);
                        if (scriptOpen >= 0)
                        {
                            var startTagEnd = html.IndexOf('>', scriptOpen);
                            if (startTagEnd >= 0)
                            {
                                var scriptClose = html.IndexOf("</script>", startTagEnd, StringComparison.OrdinalIgnoreCase);
                                if (scriptClose > startTagEnd)
                                {
                                    jsonText = html.Substring(startTagEnd + 1, scriptClose - startTagEnd - 1).Trim();
                                }
                            }
                        }
                    }
                }

                if (!string.IsNullOrWhiteSpace(jsonText) && (jsonText.TrimStart().StartsWith("{") || jsonText.TrimStart().StartsWith("[")))
                {
                    using var doc = JsonDocument.Parse(jsonText);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("props", out var propsElem) &&
                        propsElem.TryGetProperty("pageProps", out var pagePropsElem))
                    {
                        if (pagePropsElem.TryGetProperty("acta", out var actaElem))
                        {
                            actaJsonElement = actaElem.Clone();
                        }
                        else if (pagePropsElem.TryGetProperty("acta_json", out var actaElem2))
                        {
                            actaJsonElement = actaElem2.Clone();
                        }
                        else if (pagePropsElem.TryGetProperty("game", out var gameElem))
                        {
                            actaJsonElement = gameElem.Clone();
                        }
                    }
                }
            }
            catch
            {
                // ignore
            }

            if (!actaJsonElement.HasValue)
            {
                try
                {
                    if (!string.IsNullOrWhiteSpace(html) && (html.TrimStart().StartsWith("{") || html.TrimStart().StartsWith("[")))
                    {
                        using var doc2 = JsonDocument.Parse(html);
                        var root2 = doc2.RootElement;
                        if (root2.ValueKind == JsonValueKind.Object)
                        {
                            if (root2.TryGetProperty("acta", out var ae2))
                                actaJsonElement = ae2.Clone();
                            else if (root2.TryGetProperty("acta_json", out var ae3))
                                actaJsonElement = ae3.Clone();
                            else if (root2.TryGetProperty("game", out var ge))
                                actaJsonElement = ge.Clone();
                            else
                                actaJsonElement = root2.Clone();
                        }
                        else
                        {
                            actaJsonElement = root2.Clone();
                        }
                    }
                }
                catch
                {
                    // ignore
                }
            }

            if (!actaJsonElement.HasValue) return null;

            try
            {
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var game = JsonSerializer.Deserialize<MatchRffm>(actaJsonElement.Value.GetRawText(), options);
                return game;
            }
            catch
            {
                return null;
            }
        }
    }
}