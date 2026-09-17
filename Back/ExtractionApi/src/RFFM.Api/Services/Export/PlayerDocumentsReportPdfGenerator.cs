using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Linq;

namespace RFFM.Api.Services.Export
{
    public class PlayerDocumentsReportPdfGenerator
    {
        public byte[] GeneratePdf(string teamName, string documentTypeName, string seasonName, IReadOnlyList<(string PlayerName, int? Dorsal, string Status)> rows)
        {
            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(20);

                    page.Header().Element(header =>
                    {
                        header.Column(col =>
                        {
                            col.Item().Text($"Reporte de Documentos").FontSize(18).Bold();
                            col.Item().Text($"Equipo: {teamName}").FontSize(11);
                            col.Item().Text($"Documento: {documentTypeName}").FontSize(11);
                            col.Item().Text($"Temporada: {seasonName}").FontSize(11);
                            col.Item().Text($"Generado: {DateTime.UtcNow:dd/MM/yyyy HH:mm}").FontSize(10);
                            col.Item().PaddingVertical(10).LineHorizontal(1);
                        });
                    });

                    page.Content().Element(content =>
                    {
                        content.Column(column =>
                        {
                            column.Spacing(14);

                            foreach (var status in StatusGroupOrder)
                            {
                                var group = rows.Where(r => r.Status == status).ToList();
                                column.Item().Element(section => BuildStatusSection(section, status, group));
                            }
                        });
                    });

                    page.Footer().AlignCenter().Text($"Página 1 de 1").FontSize(8);
                });
            });

            return document.GeneratePdf();
        }

        private static readonly string[] StatusGroupOrder = { "Pending", "Delivered", "Approved", "Rejected" };

        private static void BuildStatusSection(IContainer section, string status, IReadOnlyList<(string PlayerName, int? Dorsal, string Status)> rows)
        {
            section.Column(column =>
            {
                column.Item().Text($"{TranslateStatus(status)} ({rows.Count})").Bold().FontSize(12);

                if (rows.Count == 0)
                {
                    column.Item().PaddingTop(2).Text("Sin jugadores en este estado.").FontSize(9).Italic();
                    return;
                }

                column.Item().PaddingTop(4).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(2); // Jugador
                        columns.RelativeColumn(1); // Dorsal
                    });

                    table.Header(header =>
                    {
                        header.Cell().Text("Jugador").Bold().FontSize(10);
                        header.Cell().Text("Dorsal").Bold().FontSize(10);
                    });

                    foreach (var row in rows)
                    {
                        table.Cell().Text(row.PlayerName).FontSize(10);
                        table.Cell().Text(row.Dorsal?.ToString() ?? "-").FontSize(10);
                    }
                });
            });
        }

        private static string TranslateStatus(string status)
        {
            return status switch
            {
                "Pending" => "Pendientes",
                "Delivered" => "Entregados",
                "Approved" => "Aprobados",
                "Rejected" => "Rechazados",
                _ => status
            };
        }
    }
}
