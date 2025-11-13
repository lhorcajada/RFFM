using HtmlAgilityPack;
using RFFM.Api.Infrastructure.Helpers;
using System.Text.Json;
using System.Text.RegularExpressions;
using static RFFM.Api.Features.Players.Queries.GetPlayer;

namespace RFFM.Api.Features.Players.Services
{
    public interface IPlayerService
    {
        Task<ResponseDetailPlayer> GetPlayerWithStatsAsync(int playerId, CancellationToken cancellationToken);
        Task<ResponseStatisticsBase> GetPlayerWithStatisticsBaseAsync(int playerId, CancellationToken cancellationToken);
    }

    public record ResponseStatisticsBase(int Ace, List<TeamParticipation> TeamParticipations);

    public class PlayerService : IPlayerService
    {
        public PlayerService(HttpClient http)
        {
            if (!http.DefaultRequestHeaders.UserAgent.Any())
                http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");
        }

        public async Task<ResponseStatisticsBase> GetPlayerWithStatisticsBaseAsync(int playerId, CancellationToken cancellationToken)
        {
            var url = $"https://www.rffm.es/fichajugador/{playerId}";
            using var http = new HttpClient();
            http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");
            var fetcher = new HtmlFetcher(http);
            var content = await fetcher.FetchAsync(url, cancellationToken);

            // try to read JSON
            var nextDataMatch = Regex.Match(content, "<script[^>]*id=\\\"__NEXT_DATA__\\\"[^>]*>(.*?)</script>", RegexOptions.Singleline | RegexOptions.IgnoreCase);
            JsonDocument? doc = null;
            if (nextDataMatch.Success)
            {
                var json = nextDataMatch.Groups[1].Value.Trim();
                try { doc = JsonDocument.Parse(json); } catch { doc = null; }
            }

            int age =0;
            var participations = new List<TeamParticipation>();
            int currentSeasonId =0;
            string currentSeasonName = string.Empty;

            if (doc != null)
            {
                try
                {
                    var root = doc.RootElement;
                    if (root.TryGetProperty("props", out var props) && props.TryGetProperty("pageProps", out var pageProps))
                    {
                        if (pageProps.TryGetProperty("player", out var playerEl) && playerEl.ValueKind == JsonValueKind.Object)
                        {
                            // age
                            age = GetIntByNames(playerEl, "edad", "age");

                            // try to obtain current season id/name from player element
                            currentSeasonId = GetIntByNames(playerEl, "codigo_temporada", "temporada", "season", "seasonId", "temporada_id");
                            currentSeasonName = GetStringByNames(playerEl, "nombre_temporada", "seasonName", "season") ?? string.Empty;

                            if (playerEl.TryGetProperty("competiciones_participa", out var compArr) && compArr.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var comp0 in compArr.EnumerateArray())
                                {
                                    var cName = GetStringByNames(comp0, "nombre_competicion", "competition", "competitionName") ?? string.Empty;
                                    var gName = GetStringByNames(comp0, "nombre_grupo", "group", "codgrupo") ?? string.Empty;
                                    var tName = GetStringByNames(comp0, "nombre_equipo", "team", "nombre_equipo") ?? string.Empty;
                                    var pts = GetIntByNames(comp0, "puntos_equipo", "puntos", "teamPoints");

                                    var seasonId = GetIntByNames(comp0, "temporada", "season", "seasonId", "codigo_temporada", "temporada_id");
                                    if (seasonId ==0 && currentSeasonId !=0) seasonId = currentSeasonId;
                                    var seasonName = GetStringByNames(comp0, "nombre_temporada", "seasonName", "season") ?? currentSeasonName ?? string.Empty;

                                    participations.Add(new TeamParticipation(cName, gName, tName, pts, seasonId, seasonName));
                                }
                            }
                        }
                    }
                }
                catch
                {
                    // ignore
                }
            }

