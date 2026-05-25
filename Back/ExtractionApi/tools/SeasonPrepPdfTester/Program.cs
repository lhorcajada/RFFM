using System;
using System.IO;
using System.Threading.Tasks;
using RFFM.Api.Services.Export;
using QuestPDF.Infrastructure;

class Program
{
    static async Task<int> Main(string[] args)
    {
            try
            {
                // Set QuestPDF license for this test runner
                QuestPDF.Settings.License = LicenseType.Community;
                // Enable QuestPDF debugging to get detailed layout information when issues occur
                QuestPDF.Settings.EnableDebugging = true;
            var generator = new SeasonPrepPdfGenerator();
            var sampleJson = "{}";
            var bytes = await generator.GeneratePdfAsync(sampleJson, null, false, "Mi Club", null);
            var outPath = Path.Combine(Directory.GetCurrentDirectory(), "test_preparacion.pdf");
            await File.WriteAllBytesAsync(outPath, bytes);
            Console.WriteLine($"Wrote PDF to: {outPath}");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.ToString());
            return 2;
        }
    }
}
