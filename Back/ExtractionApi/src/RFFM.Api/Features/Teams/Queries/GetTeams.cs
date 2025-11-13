using HtmlAgilityPack;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace RFFM.Api.Features.Teams.Queries
{
    public class GetTeams : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/teams",
                    async (IMediator mediator, CancellationToken cancellationToken, int season = 21, int competition = 25255269, int group = 25255283, int playType = 1) =>
                    {
                        var request = new Query(season, competition, group, playType);

                        var response = await mediator.Send(request, cancellationToken);

                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName(nameof(GetTeams))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<ResponseTeam[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record Query(int Season, int Competition, int Group, int PlayType) : Common.IQuery<ResponseTeam[]>
        {

        }

        public record ResponseTeam(string Id, string Name, string Link);

        public class RequestHandler : IRequestHandler<Query, ResponseTeam[]>
        {
            public async ValueTask<ResponseTeam[]> Handle(Query request, CancellationToken cancellationToken)
            {
                var url =
                    $"https://www.rffm.es/competicion/clasificaciones?temporada={request.Season}&competicion={request.Competition}&grupo={request.Group}&jornada=1&tipojuego={request.PlayType}";

                using var http = new HttpClient();
                // add a simple User-Agent to avoid some servers rejecting the request
                http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

                var htmlFetcher = new HtmlFetcher(http);
                var content = await htmlFetcher.FetchAsync(url, cancellationToken);

                // Try to extract teams from embedded JSON (<script id="__NEXT_DATA__">)
                var teams = TryExtractFromNextData(content);
                if (teams != null && teams.Count > 0)
                {
                    return teams.ToArray();
                }

                // Fallback: Parse the HTML and extract team information using HtmlAgilityPack
                var doc = new HtmlDocument();
                doc.LoadHtml(content);

                var baseUri = new Uri("https://www.rffm.es");

                var nodes = doc.DocumentNode.SelectNodes("//a[@href]") ?? Enumerable.Empty<HtmlNode>();

                var result = new List<ResponseTeam>();
                var seen = new HashSet<string>();

                foreach (var a in nodes)
                {
                    var name = HtmlEntity.DeEntitize(a.InnerText).Trim();
                    if (string.IsNullOrWhiteSpace(name) || name.Length < 2)
                        continue;

                    var href = a.GetAttributeValue("href", string.Empty);
                    if (string.IsNullOrWhiteSpace(href))
                        continue;

                    // Filter likely team links (path or query containing equipo/club)
                    if (!(href.Contains("equipo", StringComparison.OrdinalIgnoreCase) || href.Contains("club", StringComparison.OrdinalIgnoreCase) || href.Contains("codequipo", StringComparison.OrdinalIgnoreCase) || href.Contains("pnfg", StringComparison.OrdinalIgnoreCase) || href.Contains("fichaequipo", StringComparison.OrdinalIgnoreCase)))
                        continue;

                    // Build absolute URL
                    string absolute;
                    try
                    {
                        absolute = new Uri(baseUri, href).ToString();
                    }
                    catch
                    {
                        absolute = href;
                    }

                    if (!seen.Add(absolute))
                        continue;

                    // Try to extract an id from the href (digits)
                    var m = Regex.Match(href, "\\d+");
                    var id = m.Success ? m.Value : absolute;

                    // Prefer fichaequipo path when present
                    if (!href.Contains("fichaequipo", StringComparison.OrdinalIgnoreCase) && !absolute.Contains("fichaequipo", StringComparison.OrdinalIgnoreCase) && m.Success)
                    {
                        absolute = $"https://www.rffm.es/fichaequipo/{id}";
                    }

                    result.Add(new ResponseTeam(id, name, absolute));
                }

                if (result.Count == 0)
                {
                    // Fallback2: try to find team links inside table rows
                    var rowAnchors = doc.DocumentNode.SelectNodes("//table//tr//a[@href]") ?? Enumerable.Empty<HtmlNode>();
                    foreach (var a in rowAnchors)
                    {
                        var name = HtmlEntity.DeEntitize(a.InnerText).Trim();
                        if (string.IsNullOrWhiteSpace(name) || name.Length < 2)
                            continue;

                        var href = a.GetAttributeValue("href", string.Empty);
                        if (string.IsNullOrWhiteSpace(href))
                            continue;

                        string absolute;
                        try
                        {
                            absolute = new Uri(baseUri, href).ToString();
                        }
                        catch
                        {
                            absolute = href;
                        }

                        if (!seen.Add(absolute))
                            continue;

                        var m = Regex.Match(href, "\\d+");
                        var id = m.Success ? m.Value : absolute;

                        if (!href.Contains("fichaequipo", StringComparison.OrdinalIgnoreCase) && !absolute.Contains("fichaequipo", StringComparison.OrdinalIgnoreCase) && m.Success)
                        {
                            absolute = $"https://www.rffm.es/fichaequipo/{id}";
                        }

                        result.Add(new ResponseTeam(id, name, absolute));
                    }
                }

                return result.ToArray();
            }

            private static List<ResponseTeam>? TryExtractFromNextData(string html)
            {
                try
                {
                    var doc = new HtmlDocument();
                    doc.LoadHtml(html);
                    var script = doc.DocumentNode.SelectSingleNode("//script[@id='__NEXT_DATA__']");
                    if (script == null)
                        return null;

                    var jsonText = script.InnerText;
                    if (string.IsNullOrWhiteSpace(jsonText))
                        return null;

                    using var docJson = JsonDocument.Parse(jsonText);
                    // Navigate to props.pageProps.standings.clasificacion
                    if (!docJson.RootElement.TryGetProperty("props", out var props))
                        return null;
                    if (!props.TryGetProperty("pageProps", out var pageProps))
                        return null;

                    if (!pageProps.TryGetProperty("standings", out var standings))
                    {
                        return null;
                    }

                    if (!standings.TryGetProperty("clasificacion", out var clasificacion) || clasificacion.ValueKind != JsonValueKind.Array)
                        return null;

                    var list = new List<ResponseTeam>();

                    // Collect all anchors once to try to match exact links for ids
                    var anchors = doc.DocumentNode.SelectNodes("//a[@href]") ?? Enumerable.Empty<HtmlNode>();
                    var baseUri = new Uri("https://www.rffm.es");

                    foreach (var item in clasificacion.EnumerateArray())
                    {
                        string id = string.Empty;
                        string name = string.Empty;
                        // Try several property names
                        if (item.TryGetProperty("codequipo", out var codeElem))
                        {
                            if (codeElem.ValueKind == JsonValueKind.String)
                                id = codeElem.GetString() ?? string.Empty;
                            else
                                id = codeElem.GetRawText();
                        }
                        else if (item.TryGetProperty("codeEquipo", out var codeElem2))
                        {
                            id = codeElem2.GetRawText().Trim('"');
                        }

                        if (item.TryGetProperty("nombre", out var nameElem) && nameElem.ValueKind == JsonValueKind.String)
                            name = nameElem.GetString() ?? string.Empty;

                        if (string.IsNullOrWhiteSpace(name))
                        {
                            // try other fields
                            if (item.TryGetProperty("club", out var club) && club.ValueKind == JsonValueKind.String)
                                name = club.GetString() ?? string.Empty;
                        }

                        if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(id))
                            continue;

                        string link = string.Empty;

                        // Try to find an exact anchor in the HTML that references the team id
                        if (!string.IsNullOrWhiteSpace(id))
                        {
                            foreach (var a in anchors)
                            {
                                var href = a.GetAttributeValue("href", string.Empty);
                                if (string.IsNullOrWhiteSpace(href))
                                    continue;

                                if (href.Contains(id) && (href.Contains("fichaequipo") || href.Contains("pnfg") || href.Contains("equipo") || href.Contains("club") || href.Contains("codequipo") || href.Contains("VisEquipos") || href.Contains("NFG_VisEquipos")))
                                {
                                    try
                                    {
                                        link = new Uri(baseUri, href).ToString();
                                    }
                                    catch
                                    {
                                        link = href;
                                    }
                                    break;
                                }
                            }
                        }

                        // Prefer fichaequipo direct URL
                        if (string.IsNullOrWhiteSpace(link) && !string.IsNullOrWhiteSpace(id))
                        {
                            link = $"https://www.rffm.es/fichaequipo/{Uri.EscapeDataString(id)}";
                        }

                        // If still empty, fallback to PNFG viewer
                        if (string.IsNullOrWhiteSpace(link) && !string.IsNullOrWhiteSpace(id))
                        {
                            link = $"https://www.rffm.es/pnfg/NPcd/NFG_VisEquipos?cod_primaria=3001463&cod_equipo={Uri.EscapeDataString(id)}";
                        }

                        list.Add(new ResponseTeam(string.IsNullOrWhiteSpace(id) ? name : id, name, link));
                    }

                    return list.Count > 0 ? list : null;
                }
                catch
                {
                    return null;
                }
            }
        }

    }
}
