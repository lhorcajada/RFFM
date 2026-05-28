using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using QuestPDF.Helpers;
using System.Text.RegularExpressions;

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

        private static string GetPrimaryDemarcationLabel(Player p)
        {
            if (!string.IsNullOrWhiteSpace(p.PrimaryPosition))
                return p.PrimaryPosition!.Trim();

            if (p.PossiblePositions != null && p.PossiblePositions.Count > 0)
                return (p.PossiblePositions[0] ?? string.Empty).Trim();

            return string.Empty;
        }

        private static int GetDemarcationGroupPriority(string? label)
        {
            var s = (label ?? string.Empty).ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(s) || s.Contains("sin demarc")) return 99;
            if (s.Contains("port") || s.Contains("arquero") || s.Contains("guardameta")) return 0;
            if (s.Contains("defen") || s.Contains("lateral") || s.Contains("central") || s.Contains("zague") || s.Contains("defensa")) return 1;
            if (s.Contains("medio") || s.Contains("centro") || s.Contains("volante") || s.Contains("medioc")) return 2;
            if (s.Contains("extrem") || s.Contains("ala") || s.Contains("wing")) return 3;
            if (s.Contains("delanter") || s.Contains("punta") || s.Contains("nueve") || s.Contains("9")) return 4;
            return 98;
        }

        private static string PluralizeLabel(string label)
        {
            if (string.IsNullOrWhiteSpace(label)) return label;

            string PluralizeWord(string word)
            {
                if (string.IsNullOrWhiteSpace(word)) return word;
                var original = word;
                var firstUpper = char.IsUpper(original[0]);
                var lower = original.ToLowerInvariant();

                // Heurística simple: si ya parece plural (termina en 's'), lo dejamos
                if (lower.EndsWith("s")) return original;

                // si termina en 'ión' -> 'iones' (quita acento automáticamente en la transformación)
                if (Regex.IsMatch(lower, "ión$"))
                {
                    var candidate = Regex.Replace(lower, "ión$", "iones", RegexOptions.IgnoreCase);
                    return ApplyCase(candidate, firstUpper);
                }

                // z -> ces
                if (lower.EndsWith("z"))
                {
                    var candidate = lower.Substring(0, lower.Length - 1) + "ces";
                    return ApplyCase(candidate, firstUpper);
                }

                // vocales (incluye vocales acentuadas y ü)
                var last = lower[lower.Length - 1];
                var vowels = new[] { 'a', 'e', 'i', 'o', 'u', 'á', 'é', 'í', 'ó', 'ú', 'ü' };
                if (Array.IndexOf(vowels, last) >= 0)
                {
                    var candidate = lower + "s";
                    return ApplyCase(candidate, firstUpper);
                }

                // consonante -> es
                var candidateFinal = lower + "es";
                return ApplyCase(candidateFinal, firstUpper);
            }

            string ApplyCase(string w, bool firstUpper)
            {
                if (string.IsNullOrEmpty(w)) return w;
                if (firstUpper) return char.ToUpperInvariant(w[0]) + w.Substring(1);
                return w;
            }

            // Split by spaces, and pluralize subparts separated by hyphens
            var parts = label.Split(' ');
            for (int i = 0; i < parts.Length; i++)
            {
                var segment = parts[i];
                var hy = segment.Split('-');
                for (int j = 0; j < hy.Length; j++) hy[j] = PluralizeWord(hy[j]);
                parts[i] = string.Join("-", hy);
            }

            return string.Join(" ", parts);
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
                                     .OrderBy(p => GetDemarcationGroupPriority(GetPrimaryDemarcationLabel(p)))
                                     .ThenBy(p => GetPrimaryDemarcationLabel(p))
                                     .ThenBy(p => p.DisplayName)
                                     .ToList();

                    players.AddRange(others);
                    return players;
                }
            }

            return pool.Where(p => (p.TeamName ?? string.Empty).Trim() == teamName)
                       .OrderBy(p => GetDemarcationGroupPriority(GetPrimaryDemarcationLabel(p)))
                       .ThenBy(p => GetPrimaryDemarcationLabel(p))
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

        public Task<byte[]> GeneratePdfAsync(string dataJson, string? sportEventId, bool templateMode, string? clubName, string? clubLogoBase64, bool listMode = false, bool ratingsMode = false, int? teamIndex = null)
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var model = JsonSerializer.Deserialize<SessionModel>(dataJson ?? "{}", options) ?? new SessionModel();

            var pool = model.Pool ?? new List<Player>();
            var tabs = model.Slot?.Tabs ?? new List<TabData>();

            var pages = new List<(string TeamLabel, List<Player> Players)>();

            var distinctTeamNames = pool.Where(p => !string.IsNullOrWhiteSpace(p.TeamName)).Select(p => p.TeamName!.Trim()).Distinct().ToList();

            if (listMode || ratingsMode)
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
                        pages.Add(("Lista de jugadores", pool.OrderBy(p => GetDemarcationGroupPriority(GetPrimaryDemarcationLabel(p))).ThenBy(p => GetPrimaryDemarcationLabel(p)).ThenBy(p => p.DisplayName).ToList()));
                    }
                }
            }
            else
            {
                pages.Add(("Lista de jugadores", pool.OrderBy(p => GetDemarcationGroupPriority(GetPrimaryDemarcationLabel(p))).ThenBy(p => GetPrimaryDemarcationLabel(p)).ThenBy(p => p.DisplayName).ToList()));
            }

            var document = Document.Create(container =>
            {
                foreach (var (pageData, pageIdx) in pages.Select((p, i) => (p, i)))
                {
                    var teamLabel = pageData.TeamLabel;
                    var players = pageData.Players ?? new List<Player>();

                    // When generating list or ratings PDFs, order players by position groups
                    // Porteros (0), Defensas (1), Medios (2), Delanteros (3), Unknown (4)
                    if (listMode || ratingsMode)
                    {
                        players = players
                            .OrderBy(p => GetDemarcationGroupPriority(GetPrimaryDemarcationLabel(p)))
                            .ThenBy(p => GetPrimaryDemarcationLabel(p))
                            .ThenBy(p => p.DisplayName)
                            .ToList();
                    }

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

                                if (ratingsMode)
                                {
                                    // Header row for valoraciones: #, Nombre, Pos ideal, Pos posibles
                                    col.Item().BorderBottom(1).PaddingBottom(6).Row(r =>
                                    {
                                        r.ConstantItem(30).AlignCenter().Text("#").SemiBold();
                                        r.RelativeItem().Text("Nombre del jugador").SemiBold();
                                        r.ConstantItem(80).Text("Pos. ideal").SemiBold();
                                        r.ConstantItem(160).Text("Pos. posibles").SemiBold();
                                    });

                                    int idx = 1;

                                    // Group players by primary demarcation label (ideal position)
                                    var groups = players.GroupBy(p =>
                                        {
                                            var lab = GetPrimaryDemarcationLabel(p);
                                            return string.IsNullOrWhiteSpace(lab) ? "Sin demarcación" : lab;
                                        })
                                        .OrderBy(g => GetDemarcationGroupPriority(g.Key))
                                        .ThenBy(g => g.Key)
                                        .ToList();

                                    foreach (var grp in groups)
                                    {
                                        var groupLabel = grp.Key;
                                        var groupPlayers = grp.OrderBy(p => p.DisplayName).ToList();
                                        // Group container: prevent page break for the whole group and render header with background only
                                        col.Item().PaddingTop(8).PaddingBottom(2).Element(groupContainer =>
                                        {
                                            groupContainer.PreventPageBreak().Column(groupCol =>
                                            {
                                                // Group header: centered, pluralized, with background and count
                                                var headerText = PluralizeLabel(groupLabel);
                                                groupCol.Item().PaddingBottom(6).Element(h =>
                                                {
                                                    h.Background(Colors.Grey.Lighten3).Padding(6).AlignCenter().Text($"{headerText} ({groupPlayers.Count})").SemiBold();
                                                });

                                                foreach (var p in groupPlayers)
                                                {
                                                    var possible = p.PossiblePositions != null ? string.Join(", ", p.PossiblePositions.Select(pp => AbbreviatePosition(pp))) : string.Empty;

                                                    // Player row + valoraciones inside the group container
                                                    groupCol.Item().PaddingTop(6).PaddingBottom(6).Element(el =>
                                                    {
                                                        el.PreventPageBreak().Column(pc =>
                                                        {
                                                            // Basic info row
                                                            pc.Item().BorderBottom(0).PaddingBottom(4).Row(r =>
                                                            {
                                                                r.ConstantItem(30).AlignCenter().Text(idx.ToString()).FontSize(10);
                                                                r.RelativeItem().Text(p.DisplayName ?? string.Empty).FontSize(10);
                                                                r.ConstantItem(80).Text(AbbreviatePosition(p.PrimaryPosition)).FontSize(10);
                                                                r.ConstantItem(160).Text(possible).FontSize(10);
                                                            });

                                                            // Valoraciones box (compact, but with larger fonts and bigger check symbols)
                                                            pc.Item().PaddingTop(2).PaddingBottom(6).BorderBottom(1).Column(inner =>
                                                            {
                                                                inner.Item().Padding(6).Background(Colors.White).Border(1).Column(box =>
                                                                {
                                                                    // First row: Actitud | Esfuerzo
                                                                    box.Item().Row(rr =>
                                                                    {
                                                                        rr.RelativeItem().Column(g =>
                                                                        {
                                                                            g.Item().Text("Actitud:").SemiBold().FontSize(11);
                                                                            g.Item().Text("☐ Pasota  ☐ No soporta la presión  ☐ Temperamental  ☐ comunicador  ☐ concentrado  ☐ no baja los brazos  ☐ es líder").FontSize(10);
                                                                        });

                                                                        rr.RelativeItem().Column(g =>
                                                                        {
                                                                            g.Item().Text("Esfuerzo:").SemiBold().FontSize(11);
                                                                            g.Item().Text("☐ Poco esfuerzo  ☐ a ratos  ☐ gran parte del tiempo  ☐ máximo").FontSize(10);
                                                                        });
                                                                    });

                                                                    // Second row: Con balón | Sin balón | Competición
                                                                    box.Item().PaddingTop(6).Row(rr =>
                                                                    {
                                                                        rr.RelativeItem().Column(g =>
                                                                        {
                                                                            g.Item().Text("Con balón:").SemiBold().FontSize(11);
                                                                            g.Item().Text("☐ poco  ☐ se defiende  ☐ se desenvuelve  ☐ la esconde  ☐ pocas perdidas  ☐ buena visión").FontSize(10);
                                                                        });

                                                                        rr.RelativeItem().Column(g =>
                                                                        {
                                                                            g.Item().Text("Sin balón:").SemiBold().FontSize(11);
                                                                            g.Item().Text("☐ no aparece  ☐ no sigue a la marca  ☐ no se posiciona bien  ☐ se ofrece  ☐ se anticipa  ☐ sigue bien a la marca  ☐ se posiciona bien  ☐ se desmarca bien").FontSize(10);
                                                                        });

                                                                        rr.RelativeItem().Column(g =>
                                                                        {
                                                                            g.Item().Text("Competición:").SemiBold().FontSize(11);
                                                                            g.Item().Text("☐ poca lucha  ☐ no gana duelos  ☐ poca participación  ☐ participación a ratos  ☐ va a los balones divididos  ☐ gana duelos  ☐ se hace notar  ☐ es determinante").FontSize(10);
                                                                        });
                                                                    });

                                                                    // Observaciones area
                                                                    box.Item().PaddingTop(6).Text("Observaciones:").FontSize(10).SemiBold();
                                                                    box.Item().Height(40).Text(string.Empty).FontSize(10);
                                                                });
                                                            });
                                                        });
                                                    });

                                                    idx++;
                                                }
                                            });
                                        });
                                    }
                                }
                                else
                                {
                                    // Existing players list layout
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

                                    // Player rows grouped by primary demarcation label (ideal position)
                                    int idx = 1;

                                    var listGroups = players.GroupBy(p =>
                                        {
                                            var lab = GetPrimaryDemarcationLabel(p);
                                            return string.IsNullOrWhiteSpace(lab) ? "Sin demarcación" : lab;
                                        })
                                        .OrderBy(g => GetDemarcationGroupPriority(g.Key))
                                        .ThenBy(g => g.Key)
                                        .ToList();

                                    foreach (var grp in listGroups)
                                    {
                                        var groupLabel = grp.Key;
                                        var groupPlayers = grp.OrderBy(p => p.DisplayName).ToList();

                                            // Group container: prevent page break and render header with background only (centered, plural)
                                            col.Item().PaddingTop(8).PaddingBottom(2).Element(groupContainer =>
                                            {
                                                groupContainer.PreventPageBreak().Column(groupCol =>
                                                {
                                                    var headerText = PluralizeLabel(groupLabel);
                                                    groupCol.Item().PaddingBottom(6).Element(h =>
                                                    {
                                                        h.Background(Colors.Grey.Lighten3).Padding(6).AlignCenter().Text($"{headerText} ({groupPlayers.Count})").SemiBold();
                                                    });

                                                    foreach (var p in groupPlayers)
                                                    {
                                                        groupCol.Item().PaddingTop(6).BorderBottom(1).PaddingBottom(6).Row(r =>
                                                        {
                                                            r.ConstantItem(30).AlignCenter().Text(idx.ToString());
                                                            r.ConstantItem(40).AlignCenter().Text(p.Dorsal ?? string.Empty);
                                                            r.RelativeItem().Text(p.DisplayName ?? string.Empty);
                                                            r.ConstantItem(100).Text(p.TeamName ?? string.Empty);
                                                            r.ConstantItem(40).AlignCenter().Text(p.Attendance == true ? "☑" : "☐").FontSize(11).SemiBold();
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
                                    }
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
