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
using System.Linq;

namespace RFFM.Api.Features.Competitions.Queries
{
    public class GetCompetitions : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/competitions", async (IMediator mediator, CancellationToken cancellationToken) =>
            {
                var request = new Query();
                var response = await mediator.Send(request, cancellationToken);
                return response != null ? Results.Ok(response) : Results.NotFound();
            })
            .WithName(nameof(GetCompetitions))
            .WithTags("Competitions")
            .Produces<ResponseCompetition[]>()
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record Query() : Common.IQuery<ResponseCompetition[]>;

        public record ResponseCompetition(string Id, string Name);

        public class RequestHandler : IRequestHandler<Query, ResponseCompetition[]>
        {
            public async ValueTask<ResponseCompetition[]> Handle(Query request, CancellationToken cancellationToken)
            {
                var url = "https://www.rffm.es/competicion/clasificaciones";

                using var http = new HttpClient();
                http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

                var fetcher = new HtmlFetcher(http);
                var content = await fetcher.FetchAsync(url, cancellationToken);

                var list = new List<ResponseCompetition>();

                // First: try to parse the competitions selector (ul with aria-labelledby referencing 'competicion' or menu paper)
                try
                {
                    var doc = new HtmlDocument();
                    doc.LoadHtml(content);

                    // Find the exact selector UL: aria-labelledby contains 'competicion' or role listbox close to menu
                    var selectorUl = doc.DocumentNode.SelectSingleNode("//ul[contains(@aria-labelledby,'competicion') and @role='listbox']")
                    ?? doc.DocumentNode.SelectSingleNode("//ul[@role='listbox' and contains(@aria-labelledby,'competicion')]")
                    ?? doc.DocumentNode.SelectSingleNode("//div[contains(@class,'MuiMenu-paper')]//ul")
                    ?? doc.DocumentNode.SelectSingleNode("//ul[contains(@class,'MuiList-root') and @role='listbox']");

                    var seen = new HashSet<string>();

                    if (selectorUl != null)
                    {
                        var lis = selectorUl.SelectNodes(".//li") ?? Enumerable.Empty<HtmlNode>();
                        foreach (var li in lis)
                        {
                            // skip disabled / divider / header items
                            var ariaDisabled = li.GetAttributeValue("aria-disabled", string.Empty);
                            var cls = li.GetAttributeValue("class", string.Empty);
                            if (!string.IsNullOrWhiteSpace(ariaDisabled) && ariaDisabled.Equals("true", StringComparison.OrdinalIgnoreCase))
                                continue;
                            if (!string.IsNullOrWhiteSpace(cls) && cls.IndexOf("Mui-disabled", StringComparison.OrdinalIgnoreCase) >=0)
                                continue;

                            var id = li.GetAttributeValue("data-value", string.Empty).Trim();
                            if (string.IsNullOrWhiteSpace(id))
                                continue;

                            // extract only the text nodes to avoid ripple/span content
                            var textParts = li.ChildNodes
                            .Where(n => n.NodeType == HtmlNodeType.Text)
                            .Select(n => n.InnerText)
                            .Where(t => !string.IsNullOrWhiteSpace(t))
                            .ToArray();

                            var name = textParts.Length >0
                            ? string.Join(" ", textParts).Trim()
                            : HtmlEntity.DeEntitize(li.InnerText).Trim();

                            name = Regex.Replace(name, "\\s+", " ").Trim();

                            if (string.IsNullOrWhiteSpace(name))
                                continue;

                            // skip items that look like seasons (e.g.2024/2025 or2024)
                            if (Regex.IsMatch(name, "^\\d{4}(/|-)?\\d{0,4}$"))
                                continue;

                            if (seen.Add(id))
                                list.Add(new ResponseCompetition(id, name));
                        }

                        if (list.Count >0)
                            return list.OrderBy(x => x.Name).ToArray();
                    }
                }
                catch
                {
                    // ignore selector parse errors and fallback to other strategies
                }

                // Try JSON in __NEXT_DATA__ as a structured fallback
                try
                {
                    var scriptMatch = Regex.Match(content, "<script[^>]*id=\\\"__NEXT_DATA__\\\"[^>]*>(.*?)</script>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
                    if (scriptMatch.Success)
                    {
                        var json = scriptMatch.Groups[1].Value.Trim();
                        using var doc = JsonDocument.Parse(json);

                        // look for 'competitions' array inside JSON
                        if (doc.RootElement.TryGetProperty("props", out var props) && props.TryGetProperty("pageProps", out var pageProps))
                        {
                            if (pageProps.TryGetProperty("competitions", out var comps) && comps.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var c in comps.EnumerateArray())
                                {
                                    string? id = null;
                                    string? name = null;
                                    if (c.TryGetProperty("codigo", out var codigo)) id = codigo.GetRawText().Trim('"');
                                    if (c.TryGetProperty("nombre", out var nombre)) name = nombre.GetString();
                                    if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name)) continue;
                                    if (!list.Any(x => x.Id == id)) list.Add(new ResponseCompetition(id, name));
                                }
                                if (list.Count >0) return list.OrderBy(x => x.Name).ToArray();
                            }

                            // generic fallback crawling JSON tree
                            var found = new List<(string id, string name)>();
                            FindCompetitionsInJson(doc.RootElement, found);
                            foreach (var f in found)
                            {
                                if (string.IsNullOrWhiteSpace(f.id) || string.IsNullOrWhiteSpace(f.name)) continue;
                                if (!list.Any(x => x.Id == f.id)) list.Add(new ResponseCompetition(f.id, f.name));
                            }
                            if (list.Count >0) return list.OrderBy(x => x.Name).ToArray();
                        }
                    }
                }
                catch
                {
                    // ignore JSON parse errors
                }

                // Fallback: parse anchors in HTML
                try
                {
                    var doc = new HtmlDocument();
                    doc.LoadHtml(content);
                    var anchors = doc.DocumentNode.SelectNodes("//a[@href]") ?? Enumerable.Empty<HtmlNode>();
                    var seen = new HashSet<string>();
                    foreach (var a in anchors)
                    {
                        var href = a.GetAttributeValue("href", string.Empty);
                        if (string.IsNullOrWhiteSpace(href)) continue;
                        if (!href.Contains("/competicion/", StringComparison.OrdinalIgnoreCase) && !href.Contains("/competicion", StringComparison.OrdinalIgnoreCase)) continue;

                        var m = Regex.Match(href, "(\\d+)");
                        var id = m.Success ? m.Value : href;
                        if (string.IsNullOrWhiteSpace(id)) continue;

                        var name = HtmlEntity.DeEntitize(a.InnerText).Trim();
                        if (string.IsNullOrWhiteSpace(name))
                        {
                            // try aria-label or title
                            name = a.GetAttributeValue("title", string.Empty).Trim();
                        }
                        if (string.IsNullOrWhiteSpace(name)) continue;

                        if (seen.Add(id)) list.Add(new ResponseCompetition(id, name));
                    }
                }
                catch
                {
                    // ignore
                }

                return list.OrderBy(x => x.Name).ToArray();
            }

            private static void FindCompetitionsInJson(JsonElement el, List<(string id, string name)> found)
            {
                if (el.ValueKind == JsonValueKind.Object)
                {
                    // detect competition-like object
                    string? id = null;
                    string? name = null;

                    foreach (var prop in el.EnumerateObject())
                    {
                        var pname = prop.Name;
                        if (id == null && (string.Equals(pname, "id", StringComparison.OrdinalIgnoreCase) || pname.IndexOf("cod", StringComparison.OrdinalIgnoreCase) >=0 || pname.IndexOf("codigo", StringComparison.OrdinalIgnoreCase) >=0))
                        {
                            if (prop.Value.ValueKind == JsonValueKind.String) id = prop.Value.GetString();
                            else if (prop.Value.ValueKind == JsonValueKind.Number) id = prop.Value.GetRawText();
                        }
                        if (name == null && (pname.IndexOf("nombre", StringComparison.OrdinalIgnoreCase) >=0 || pname.IndexOf("name", StringComparison.OrdinalIgnoreCase) >=0 || pname.IndexOf("competition", StringComparison.OrdinalIgnoreCase) >=0))
                        {
                            if (prop.Value.ValueKind == JsonValueKind.String) name = prop.Value.GetString();
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(name))
                    {
                        found.Add((id!, name!));
                    }

                    // recurse
                    foreach (var prop in el.EnumerateObject()) FindCompetitionsInJson(prop.Value, found);
                }
                else if (el.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in el.EnumerateArray()) FindCompetitionsInJson(item, found);
                }
            }
        }
    }
}
