#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using RFFM.Api.Infrastructure.GameModelImport;
using Xunit;
using Xunit.Abstractions;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Runs the importer against the real, full `ADN-Modelo-de-Juego-Legible.md` end-to-end.
    /// As of the full-document sweep of every Zona heading (§3 special cases fully populated)
    /// this now asserts a clean, zero-rejection import with plausible counts, rather than just
    /// tolerating failure — a regression here means a new heading/pattern needs handling.
    /// </summary>
    public class AdnLegibleImporterFullDocumentSpotCheckTests
    {
        private readonly ITestOutputHelper _output;

        public AdnLegibleImporterFullDocumentSpotCheckTests(ITestOutputHelper output) => _output = output;

        private static string? FindLegibleDocPath()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null)
            {
                var candidate = Path.Combine(dir.FullName, "docs", "game-model", "ADN-Modelo-de-Juego-Legible.md");
                if (File.Exists(candidate))
                    return candidate;
                dir = dir.Parent;
            }
            return null;
        }

        [Fact]
        public void Parse_RealFullDocument_ImportsCleanlyWithPlausibleCounts()
        {
            var path = FindLegibleDocPath();
            if (path is null)
            {
                _output.WriteLine("ADN-Modelo-de-Juego-Legible.md not found relative to test output directory — skipping.");
                return;
            }

            var markdown = File.ReadAllText(path);
            var importer = new AdnLegibleImporter();

            // No try/catch: a GameModelImportException here is a real regression, not tolerated.
            var result = importer.Parse(markdown);

            var subCount = 0;
            var zonaCount = 0;
            var sspCount = 0;
            var habCount = 0;
            foreach (var p in result.Principios)
            {
                subCount += p.Subprincipios.Count;
                foreach (var sp in p.Subprincipios)
                {
                    zonaCount += sp.Zonas.Count;
                    sspCount += sp.SubSubPrincipios.Count;
                    foreach (var z in sp.Zonas)
                    {
                        sspCount += z.SubSubPrincipios.Count;
                        foreach (var ssp in z.SubSubPrincipios) habCount += ssp.Habilidades.Count;
                    }
                    foreach (var ssp in sp.SubSubPrincipios) habCount += ssp.Habilidades.Count;
                }
            }

            _output.WriteLine($"Principios: {result.Principios.Count}, Subprincipios: {subCount}, Zonas: {zonaCount}, SubSubPrincipios: {sspCount}, Habilidades: {habCount}, Notas: {result.Notas.Count}, SetPieceRules: {result.SetPieceRules.Count}, OpenIssues: {result.OpenIssues.Count}");

            // Matches the doc's stated coverage (intro paragraph): 4 Fases with 2 Principios each
            // (Defensa organizada, Transición defensa-ataque, Ataque organizado, Transición
            // ataque-defensa) minus the one un-numbered/absent Principio in Transición
            // ataque-defensa, plus the flat Balón parado section (no Principios there).
            Assert.Equal(7, result.Principios.Count);
            Assert.True(subCount > 0);
            Assert.True(zonaCount > 0);
            Assert.True(sspCount > 0);
            Assert.True(habCount > 0);
            Assert.True(result.Notas.Count > 0);
            Assert.True(result.SetPieceRules.Count > 0);
            Assert.Single(result.OpenIssues);
        }

        /// <summary>
        /// Diagnostic pass: instead of aborting at the first unresolvable Zona heading, collects
        /// every unresolvable Zona heading across the whole document in one scan (heading text,
        /// Fase, Subprincipio, and source line number), so they can all be reported together.
        /// </summary>
        [Fact]
        public void Parse_RealFullDocument_CollectsAllUnresolvedZonaHeadings()
        {
            var path = FindLegibleDocPath();
            if (path is null)
            {
                _output.WriteLine("ADN-Modelo-de-Juego-Legible.md not found relative to test output directory — skipping.");
                return;
            }

            var markdown = File.ReadAllText(path);
            var importer = new AdnLegibleImporter();
            var unresolved = new List<AdnLegibleImporter.UnresolvedZonaHeading>();

            importer.Parse(markdown, unresolved);

            if (unresolved.Count == 0)
            {
                _output.WriteLine("No unresolved Zona headings — the full document imports cleanly.");
                return;
            }

            _output.WriteLine($"{unresolved.Count} unresolved Zona heading(s):");
            foreach (var u in unresolved)
                _output.WriteLine($"  Line {u.LineNumber} | Fase '{u.FaseSlug}' | Subprincipio {u.SubprincipioNumero} — {u.SubprincipioTitulo} | Heading: \"{u.Heading}\"");
        }
    }
}
