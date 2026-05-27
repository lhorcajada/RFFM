using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using QuestPDF.Helpers;

namespace RFFM.Api.Services.Export
{
    public class SeasonPrepPdfGenerator
    {
        public SeasonPrepPdfGenerator()
        {
        }

        private static string GetInitials(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "LOGO";
            var parts = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 1) return parts[0].Substring(0, Math.Min(3, parts[0].Length)).ToUpperInvariant();
            var a = parts[0].Substring(0, 1).ToUpperInvariant();
            var b = parts.Length > 1 ? parts[1].Substring(0, 1).ToUpperInvariant() : string.Empty;
            return (a + b).Trim();
        }

        private static string AbbreviatePosition(string? position)
        {
            if (string.IsNullOrWhiteSpace(position)) return string.Empty;
            var s = position.Trim().ToLowerInvariant();
            if (s.Contains("portero")) return "P";
            if (s.Contains("lateral derecho") || s.Contains("lateral-derecho")) return "LD";
            if (s.Contains("lateral izquierdo") || s.Contains("lateral-izquierdo")) return "LI";
            if (s.Contains("defensa central") || s.Contains("defensa-central") || s.Contains("central")) return "DFC";
            if (s.Contains("mediocentro derecho")) return "MCD";
            if (s.Contains("mediocentro izquierdo")) return "MCI";
            if (s.Contains("mediocentro") || s.Contains("medio")) return "MC";
            if (s.Contains("delantero centro") || s.Contains("delantero")) return "DC";
            if (s.Contains("extremo derecho")) return "ED";
            if (s.Contains("extremo izquierdo")) return "EI";
            if (s.Contains("interior derecho")) return "ID";
            if (s.Contains("interior izquierdo")) return "II";

            var parts = position.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) return string.Empty;
            return string.Concat(parts.Select(p => char.ToUpperInvariant(p[0])));
        }

        private static int PositionGroupFromPosition(string? position)
        {
            var abb = AbbreviatePosition(position).ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(abb)) return 4;

            switch (abb)
            {
                case "P":
                    return 0; // Portero
                case "LD":
                case "LI":
                case "DFC":
                    return 1; // Defensa
                case "MCD":
                case "MCI":
                case "MC":
                case "ID":
                case "II":
                    return 2; // Medio
                case "DC":
                case "ED":
                case "EI":
                    return 3; // Delantero
                default:
                    if (abb.StartsWith("P")) return 0;
                    if (abb.StartsWith("D")) return 1;
                    if (abb.StartsWith("M") || abb.StartsWith("I")) return 2;
                    if (abb.StartsWith("E")) return 3;
                    return 4;
            }
        }

        private static int GetPositionGroup(Player p)
        {
            if (!string.IsNullOrWhiteSpace(p.PrimaryPosition))
                return PositionGroupFromPosition(p.PrimaryPosition);

            if (p.PossiblePositions != null && p.PossiblePositions.Count > 0)
            {
                foreach (var pos in p.PossiblePositions)
                {
                    var g = PositionGroupFromPosition(pos);
                    if (g != 4) return g;
                }
            }

            return 4;
        }

        private static List<Player> BuildPlayersForTeam(string teamName, List<Player> pool, List<TabData> tabs)
        {
            if (tabs != null && tabs.Count > 0)
            {
                TabData? bestTab = null;
                int bestMatches = 0;

                foreach (var tab in tabs)
                {
                    var ids = (tab.Slots?.Values ?? Enumerable.Empty<string>()).Concat(tab.Bench ?? Enumerable.Empty<string>()).Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
                    var matches = ids.Select(id => pool.FirstOrDefault(p => p.TeamPlayerId == id && ((p.TeamName ?? string.Empty).Trim() == teamName))).Count(p => p != null);
                    if (matches > bestMatches)
                    {
                        bestMatches = matches;
                        bestTab = tab;
                    }
                }

                if (bestTab != null && bestMatches > 0)
                {
                    var ids = (bestTab.Slots?.Values ?? Enumerable.Empty<string>()).Concat(bestTab.Bench ?? Enumerable.Empty<string>()).Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
                    var players = new List<Player>();
                    var added = new HashSet<string?>();

                    foreach (var id in ids)
                    {
                        var p = pool.FirstOrDefault(pl => pl.TeamPlayerId == id);
                        if (p != null && !added.Contains(p.TeamPlayerId))
                        {
                            players.Add(p);
                            added.Add(p.TeamPlayerId);
                        }
                    }

                    var others = pool.Where(p => (p.TeamName ?? string.Empty).Trim() == teamName && !added.Contains(p.TeamPlayerId))
                                     .OrderBy(p => GetPositionGroup(p))
                                     .ThenBy(p => { if (int.TryParse(p.Dorsal, out var v)) return v; return int.MaxValue; })
                                     .ThenBy(p => p.DisplayName)
                                     .ToList();

                    players.AddRange(others);
                    return players;
                }
            }

            return pool.Where(p => (p.TeamName ?? string.Empty).Trim() == teamName)
                       .OrderBy(p => GetPositionGroup(p))
                       .ThenBy(p => { if (int.TryParse(p.Dorsal, out var v)) return v; return int.MaxValue; })
                       .ThenBy(p => p.DisplayName)
                       .ToList();
        }

        private static List<Player> BuildPlayersFromTab(TabData tab, List<Player> pool)
        {
            var ids = (tab.Slots?.Values ?? Enumerable.Empty<string>()).Concat(tab.Bench ?? Enumerable.Empty<string>()).Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
            var players = new List<Player>();
            var added = new HashSet<string?>();

            foreach (var id in ids)
            {
                var p = pool.FirstOrDefault(pl => pl.TeamPlayerId == id);
                if (p != null && !added.Contains(p.TeamPlayerId))
                {
                    players.Add(p);
                    added.Add(p.TeamPlayerId);
                }
            }

            return players;
        }

        public Task<byte[]> GeneratePdfAsync(string dataJson, string? sportEventId, bool templateMode, string? clubName, string? clubLogoBase64, bool listMode = false, int? teamIndex = null)
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var model = JsonSerializer.Deserialize<SessionModel>(dataJson ?? "{}", options) ?? new SessionModel();

            var pool = model.Pool ?? new List<Player>();
            var tabs = model.Slot?.Tabs ?? new List<TabData>();

            var pages = new List<(string TeamLabel, List<Player> Players)>();

            var distinctTeamNames = pool.Where(p => !string.IsNullOrWhiteSpace(p.TeamName)).Select(p => p.TeamName!.Trim()).Distinct().ToList();

            if (listMode)
            {
                if (teamIndex.HasValue)
                {
                    var idx = Math.Max(0, teamIndex.Value);
                    if (tabs != null && tabs.Count > 0 && idx < tabs.Count)
                    {
                        var tab = tabs[idx];
                        var playersForTeam = BuildPlayersFromTab(tab, pool);
                        pages.Add(($"Equipo {idx + 1}", playersForTeam));
                    }
                    else if (idx < distinctTeamNames.Count)
                    {
                        var teamName = distinctTeamNames[idx];
                        var playersForTeam = BuildPlayersForTeam(teamName, pool, tabs);
                        pages.Add((teamName, playersForTeam));
                    }
                    else
                    {
                        pages.Add(($"Equipo {idx + 1}", new List<Player>()));
                    }
                }
                else
                {
                    if (tabs != null && tabs.Any())
                    {
                        for (int t = 0; t < tabs.Count; t++)
                        {
                            var tab = tabs[t];
                            var playersForTeam = BuildPlayersFromTab(tab, pool);
                            pages.Add(($"Equipo {t + 1}", playersForTeam));
                        }
                    }
                    else if (distinctTeamNames.Any())
                    {
                        foreach (var tn in distinctTeamNames)
                        {
                            var playersForTeam = BuildPlayersForTeam(tn, pool, tabs);
                            pages.Add((tn, playersForTeam));
                        }
                    }
                    else
                    {
                        pages.Add(("Lista de jugadores", pool.OrderBy(p => GetPositionGroup(p)).ThenBy(p => { if (int.TryParse(p.Dorsal, out var v)) return v; return int.MaxValue; }).ThenBy(p => p.DisplayName).ToList()));
                    }
                }
            }
            else
            {
                pages.Add(("Lista de jugadores", pool.OrderBy(p => GetPositionGroup(p)).ThenBy(p => { if (int.TryParse(p.Dorsal, out var v)) return v; return int.MaxValue; }).ThenBy(p => p.DisplayName).ToList()));
            }

            var document = Document.Create(container =>
            {
                foreach (var (pageData, pageIdx) in pages.Select((p, i) => (p, i)))
                {
                    var teamLabel = pageData.TeamLabel;
                    var players = pageData.Players ?? new List<Player>();

                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4.Landscape());
                        page.Margin(18);
                        page.DefaultTextStyle(x => x.FontSize(10));

                        page.Header().Element(header =>
                        {
                            header.Row(r =>
                            {
                                r.RelativeItem().Column(col =>
                                {
                                    col.Item().Text(clubName ?? "Club").SemiBold().FontSize(16);
                                });

                                r.ConstantItem(240).AlignRight().Column(col =>
                                {
                                    col.Item().AlignRight().Text($"Fecha: {DateTime.Now:dd/MM/yyyy}");
                                });
                            });
                        });

                        page.Content().PaddingVertical(8).Element(content =>
                        {
                            content.Column(col =>
                            {
                                col.Item().Text(teamLabel).FontSize(11).SemiBold();

                                // Header row
                                col.Item().BorderBottom(1).PaddingBottom(6).Row(r =>
                                {
                                    r.ConstantItem(30).AlignCenter().Text("#").SemiBold();
                                    r.ConstantItem(40).AlignCenter().Text("Dorsal").SemiBold();
                                    r.RelativeItem().Text("Nombre y apellidos").SemiBold();
                                    r.ConstantItem(100).Text("Equipo").SemiBold();
                                    r.ConstantItem(40).AlignCenter().Text("Asist.").SemiBold();
                                    r.ConstantItem(50).Text("Pos. ideal").SemiBold();
                                    r.ConstantItem(90).Text("Pos. posibles").SemiBold();
                                    r.ConstantItem(100).Text("Padre (tel)").SemiBold();
                                    r.ConstantItem(100).Text("Madre (tel)").SemiBold();
                                    r.ConstantItem(120).Text("Observaciones").SemiBold();
                                });

                                // Player rows
                                int idx = 1;
                                foreach (var p in players)
                                {
                                    col.Item().PaddingTop(6).BorderBottom(1).PaddingBottom(6).Row(r =>
                                    {
                                        r.ConstantItem(30).AlignCenter().Text(idx.ToString());
                                        r.ConstantItem(40).AlignCenter().Text(p.Dorsal ?? string.Empty);
                                        r.RelativeItem().Text(p.DisplayName ?? string.Empty);
                                        r.ConstantItem(100).Text(p.TeamName ?? string.Empty);
                                        r.ConstantItem(40).AlignCenter().Text(p.Attendance == true ? "[X]" : "[ ]");
                                        r.ConstantItem(50).Text(AbbreviatePosition(p.PrimaryPosition));
                                        var possible = p.PossiblePositions != null ? string.Join(", ", p.PossiblePositions.Select(pp => AbbreviatePosition(pp))) : string.Empty;
                                        r.ConstantItem(90).Text(possible);
                                        var father = string.IsNullOrWhiteSpace(p.FatherName) && string.IsNullOrWhiteSpace(p.FatherPhone) ? string.Empty : $"{p.FatherName} {p.FatherPhone}".Trim();
                                        r.ConstantItem(100).Text(father);
                                        var mother = string.IsNullOrWhiteSpace(p.MotherName) && string.IsNullOrWhiteSpace(p.MotherPhone) ? string.Empty : $"{p.MotherName} {p.MotherPhone}".Trim();
                                        r.ConstantItem(100).Text(mother);
                                        r.ConstantItem(120).Text(p.Observations ?? string.Empty);
                                    });
                                    idx++;
                                }
                            });
                        });
                    });
                }
            });

            using var ms = new MemoryStream();
            document.GeneratePdf(ms);
            return Task.FromResult(ms.ToArray());
        }
    }

    // Models
    public class SessionModel
    {
        public string? FedSeason { get; set; }
        public string? SportEventId { get; set; }
        public SlotData? Slot { get; set; }
        public List<Player>? Pool { get; set; } = new();
        public int? ActiveTab { get; set; }
        public string? FormationId { get; set; }
        public string? FormationName { get; set; }
        public int? SelectedDayIndex { get; set; }
    }

    public class SlotData
    {
        public string? FormationId { get; set; }
        public string? Formation { get; set; }
        public int ActiveTab { get; set; }
        public List<TabData>? Tabs { get; set; } = new();
    }

    public class TabData
    {
        public Dictionary<string, string>? Slots { get; set; } = new();
        public List<string>? Bench { get; set; } = new();
    }

    public class Player
    {
        public string? TeamPlayerId { get; set; }
        public string? DisplayName { get; set; }
        public string? Alias { get; set; }
        public string? PhotoSrc { get; set; }
        public string? Dorsal { get; set; }
        public int? Competitiveness { get; set; }
        public string? PrimaryPosition { get; set; }
        public List<string>? PossiblePositions { get; set; } = new();
        public string? TeamName { get; set; }
        public bool? Attendance { get; set; }
        public string? FatherName { get; set; }
        public string? FatherPhone { get; set; }
        public string? MotherName { get; set; }
        public string? MotherPhone { get; set; }
        public string? Observations { get; set; }
    }
}