            // fallback HTML parsing if JSON didn't provide participations or age
            if ((!participations.Any() || age ==0) && !string.IsNullOrEmpty(content))
            {
                try
                {
                    var docH = new HtmlDocument();
                    docH.LoadHtml(content);

                    // attempt to read season selector for current season
                    var seasonNode = docH.DocumentNode.SelectSingleNode("//*[@id='temporada-select']")
                     ?? docH.DocumentNode.SelectSingleNode("//div[contains(@id,'temporada-select') or contains(@class,'temporada')]");
                    if (seasonNode != null)
                    {
                        var seasonText = HtmlEntity.DeEntitize(seasonNode.InnerText).Trim();
                        var sid = TryParseInt(Regex.Match(seasonText, "\\d+").Value);
                        if (sid !=0) currentSeasonId = sid;
                        if (string.IsNullOrEmpty(currentSeasonName)) currentSeasonName = seasonText;
                    }

                    // competition rows
                    var compNodes = docH.DocumentNode.SelectNodes("//table[contains(@class,'competicionesJugador')]//div[contains(@class,'textoEquipo')]//div[contains(@class,'MuiBox-root')]");
                    if (compNodes != null && compNodes.Count >=4)
                    {
                        var cName = HtmlEntity.DeEntitize(compNodes[0].InnerText).Trim();
                        var gName = HtmlEntity.DeEntitize(compNodes[1].InnerText).Trim();
                        var tName = HtmlEntity.DeEntitize(compNodes[2].InnerText).Trim();
                        var pts = TryParseInt(HtmlEntity.DeEntitize(compNodes[3].InnerText).Trim());

                        participations.Add(new TeamParticipation(cName, gName, tName, pts, currentSeasonId, currentSeasonName));
                    }

                    // age fallback from HTML
                    if (age ==0)
                    {
                        var ageNode = docH.DocumentNode.SelectSingleNode("//span[normalize-space(.)='Edad'] | //div[normalize-space(.)='Edad']");
                        if (ageNode != null)
                        {
                            var h3 = ageNode.SelectSingleNode("following::h3[1]") ?? ageNode.ParentNode?.SelectSingleNode(".//h3");
                            if (h3 != null && int.TryParse(Regex.Replace(HtmlEntity.DeEntitize(h3.InnerText).Trim(), "[^0-9-]", ""), out var a)) age = a;
                        }
                    }
                }
                catch
                {
                    // ignore
                }
            }

            // determine current and previous season filter
            List<TeamParticipation> filtered;
            if (currentSeasonId !=0)
            {
                var prev = currentSeasonId -1;
                filtered = participations.Where(tp => tp.SeasonId == currentSeasonId || tp.SeasonId == prev).ToList();
            }
            else
            {
                // take most recent two seasonIds present
                filtered = participations.OrderByDescending(tp => tp.SeasonId).Take(2).ToList();
            }

            return new ResponseStatisticsBase(age, filtered);
        }

        public async Task<ResponseDetailPlayer> GetPlayerWithStatsAsync(int playerId, CancellationToken cancellationToken)
        {
            var playerData = new ResponseDetailPlayer();

            for (int i =15; i <=21; i++)
            {
                var url = $"https://www.rffm.es/fichajugador/{playerId}?temporada={i}";

                using var http = new HttpClient();
                // add a simple User-Agent to avoid some servers rejecting the request
                http.DefaultRequestHeaders.UserAgent.ParseAdd("RFFM.Extractor/1.0");

                var htmlFetcher = new HtmlFetcher(http);
                var content = await htmlFetcher.FetchAsync(url, cancellationToken);

                var playerDataSeason = ExtractPlayerDataLocal(content, playerId);
                if (playerDataSeason?.StatisticsBySeason != null && playerDataSeason.StatisticsBySeason.Any())
                {
                    playerData.StatisticsBySeason.Add(playerDataSeason.StatisticsBySeason.First());
                }

                if (playerData.Ace ==0)
                    playerData.Ace = playerDataSeason?.Ace ?? playerData.Ace;
                if (string.IsNullOrEmpty(playerData.PlayerName))
                    playerData.PlayerName = playerDataSeason?.PlayerName ?? playerData.PlayerName;
                if (playerData.PlayerId ==0)
                    playerData.PlayerId = playerDataSeason?.PlayerId ?? playerData.PlayerId;
            }

            return playerData;
        }

