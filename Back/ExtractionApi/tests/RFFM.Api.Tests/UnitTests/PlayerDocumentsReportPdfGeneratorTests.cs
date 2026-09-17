#nullable enable
using QuestPDF.Infrastructure;
using RFFM.Api.Services.Export;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class PlayerDocumentsReportPdfGeneratorTests
    {
        public PlayerDocumentsReportPdfGeneratorTests()
        {
            // Same as RFFM.Host/Program.cs at startup: outside the host, tests must set this
            // themselves before calling QuestPDF's GeneratePdf().
            QuestPDF.Settings.License = LicenseType.Community;
        }

        [Fact]
        public void GeneratePdf_ReturnsValidPdf()
        {
            var generator = new PlayerDocumentsReportPdfGenerator();
            // Rows use the raw English status codes the generator groups by (see GetTeamPlayerDocumentsStatus/
            // ExportPlayerDocumentsReport) — the generator translates them to Spanish internally.
            var rows = new List<(string PlayerName, int? Dorsal, string Status)>
            {
                ("Juan Pérez", 10, "Approved"),
                ("Carlos Rodríguez", null, "Pending")
            };

            var pdf = generator.GeneratePdf("FC Test", "Autorización", "2025-2026", rows);

            Assert.NotNull(pdf);
            Assert.NotEmpty(pdf);
            // Check PDF magic bytes
            Assert.Equal(0x25, pdf[0]); // %
            Assert.Equal(0x50, pdf[1]); // P
            Assert.Equal(0x44, pdf[2]); // D
            Assert.Equal(0x46, pdf[3]); // F
        }
    }
}
