using HtmlAgilityPack;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Teams;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Text.RegularExpressions;
using RFFM.Api.Features.Players.Services;

namespace RFFM.Api.Features.Players.Queries
{
    public class GetPlayers : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/players/team/{teamId}",
                    async (IMediator mediator, CancellationToken cancellationToken, int teamId = 21) =>
                    {
                        var request = new Query(teamId);

                        var response = await mediator.Send(request, cancellationToken);

                        return response != null ? Results.Ok(response) : Results.NotFound();
                    })
                .WithName(nameof(GetPlayers))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<ResponseHeaderPlayer[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces(StatusCodes.Status404NotFound);
        }

        public record Query(int teamId) : Common.IQuery<ResponseHeaderPlayer[]>
        {

        }

        public record ResponseHeaderPlayer(int Id, string Name, string Link, int Ace, List<GetPlayer.TeamParticipation> TeamParticipations)
        {
            public List<GetPlayer.TeamParticipation> TeamParticipations { get; set; } = TeamParticipations;
        }

        public class RequestHandler : IRequestHandler<Query, ResponseHeaderPlayer[]>
        {
            private readonly IPlayerService _playerService;

            public RequestHandler(IPlayerService playerService)
            {
                _playerService = playerService;
            }

            public async ValueTask<ResponseHeaderPlayer[]> Handle(Query request, CancellationToken cancellationToken)
            {
                var url =
                    $"https://www.rffm.es/fichaequipo/{request.teamId}";

                using var http = new HttpClient();
                // add a simple User-Agent to avoid some servers rejecting the request
                http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

                var htmlFetcher = new HtmlFetcher(http);
                var content = await htmlFetcher.FetchAsync(url, cancellationToken);

                var headerPlayers = TryExtractPlayers(content);
                var playersResponse = new List<ResponseHeaderPlayer>();
                if (headerPlayers != null && headerPlayers.Count > 0)
                {
                    foreach (var player in headerPlayers)
                    {
                        var playerWithStats = await _playerService.GetPlayerWithStatisticsBaseAsync(player.Id, cancellationToken);
                        playersResponse.Add(player with { Ace = playerWithStats.Ace, TeamParticipations = playerWithStats.TeamParticipations});
                    }

                    return playersResponse.ToArray();
                }

                return Array.Empty<ResponseHeaderPlayer>();
            }

            private static List<ResponseHeaderPlayer>? TryExtractPlayers(string html)
            {
                try
                {
                    var doc = new HtmlDocument();
                    doc.LoadHtml(html);

                    // Try to parse JSON in __NEXT_DATA__ first
                    var script = doc.DocumentNode.SelectSingleNode("//script[@id='__NEXT_DATA__']");
                    var anchors = doc.DocumentNode.SelectNodes("//a[@href]") ?? Enumerable.Empty<HtmlNode>();
                    var baseUri = new Uri("https://www.rffm.es");

                    if (script != null && !string.IsNullOrWhiteSpace(script.InnerText))
                    {
                        using var json = JsonDocument.Parse(script.InnerText);
                        if (json.RootElement.TryGetProperty("props", out var props) &&
                            props.TryGetProperty("pageProps", out var pageProps) &&
                            pageProps.TryGetProperty("team", out var team) &&
                            team.TryGetProperty("jugadores_equipo", out var jugadores) && jugadores.ValueKind == JsonValueKind.Array)
                        {
                            var list = new List<ResponseHeaderPlayer>();

                            foreach (var item in jugadores.EnumerateArray())
                            {
                                int id = 0;
                                string name = string.Empty;

                                if (item.TryGetProperty("cod_jugador", out var idElem))
                                {
                                    id = Convert.ToInt32(idElem.ValueKind == JsonValueKind.String ? idElem.GetString() ?? string.Empty : idElem.GetRawText());
                                }
                                else if (item.TryGetProperty("codJugador", out var idElem2))
                                {
                                    id = Convert.ToInt32(idElem2.GetRawText().Trim('"'));
                                }

                                if (item.TryGetProperty("nombre", out var nameElem) && nameElem.ValueKind == JsonValueKind.String)
                                {
                                    name = nameElem.GetString() ?? string.Empty;
                                }

                                if (string.IsNullOrWhiteSpace(name) && id == 0)
                                    continue;

                                // Try to find an anchor that links to the player's ficha
                                string link = string.Empty;
                                if (id != 0)
                                {
                                    foreach (var a in anchors)
                                    {
                                        var href = a.GetAttributeValue("href", string.Empty);
                                        if (string.IsNullOrWhiteSpace(href))
                                            continue;

                                        if (href.Contains(id.ToString()) && (href.Contains("fichajugador", System.StringComparison.OrdinalIgnoreCase) || href.Contains("fichajugador", System.StringComparison.OrdinalIgnoreCase) || href.Contains("jugador", System.StringComparison.OrdinalIgnoreCase) || href.Contains("pnfg", System.StringComparison.OrdinalIgnoreCase)))
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

                                // Prefer canonical ficha URL if none found
                                if (string.IsNullOrWhiteSpace(link) && id != 0)
                                {
                                    link = $"https://www.rffm.es/fichajugador/{Uri.EscapeDataString(id.ToString())}";
                                }

                                list.Add(new ResponseHeaderPlayer(id, name, link, 0, new List<GetPlayer.TeamParticipation>()));
                            }

                            if (list.Count > 0)
                                return list;
                        }
                    }

                    // Fallback: try to extract from HTML lists/anchors
                    var result = new List<ResponseHeaderPlayer>();
                    var seen = new HashSet<string>();

                    // Look for anchors that likely point to player profiles
                    foreach (var a in anchors)
                    {
                        var href = a.GetAttributeValue("href", string.Empty);
                        if (string.IsNullOrWhiteSpace(href))
                            continue;

                        if (!(href.Contains("jugador", System.StringComparison.OrdinalIgnoreCase) || href.Contains("fichajugador", System.StringComparison.OrdinalIgnoreCase) || href.Contains("fichajugador", System.StringComparison.OrdinalIgnoreCase) || href.Contains("pnfg", System.StringComparison.OrdinalIgnoreCase)))
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

                        var name = HtmlEntity.DeEntitize(a.InnerText).Trim();
                        if (string.IsNullOrWhiteSpace(name) || name.Length < 2)
                        {
                            // try nearby text
                            name = HtmlEntity.DeEntitize(a.GetAttributeValue("title", string.Empty)).Trim();
                        }

                        var m = Regex.Match(href, "\\d+");
                        var id = m.Success ? m.Value : absolute;

                        result.Add(new ResponseHeaderPlayer(Convert.ToInt32(id), name, absolute, 0, new List<GetPlayer.TeamParticipation>()));
                    }

                    // If still empty, try to find list items with player names in page
                    if (result.Count == 0)
                    {
                        var lis = doc.DocumentNode.SelectNodes("//li") ?? Enumerable.Empty<HtmlNode>();
                        foreach (var li in lis)
                        {
                            var text = HtmlEntity.DeEntitize(li.InnerText).Trim();
                            if (string.IsNullOrWhiteSpace(text) || text.Length < 3)
                                continue;

                            // Heuristic: many player names contain a comma (LAST, FIRST) or two words
                            if (!text.Contains(",") && text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length < 2)
                                continue;

                            // Try to find an anchor inside li
                            var a = li.SelectSingleNode(".//a[@href]");
                            string link = string.Empty;
                            string id = string.Empty;
                            if (a != null)
                            {
                                var href = a.GetAttributeValue("href", string.Empty);
                                try { link = new Uri(baseUri, href).ToString(); } catch { link = href; }
                                var m = Regex.Match(href, "\\d+");
                                if (m.Success) id = m.Value;
                            }

                            int playerId;
                            if (!string.IsNullOrWhiteSpace(id) && int.TryParse(id, out playerId))
                            {
                                result.Add(new ResponseHeaderPlayer(playerId, text, link, 0, new List<GetPlayer.TeamParticipation>()));
                            }
                        }
                    }

                    return result.Count > 0 ? result : null;
                }
                catch
                {
                    return null;
                }
            }
        }

    }
}