        // Local copy of ExtractPlayerData adapted for internal use (returns ResponseDetailPlayer)
        private ResponseDetailPlayer? ExtractPlayerDataLocal(string content, int playerId)
        {
            //1) Try to extract JSON from <script id="__NEXT_DATA__"> ... </script>
            var nextDataMatch = Regex.Match(content, "<script[^>]*id=\\\"__NEXT_DATA__\\\"[^>]*>(.*?)</script>", RegexOptions.Singleline | RegexOptions.IgnoreCase);

            JsonDocument? doc = null;
            if (nextDataMatch.Success)
            {
                var json = nextDataMatch.Groups[1].Value.Trim();
                try { doc = JsonDocument.Parse(json); } catch { doc = null; }
            }

            var statistics = new List<PlayerStatisticsBySeason>();
            string playerName = string.Empty;
            int age =0;
            string dorsal = string.Empty;
            string position = string.Empty;

            if (doc != null)
            {
                try
                {
                    var root = doc.RootElement;
                    if (root.TryGetProperty("props", out var props) && props.TryGetProperty("pageProps", out var pageProps))
                    {
                        // recursively search for arrays that look like stats
                        var arrays = new List<JsonElement>();
                        FindCandidateArrays(pageProps, arrays);

                        foreach (var arr in arrays)
                        {
                            if (arr.ValueKind != JsonValueKind.Array) continue;
                            foreach (var el in arr.EnumerateArray())
                            {
                                if (el.ValueKind != JsonValueKind.Object) continue;

                                if (!HasAnyProperty(el, "temporada", "season", "seasonId", "temporada_id", "season_id") && !HasAnyProperty(el, "goles", "goals", "teamPoints", "puntos"))
                                    continue;

                                var stat = MapJsonElementToStat(el);
                                if (stat != null) statistics.Add(stat);
                            }
                        }

                        if (pageProps.TryGetProperty("player", out var playerEl) && playerEl.ValueKind == JsonValueKind.Object)
                        {
                            playerName = GetStringByNames(playerEl, "nombre_jugador", "nombre", "name", "playerName") ?? playerName;
                            age = GetIntByNames(playerEl, "edad", "age", "anio_nacimiento", "anioNacimiento");
                            dorsal = GetStringByNames(playerEl, "dorsal_jugador", "dorsal", "dorsalNumber", "numero") ?? string.Empty;
                            position = GetStringByNames(playerEl, "posicion_jugador", "posicion", "position") ?? string.Empty;

                            // build teamParts if present
                            var teamParts = new List<TeamParticipation>();
                            if (playerEl.TryGetProperty("competiciones_participa", out var compArr) && compArr.ValueKind == JsonValueKind.Array && compArr.GetArrayLength() >0)
                            {
                                var seasonCode = GetStringByNames(playerEl, "codigo_temporada", "codigo_temporada", "seasonCode");
                                var seasonNameFromJson = GetStringByNames(playerEl, "nombre_temporada", "seasonName", "season") ?? string.Empty;
                                var seasonIdFromJson =0;
                                if (!string.IsNullOrEmpty(seasonCode)) seasonIdFromJson = TryParseInt(seasonCode);

                                foreach (var comp0 in compArr.EnumerateArray())
                                {
                                    var cName = GetStringByNames(comp0, "nombre_competicion", "competition", "nombre_competicion") ?? string.Empty;
                                    var gName = GetStringByNames(comp0, "nombre_grupo", "nombre_grupo", "codgrupo", "group") ?? string.Empty;
                                    var tName = GetStringByNames(comp0, "nombre_equipo", "nombre_equipo", "nombre_equipo", "team") ?? string.Empty;
                                    var pts = GetIntByNames(comp0, "puntos_equipo", "puntos", "teamPoints");

                                    var sid = GetIntByNames(comp0, "temporada", "season", "seasonId", "codigo_temporada", "temporada_id");
                                    if (sid ==0) sid = seasonIdFromJson;
                                    var sname = GetStringByNames(comp0, "nombre_temporada", "seasonName", "season") ?? seasonNameFromJson ?? string.Empty;

                                    teamParts.Add(new TeamParticipation(cName, gName, tName, pts, sid, sname));
                                }

                                // if teamParts created, set primary fields from first
                                if (teamParts.Count >0)
                                {
                                    var tp = teamParts[0];
                                    var stat = new PlayerStatisticsBySeason(tp.TeamName)
                                    {
                                        SeasonId = tp.SeasonId,
                                        SeasonName = tp.SeasonName,
                                        CategoryName = string.Empty,
                                        CompetitionName = tp.CompetitionName,
                                        GroupName = tp.GroupName,
                                        TeamName = tp.TeamName,
                                        TeamPoints = tp.TeamPoints,
                                        MatchesPlayed =0,
                                        Goals =0,
                                        HeadLine =0,
                                        Substitute =0,
                                        YellowCards =0,
                                        RedCards =0,
                                        DoubleYellowCards =0,
                                        DorsalNumber = dorsal,
                                        Position = position,
                                        TeamParticipations = teamParts
                                    };

                                    statistics.Add(stat);
                                }
                            }
                        }
                    }
                }
                catch
                {
                    // ignore parsing errors
                }
            }

            // fallback HTML parsing
            if (!statistics.Any() || string.IsNullOrEmpty(playerName) || age ==0)
            {
                var docH = new HtmlDocument();
                docH.LoadHtml(content);

                // extract name and age (simplified)
                if (string.IsNullOrEmpty(playerName))
                {
                    var title = docH.DocumentNode.SelectSingleNode("//title");
                    if (title != null)
                    {
                        var t = HtmlEntity.DeEntitize(title.InnerText).Trim();
                        var parts = t.Split('|');
                        if (parts.Length >0) playerName = parts[0].Trim();
                    }
                }

                if (age ==0)
                {
                    var ageNode = docH.DocumentNode.SelectSingleNode("//span[normalize-space(.)='Edad'] | //div[normalize-space(.)='Edad']");
                    if (ageNode != null)
                    {
                        var h3 = ageNode.SelectSingleNode("following::h3[1]") ?? ageNode.ParentNode?.SelectSingleNode(".//h3");
                        if (h3 != null && int.TryParse(Regex.Replace(HtmlEntity.DeEntitize(h3.InnerText).Trim(), "[^0-9-]", ""), out var a)) age = a;
                    }
                }
            }

            if (!statistics.Any()) return null;

            return new ResponseDetailPlayer()
            {
                PlayerId = playerId,
                PlayerName = playerName ?? string.Empty,
                StatisticsBySeason = statistics,
                Ace = age
            };
        }

