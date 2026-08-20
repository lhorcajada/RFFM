using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Infrastructure.Services
{
    /// <summary>
    /// Rerunnable importer that upserts the real "Plan de Temporada" (Cadete, 2ª División)
    /// content — transcribed from <c>docs/game-model/Plan-de-Temporada.docx</c> — into a
    /// team's <see cref="SeasonPlan"/>. Invoked automatically on every API startup via
    /// <c>WebApplicationExtensions.SeedSeasonPlanAsync</c> (called from <c>Program.cs</c>,
    /// mirroring the other catalog seeders) for the hardcoded target team/season — safe because
    /// every node is upserted by its position (<c>Order</c>) within its parent, the only
    /// deterministic key available (SeasonPlan nodes have no natural business key like
    /// GameModel's <c>Key</c>), and existing children not present in the hardcoded data are
    /// never removed. Re-invoking it after editing the hardcoded data below simply updates the
    /// affected nodes; call <see cref="ImportAsync"/> directly for any other team/season.
    ///
    /// GameZoneId values match the fixed GameZone catalog (see
    /// <c>GameZoneConfiguration.Configure</c>): 1 = Iniciación, 2 = Creación en Campo Propio,
    /// 3 = Creación en Campo Rival, 4 = Finalización.
    ///
    /// Assumptions made while transcribing this revision (documented, not silent):
    /// - The model is now Macrociclo (a periodización-táctica hito: Pretemporada, Iniciación,
    ///   Perfeccionamiento, plus a trailing Cierre de temporada) → Mesociclo (a block of weeks
    ///   during which the four phases work the same "generación" of subprincipio) → Microciclo
    ///   (one training week, two sessions). This replaces the previous "capa de profundidad"
    ///   concept (Macrociclo 1 = "esta temporada" / Macrociclo 2 = "curso siguiente") entirely —
    ///   that concept no longer exists in the source document.
    /// - Schema change: <see cref="Microciclo"/> now has <c>GameZoneIdSesionA</c>/
    ///   <c>GameZoneIdSesionB</c> (see its doc-comment and <c>UpdateZones</c>), because the real
    ///   plan trains Sesión A and Sesión B of the same week in different field zones very often
    ///   (e.g. Microciclo 5: Sesión 1 in Creación Propia, Sesión 2 in Creación Rival) — a
    ///   Mesociclo-level single zone cannot represent that. <see cref="Mesociclo.GameZoneId"/>
    ///   is kept (other consumers — CreateSeasonPlan/UpdateSeasonPlan/GetSeasonPlan and the
    ///   frontend SeasonPlanEditor/SeasonPlanView — still read/write it) and is upserted here
    ///   with the zone of that Mesociclo's first Microciclo's Sesión A as a non-null placeholder;
    ///   it does not carry meaning beyond satisfying the required FK.
    /// - Mesociclo "generación 6" spans the Macrociclo 2 / Macrociclo 3 boundary in the source
    ///   narrative ("se retoma el Mesociclo 6 donde se dejó") but a Mesociclo can only belong to
    ///   one Macrociclo (single MacrocicloId FK), so it is modelled as two Mesociclo rows:
    ///   "Mesociclo 6 (parte 1)" (Order 4 within Macrociclo 2, just Microciclo 16) and
    ///   "Mesociclo 6 (continuación)" (Order 1 within Macrociclo 3, Microciclos 17–18).
    /// - Only Microciclos 1–30 (the plan's first full pass through the catalog) are transcribed.
    ///   The source's "Segunda vuelta" paragraph after Microciclo 30 is a forward-looking note
    ///   ("se organiza según el tiempo restante hasta el cierre de temporada"), not concrete
    ///   per-week data, so Microciclos 31+ are deliberately left unmodelled here pending the
    ///   actual second-pass cadence — do not invent content for them.
    /// - "Cierre de temporada" is modelled as a trailing Macrociclo (Order 4) with a single
    ///   Mesociclo/Microciclo pair (19 May – 15 Jun), reusing the exact same dates and approach
    ///   the previous revision of this importer used for its own "Cierre de temporada" block —
    ///   the source's own text for this section is unchanged. Its Mesociclo/Microciclo have no
    ///   doc-given zone (the block is "repaso global, libre") and keep GameZoneId /
    ///   GameZoneIdSesionA/B = Iniciación (1) as an arbitrary placeholder.
    /// - ObjetivoSesionA/ObjetivoSesionB prose stays close to the source's own wording (each
    ///   subprincipio's number, title and zone, plus any "(repaso)"/"(continúa)"/"(repaso
    ///   conceptual)" qualifier verbatim) rather than inventing extra coaching detail beyond
    ///   what the document states, to avoid fabricating content not in the plan.
    /// - Macrociclo/Mesociclo StartDate/EndDate are derived from their constituent Microciclos'
    ///   actual weekly date ranges (not the document's rounded top-level "calendario general"
    ///   table), consistent with how the previous revision of this importer computed its own
    ///   dates. Macrociclo 3's EndDate is kept at the document's stated hito boundary (17 May)
    ///   even though only Microciclos 17–30 (through 14 Apr) are concretely modelled within it —
    ///   see the Microciclos-31+ note above.
    /// - SubprincipioLinks/SubSubPrincipioLinks are left empty for every Microciclo: resolving
    ///   real GameModel Subprincipio/SubSubPrincipio ids from this standalone transcription isn't
    ///   feasible here. A future pass should link them once the corresponding GameModel ids are
    ///   available.
    /// </summary>
    public class SeasonPlanImporter
    {
        private readonly AppDbContext _db;
        public SeasonPlanImporter(AppDbContext db) => _db = db;

        private const int ZonaIniciacion = 1;
        private const int ZonaCreacionPropia = 2;
        private const int ZonaCreacionRival = 3;
        private const int ZonaFinalizacion = 4;

        public async Task<string> ImportAsync(string teamId, string seasonId, CancellationToken ct = default)
        {
            var plan = await _db.SeasonPlans
                .Include(sp => sp.Macrociclos).ThenInclude(m => m.Mesociclos).ThenInclude(m => m.Microciclos)
                .FirstOrDefaultAsync(sp => sp.TeamId == teamId && sp.SeasonId == seasonId, ct);

            if (plan is null)
            {
                plan = new SeasonPlan(teamId, seasonId);
                _db.SeasonPlans.Add(plan);
            }

            UpsertMacrociclo(plan, 1, "Macrociclo 1 — Pretemporada", new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 12), BuildMacrociclo1Mesociclos());
            UpsertMacrociclo(plan, 2, "Macrociclo 2 — Iniciación", new DateOnly(2026, 10, 12), new DateOnly(2026, 12, 20), BuildMacrociclo2Mesociclos());
            UpsertMacrociclo(plan, 3, "Macrociclo 3 — Perfeccionamiento", new DateOnly(2027, 1, 7), new DateOnly(2027, 5, 17), BuildMacrociclo3Mesociclos());
            UpsertMacrociclo(plan, 4, "Cierre de temporada", new DateOnly(2027, 5, 19), new DateOnly(2027, 6, 15), BuildCierreMesociclos());

            await _db.SaveChangesAsync(ct);
            return plan.Id;
        }

        // ── Macrociclo 1 — Pretemporada (1 sept – 11 oct) ─────────────────────────────

        private static List<MesocicloData> BuildMacrociclo1Mesociclos()
        {
            var mesociclo1 = new List<MicrocicloData>
            {
                new(1, "Semana 1 — generación 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7),
                    "Defensa organizada 1.1 (Evitar que el rival supere nuestra 1ª línea de presión) + Transición defensa-ataque 1.1 (Elegir el modo de salida según la zona de recuperación), zona Creación Propia.",
                    "Ataque organizado 1.1 (Desorganizar al rival antes de atacar) + Transición ataque-defensa 1.1 (Reaccionar según la zona donde se pierde el balón), zona Creación Propia.",
                    ZonaCreacionPropia, ZonaCreacionPropia),
                new(2, "Semana 2 — generación 1", new DateOnly(2026, 9, 8), new DateOnly(2026, 9, 14),
                    "Defensa organizada 1.1 (continúa) + Transición defensa-ataque 1.1, zona Iniciación.",
                    "Ataque organizado 1.1 + Transición ataque-defensa 1.1, zona Iniciación.",
                    ZonaIniciacion, ZonaIniciacion),
                new(3, "Semana 3 — generación 1", new DateOnly(2026, 9, 15), new DateOnly(2026, 9, 21),
                    "Defensa organizada 1.1 + Transición defensa-ataque 1.1, zona Creación Rival (zona base de la semana).",
                    "Ataque organizado 1.1 + Transición ataque-defensa 1.1, zona Creación Rival (zona base de la semana).",
                    ZonaCreacionRival, ZonaCreacionRival),
                new(4, "Semana 4 — generación 1", new DateOnly(2026, 9, 22), new DateOnly(2026, 9, 28),
                    "Defensa organizada 1.1 + Transición defensa-ataque 1.1, zona Finalización (zona base de la semana).",
                    "Ataque organizado 1.1 + Transición ataque-defensa 1.1, zona Finalización (zona base de la semana).",
                    ZonaFinalizacion, ZonaFinalizacion),
            };
            var mesociclo2 = new List<MicrocicloData>
            {
                new(5, "Semana 5 — generación 2", new DateOnly(2026, 9, 29), new DateOnly(2026, 10, 5),
                    "Defensa organizada 1.2 (Reaccionar de inmediato cuando superan nuestra línea por dentro) + Transición defensa-ataque 2.1 (Ejecutar la verticalidad cuando se roba el balón a un lateral rival), zona Creación Propia.",
                    "Ataque organizado 1.2 (Pasar a la siguiente zona con ventaja de recepción, riesgo asumible) + Transición ataque-defensa 1.2 (Abandonar la presión inmediata y replegar organizado cuando no se recupera a tiempo), zona Creación Rival.",
                    ZonaCreacionPropia, ZonaCreacionRival),
                new(6, "Semana 6 — generación 2", new DateOnly(2026, 10, 6), new DateOnly(2026, 10, 12),
                    "Defensa organizada 1.2 (continúa) + Transición defensa-ataque 2.1, zona Creación Rival.",
                    "Ataque organizado 1.2 (riesgo asumible) + Transición ataque-defensa 1.2, zona Finalización.",
                    ZonaCreacionRival, ZonaFinalizacion),
            };
            return new List<MesocicloData>
            {
                new(1, "Mesociclo 1 — generación 1", mesociclo1[0].StartDate, mesociclo1[^1].EndDate, mesociclo1[0].GameZoneIdSesionA, mesociclo1),
                new(2, "Mesociclo 2 — generación 2", mesociclo2[0].StartDate, mesociclo2[^1].EndDate, mesociclo2[0].GameZoneIdSesionA, mesociclo2),
            };
        }

        // ── Macrociclo 2 — Iniciación (12 oct – 21 dic) ───────────────────────────────

        private static List<MesocicloData> BuildMacrociclo2Mesociclos()
        {
            var mesociclo3 = new List<MicrocicloData>
            {
                new(7, "Semana 7 — generación 3", new DateOnly(2026, 10, 12), new DateOnly(2026, 10, 18),
                    "Defensa organizada 1.3 (Reaccionar de inmediato cuando superan a nuestro extremo — superación por banda) + Transición defensa-ataque 2.2 (Ejecutar la verticalidad cuando se roba el balón a un central rival), zona Creación Rival.",
                    "Ataque organizado 1.3 (Pasar a la siguiente zona conduciendo el balón) + Transición ataque-defensa 1.3 (Diferenciar la reacción según si la pérdida fue un riesgo asumido o un error no forzado), zona Creación Propia.",
                    ZonaCreacionRival, ZonaCreacionPropia),
                new(8, "Semana 8 — generación 3", new DateOnly(2026, 10, 19), new DateOnly(2026, 10, 25),
                    "Defensa organizada 1.3 (variante de zona de Iniciación: roles fijos de marca) + Transición defensa-ataque 2.2 (repaso general, este subprincipio no tiene variante específica en Iniciación), zona Iniciación.",
                    "Ataque organizado 1.3 (continúa) + Transición ataque-defensa 1.3 (continúa), zona Iniciación.",
                    ZonaIniciacion, ZonaIniciacion),
            };
            var mesociclo4 = new List<MicrocicloData>
            {
                new(9, "Semana 9 — generación 4", new DateOnly(2026, 10, 26), new DateOnly(2026, 11, 1),
                    "Defensa organizada 1.4 (Reaccionar cuando superan la línea con un pase largo que salta líneas) + Transición defensa-ataque 2.3 (Ejecutar la verticalidad cuando se roba el balón al último mediocentro rival con compañeros por delante), zona Creación Propia.",
                    "Ataque organizado 1.4 (Pasar a la siguiente zona buscando el tercer hombre) + Transición ataque-defensa 1.4 (Comunicar el instante de la pérdida), zona Creación Propia.",
                    ZonaCreacionPropia, ZonaCreacionPropia),
                new(10, "Semana 10 — generación 4", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8),
                    "Defensa organizada 1.4 (variante Propia/Iniciación, sin arriesgar fuera de juego) + Transición defensa-ataque 2.3 (repaso general), zona Iniciación.",
                    "Ataque organizado 1.4 (continúa) + Transición ataque-defensa 1.4 (continúa), zona Iniciación.",
                    ZonaIniciacion, ZonaIniciacion),
                new(11, "Semana 11 — generación 4", new DateOnly(2026, 11, 9), new DateOnly(2026, 11, 15),
                    "Defensa organizada 1.4 (variante de zona de Creación Rival, arriesgando el fuera de juego) + Transición defensa-ataque 2.3, zona Creación Rival.",
                    "Ataque organizado 1.4 (continúa) + Transición ataque-defensa 1.4 (continúa), zona Creación Rival.",
                    ZonaCreacionRival, ZonaCreacionRival),
            };
            var mesociclo5 = new List<MicrocicloData>
            {
                new(12, "Semana 12 — generación 5", new DateOnly(2026, 11, 16), new DateOnly(2026, 11, 22),
                    "Defensa organizada 1.5 (Defender en inferioridad numérica cuando falla la reorganización del bloque) + Transición defensa-ataque 1.1 (repaso — Elegir el modo de salida según la zona de recuperación), zona Creación Propia.",
                    "Ataque organizado 1.5 (Pasar a la siguiente zona con paredes) + Transición ataque-defensa 1.1 (repaso — Reaccionar según la zona donde se pierde el balón), zona Creación Propia.",
                    ZonaCreacionPropia, ZonaCreacionPropia),
                new(13, "Semana 13 — generación 5", new DateOnly(2026, 11, 23), new DateOnly(2026, 11, 29),
                    "Defensa organizada 1.5 (variante de zona de Iniciación) + Transición defensa-ataque 1.1 (repaso), zona Iniciación.",
                    "Ataque organizado 1.5 (continúa) + Transición ataque-defensa 1.1 (repaso), zona Iniciación.",
                    ZonaIniciacion, ZonaIniciacion),
                new(14, "Semana 14 — generación 5", new DateOnly(2026, 11, 30), new DateOnly(2026, 12, 6),
                    "Defensa organizada 1.5 (variante Rival/Propia, continúa) + Transición defensa-ataque 1.1 (repaso), zona Creación Rival.",
                    "Ataque organizado 1.5 (continúa) + Transición ataque-defensa 1.1 (repaso), zona Creación Rival.",
                    ZonaCreacionRival, ZonaCreacionRival),
                new(15, "Semana 15 — generación 5", new DateOnly(2026, 12, 7), new DateOnly(2026, 12, 13),
                    "Defensa organizada 1.5 (variante de zona de Finalización, repliegue sin marcas) + Transición defensa-ataque 1.1 (repaso), zona Finalización.",
                    "Ataque organizado 1.5 (continúa) + Transición ataque-defensa 1.1 (repaso), zona Finalización.",
                    ZonaFinalizacion, ZonaFinalizacion),
            };
            var mesociclo6Parte1 = new List<MicrocicloData>
            {
                new(16, "Semana 16 — generación 6", new DateOnly(2026, 12, 14), new DateOnly(2026, 12, 20),
                    "Defensa organizada 1.6 (Gestionar la línea de fuera de juego en el día a día) + Transición defensa-ataque 2.1 (repaso — Ejecutar la verticalidad cuando se roba el balón a un lateral rival), zona Creación Propia.",
                    "Ataque organizado 1.6 (Pasar a la siguiente zona con pase largo en diagonal al lado débil) + Transición ataque-defensa 1.2 (repaso — Abandonar la presión inmediata y replegar organizado cuando no se recupera a tiempo; nota del plan: esta zona de Creación Propia no es donde se aplica 1.2, se trabaja de forma general esta semana), zona Creación Propia.",
                    ZonaCreacionPropia, ZonaCreacionPropia),
            };
            return new List<MesocicloData>
            {
                new(1, "Mesociclo 3 — generación 3", mesociclo3[0].StartDate, mesociclo3[^1].EndDate, mesociclo3[0].GameZoneIdSesionA, mesociclo3),
                new(2, "Mesociclo 4 — generación 4", mesociclo4[0].StartDate, mesociclo4[^1].EndDate, mesociclo4[0].GameZoneIdSesionA, mesociclo4),
                new(3, "Mesociclo 5 — generación 5", mesociclo5[0].StartDate, mesociclo5[^1].EndDate, mesociclo5[0].GameZoneIdSesionA, mesociclo5),
                new(4, "Mesociclo 6 (parte 1) — generación 6", mesociclo6Parte1[0].StartDate, mesociclo6Parte1[^1].EndDate, mesociclo6Parte1[0].GameZoneIdSesionA, mesociclo6Parte1),
            };
        }

        // ── Macrociclo 3 — Perfeccionamiento (7 ene – 17 mayo) ────────────────────────

        private static List<MesocicloData> BuildMacrociclo3Mesociclos()
        {
            var mesociclo6Continuacion = new List<MicrocicloData>
            {
                new(1, "Semana 17 — generación 6", new DateOnly(2027, 1, 7), new DateOnly(2027, 1, 13),
                    "Defensa organizada 1.6 (continúa, sigue aplicando en Iniciación) + Transición defensa-ataque 2.1 (repaso; nota del plan: se trabaja en zona Creación Propia, la más cercana a Iniciación disponible para este subprincipio), zona Iniciación.",
                    "Ataque organizado 1.6 (progresión Creación Propia → Creación Rival) + Transición ataque-defensa 1.2 (repaso, aquí sí aplica), zona Creación Rival.",
                    ZonaIniciacion, ZonaCreacionRival),
                new(2, "Semana 18 — generación 6", new DateOnly(2027, 1, 14), new DateOnly(2027, 1, 20),
                    "Defensa organizada 1.6 (repaso conceptual — este subprincipio no aplica en Creación Rival, se revisa la teoría sin variante nueva) + Transición defensa-ataque 2.1 (repaso), zona Creación Rival.",
                    "Ataque organizado 1.6 (caso particular de Finalización, buscando la banda contraria) + Transición ataque-defensa 1.2 (repaso), zona Finalización.",
                    ZonaCreacionRival, ZonaFinalizacion),
            };
            var mesociclo7 = new List<MicrocicloData>
            {
                new(1, "Semana 19 — generación 7", new DateOnly(2027, 1, 21), new DateOnly(2027, 1, 27),
                    "Defensa organizada 2.1 (Robar el balón cuando el rival no controla bien) + Transición defensa-ataque 2.2 (repaso — Ejecutar la verticalidad cuando se roba el balón a un central rival), zona Creación Propia.",
                    "Ataque organizado 1.7 (Llegar rápido a Zona de Finalización cuando la desorganización del rival es severa) + Transición ataque-defensa 1.3 (repaso — Diferenciar riesgo asumido vs. error no forzado), zona Creación Rival.",
                    ZonaCreacionPropia, ZonaCreacionRival),
            };
            var mesociclo8 = new List<MicrocicloData>
            {
                new(1, "Semana 20 — generación 8", new DateOnly(2027, 1, 28), new DateOnly(2027, 2, 3),
                    "Defensa organizada 2.2 (Presionar en bloque cuando el rival juega un pase atrás débil) + Transición defensa-ataque 2.3 (repaso — verticalidad tras robo al último mediocentro), zona Creación Propia.",
                    "Ataque organizado 2.1 (Generar superioridad interior en Zona de Creación Rival) + Transición ataque-defensa 1.4 (repaso — Comunicar el instante de la pérdida), zona Creación Rival.",
                    ZonaCreacionPropia, ZonaCreacionRival),
                new(2, "Semana 21 — generación 8", new DateOnly(2027, 2, 4), new DateOnly(2027, 2, 10),
                    "Defensa organizada 2.2 (continúa, gatillo colectivo — aplica en cualquier zona) + Transición defensa-ataque 2.3 (repaso), zona Creación Rival.",
                    "Ataque organizado 2.1 (continúa) + Transición ataque-defensa 1.4 (continúa), zona Creación Rival.",
                    ZonaCreacionRival, ZonaCreacionRival),
            };
            var mesociclo9 = new List<MicrocicloData>
            {
                new(1, "Semana 22 — generación 9", new DateOnly(2027, 2, 11), new DateOnly(2027, 2, 17),
                    "Defensa organizada 2.3 (repaso conceptual — este subprincipio solo aplica en Rival/Finalización, se introduce la teoría) + Transición defensa-ataque 1.1 (repaso), zona Creación Propia.",
                    "Ataque organizado 2.2 (Trasladar la superioridad a la banda alejada — repaso conceptual, solo aplica en Creación Rival) + Transición ataque-defensa 1.1 (repaso), zona Creación Propia.",
                    ZonaCreacionPropia, ZonaCreacionPropia),
                new(2, "Semana 23 — generación 9", new DateOnly(2027, 2, 18), new DateOnly(2027, 2, 24),
                    "Defensa organizada 2.3 (repaso conceptual) + Transición defensa-ataque 1.1 (repaso), zona Iniciación.",
                    "Ataque organizado 2.2 (repaso conceptual) + Transición ataque-defensa 1.1 (repaso), zona Iniciación.",
                    ZonaIniciacion, ZonaIniciacion),
                new(3, "Semana 24 — generación 9", new DateOnly(2027, 2, 25), new DateOnly(2027, 3, 3),
                    "Defensa organizada 2.3 (Interceptar el pase, aceptando el riesgo de abrir el carril central — zona real de aplicación) + Transición defensa-ataque 1.1 (repaso), zona Creación Rival.",
                    "Ataque organizado 2.2 (zona real de aplicación) + Transición ataque-defensa 1.1 (repaso), zona Creación Rival.",
                    ZonaCreacionRival, ZonaCreacionRival),
                new(4, "Semana 25 — generación 9", new DateOnly(2027, 3, 4), new DateOnly(2027, 3, 10),
                    "Defensa organizada 2.3 (zona real de aplicación) + Transición defensa-ataque 1.1 (repaso), zona Finalización.",
                    "Ataque organizado 2.3 (Resolver en Zona de Finalización) + Transición ataque-defensa 1.1 (repaso), zona Finalización.",
                    ZonaFinalizacion, ZonaFinalizacion),
            };
            var mesociclo10 = new List<MicrocicloData>
            {
                new(1, "Semana 26 — generación 10", new DateOnly(2027, 3, 11), new DateOnly(2027, 3, 17),
                    "Defensa organizada 2.4 (Aprovechar la superioridad numérica cerca del balón) + Transición defensa-ataque 2.1 (repaso — verticalidad tras robo a lateral), zona Creación Propia.",
                    "Ataque organizado 2.3 (continúa) + Transición ataque-defensa 1.2 (repaso), zona Finalización.",
                    ZonaCreacionPropia, ZonaFinalizacion),
                new(2, "Semana 27 — generación 10", new DateOnly(2027, 3, 18), new DateOnly(2027, 3, 24),
                    "Defensa organizada 2.4 (continúa) + Transición defensa-ataque 2.1 (repaso), zona Creación Rival.",
                    "Ataque organizado 2.3 (repaso, refuerzo) + Transición ataque-defensa 1.2 (repaso), zona Finalización.",
                    ZonaCreacionRival, ZonaFinalizacion),
            };
            var mesociclo11 = new List<MicrocicloData>
            {
                new(1, "Semana 28 — generación 11", new DateOnly(2027, 3, 25), new DateOnly(2027, 3, 31),
                    "Defensa organizada 2.5 (Disputar el balón dividido) + Transición defensa-ataque 2.2 (repaso — verticalidad tras robo a central), zona Creación Propia.",
                    "Ataque organizado 1.1 (repaso — Desorganizar al rival antes de atacar) + Transición ataque-defensa 1.3 (repaso — riesgo asumido vs. error no forzado), zona Creación Rival.",
                    ZonaCreacionPropia, ZonaCreacionRival),
            };
            var mesociclo12 = new List<MicrocicloData>
            {
                new(1, "Semana 29 — generación 12", new DateOnly(2027, 4, 1), new DateOnly(2027, 4, 7),
                    "Defensa organizada 2.6 (Robar el balón cuando el rival se queda sin opciones de pase) + Transición defensa-ataque 2.3 (repaso — verticalidad tras robo al último mediocentro), zona Creación Propia.",
                    "Ataque organizado 1.2 (repaso — Pasar a la siguiente zona con ventaja de recepción, bloque de riesgo bajo) + Transición ataque-defensa 1.4 (repaso — Comunicar el instante de la pérdida), zona Creación Propia.",
                    ZonaCreacionPropia, ZonaCreacionPropia),
                new(2, "Semana 30 — generación 12", new DateOnly(2027, 4, 8), new DateOnly(2027, 4, 14),
                    "Defensa organizada 2.6 (continúa, aplica en cualquier zona) + Transición defensa-ataque 2.3 (repaso), zona Creación Rival.",
                    "Ataque organizado 1.2 (repaso, bloque de riesgo asumible) + Transición ataque-defensa 1.4 (continúa), zona Creación Rival.",
                    ZonaCreacionRival, ZonaCreacionRival),
                // Fin de la primera vuelta completa del temario (30 subprincipios). A partir de
                // aquí ("Segunda vuelta — nivel alto", 15 abr en adelante) el plan solo describe
                // el criterio (repetir el mismo recorrido con más exigencia), no semanas
                // concretas — Microciclos 31+ quedan deliberadamente sin transcribir hasta que
                // exista esa cadencia concreta. Ver el doc-comment de la clase.
            };
            return new List<MesocicloData>
            {
                new(1, "Mesociclo 6 (continuación) — generación 6", mesociclo6Continuacion[0].StartDate, mesociclo6Continuacion[^1].EndDate, mesociclo6Continuacion[0].GameZoneIdSesionA, mesociclo6Continuacion),
                new(2, "Mesociclo 7 — generación 7", mesociclo7[0].StartDate, mesociclo7[^1].EndDate, mesociclo7[0].GameZoneIdSesionA, mesociclo7),
                new(3, "Mesociclo 8 — generación 8", mesociclo8[0].StartDate, mesociclo8[^1].EndDate, mesociclo8[0].GameZoneIdSesionA, mesociclo8),
                new(4, "Mesociclo 9 — generación 9", mesociclo9[0].StartDate, mesociclo9[^1].EndDate, mesociclo9[0].GameZoneIdSesionA, mesociclo9),
                new(5, "Mesociclo 10 — generación 10", mesociclo10[0].StartDate, mesociclo10[^1].EndDate, mesociclo10[0].GameZoneIdSesionA, mesociclo10),
                new(6, "Mesociclo 11 — generación 11", mesociclo11[0].StartDate, mesociclo11[^1].EndDate, mesociclo11[0].GameZoneIdSesionA, mesociclo11),
                new(7, "Mesociclo 12 — generación 12", mesociclo12[0].StartDate, mesociclo12[^1].EndDate, mesociclo12[0].GameZoneIdSesionA, mesociclo12),
            };
        }

        // ── Cierre de temporada ───────────────────────────────────────────────────────

        private static List<MesocicloData> BuildCierreMesociclos() => new()
        {
            new MesocicloData(1, "Cierre de temporada", new DateOnly(2027, 5, 19), new DateOnly(2027, 6, 15), ZonaIniciacion, new()
            {
                new MicrocicloData(1, "Cierre de temporada — Repaso global", new DateOnly(2027, 5, 19), new DateOnly(2027, 6, 15),
                    "Las últimas semanas de mayo y junio, ya sin competición oficial, sirven de repaso global y evaluación de la temporada: qué parte del modelo está ya interiorizada y qué queda pendiente de cara al año siguiente.",
                    "Las últimas semanas de mayo y junio, ya sin competición oficial, sirven de repaso global y evaluación de la temporada: qué parte del modelo está ya interiorizada y qué queda pendiente de cara al año siguiente.",
                    ZonaIniciacion, ZonaIniciacion),
            }),
        };

        // ── Upsert helpers (match by Order within parent — the only deterministic key) ──

        private static void UpsertMacrociclo(SeasonPlan plan, int order, string name, DateOnly start, DateOnly end, List<MesocicloData> mesociclos)
        {
            var macrociclo = plan.Macrociclos.FirstOrDefault(m => m.Order == order);
            if (macrociclo is null)
            {
                macrociclo = new Macrociclo(plan.Id, order, name, start, end);
                plan.Macrociclos.Add(macrociclo);
            }
            else
            {
                macrociclo.UpdateName(name);
                macrociclo.Reschedule(start, end);
            }

            foreach (var mesData in mesociclos)
                UpsertMesociclo(macrociclo, mesData);
        }

        private static void UpsertMesociclo(Macrociclo macrociclo, MesocicloData data)
        {
            var mesociclo = macrociclo.Mesociclos.FirstOrDefault(m => m.Order == data.Order);
            if (mesociclo is null)
            {
                mesociclo = new Mesociclo(macrociclo.Id, data.Order, data.Name, data.StartDate, data.EndDate, data.GameZoneId);
                macrociclo.Mesociclos.Add(mesociclo);
            }
            else
            {
                mesociclo.UpdateName(data.Name);
                mesociclo.Reschedule(data.StartDate, data.EndDate);
                mesociclo.UpdateGameZoneId(data.GameZoneId);
            }

            foreach (var micData in data.Microciclos)
                UpsertMicrociclo(mesociclo, micData);
        }

        private static void UpsertMicrociclo(Mesociclo mesociclo, MicrocicloData data)
        {
            var microciclo = mesociclo.Microciclos.FirstOrDefault(m => m.Order == data.Order);
            if (microciclo is null)
            {
                microciclo = new Microciclo(
                    mesociclo.Id, data.Order, data.WeekLabel, data.StartDate, data.EndDate, data.ObjetivoSesionA, data.ObjetivoSesionB);
                microciclo.UpdateZones(data.GameZoneIdSesionA, data.GameZoneIdSesionB);
                mesociclo.Microciclos.Add(microciclo);
            }
            else
            {
                microciclo.UpdateWeekLabel(data.WeekLabel);
                microciclo.Reschedule(data.StartDate, data.EndDate);
                microciclo.UpdateObjectives(data.ObjetivoSesionA, data.ObjetivoSesionB);
                microciclo.UpdateZones(data.GameZoneIdSesionA, data.GameZoneIdSesionB);
            }
        }

        private record MesocicloData(int Order, string Name, DateOnly StartDate, DateOnly EndDate, int GameZoneId, List<MicrocicloData> Microciclos);

        private record MicrocicloData(int Order, string WeekLabel, DateOnly StartDate, DateOnly EndDate, string ObjetivoSesionA, string ObjetivoSesionB, int GameZoneIdSesionA, int GameZoneIdSesionB);
    }
}
