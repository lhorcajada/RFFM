using HtmlAgilityPack;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Text.RegularExpressions;

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
 private const string BaseUrl = "https://www.rffm.es/competicion/clasificaciones";

 public CompetitionService(HttpClient http)
 {
 _http = http;
 _http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");
 _fetcher = new HtmlFetcher(http);
 }

 public async Task<ResponseCompetition[]> GetCompetitionsAsync(CancellationToken cancellationToken = default)
 {
 var content = await _fetcher.FetchAsync(BaseUrl, cancellationToken).ConfigureAwait(false);
 var list = new List<ResponseCompetition>();

 // Try to parse selector UL for competitions (same logic used previously)
 try
 {
 var doc = new HtmlDocument();
 doc.LoadHtml(content);
 var selectorUl = doc.DocumentNode.SelectSingleNode("//ul[contains(@aria-labelledby,'competicion') and @role='listbox']")
 ?? doc.DocumentNode.SelectSingleNode("//div[contains(@class,'MuiMenu-paper')]//ul")
 ?? doc.DocumentNode.SelectSingleNode("//ul[contains(@class,'MuiList-root') and @role='listbox']");

 var seen = new HashSet<string>();

 if (selectorUl != null)
 {
 var lis = selectorUl.SelectNodes(".//li[@data-value]") ?? Enumerable.Empty<HtmlNode>();
 foreach (var li in lis)
 {
 var ariaDisabled = li.GetAttributeValue("aria-disabled", string.Empty);
 var cls = li.GetAttributeValue("class", string.Empty);
 if (!string.IsNullOrWhiteSpace(ariaDisabled) && ariaDisabled.Equals("true", StringComparison.OrdinalIgnoreCase))
 continue;
 if (!string.IsNullOrWhiteSpace(cls) && cls.IndexOf("Mui-disabled", StringComparison.OrdinalIgnoreCase) >=0)
 continue;

 var id = li.GetAttributeValue("data-value", string.Empty).Trim();
 if (string.IsNullOrWhiteSpace(id)) continue;

 var textParts = li.ChildNodes
 .Where(n => n.NodeType == HtmlNodeType.Text)
 .Select(n => n.InnerText)
 .Where(t => !string.IsNullOrWhiteSpace(t))
 .ToArray();

 var name = textParts.Length >0
 ? string.Join(" ", textParts).Trim()
 : HtmlEntity.DeEntitize(li.InnerText).Trim();

 name = Regex.Replace(name, "\\s+", " ").Trim();
 if (string.IsNullOrWhiteSpace(name)) continue;
 if (Regex.IsMatch(name, "^\\d{4}(/|-)?\\d{0,4}$")) continue;

 if (seen.Add(id)) list.Add(new ResponseCompetition(id, name));
 }

 if (list.Count >0) return list.OrderBy(x => x.Name).ToArray();
 }
 }
 catch
 {
 // ignore
 }

 // JSON fallback
 try
 {
 var scriptMatch = Regex.Match(content, "<script[^>]*id=\\\"__NEXT_DATA__\\\"[^>]*>(.*?)</script>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
 if (scriptMatch.Success)
 {
 var json = scriptMatch.Groups[1].Value.Trim();
 using var doc = JsonDocument.Parse(json);
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
 // ignore
 }

 // anchors fallback
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
 if (string.IsNullOrWhiteSpace(name)) name = a.GetAttributeValue("title", string.Empty).Trim();
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

 public async Task<ResponseGroup[]> GetGroupsAsync(string competitionId, CancellationToken cancellationToken = default)
 {
 // fixed params as requested
 var url = $"{BaseUrl}?temporada=21&competicion={competitionId}&jornada=1&tipojuego=1";
 var content = await _fetcher.FetchAsync(url, cancellationToken).ConfigureAwait(false);
 var list = new List<ResponseGroup>();

 try
 {
 var doc = new HtmlDocument();
 doc.LoadHtml(content);

 // find selector UL for groups - try aria-labelledby containing 'grupo' or select with id/label
 var selectorUl = doc.DocumentNode.SelectSingleNode("//ul[contains(@aria-labelledby,'grupo') and @role='listbox']")
 ?? doc.DocumentNode.SelectSingleNode("//ul[contains(@id,'grupo')]")
 ?? doc.DocumentNode.SelectSingleNode("//div[contains(@class,'MuiMenu-paper')]//ul")
 ?? doc.DocumentNode.SelectSingleNode("//ul[contains(@class,'MuiList-root') and @role='listbox']");

 var seen = new HashSet<string>();
 if (selectorUl != null)
 {
 var lis = selectorUl.SelectNodes(".//li[@data-value]") ?? Enumerable.Empty<HtmlNode>();
 foreach (var li in lis)
 {
 var ariaDisabled = li.GetAttributeValue("aria-disabled", string.Empty);
 var cls = li.GetAttributeValue("class", string.Empty);
 if (!string.IsNullOrWhiteSpace(ariaDisabled) && ariaDisabled.Equals("true", StringComparison.OrdinalIgnoreCase))
 continue;
 if (!string.IsNullOrWhiteSpace(cls) && cls.IndexOf("Mui-disabled", StringComparison.OrdinalIgnoreCase) >=0)
 continue;

 var id = li.GetAttributeValue("data-value", string.Empty).Trim();
 if (string.IsNullOrWhiteSpace(id)) continue;

 var textParts = li.ChildNodes
 .Where(n => n.NodeType == HtmlNodeType.Text)
 .Select(n => n.InnerText)
 .Where(t => !string.IsNullOrWhiteSpace(t))
 .ToArray();

 var name = textParts.Length >0
 ? string.Join(" ", textParts).Trim()
 : HtmlEntity.DeEntitize(li.InnerText).Trim();

 name = Regex.Replace(name, "\\s+", " ").Trim();
 if (string.IsNullOrWhiteSpace(name)) continue;

 if (seen.Add(id)) list.Add(new ResponseGroup(id, name));
 }

 if (list.Count >0) return list.OrderBy(x => x.Name).ToArray();
 }
 }
 catch
 {
 // ignore
 }

 // try JSON __NEXT_DATA__ for groups
 try
 {
 var scriptMatch = Regex.Match(content, "<script[^>]*id=\\\"__NEXT_DATA__\\\"[^>]*>(.*?)</script>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
 if (scriptMatch.Success)
 {
 var json = scriptMatch.Groups[1].Value.Trim();
 using var doc = JsonDocument.Parse(json);
 // try to find pageProps.competitions or pageProps.groups
 if (doc.RootElement.TryGetProperty("props", out var props) && props.TryGetProperty("pageProps", out var pageProps))
 {
 if (pageProps.TryGetProperty("groups", out var groups) && groups.ValueKind == JsonValueKind.Array)
 {
 foreach (var g in groups.EnumerateArray())
 {
 string? id = null;
 string? name = null;
 if (g.TryGetProperty("codigo", out var codigo)) id = codigo.GetRawText().Trim('"');
 if (g.TryGetProperty("nombre", out var nombre)) name = nombre.GetString();
 if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name)) continue;
 if (!list.Any(x => x.Id == id)) list.Add(new ResponseGroup(id, name));
 }
 if (list.Count >0) return list.OrderBy(x => x.Name).ToArray();
 }

 // generic scan for group-like objects
 var found = new List<(string id, string name)>();
 FindCompetitionsInJson(doc.RootElement, found);
 foreach (var f in found)
 {
 if (string.IsNullOrWhiteSpace(f.id) || string.IsNullOrWhiteSpace(f.name)) continue;
 // some ids may represent groups
 if (!list.Any(x => x.Id == f.id)) list.Add(new ResponseGroup(f.id, f.name));
 }
 if (list.Count >0) return list.OrderBy(x => x.Name).ToArray();
 }
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
 if (name == null && (pname.IndexOf("nombre", StringComparison.OrdinalIgnoreCase) >=0 || pname.IndexOf("name", StringComparison.OrdinalIgnoreCase) >=0 || pname.IndexOf("grupo", StringComparison.OrdinalIgnoreCase) >=0))
 {
 if (prop.Value.ValueKind == JsonValueKind.String) name = prop.Value.GetString();
 }
 }

 if (!string.IsNullOrWhiteSpace(id) && !string.IsNullOrWhiteSpace(name))
 {
 found.Add((id!, name!));
 }

 foreach (var prop in el.EnumerateObject()) FindCompetitionsInJson(prop.Value, found);
 }
 else if (el.ValueKind == JsonValueKind.Array)
 {
 foreach (var item in el.EnumerateArray()) FindCompetitionsInJson(item, found);
 }
 }
 }
}
