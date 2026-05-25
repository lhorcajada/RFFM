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

        public Task<byte[]> GeneratePdfAsync(string dataJson, string? sportEventId, bool templateMode, string? clubName, string? clubLogoBase64)
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var model = JsonSerializer.Deserialize<SessionModel>(dataJson ?? "{}", options) ?? new SessionModel();

            var tabs = model.Slot?.Tabs ?? new List<TabData> { new TabData() };
            var valuationLabels = new[] { "Técnica", "Táctica", "Física", "Actitud" };

            // Pre-parse club logo bytes to avoid doing base64 decoding inside the PDF composition
            byte[]? clubLogoBytes = null;
            if (!string.IsNullOrWhiteSpace(clubLogoBase64))
            {
                try
                {
                    var raw = clubLogoBase64;
                    var comma = raw.IndexOf("base64,", StringComparison.OrdinalIgnoreCase);
                    if (comma >= 0) raw = raw.Substring(comma + 7);
                    var bytes = Convert.FromBase64String(raw);
                    if (bytes?.Length > 0) clubLogoBytes = bytes;
                }
                catch
                {
                    clubLogoBytes = null;
                }
            }

            var document = Document.Create(container =>
            {
                foreach (var (tab, idx) in tabs.Select((value, i) => (value, i)))
                {
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4.Landscape());
                        page.Margin(18);
                        page.DefaultTextStyle(x => x.FontSize(10));

                        // Header with optional logo, club and meta
                        page.Header().Element(header =>
                        {
                            header.Row(r =>
                            {
                                // Logo / placeholder
                                r.ConstantItem(80).Element(img =>
                                {
                                    if (clubLogoBytes != null)
                                    {
                                        img.Image(clubLogoBytes, ImageScaling.FitArea);
                                    }
                                    else
                                    {
                                        img.Border(1).AlignCenter().Text(GetInitials(clubName)).SemiBold();
                                    }
                                });

                                // Club name + team label
                                r.RelativeItem().Column(col =>
                                {
                                    col.Item().Text(clubName ?? "Club").SemiBold().FontSize(16);
                                    col.Item().Text($"Equipo {idx + 1}").FontSize(11);
                                });

                                // Meta: date / trainer
                                r.ConstantItem(240).Column(col =>
                                {
                                    col.Item().AlignRight().Text($"Evento: {model.SportEventId ?? ""}");
                                    col.Item().AlignRight().Text("Fecha: ______________________");
                                    col.Item().AlignRight().Text("Entrenador: ______________________");
                                });
                            });
                        });

                        // Content: starters table, bench, extra rows
                        page.Content().PaddingVertical(6).Element(content =>
                        {
                            content.Column(col =>
                            {
                                // Table header
                                col.Item().BorderBottom(1).PaddingBottom(4).Row(r =>
                                {
                                    r.ConstantItem(30).AlignCenter().Text("#").SemiBold();
                                    r.ConstantItem(40).AlignCenter().Text("Dorsal").SemiBold();
                                    r.RelativeItem().Text("Nombre y apellidos").SemiBold();
                                    r.ConstantItem(70).AlignCenter().Text("Equipo").SemiBold();
                                    r.ConstantItem(34).AlignCenter().Text("Asist.").SemiBold();
                                    r.ConstantItem(140).AlignCenter().Text("Padre (tel)").SemiBold();
                                    r.ConstantItem(140).AlignCenter().Text("Madre (tel)").SemiBold();
                                    r.ConstantItem(160).AlignCenter().Text("Valoración").SemiBold();
                                    r.ConstantItem(80).AlignCenter().Text("Obs").SemiBold();
                                });

                                // Starters rows (11)
                                var slotsDict = tab.Slots ?? new Dictionary<string, string>();
                                var slotIndices = slotsDict.Keys.Select(k => { int.TryParse(k, out var v); return v; }).Where(v => v >= 0).OrderBy(v => v).ToList();

                                for (int i = 0; i < 11; i++)
                                {
                                    string? pid = null;
                                    if (i < slotIndices.Count)
                                    {
                                        var key = slotIndices[i].ToString();
                                        slotsDict.TryGetValue(key, out pid);
                                    }
                                    var p = model.Pool?.FirstOrDefault(pp => pp.TeamPlayerId == pid);

                                    col.Item().PaddingVertical(4).Row(r =>
                                    {
                                        r.ConstantItem(30).AlignCenter().Text((i + 1).ToString());
                                        r.ConstantItem(40).AlignCenter().Text(p?.Dorsal ?? "");
                                        r.RelativeItem().Text($"{p?.DisplayName ?? ""}");
                                        r.ConstantItem(70).Text(p?.TeamName ?? "");
                                        r.ConstantItem(34).AlignCenter().Text("[ ]");
                                        r.ConstantItem(140).Text("");
                                        r.ConstantItem(140).Text("");
                                        // valoración: show empty small boxes for each label stacked vertically to fit
                                        r.ConstantItem(160).Column(vc =>
                                        {
                                            foreach (var lbl in valuationLabels)
                                            {
                                                vc.Item().Row(rr =>
                                                {
                                                    rr.ConstantItem(18).Border(1).AlignCenter().Text(" ");
                                                    rr.RelativeItem().Text(lbl).FontSize(9);
                                                });
                                            }
                                        });
                                        r.ConstantItem(80).Text("");
                                    });
                                }

                                // Bench
                                col.Item().PaddingTop(8).Text($"BANQUILLO ({(tab.Bench?.Count ?? 0)})").Bold();
                                var bench = tab.Bench ?? new List<string>();
                                foreach (var pid in bench)
                                {
                                    var p = model.Pool?.FirstOrDefault(pp => pp.TeamPlayerId == pid);
                                    col.Item().Text($"• {p?.Dorsal ?? ""} {p?.DisplayName ?? ""} ({p?.TeamName ?? ""})");
                                }

                                // Extra rows
                                col.Item().PaddingTop(8).Text("Filas extra").Bold();
                                for (int i = 0; i < 8; i++) col.Item().Height(18).Border(1);

                                // Parents + Observations + Valuation summary
                                col.Item().PaddingTop(8).Row(r =>
                                {
                                    r.RelativeItem().Column(pc =>
                                    {
                                        pc.Item().Text("Padre: ________________________   Tel: ____________");
                                        pc.Item().Text("Madre: ________________________   Tel: ____________");
                                    });

                                    r.ConstantItem(260).Column(pc =>
                                    {
                                        pc.Item().Text("Observaciones").Bold();
                                        pc.Item().Height(80).Border(1);
                                    });
                                });
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
    }
}