        // Helper methods copied locally
        private static bool HasAnyProperty(JsonElement el, params string[] names)
        {
            foreach (var n in names)
            {
                if (el.TryGetProperty(n, out _)) return true;
                foreach (var prop in el.EnumerateObject())
                {
                    if (string.Equals(prop.Name, n, StringComparison.OrdinalIgnoreCase)) return true;
                }
            }
            return false;
        }

        private static void FindCandidateArrays(JsonElement root, List<JsonElement> arrays)
        {
            if (root.ValueKind == JsonValueKind.Array)
            {
                arrays.Add(root);
                foreach (var el in root.EnumerateArray()) FindCandidateArrays(el, arrays);
            }
            else if (root.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in root.EnumerateObject()) FindCandidateArrays(prop.Value, arrays);
            }
        }

        private static PlayerStatisticsBySeason? MapJsonElementToStat(JsonElement el)
        {
            try
            {
                string teamName = GetStringByNames(el, "teamName", "team", "equipo", "TeamName") ?? string.Empty;
                int seasonId = GetIntByNames(el, "temporada", "season", "seasonId", "idTemporada");
                string seasonName = GetStringByNames(el, "seasonName", "temporadaNombre", "name") ?? string.Empty;
                int teamPoints = GetIntByNames(el, "teamPoints", "puntos", "points");
                int matchesPlayed = GetIntByNames(el, "played", "jugados", "matches", "MatchesPlayed");
                int goals = GetIntByNames(el, "goals", "goles", "Goals");
                int headline = GetIntByNames(el, "titular", "headLine", "starting", "HeadLine");
                int substitute = GetIntByNames(el, "suplente", "substitute", "Substitute");
                int yellow = GetIntByNames(el, "amarillas", "yellowCards", "YellowCards");
                int red = GetIntByNames(el, "rojas", "redCards", "RedCards");
                int doubleYellow = GetIntByNames(el, "doble_amarilla", "doubleYellowCards", "DoubleYellowCards");

                var participation = new TeamParticipation(
                    GetStringByNames(el, "competition", "competitionName", "nombre_competicion") ?? string.Empty,
                    GetStringByNames(el, "group", "nombre_grupo", "codgrupo") ?? string.Empty,
                    teamName,
                    teamPoints,
                    seasonId,
                    GetStringByNames(el, "seasonName", "nombre_temporada", "temporadaNombre") ?? string.Empty
                );

                return new PlayerStatisticsBySeason(teamName)
                {
                    SeasonId = seasonId,
                    SeasonName = seasonName,
                    TeamName = teamName,
                    TeamPoints = teamPoints,
                    TeamParticipations = new List<TeamParticipation> { participation },
                    MatchesPlayed = matchesPlayed,
                    Goals = goals,
                    HeadLine = headline,
                    Substitute = substitute,
                    YellowCards = yellow,
                    RedCards = red,
                    DoubleYellowCards = doubleYellow
                };
            }
            catch
            {
                return null;
            }
        }

        private static int GetIntByNames(JsonElement el, params string[] names)
        {
            foreach (var n in names)
            {
                if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(n, out var v))
                {
                    if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var iv)) return iv;
                    if (v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out var iv2)) return iv2;
                }
                foreach (var prop in el.EnumerateObject())
                {
                    if (string.Equals(prop.Name, n, StringComparison.OrdinalIgnoreCase))
                    {
                        var propVal = prop.Value;
                        if (propVal.ValueKind == JsonValueKind.Number && propVal.TryGetInt32(out var iv)) return iv;
                        if (propVal.ValueKind == JsonValueKind.String && int.TryParse(propVal.GetString(), out var iv2)) return iv2;
                    }
                }
            }
            return 0;
        }

        private static string? GetStringByNames(JsonElement el, params string[] names)
        {
            foreach (var n in names)
            {
                if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(n, out var v))
                {
                    if (v.ValueKind == JsonValueKind.String) return v.GetString();
                    return v.ToString();
                }
                foreach (var prop in el.EnumerateObject())
                {
                    if (string.Equals(prop.Name, n, StringComparison.OrdinalIgnoreCase))
                    {
                        if (prop.Value.ValueKind == JsonValueKind.String) return prop.Value.GetString();
                        return prop.Value.ToString();
                    }
                }
            }
            return null;
        }

        private static int TryParseInt(string? s)
        {
            if (string.IsNullOrEmpty(s)) return 0;
            var cleaned = Regex.Replace(s, "[^0-9-]", "");
            if (int.TryParse(cleaned, out var v)) return v;
            return 0;
        }

        private static string GetSidebarValue(HtmlDocument doc, string label)
        {
            try
            {
                var labelNode = doc.DocumentNode.SelectSingleNode($"//div[normalize-space(.)='{label}']")
                 ?? doc.DocumentNode.SelectSingleNode($"//span[normalize-space(.)='{label}']");
                if (labelNode == null) return string.Empty;

                var container = labelNode.ParentNode?.ParentNode ?? labelNode.ParentNode;
                if (container == null) return string.Empty;

                var boxes = container.SelectNodes(".//div[contains(@class,'MuiBox-root')]");
                if (boxes != null && boxes.Count >0)
                {
                    for (int i = boxes.Count -1; i >=0; i--)
                    {
                        var txt = HtmlEntity.DeEntitize(boxes[i].InnerText).Trim();
                        if (!string.IsNullOrEmpty(txt) && !string.Equals(txt, label, StringComparison.OrdinalIgnoreCase)) return txt;
                    }
                }

                var sibling = labelNode.ParentNode?.SelectSingleNode("following-sibling::div//div[contains(@class,'MuiBox-root')]");
                if (sibling != null) return HtmlEntity.DeEntitize(sibling.InnerText).Trim();

                return string.Empty;
            }
            catch
            {
                return string.Empty;
            }
        }
    }
}
