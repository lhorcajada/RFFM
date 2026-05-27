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
                        var sampleJson = @"{
    ""fedSeason"": ""2026"",
    ""sportEventId"": null,
    ""slot"": { ""formationId"": null, ""formation"": ""4-3-3"", ""activeTab"": 0, ""tabs"": [ { ""slots"": { ""0"": ""p1"", ""1"": ""p2"", ""2"": ""p3"" }, ""bench"": [""p7"", ""p8""] }, { ""slots"": { ""0"": ""p4"", ""1"": ""p5"", ""2"": ""p6"" }, ""bench"": [""p9""] } ] },
    ""pool"": [
        { ""TeamPlayerId"": ""p1"", ""DisplayName"": ""Jugador Uno"", ""TeamName"": ""Equipo 1"", ""PrimaryPosition"": ""Delantero"", ""PossiblePositions"": [""Extremo"", ""Segundo delantero""], ""attendance"": true, ""fatherName"": ""Padre Uno"", ""fatherPhone"": ""600111111"", ""motherName"": ""Madre Uno"", ""motherPhone"": ""600222222"" },
        { ""TeamPlayerId"": ""p2"", ""DisplayName"": ""Jugador Dos"", ""TeamName"": ""Equipo 1"", ""PrimaryPosition"": ""Centrocampista"", ""PossiblePositions"": [""Interior""], ""attendance"": false, ""fatherName"": ""Padre Dos"", ""fatherPhone"": ""600333333"", ""motherName"": ""Madre Dos"", ""motherPhone"": ""600444444"" },
        { ""TeamPlayerId"": ""p3"", ""DisplayName"": ""Jugador Tres"", ""TeamName"": ""Equipo 1"", ""PrimaryPosition"": ""Defensa"", ""PossiblePositions"": [""Central""], ""attendance"": true, ""fatherName"": ""Padre Tres"", ""fatherPhone"": ""600555555"", ""motherName"": ""Madre Tres"", ""motherPhone"": ""600666666"" },
        { ""TeamPlayerId"": ""p4"", ""DisplayName"": ""Jugador Cuatro"", ""TeamName"": ""Equipo 2"", ""PrimaryPosition"": ""Portero"", ""PossiblePositions"": [], ""attendance"": true, ""fatherName"": ""Padre Cuatro"", ""fatherPhone"": ""600777777"", ""motherName"": ""Madre Cuatro"", ""motherPhone"": ""600888888"" },
        { ""TeamPlayerId"": ""p5"", ""DisplayName"": ""Jugador Cinco"", ""TeamName"": ""Equipo 2"", ""PrimaryPosition"": ""Delantero"", ""PossiblePositions"": [""Extremo""], ""attendance"": false, ""fatherName"": ""Padre Cinco"", ""fatherPhone"": ""600999999"", ""motherName"": ""Madre Cinco"", ""motherPhone"": ""601000000"" },
        { ""TeamPlayerId"": ""p6"", ""DisplayName"": ""Jugador Seis"", ""TeamName"": ""Equipo 2"", ""PrimaryPosition"": ""Medio"", ""PossiblePositions"": [""Pivote""], ""attendance"": true, ""fatherName"": ""Padre Seis"", ""fatherPhone"": ""601111111"", ""motherName"": ""Madre Seis"", ""motherPhone"": ""601222222"" },
        { ""TeamPlayerId"": ""p7"", ""DisplayName"": ""Jugador Siete"", ""TeamName"": ""Equipo 1"", ""PrimaryPosition"": ""Delantero"", ""PossiblePositions"": [], ""attendance"": true, ""fatherName"": """", ""fatherPhone"": """", ""motherName"": """", ""motherPhone"": """" },
        { ""TeamPlayerId"": ""p8"", ""DisplayName"": ""Jugador Ocho"", ""TeamName"": ""Equipo 1"", ""PrimaryPosition"": ""Medio"", ""PossiblePositions"": [], ""attendance"": null, ""fatherName"": """", ""fatherPhone"": """", ""motherName"": """", ""motherPhone"": """" },
        { ""TeamPlayerId"": ""p9"", ""DisplayName"": ""Jugador Nueve"", ""TeamName"": ""Equipo 2"", ""PrimaryPosition"": ""Defensa"", ""PossiblePositions"": [], ""attendance"": false, ""fatherName"": """", ""fatherPhone"": """", ""motherName"": """", ""motherPhone"": """" }
    ],
    ""activeTab"": 0
}";
                        // Generate the equipos listing (listMode = true)
                        var bytes = await generator.GeneratePdfAsync(sampleJson, null, false, "Mi Club", null, true);
                        var outPath = Path.Combine(Directory.GetCurrentDirectory(), $"test_preparacion_listado_equipos_{DateTime.Now:yyyyMMdd_HHmmss}.pdf");
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
