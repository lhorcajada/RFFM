using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Infrastructure.GameModelImport
{
    /// <summary>
    /// Parses `docs/game-model/ADN-Modelo-de-Juego-Legible.md` into an in-memory
    /// <see cref="ImportedGameModel"/> tree, following the parsing/key-derivation rules in
    /// `docs/game-model/ADN-modelo-de-juego-especificacion-tecnica.md` §1–§5, and upserts that
    /// tree against a <see cref="GameModel"/> by <c>Key</c> (idempotent — see spec §8).
    /// </summary>
    public class AdnLegibleImporter
    {
        // ── §2 patterns ─────────────────────────────────────────────────────────

        private static readonly Regex FaseRegex = new(@"^##\s+\d+\.\s+(.+)$", RegexOptions.Compiled);
        private static readonly Regex PrincipioRegex = new(@"^(\d+)\.\s+\*\*(.+?)\.\*\*\s*(.*)$", RegexOptions.Compiled);
        /// <summary>Alternate Principio heading style used in some Fases (e.g. Transición
        /// defensa-ataque): "**Principio N — Título.** texto" instead of "N. **Título.** texto".</summary>
        private static readonly Regex PrincipioAltRegex = new(@"^\*\*Principio\s+(\d+)\s+—\s+(.+?)\.\*\*\s*(.*)$", RegexOptions.Compiled);
        private static readonly Regex SubprincipioRegex = new(@"-\s+\*\*Subprincipio\s+([\d.]+)\s+—\s+(.+?)\.\*\*\s*(.*)$", RegexOptions.Compiled);
        private static readonly Regex SubSubPrincipioRegex = new(@"-\s+\*\*Sub-subprincipio\s+([\d.]+)\s+—\s+(.+?):\*\*\s*(.*)$", RegexOptions.Compiled);
        private static readonly Regex HabilidadMismaQueRegex = new(@"-\s+Habilidad imprescindible\s+—\s+\*\*(.+?)\*\*\s*\(misma que\s+([\d.]+)\)\.?\s*$", RegexOptions.Compiled);
        private static readonly Regex HabilidadRegex = new(@"-\s+Habilidad imprescindible\s+—\s+\*\*(.+?)\*\*:\s*(.+?)\.\s*\(Entrenable:\s*(.+?)\)\.?\s*$", RegexOptions.Compiled);
        private static readonly Regex NotaRegex = new(@"^\*(.+)\*$", RegexOptions.Compiled);
        private static readonly Regex ImageRegex = new(@"^!\[.*\]\(.*\)\s*$", RegexOptions.Compiled);
        private static readonly Regex ZonaHeadingRegex = new(@"-\s+\*\*(Zona de .+?|Todas las zonas|[^*]*Zona[^*]*)\.\*\*\s*(.*)$", RegexOptions.Compiled);
        private static readonly Regex SetPieceRuleRegex = new(@"^\*\*(.+?)\.\*\*\s*(.*)$", RegexOptions.Compiled);
        private static readonly Regex OpenIssueRegex = new(@"^\d+\.\s+\*\*(.+?)\*\*\s*(.*)$", RegexOptions.Compiled);

        private static readonly Dictionary<string, string> SimpleZoneMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Zona de Finalización"] = "finalizacion",
            ["Zona de Creación Rival"] = "creacion-rival",
            ["Zona de Creación Propia"] = "creacion-propia",
            ["Zona de Iniciación"] = "iniciacion",
        };

        /// <summary>§3 special cases: exact heading text (without trailing period) → zoneKeysCsv.
        /// A <c>*</c> value means "compuesta" (zona_texto keeps the literal heading).</summary>
        private static readonly Dictionary<string, string> CompoundZoneMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Zona de Creación Propia / Iniciación (bloque bajo)"] = "creacion-propia,iniciacion",
            ["Zona de Finalización / Creación Rival / Creación Propia"] = "finalizacion,creacion-rival,creacion-propia",
            ["Zona de Iniciación y Zona de Creación Propia (campo propio)"] = "iniciacion,creacion-propia",
            ["Zona de Creación Propia y Zona de Creación Rival"] = "creacion-propia,creacion-rival",
            ["Zona de Creación Rival / Creación Propia"] = "creacion-rival,creacion-propia",
            ["Zona de Finalización y Zona de Creación Rival"] = "finalizacion,creacion-rival",
            ["Zona de Finalización, Creación Rival y Creación Propia"] = "finalizacion,creacion-rival,creacion-propia",
            ["Zona de Iniciación y Zona de Creación Propia (riesgo bajo)"] = "iniciacion,creacion-propia",
            ["Zona de Creación Rival y Zona de Finalización (riesgo asumible)"] = "creacion-rival,finalizacion",
            ["Balón cae entre Zona de Creación Rival y Zona de Creación Propia (extremo superado en Finalización)"] = "*",
            ["Balón cae en Zona de Creación Rival"] = "*",
            ["Balón cae en Zona de Creación Propia / Iniciación"] = "*",
            ["Zona de Iniciación → Creación Propia y Zona de Creación Propia → Creación Rival"] = "*",
        };

        /// <summary>Optional label for a handful of §3 compound cases where the heading's
        /// parenthetical is a sub-grouping distinguisher within the same Subprincipio (same
        /// pattern as "Ataque del centro (ambas zonas)"), not part of the zone-key derivation.</summary>
        private static readonly Dictionary<string, string> CompoundZoneLabelMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Zona de Iniciación y Zona de Creación Propia (riesgo bajo)"] = "riesgo bajo",
            ["Zona de Creación Rival y Zona de Finalización (riesgo asumible)"] = "riesgo asumible",
        };

        private static readonly Dictionary<string, string> SetPieceSubtypeMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Córners defensivos"] = "corners-defensivos",
            ["Córners ofensivos"] = "corners-ofensivos",
            ["Faltas defendiendo"] = "faltas-defendiendo",
            ["Faltas defendiendo (cerca del área propia)"] = "faltas-defendiendo",
            ["Faltas atacando"] = "faltas-atacando",
            ["Faltas atacando (cerca del área rival)"] = "faltas-atacando",
            ["Saques de banda"] = "saques-banda",
            ["Saque de portería"] = "saque-porteria",
            ["Saque de centro"] = "saque-centro",
            ["Penaltis"] = "penaltis",
        };

        // ── Parsing ─────────────────────────────────────────────────────────────

        /// <summary>A Zona heading that <see cref="ResolveZona"/> could not resolve, captured by
        /// the diagnostic collect-mode of <see cref="Parse"/> (see <paramref name="unresolvedZonas"/>)
        /// instead of aborting the whole parse — used to enumerate every unresolved heading across
        /// the document in one pass rather than fixing them one at a time.</summary>
        public record UnresolvedZonaHeading(string Heading, string FaseSlug, string SubprincipioNumero, string SubprincipioTitulo, int LineNumber);

        /// <param name="markdown">The legible document source.</param>
        /// <param name="unresolvedZonas">When non-null, unresolvable Zona headings are collected
        /// into this list instead of throwing, and parsing continues past them (diagnostic
        /// collect-mode). When null (default), the first unresolvable Zona heading throws
        /// <see cref="GameModelImportException"/> immediately, as normal.</param>
        public ImportedGameModel Parse(string markdown, List<UnresolvedZonaHeading>? unresolvedZonas = null)
        {
            var model = new ImportedGameModel();

            string? currentFaseSlug = null;
            bool inBalonParado = false;
            bool inOpenIssues = false;

            ImportedPrincipio? currentPrincipio = null;
            ImportedSubprincipio? currentSubprincipio = null;
            ImportedZona? currentZona = null;
            ImportedSubSubPrincipio? currentSsp = null;

            // Notas that appear right after a "## N. Fase" heading, before that Fase's first
            // Principio has been parsed (e.g. the "Nota de identidad" intro in Ataque organizado)
            // have no Principio/Subprincipio/Zona/SubSubPrincipio to anchor to yet — the schema
            // has no Fase-level anchor (design.md §1.2 lists only those four). They characterize
            // how to read the Fase's Principios as a whole, so they are anchored to the Fase's
            // first Principio once it is parsed, rather than dropped or rejected.
            var pendingFaseNotas = new List<(string Tipo, string Texto)>();

            var lines = markdown.Replace("\r\n", "\n").Split('\n');

            for (var lineIndex = 0; lineIndex < lines.Length; lineIndex++)
            {
                var rawLine = lines[lineIndex];
                var line = rawLine.TrimEnd();
                var trimmed = line.Trim();

                if (trimmed.Length == 0)
                    continue;

                if (ImageRegex.IsMatch(trimmed))
                    continue;

                var faseMatch = FaseRegex.Match(trimmed);
                if (faseMatch.Success)
                {
                    var titulo = faseMatch.Groups[1].Value;
                    currentFaseSlug = ResolveFaseSlug(titulo);
                    inBalonParado = currentFaseSlug == "balon-parado";
                    inOpenIssues = titulo.Contains("Pendientes abiertos", StringComparison.OrdinalIgnoreCase);
                    currentPrincipio = null;
                    currentSubprincipio = null;
                    currentZona = null;
                    currentSsp = null;
                    pendingFaseNotas.Clear(); // a Fase with no Principios (e.g. Balón parado) never anchors these
                    continue;
                }

                if (trimmed.Equals("Pendientes abiertos", StringComparison.OrdinalIgnoreCase) ||
                    trimmed.Equals("## Pendientes abiertos", StringComparison.OrdinalIgnoreCase))
                {
                    inOpenIssues = true;
                    continue;
                }

                if (inOpenIssues)
                {
                    var issueMatch = OpenIssueRegex.Match(trimmed);
                    if (issueMatch.Success)
                    {
                        model.OpenIssues.Add(new ImportedOpenIssue
                        {
                            Topic = issueMatch.Groups[1].Value.Trim().TrimEnd('.'),
                            Description = issueMatch.Groups[2].Value.Trim(),
                            Status = "open"
                        });
                    }
                    continue;
                }

                if (inBalonParado)
                {
                    var ruleMatch = SetPieceRuleRegex.Match(trimmed);
                    if (ruleMatch.Success)
                    {
                        var label = ruleMatch.Groups[1].Value.Trim();
                        var subtype = ResolveSetPieceSubtype(label);
                        if (subtype is not null)
                        {
                            model.SetPieceRules.Add(new ImportedSetPieceRule { Subtype = subtype, Texto = ruleMatch.Groups[2].Value.Trim() });
                            continue;
                        }
                    }
                    // Free prose continuation for the last SetPieceRule block.
                    if (model.SetPieceRules.Count > 0)
                        model.SetPieceRules[^1].Texto = Append(model.SetPieceRules[^1].Texto, trimmed);
                    continue;
                }

                if (currentFaseSlug is null)
                    continue; // preamble / title lines before the first Fase heading

                var notaMatch = NotaRegex.Match(trimmed);
                if (notaMatch.Success)
                {
                    var (tipo, texto) = ParseNota(notaMatch.Groups[1].Value.Trim());
                    var anchorKey = currentZona?.Key ?? currentSubprincipio?.Key ?? currentPrincipio?.Key;
                    if (anchorKey is null)
                    {
                        // Fase-level Nota, appearing before this Fase's first Principio has been
                        // parsed (e.g. "Nota de identidad" right after "## 3. Ataque organizado").
                        // Buffer it; it is anchored to the Fase's first Principio once parsed below.
                        pendingFaseNotas.Add((tipo, texto));
                        continue;
                    }

                    model.Notas.Add(new ImportedNota { AnchorKey = anchorKey, Tipo = tipo, Texto = texto });
                    continue;
                }

                var principioMatch = PrincipioRegex.Match(trimmed);
                var isAltPrincipio = false;
                if (!principioMatch.Success)
                {
                    principioMatch = PrincipioAltRegex.Match(trimmed);
                    isAltPrincipio = principioMatch.Success;
                }
                if (principioMatch.Success && (isAltPrincipio || !trimmed.StartsWith("-")))
                {
                    var numero = int.Parse(principioMatch.Groups[1].Value);
                    var key = GameModelKeys.BuildPrincipioKey(currentFaseSlug, numero);
                    currentPrincipio = new ImportedPrincipio
                    {
                        FaseSlug = currentFaseSlug,
                        Key = key,
                        Numero = numero,
                        Titulo = principioMatch.Groups[2].Value.Trim(),
                        Texto = principioMatch.Groups[3].Value.Trim(),
                    };
                    model.Principios.Add(currentPrincipio);

                    if (pendingFaseNotas.Count > 0)
                    {
                        foreach (var (tipo, texto) in pendingFaseNotas)
                            model.Notas.Add(new ImportedNota { AnchorKey = currentPrincipio.Key, Tipo = tipo, Texto = texto });
                        pendingFaseNotas.Clear();
                    }

                    currentSubprincipio = null;
                    currentZona = null;
                    currentSsp = null;
                    continue;
                }

                var subprincipioMatch = SubprincipioRegex.Match(trimmed);
                if (subprincipioMatch.Success)
                {
                    if (currentPrincipio is null)
                        throw new GameModelImportException($"Subprincipio outside of a Principio: '{trimmed}'");

                    var numero = subprincipioMatch.Groups[1].Value;
                    var key = GameModelKeys.BuildSubprincipioKey(currentFaseSlug, numero);
                    currentSubprincipio = new ImportedSubprincipio
                    {
                        Key = key,
                        Numero = numero,
                        Titulo = subprincipioMatch.Groups[2].Value.Trim(),
                        Texto = subprincipioMatch.Groups[3].Value.Trim(),
                    };
                    currentPrincipio.Subprincipios.Add(currentSubprincipio);
                    currentZona = null;
                    currentSsp = null;
                    continue;
                }

                var sspMatch = SubSubPrincipioRegex.Match(trimmed);
                if (sspMatch.Success)
                {
                    if (currentSubprincipio is null)
                        throw new GameModelImportException($"SubSubPrincipio outside of a Subprincipio: '{trimmed}'");

                    var numero = sspMatch.Groups[1].Value;
                    var key = GameModelKeys.BuildSubSubPrincipioKey(currentFaseSlug, numero);
                    currentSsp = new ImportedSubSubPrincipio
                    {
                        Key = key,
                        Numero = numero,
                        Rol = sspMatch.Groups[2].Value.Trim(),
                        Texto = sspMatch.Groups[3].Value.Trim(),
                    };
                    (currentZona?.SubSubPrincipios ?? currentSubprincipio.SubSubPrincipios).Add(currentSsp);
                    continue;
                }

                var habilidadMismaQueMatch = HabilidadMismaQueRegex.Match(trimmed);
                if (habilidadMismaQueMatch.Success)
                {
                    if (currentSsp is null)
                        throw new GameModelImportException($"Habilidad outside of a SubSubPrincipio: '{trimmed}'");

                    var nombre = habilidadMismaQueMatch.Groups[1].Value.Trim();
                    ValidateHabilidadVocabulary(nombre, trimmed);
                    currentSsp.Habilidades.Add(new ImportedHabilidad { Nombre = nombre, ReferenciaRaw = habilidadMismaQueMatch.Groups[2].Value.Trim() });
                    continue;
                }

                var habilidadMatch = HabilidadRegex.Match(trimmed);
                if (habilidadMatch.Success)
                {
                    if (currentSsp is null)
                        throw new GameModelImportException($"Habilidad outside of a SubSubPrincipio: '{trimmed}'");

                    var nombre = habilidadMatch.Groups[1].Value.Trim();
                    ValidateHabilidadVocabulary(nombre, trimmed);
                    currentSsp.Habilidades.Add(new ImportedHabilidad
                    {
                        Nombre = nombre,
                        Descripcion = habilidadMatch.Groups[2].Value.Trim(),
                        Entrenable = habilidadMatch.Groups[3].Value.Trim(),
                    });
                    continue;
                }

                var zonaMatch = ZonaHeadingRegex.Match(trimmed);
                if (zonaMatch.Success)
                {
                    if (currentSubprincipio is null)
                        throw new GameModelImportException($"Zona outside of a Subprincipio: '{trimmed}'");

                    var headingText = zonaMatch.Groups[1].Value.Trim();
                    if (unresolvedZonas is not null)
                    {
                        try
                        {
                            currentZona = ResolveZona(currentFaseSlug, currentSubprincipio, headingText, zonaMatch.Groups[2].Value.Trim());
                            currentSubprincipio.Zonas.Add(currentZona);
                        }
                        catch (GameModelImportException)
                        {
                            unresolvedZonas.Add(new UnresolvedZonaHeading(
                                headingText.TrimEnd('.'), currentFaseSlug, currentSubprincipio.Numero, currentSubprincipio.Titulo, lineIndex + 1));
                            currentZona = null; // skip this zona's subtree; keep scanning for more unresolved headings
                        }
                    }
                    else
                    {
                        currentZona = ResolveZona(currentFaseSlug, currentSubprincipio, headingText, zonaMatch.Groups[2].Value.Trim());
                        currentSubprincipio.Zonas.Add(currentZona);
                    }

                    currentSsp = null;
                    continue;
                }

                // Free prose continuation — append to the deepest active node (Habilidad excluded:
                // habilidades are always single-line per spec §2).
                if (currentSsp is not null) currentSsp.Texto = Append(currentSsp.Texto, trimmed);
                else if (currentZona is not null) currentZona.Texto = Append(currentZona.Texto, trimmed);
                else if (currentSubprincipio is not null) currentSubprincipio.Texto = Append(currentSubprincipio.Texto, trimmed);
                else if (currentPrincipio is not null) currentPrincipio.Texto = Append(currentPrincipio.Texto, trimmed);
            }

            ResolveHabilidadReferences(model);

            return model;
        }

        private static string Append(string existing, string addition) =>
            string.IsNullOrEmpty(existing) ? addition : $"{existing} {addition}";

        private static string ResolveFaseSlug(string titulo)
        {
            var t = titulo.ToLowerInvariant();
            if (t.Contains("defensa organizada")) return "defensa-organizada";
            if (t.Contains("ataque organizado")) return "ataque-organizado";
            if (t.Contains("transición defensa-ataque") || t.Contains("transicion defensa-ataque")) return "transicion-defensa-ataque";
            if (t.Contains("transición ataque-defensa") || t.Contains("transicion ataque-defensa")) return "transicion-ataque-defensa";
            if (t.Contains("balón parado") || t.Contains("balon parado")) return "balon-parado";
            throw new GameModelImportException($"Unresolvable Fase heading: '{titulo}'");
        }

        private static string? ResolveSetPieceSubtype(string label)
        {
            foreach (var (key, subtype) in SetPieceSubtypeMap)
                if (label.Equals(key, StringComparison.OrdinalIgnoreCase) || label.StartsWith(key, StringComparison.OrdinalIgnoreCase))
                    return subtype;
            return null;
        }

        private static (string Tipo, string Texto) ParseNota(string content)
        {
            var riesgoMatch = Regex.Match(content, @"^Riesgo aceptado(\s*\([^)]*\))?:?\s*(.*)$", RegexOptions.IgnoreCase);
            if (riesgoMatch.Success)
                return ("riesgo-aceptado", riesgoMatch.Groups[2].Value.Trim());

            if (content.Contains("objetivo de temporada", StringComparison.OrdinalIgnoreCase))
            {
                var idx = content.IndexOf(':');
                return ("objetivo-temporada", idx >= 0 ? content[(idx + 1)..].Trim() : content.Trim());
            }

            if (content.Contains("excepción", StringComparison.OrdinalIgnoreCase) || content.Contains("excepcion", StringComparison.OrdinalIgnoreCase))
            {
                var idx = content.IndexOf(':');
                return ("excepcion", idx >= 0 ? content[(idx + 1)..].Trim() : content.Trim());
            }

            var notaIdx = content.IndexOf(':');
            var startsWithNota = content.StartsWith("Nota", StringComparison.OrdinalIgnoreCase);
            return ("nota", startsWithNota && notaIdx >= 0 ? content[(notaIdx + 1)..].Trim() : content.Trim());
        }

        private static ImportedZona ResolveZona(string faseSlug, ImportedSubprincipio subprincipio, string heading, string texto)
        {
            heading = heading.TrimEnd('.');

            if (heading.Equals("Todas las zonas", StringComparison.OrdinalIgnoreCase))
            {
                var key = GameModelKeys.BuildZonaKey(faseSlug, subprincipio.Numero, "todas");
                return new ImportedZona { Key = key, ZoneKeysCsv = "todas", Texto = texto };
            }

            if (heading.Equals("Ataque del centro (ambas zonas)", StringComparison.OrdinalIgnoreCase))
            {
                var inherited = subprincipio.Zonas.Count > 0
                    ? subprincipio.Zonas[0].ZoneKeysCsv
                    : throw new GameModelImportException("'Ataque del centro (ambas zonas)' has no prior Zona to inherit zoneKeys from.");
                var key = GameModelKeys.BuildZonaKey(faseSlug, subprincipio.Numero, inherited, "Ataque del centro");
                return new ImportedZona { Key = key, ZoneKeysCsv = inherited, Label = "Ataque del centro", Texto = texto };
            }

            if (SimpleZoneMap.TryGetValue(heading, out var singleZoneKey))
            {
                var key = GameModelKeys.BuildZonaKey(faseSlug, subprincipio.Numero, singleZoneKey);
                return new ImportedZona { Key = key, ZoneKeysCsv = singleZoneKey, Texto = texto };
            }

            if (CompoundZoneMap.TryGetValue(heading, out var compoundZoneKeys))
            {
                if (compoundZoneKeys == "*")
                {
                    var key = GameModelKeys.BuildZonaKey(faseSlug, subprincipio.Numero, "compuesta");
                    return new ImportedZona { Key = key, ZoneKeysCsv = "compuesta", ZonaTexto = heading, Texto = texto };
                }
                else
                {
                    CompoundZoneLabelMap.TryGetValue(heading, out var label);
                    var key = GameModelKeys.BuildZonaKey(faseSlug, subprincipio.Numero, compoundZoneKeys, label);
                    return new ImportedZona { Key = key, ZoneKeysCsv = compoundZoneKeys, Label = label, Texto = texto };
                }
            }

            // Per spec §3/§8: unresolvable Zona headings are rejected, never guessed.
            throw new GameModelImportException($"Unresolvable Zona heading (matches neither the 4-zone catalog nor a documented §3 special case): '{heading}'");
        }

        private static void ValidateHabilidadVocabulary(string nombre, string sourceLine)
        {
            if (!Habilidad.Vocabulary.Contains(nombre))
                throw new GameModelImportException($"'{nombre}' is not in the 15-value Habilidad closed vocabulary (spec §4): '{sourceLine}'");
        }

        /// <summary>Second pass per spec §8: resolves "(misma que X.Y.Z)" references against keys
        /// collected across the whole document, since the reference may be defined later.</summary>
        private static void ResolveHabilidadReferences(ImportedGameModel model)
        {
            var allSspKeysByFase = model.Principios
                .SelectMany(p => AllSubSubPrincipios(p).Select(ssp => (p.FaseSlug, ssp)))
                .ToDictionary(x => (x.FaseSlug, x.ssp.Numero), x => x.ssp.Key);

            foreach (var principio in model.Principios)
            {
                foreach (var ssp in AllSubSubPrincipios(principio))
                {
                    foreach (var habilidad in ssp.Habilidades.Where(h => h.ReferenciaRaw is not null))
                    {
                        var refKey = GameModelKeys.BuildSubSubPrincipioKey(principio.FaseSlug, habilidad.ReferenciaRaw!);
                        var exists = allSspKeysByFase.Values.Contains(refKey);
                        if (!exists)
                            throw new GameModelImportException($"Unresolvable Habilidad reference '(misma que {habilidad.ReferenciaRaw})' — key '{refKey}' was never defined in the document.");
                        habilidad.ReferenciaAKey = refKey;
                    }
                }
            }
        }

        private static IEnumerable<ImportedSubSubPrincipio> AllSubSubPrincipios(ImportedPrincipio p) =>
            p.Subprincipios.SelectMany(sp => sp.SubSubPrincipios)
                .Concat(p.Subprincipios.SelectMany(sp => sp.Zonas).SelectMany(z => z.SubSubPrincipios));

        // ── Upsert ──────────────────────────────────────────────────────────────

        /// <summary>Upserts the parsed tree into <paramref name="db"/> against the GameModel for
        /// <paramref name="teamId"/>/<paramref name="season"/>, matching by <c>Key</c> — idempotent
        /// (spec §8): re-running against an unchanged document does not duplicate rows.</summary>
        public async Task<string> UpsertAsync(AppDbContext db, ImportedGameModel imported, string teamId, string modelName, string season, CancellationToken ct = default)
        {
            var gameModel = await db.GameModels
                .Include(gm => gm.Principles).ThenInclude(p => p.Subprincipios).ThenInclude(sp => sp.Zonas).ThenInclude(z => z.SubSubPrincipios).ThenInclude(ssp => ssp.Habilidades)
                .Include(gm => gm.Principles).ThenInclude(p => p.Subprincipios).ThenInclude(sp => sp.SubSubPrincipios).ThenInclude(ssp => ssp.Habilidades)
                .Include(gm => gm.Notas)
                .Include(gm => gm.SetPieceRules)
                .Include(gm => gm.OpenIssues)
                .FirstOrDefaultAsync(gm => gm.TeamId == teamId && gm.Season == season, ct);

            if (gameModel is null)
            {
                gameModel = new GameModel(teamId, modelName, season);
                await db.GameModels.AddAsync(gameModel, ct);
            }

            foreach (var ip in imported.Principios)
            {
                var principio = gameModel.Principles.FirstOrDefault(p => p.Key == ip.Key);
                var gameMomentId = GameModelKeys.GameMomentIdsBySlug[ip.FaseSlug];
                if (principio is null)
                {
                    principio = new GamePrinciple(gameModel.Id, gameMomentId, ip.Key, ip.Numero, ip.Titulo, ip.Texto);
                    gameModel.Principles.Add(principio);
                }
                else
                {
                    principio.UpdateNumero(ip.Numero);
                    principio.UpdateTitulo(ip.Titulo);
                    principio.UpdateTexto(ip.Texto);
                }

                UpsertSubprincipios(principio, ip.Subprincipios);
            }

            foreach (var ir in imported.SetPieceRules)
            {
                var rule = gameModel.SetPieceRules.FirstOrDefault(r => r.Subtype == ir.Subtype);
                if (rule is null)
                    gameModel.SetPieceRules.Add(new SetPieceRule(gameModel.Id, ir.Subtype, ir.Texto));
                else
                    rule.UpdateTexto(ir.Texto);
            }

            foreach (var io in imported.OpenIssues)
            {
                var existing = gameModel.OpenIssues.FirstOrDefault(o => o.Topic == io.Topic);
                if (existing is null)
                    gameModel.OpenIssues.Add(new OpenIssue(gameModel.Id, io.Topic, io.Description, io.Status));
                else
                    existing.UpdateDescription(io.Description);
            }

            UpsertNotas(gameModel, imported.Notas);

            await db.SaveChangesAsync(ct);
            return gameModel.Id;
        }

        private static void UpsertSubprincipios(GamePrinciple principio, List<ImportedSubprincipio> imported)
        {
            foreach (var isp in imported)
            {
                var sp = principio.Subprincipios.FirstOrDefault(s => s.Key == isp.Key);
                if (sp is null)
                {
                    sp = new Subprincipio(principio.Id, isp.Key, isp.Numero, isp.Titulo, isp.Texto);
                    principio.Subprincipios.Add(sp);
                }
                else
                {
                    sp.UpdateNumero(isp.Numero);
                    sp.UpdateTitulo(isp.Titulo);
                    sp.UpdateTexto(isp.Texto);
                }

                foreach (var iz in isp.Zonas)
                {
                    var zona = sp.Zonas.FirstOrDefault(z => z.Key == iz.Key);
                    if (zona is null)
                    {
                        zona = new Zona(sp.Id, iz.Key, iz.ZoneKeysCsv, iz.Label, iz.ZonaTexto, iz.Texto);
                        sp.Zonas.Add(zona);
                    }
                    else
                    {
                        zona.UpdateZoneKeysCsv(iz.ZoneKeysCsv);
                        zona.UpdateLabel(iz.Label);
                        zona.UpdateZonaTexto(iz.ZonaTexto);
                        zona.UpdateTexto(iz.Texto);
                    }

                    UpsertSubSubPrincipios(zona.SubSubPrincipios, iz.SubSubPrincipios, subprincipioId: null, zonaId: zona.Id);
                }

                UpsertSubSubPrincipios(sp.SubSubPrincipios, isp.SubSubPrincipios, subprincipioId: sp.Id, zonaId: null);
            }
        }

        private static void UpsertSubSubPrincipios(List<SubSubPrincipio> current, List<ImportedSubSubPrincipio> imported, string? subprincipioId, string? zonaId)
        {
            foreach (var issp in imported)
            {
                var ssp = current.FirstOrDefault(s => s.Key == issp.Key);
                if (ssp is null)
                {
                    ssp = new SubSubPrincipio(issp.Key, issp.Numero, issp.Rol, issp.Texto, subprincipioId, zonaId);
                    current.Add(ssp);
                }
                else
                {
                    ssp.UpdateNumero(issp.Numero);
                    ssp.UpdateRol(issp.Rol);
                    ssp.UpdateTexto(issp.Texto);
                }

                foreach (var ih in issp.Habilidades)
                {
                    var habilidad = ssp.Habilidades.FirstOrDefault(h => h.Nombre == ih.Nombre);
                    if (habilidad is null)
                        ssp.Habilidades.Add(new Habilidad(ssp.Id, ih.Nombre, ih.Descripcion, ih.Entrenable, ih.ReferenciaAKey));
                    else
                    {
                        habilidad.UpdateDescripcion(ih.Descripcion);
                        habilidad.UpdateEntrenable(ih.Entrenable);
                        habilidad.UpdateReferenciaAKey(ih.ReferenciaAKey);
                    }
                }
            }
        }

        private static void UpsertNotas(GameModel gameModel, List<ImportedNota> imported)
        {
            foreach (var inota in imported)
            {
                var anchoredZona = gameModel.Principles.SelectMany(p => p.Subprincipios).SelectMany(sp => sp.Zonas).FirstOrDefault(z => z.Key == inota.AnchorKey);
                var anchoredSubprincipio = anchoredZona is null
                    ? gameModel.Principles.SelectMany(p => p.Subprincipios).FirstOrDefault(sp => sp.Key == inota.AnchorKey)
                    : null;
                var anchoredPrincipio = anchoredZona is null && anchoredSubprincipio is null
                    ? gameModel.Principles.FirstOrDefault(p => p.Key == inota.AnchorKey)
                    : null;

                if (anchoredZona is null && anchoredSubprincipio is null && anchoredPrincipio is null)
                    throw new GameModelImportException($"Nota anchor key '{inota.AnchorKey}' does not match any imported Principio/Subprincipio/Zona.");

                var existing = gameModel.Notas.FirstOrDefault(n => n.Texto == inota.Texto &&
                    (anchoredZona is not null ? n.ZonaId == anchoredZona.Id
                        : anchoredSubprincipio is not null ? n.SubprincipioId == anchoredSubprincipio.Id
                        : n.PrincipioId == anchoredPrincipio!.Id));
                if (existing is not null)
                {
                    existing.UpdateTipo(inota.Tipo);
                    continue;
                }

                if (anchoredZona is not null)
                    gameModel.Notas.Add(new Nota(gameModel.Id, inota.Tipo, inota.Texto, null, null, anchoredZona.Id, null));
                else if (anchoredSubprincipio is not null)
                    gameModel.Notas.Add(new Nota(gameModel.Id, inota.Tipo, inota.Texto, null, anchoredSubprincipio.Id, null, null));
                else
                    gameModel.Notas.Add(new Nota(gameModel.Id, inota.Tipo, inota.Texto, anchoredPrincipio!.Id, null, null, null));
            }
        }
    }
}
