using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Infrastructure.Services
{
    /// <summary>
    /// Rerunnable importer that upserts the real "Plan de Temporada" (Cadete, 2ª División)
    /// content — transcribed from <c>docs/game-model/Plan-de-Temporada.docx</c> — into a
    /// team's <see cref="SeasonPlan"/>. Mirrors <c>GameModelSeeder</c>'s shape: NOT invoked
    /// automatically from any EF migration or app startup path (seeding a specific team/season
    /// is an operator decision, not schema setup — the
    /// <c>20260811124354_ReplaceGameModelAdnHierarchy</c> migration this change's design.md
    /// points to as precedent does pure schema DDL only and never calls C# seed logic from
    /// within a migration; the actual seed invocation for GameModel happens via the standalone
    /// <c>GameModelSeeder.SeedAsync</c>, called manually). Invoke <see cref="ImportAsync"/> once
    /// for the target team/season (e.g. from a one-off admin endpoint, a migrations runbook
    /// step, or a test/tool) and safely re-invoke whenever the hardcoded data below changes,
    /// since every node is upserted by its position (<c>Order</c>) within its parent — the only
    /// deterministic key available (SeasonPlan nodes have no natural business key like
    /// GameModel's <c>Key</c>).
    ///
    /// GameZoneId values match the fixed GameZone catalog (see
    /// <c>GameZoneConfiguration.Configure</c>): 1 = Iniciación, 2 = Creación en Campo Propio,
    /// 3 = Creación en Campo Rival, 4 = Finalización.
    ///
    /// Assumptions made while transcribing (documented, not silent):
    /// - Weeks inside each 3-week Macrociclo-1 Mesociclo split the given date range into three
    ///   consecutive 7-day blocks (the source gives only the Mesociclo-level range).
    /// - Macrociclo 2's Mesociclos (6 weeks each) are laid out as four consecutive 6-week blocks
    ///   starting the day after Macrociclo 1 ends (24 Nov); the source only gives the overall
    ///   Macrociclo 2 range ("24 nov – ~17 may, ~25 sem", "parón navideño incluido") without
    ///   per-Mesociclo boundaries, so no explicit gap is carved out for the Christmas break.
    /// - "Cierre de temporada" is modelled as a trailing Macrociclo #3 with a single
    ///   Mesociclo/Microciclo pair (19 May – 15 Jun; the source's "15/20 jun" is a range, the
    ///   earlier bound was picked), per design.md's guidance to represent the whole document.
    ///   Its Mesociclo has no doc-given zone (the closing block is "repaso global, libre") — it
    ///   is assigned GameZoneId 1 (Iniciación) as an arbitrary placeholder to satisfy the
    ///   required FK; this does not carry any zone-specific meaning.
    /// - Weeks in Macrociclo 1 that state a single combined "Objetivo:" sentence (Situacional,
    ///   Global) and weeks in Macrociclo 2 that only cover one session pairing (a given week is
    ///   either the defensive pairing OR the offensive pairing, never both, unlike Macrociclo 1)
    ///   have that one text duplicated verbatim into both ObjetivoSesionA and ObjetivoSesionB,
    ///   per design.md/implement.md's explicit instruction not to invent a split that isn't in
    ///   the source.
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

            UpsertMacrociclo(plan, 1, "Macrociclo 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 11, 23), BuildMacrociclo1Mesociclos());
            UpsertMacrociclo(plan, 2, "Macrociclo 2", new DateOnly(2026, 11, 24), new DateOnly(2027, 5, 10), BuildMacrociclo2Mesociclos());
            UpsertMacrociclo(plan, 3, "Cierre de temporada", new DateOnly(2027, 5, 19), new DateOnly(2027, 6, 15), BuildCierreMesociclos());

            await _db.SaveChangesAsync(ct);
            return plan.Id;
        }

        // ── Macrociclo 1 — capa base (subprincipios 1.1 de las cuatro fases) ─────────

        private static List<MesocicloData> BuildMacrociclo1Mesociclos() => new()
        {
            new MesocicloData(1, "Mesociclo 1.1 — Creación Propia", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), ZonaCreacionPropia, new()
            {
                new MicrocicloData(1, "Semana 1 — Analítico", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7),
                    "Defensa organizada 1.1 + Transición defensa-ataque 1.1: evitar que el rival progrese con orden en esta zona; al robar, mantener el balón sin transición rápida ni pase largo.",
                    "Ataque organizado 1.1 + Transición ataque-defensa 1.1: empezar a desorganizar al rival por dentro; si se pierde el balón, repliegue rápido a bloque medio con basculación, sin arriesgar falta."),
                new MicrocicloData(2, "Semana 2 — Situacional", new DateOnly(2026, 9, 8), new DateOnly(2026, 9, 14),
                    "Objetivo: conectar ambas parejas de fases con oposición reducida y variabilidad.",
                    "Objetivo: conectar ambas parejas de fases con oposición reducida y variabilidad."),
                new MicrocicloData(3, "Semana 3 — Global", new DateOnly(2026, 9, 15), new DateOnly(2026, 9, 21),
                    "Objetivo: las cuatro fases encadenadas en juego condicionado a esta zona, evaluado con checklist de comportamientos observables.",
                    "Objetivo: las cuatro fases encadenadas en juego condicionado a esta zona, evaluado con checklist de comportamientos observables."),
            }),
            new MesocicloData(2, "Mesociclo 1.2 — Creación Rival", new DateOnly(2026, 9, 22), new DateOnly(2026, 10, 12), ZonaCreacionRival, new()
            {
                new MicrocicloData(1, "Semana 1 — Analítico", new DateOnly(2026, 9, 22), new DateOnly(2026, 9, 28),
                    "Defensa organizada 1.1 + Transición defensa-ataque 1.1: mantener la presión intensa propia de esta zona alta, evitando que el rival progrese con facilidad; al robar aquí, mantener posesión e iniciar jugada, salvo que el robo sea a un jugador de la línea defensiva rival, entonces verticalidad inmediata.",
                    "Ataque organizado 1.1 + Transición ataque-defensa 1.1: desorganizar al rival por dentro con pivotes, mediapunta y extremo cercano (zona por defecto del subprincipio); si se pierde el balón, presión inmediata de los 4 jugadores más cercanos y resto en contención, vigilando el repliegue a carriles centrales si el rival tiene salida en largo."),
                new MicrocicloData(2, "Semana 2 — Situacional", new DateOnly(2026, 9, 29), new DateOnly(2026, 10, 5),
                    "Objetivo: con oposición, leer si el robo viene de un central rival (verticalidad) o no (paciencia); practicar la falta táctica de forma controlada para frenar un contragolpe.",
                    "Objetivo: con oposición, leer si el robo viene de un central rival (verticalidad) o no (paciencia); practicar la falta táctica de forma controlada para frenar un contragolpe."),
                new MicrocicloData(3, "Semana 3 — Global", new DateOnly(2026, 10, 6), new DateOnly(2026, 10, 12),
                    "Objetivo: las cuatro fases encadenadas en esta zona, evaluando especialmente esa decisión clave (verticalidad vs. paciencia).",
                    "Objetivo: las cuatro fases encadenadas en esta zona, evaluando especialmente esa decisión clave (verticalidad vs. paciencia)."),
            }),
            new MesocicloData(3, "Mesociclo 1.3 — Iniciación", new DateOnly(2026, 10, 13), new DateOnly(2026, 11, 2), ZonaIniciacion, new()
            {
                new MicrocicloData(1, "Semana 1 — Analítico", new DateOnly(2026, 10, 13), new DateOnly(2026, 10, 19),
                    "Defensa organizada 1.1 + Transición defensa-ataque 1.1: máxima prudencia, cerrar espacios sin arriesgar, tan cerca de nuestra portería; al robar aquí, balón largo priorizando la banda más cercana al robo, asumiendo que probablemente se pierda de nuevo, pero evitando el riesgo de jugar corto con poco espacio.",
                    "Ataque organizado 1.1 (condicional) + Transición ataque-defensa 1.1: en esta zona el subprincipio de desorganizar solo aplica si el rival no presiona alto — el objetivo es que reconozcan cuándo se da esa condición y cuándo no; si se pierde el balón, cierre de carriles centrales, presión sin falta del jugador cercano, resto ayuda y recupera marcas."),
                new MicrocicloData(2, "Semana 2 — Situacional", new DateOnly(2026, 10, 20), new DateOnly(2026, 10, 26),
                    "Objetivo: variar la presión del rival para que decidan en tiempo real entre salida directa o intento de mantener; practicar el repliegue sin falta cerca del área propia.",
                    "Objetivo: variar la presión del rival para que decidan en tiempo real entre salida directa o intento de mantener; practicar el repliegue sin falta cerca del área propia."),
                new MicrocicloData(3, "Semana 3 — Global", new DateOnly(2026, 10, 27), new DateOnly(2026, 11, 2),
                    "Objetivo: juego condicionado en esta zona, priorizando en la evaluación la seguridad de la decisión por encima de la brillantez.",
                    "Objetivo: juego condicionado en esta zona, priorizando en la evaluación la seguridad de la decisión por encima de la brillantez."),
            }),
            new MesocicloData(4, "Mesociclo 1.4 — Finalización", new DateOnly(2026, 11, 3), new DateOnly(2026, 11, 23), ZonaFinalizacion, new()
            {
                new MicrocicloData(1, "Semana 1 — Analítico", new DateOnly(2026, 11, 3), new DateOnly(2026, 11, 9),
                    "Defensa organizada 1.1 + Transición defensa-ataque 1.1: máxima exigencia de presión, tan cerca del área rival; al robar aquí, mantener posesión e iniciar jugada si el rival está ordenado, buscar verticalidad inmediata si está desorganizado y tenemos 3 o más efectivos cerca del área.",
                    "Ataque organizado 1.1 (condicional) + Transición ataque-defensa 1.1: en esta zona el subprincipio solo aplica si llegamos por banda o el rival está replegado — reconocer cuándo conviene mantener el balón para desorganizar en vez de resolver directo; si se pierde el balón aquí, presión máxima de todo el equipo de inmediato."),
                new MicrocicloData(2, "Semana 2 — Situacional", new DateOnly(2026, 11, 10), new DateOnly(2026, 11, 16),
                    "Objetivo: con oposición, distinguir rival ordenado vs. desorganizado al robar; practicar la presión máxima tras pérdida sin descompensar al equipo.",
                    "Objetivo: con oposición, distinguir rival ordenado vs. desorganizado al robar; practicar la presión máxima tras pérdida sin descompensar al equipo."),
                new MicrocicloData(3, "Semana 3 — Global", new DateOnly(2026, 11, 17), new DateOnly(2026, 11, 23),
                    "Objetivo: juego condicionado en esta zona, evaluando sobre todo las decisiones de riesgo (aquí es donde más conviene arriesgar) y la contundencia en la presión tras pérdida.",
                    "Objetivo: juego condicionado en esta zona, evaluando sobre todo las decisiones de riesgo (aquí es donde más conviene arriesgar) y la contundencia en la presión tras pérdida."),
            }),
        };

        // ── Macrociclo 2 — segunda capa de subprincipios ─────────────────────────────

        private static List<MesocicloData> BuildMacrociclo2Mesociclos() => new()
        {
            new MesocicloData(1, "Mesociclo 2.1 — Creación Propia", new DateOnly(2026, 11, 24), new DateOnly(2027, 1, 4), ZonaCreacionPropia, new()
            {
                new MicrocicloData(1, "Semana 1 — Analítico A", new DateOnly(2026, 11, 24), new DateOnly(2026, 11, 30),
                    "Defensa organizada 1.2 + Transición defensa-ataque 2.1/2.2 en esta zona: reacción inmediata si superan la línea por dentro (el mediocentro cercano presiona, el central cubre, el resto compacta); ejecutar la verticalidad cuando el robo es a un lateral o a un central rival — conducción a máxima velocidad, protección de balón, apoyos coordinados.",
                    "Defensa organizada 1.2 + Transición defensa-ataque 2.1/2.2 en esta zona: reacción inmediata si superan la línea por dentro (el mediocentro cercano presiona, el central cubre, el resto compacta); ejecutar la verticalidad cuando el robo es a un lateral o a un central rival — conducción a máxima velocidad, protección de balón, apoyos coordinados."),
                new MicrocicloData(2, "Semana 2 — Analítico B", new DateOnly(2026, 12, 1), new DateOnly(2026, 12, 7),
                    "Ataque organizado 1.4 y 1.5 en esta zona + Transición ataque-defensa 1.2/1.3/1.4: tercer hombre y paredes para progresar de zona; abandonar la presión y replegar con el central de cobertura como voz de referencia; diferenciar la reacción según si la pérdida fue un riesgo asumido o un error no forzado; avisar en voz alta el instante de la pérdida.",
                    "Ataque organizado 1.4 y 1.5 en esta zona + Transición ataque-defensa 1.2/1.3/1.4: tercer hombre y paredes para progresar de zona; abandonar la presión y replegar con el central de cobertura como voz de referencia; diferenciar la reacción según si la pérdida fue un riesgo asumido o un error no forzado; avisar en voz alta el instante de la pérdida."),
                new MicrocicloData(3, "Semana 3 — Situacional A", new DateOnly(2026, 12, 8), new DateOnly(2026, 12, 14),
                    "Objetivo: con oposición reducida, exigir que la reacción a la superación de línea y la ejecución de la verticalidad (robo a lateral o central) salgan bajo presión, no solo en analítico.",
                    "Objetivo: con oposición reducida, exigir que la reacción a la superación de línea y la ejecución de la verticalidad (robo a lateral o central) salgan bajo presión, no solo en analítico."),
                new MicrocicloData(4, "Semana 4 — Situacional B", new DateOnly(2026, 12, 15), new DateOnly(2026, 12, 21),
                    "Objetivo: con oposición, exigir que el tercer hombre y las paredes se completen bajo presión, y practicar el aviso de repliegue del central de cobertura en situaciones reales de pérdida.",
                    "Objetivo: con oposición, exigir que el tercer hombre y las paredes se completen bajo presión, y practicar el aviso de repliegue del central de cobertura en situaciones reales de pérdida."),
                new MicrocicloData(5, "Semana 5 — Global (primera exposición)", new DateOnly(2026, 12, 22), new DateOnly(2026, 12, 28),
                    "Objetivo: las cuatro fases encadenadas en esta zona, en juego condicionado, con exigencia moderada — primera vez que se conecta todo el contenido del mesociclo.",
                    "Objetivo: las cuatro fases encadenadas en esta zona, en juego condicionado, con exigencia moderada — primera vez que se conecta todo el contenido del mesociclo."),
                new MicrocicloData(6, "Semana 6 — Global (evaluación)", new DateOnly(2026, 12, 29), new DateOnly(2027, 1, 4),
                    "Objetivo: mismo ejercicio con mayor exigencia y ritmo de partido, evaluado con checklist de comportamientos observables, cerrando el mesociclo.",
                    "Objetivo: mismo ejercicio con mayor exigencia y ritmo de partido, evaluado con checklist de comportamientos observables, cerrando el mesociclo."),
            }),
            new MesocicloData(2, "Mesociclo 2.2 — Creación Rival", new DateOnly(2027, 1, 5), new DateOnly(2027, 2, 15), ZonaCreacionRival, new()
            {
                new MicrocicloData(1, "Semana 1 — Analítico A", new DateOnly(2027, 1, 5), new DateOnly(2027, 1, 11),
                    "Defensa organizada 1.3 + 2.3 + Transición defensa-ataque 2.1/2.2/2.3 en esta zona: reacción cuando superan a nuestro extremo por banda (rotación corta del costado); interceptar el pase asumiendo el riesgo de abrir el carril central, con cobertura; verticalidad tras robo a lateral, central o al último mediocentro.",
                    "Defensa organizada 1.3 + 2.3 + Transición defensa-ataque 2.1/2.2/2.3 en esta zona: reacción cuando superan a nuestro extremo por banda (rotación corta del costado); interceptar el pase asumiendo el riesgo de abrir el carril central, con cobertura; verticalidad tras robo a lateral, central o al último mediocentro."),
                new MicrocicloData(2, "Semana 2 — Analítico B", new DateOnly(2027, 1, 12), new DateOnly(2027, 1, 18),
                    "Ataque organizado 1.4, 1.7 y Principio 2 (2.1/2.2) + Transición ataque-defensa 1.2/1.3/1.4: tercer hombre; llegar directo a Finalización si la desorganización rival es severa; generar superioridad interior con pivotes/mediapunta/extremo cercano y trasladarla a la banda alejada — la pieza que prepara la llegada de segunda línea del siguiente mesociclo; los tres subprincipios nuevos de reacción a la pérdida, con el gatillo de presión de los 4 más cercanos.",
                    "Ataque organizado 1.4, 1.7 y Principio 2 (2.1/2.2) + Transición ataque-defensa 1.2/1.3/1.4: tercer hombre; llegar directo a Finalización si la desorganización rival es severa; generar superioridad interior con pivotes/mediapunta/extremo cercano y trasladarla a la banda alejada — la pieza que prepara la llegada de segunda línea del siguiente mesociclo; los tres subprincipios nuevos de reacción a la pérdida, con el gatillo de presión de los 4 más cercanos."),
                new MicrocicloData(3, "Semana 3 — Situacional A", new DateOnly(2027, 1, 19), new DateOnly(2027, 1, 25),
                    "Objetivo: con oposición, exigir la lectura correcta del gatillo de robo (lateral, central o último mediocentro) y la reacción por banda bajo presión real.",
                    "Objetivo: con oposición, exigir la lectura correcta del gatillo de robo (lateral, central o último mediocentro) y la reacción por banda bajo presión real."),
                new MicrocicloData(4, "Semana 4 — Situacional B", new DateOnly(2027, 1, 26), new DateOnly(2027, 2, 1),
                    "Objetivo: con oposición, exigir una superioridad interior real (no simulada) y practicar el aviso de repliegue del central de cobertura con el gatillo de los 4 más cercanos presionando.",
                    "Objetivo: con oposición, exigir una superioridad interior real (no simulada) y practicar el aviso de repliegue del central de cobertura con el gatillo de los 4 más cercanos presionando."),
                new MicrocicloData(5, "Semana 5 — Global (primera exposición)", new DateOnly(2027, 2, 2), new DateOnly(2027, 2, 8),
                    "Objetivo: las cuatro fases encadenadas en esta zona, en juego condicionado, con exigencia moderada.",
                    "Objetivo: las cuatro fases encadenadas en esta zona, en juego condicionado, con exigencia moderada."),
                new MicrocicloData(6, "Semana 6 — Global (evaluación)", new DateOnly(2027, 2, 9), new DateOnly(2027, 2, 15),
                    "Objetivo: mismo ejercicio con mayor exigencia, evaluado con checklist, cerrando el mesociclo.",
                    "Objetivo: mismo ejercicio con mayor exigencia, evaluado con checklist, cerrando el mesociclo."),
            }),
            new MesocicloData(3, "Mesociclo 2.3 — Iniciación", new DateOnly(2027, 2, 16), new DateOnly(2027, 3, 29), ZonaIniciacion, new()
            {
                new MicrocicloData(1, "Semana 1 — Analítico A", new DateOnly(2027, 2, 16), new DateOnly(2027, 2, 22),
                    "Defensa organizada 1.3 (zona Iniciación) + 1.6: generar 2 contra 1 en banda con roles fijos de mediocentro/lateral/extremo superado; gestión de la línea de fuera de juego en el día a día, subiendo con el pase atrás u horizontal del rival como gatillo.",
                    "Defensa organizada 1.3 (zona Iniciación) + 1.6: generar 2 contra 1 en banda con roles fijos de mediocentro/lateral/extremo superado; gestión de la línea de fuera de juego en el día a día, subiendo con el pase atrás u horizontal del rival como gatillo."),
                new MicrocicloData(2, "Semana 2 — Analítico B", new DateOnly(2027, 2, 23), new DateOnly(2027, 3, 1),
                    "Ataque organizado 1.2 y 1.3 en esta zona + Transición ataque-defensa 1.1 (consolidación): ventaja de recepción y conducción, con el criterio de riesgo bajo propio de esta zona; consolidar el cierre en carriles centrales y la recuperación de marcas — aquí no aplican los Subprincipios 1.2 nuevos, porque en esta zona 1.1 ya pide repliegue por defecto.",
                    "Ataque organizado 1.2 y 1.3 en esta zona + Transición ataque-defensa 1.1 (consolidación): ventaja de recepción y conducción, con el criterio de riesgo bajo propio de esta zona; consolidar el cierre en carriles centrales y la recuperación de marcas — aquí no aplican los Subprincipios 1.2 nuevos, porque en esta zona 1.1 ya pide repliegue por defecto."),
                new MicrocicloData(3, "Semana 3 — Situacional A", new DateOnly(2027, 3, 2), new DateOnly(2027, 3, 8),
                    "Objetivo: variar la presión e intensidad del rival para exigir lectura real del 2 contra 1 y de la subida de línea de fuera de juego.",
                    "Objetivo: variar la presión e intensidad del rival para exigir lectura real del 2 contra 1 y de la subida de línea de fuera de juego."),
                new MicrocicloData(4, "Semana 4 — Situacional B", new DateOnly(2027, 3, 9), new DateOnly(2027, 3, 15),
                    "Objetivo: con oposición, exigir que la decisión de riesgo bajo (pase directo solo si está limpio) se mantenga bajo presión, sin forzar.",
                    "Objetivo: con oposición, exigir que la decisión de riesgo bajo (pase directo solo si está limpio) se mantenga bajo presión, sin forzar."),
                new MicrocicloData(5, "Semana 5 — Global (primera exposición)", new DateOnly(2027, 3, 16), new DateOnly(2027, 3, 22),
                    "Objetivo: partido condicionado en esta zona, conectando las cuatro fases con exigencia moderada.",
                    "Objetivo: partido condicionado en esta zona, conectando las cuatro fases con exigencia moderada."),
                new MicrocicloData(6, "Semana 6 — Global (evaluación)", new DateOnly(2027, 3, 23), new DateOnly(2027, 3, 29),
                    "Objetivo: mismo ejercicio con mayor exigencia, con la seguridad de la decisión como criterio principal de evaluación, igual que en el Macrociclo 1.",
                    "Objetivo: mismo ejercicio con mayor exigencia, con la seguridad de la decisión como criterio principal de evaluación, igual que en el Macrociclo 1."),
            }),
            new MesocicloData(4, "Mesociclo 2.4 — Finalización", new DateOnly(2027, 3, 30), new DateOnly(2027, 5, 10), ZonaFinalizacion, new()
            {
                new MicrocicloData(1, "Semana 1 — Analítico A", new DateOnly(2027, 3, 30), new DateOnly(2027, 4, 5),
                    "Defensa organizada 1.5.1 + 2.3 + ataque del centro (Transición defensa-ataque 2.1.12/2.1.13): repliegue en inferioridad numérica; interceptar asumiendo riesgo; ejecución del centro raso o aéreo con remate al primer o segundo palo.",
                    "Defensa organizada 1.5.1 + 2.3 + ataque del centro (Transición defensa-ataque 2.1.12/2.1.13): repliegue en inferioridad numérica; interceptar asumiendo riesgo; ejecución del centro raso o aéreo con remate al primer o segundo palo."),
                new MicrocicloData(2, "Semana 2 — Analítico B", new DateOnly(2027, 4, 6), new DateOnly(2027, 4, 12),
                    "Ataque organizado 2.3 completo + Transición ataque-defensa 1.2/1.3/1.4: cambio de ritmo al entrar en el área, delantero de espaldas protegiendo balón, paredes hasta línea de fondo, pase atrás al punto de penalti priorizado sobre el centro aéreo, y la llegada de segunda línea (\"llegar, no estar\") como forma prioritaria de definir; los tres subprincipios nuevos con el gatillo de presión máxima inmediata.",
                    "Ataque organizado 2.3 completo + Transición ataque-defensa 1.2/1.3/1.4: cambio de ritmo al entrar en el área, delantero de espaldas protegiendo balón, paredes hasta línea de fondo, pase atrás al punto de penalti priorizado sobre el centro aéreo, y la llegada de segunda línea (\"llegar, no estar\") como forma prioritaria de definir; los tres subprincipios nuevos con el gatillo de presión máxima inmediata."),
                new MicrocicloData(3, "Semana 3 — Situacional A", new DateOnly(2027, 4, 13), new DateOnly(2027, 4, 19),
                    "Objetivo: con oposición, exigir el repliegue correcto en inferioridad y la ejecución limpia del ataque del centro bajo presión real.",
                    "Objetivo: con oposición, exigir el repliegue correcto en inferioridad y la ejecución limpia del ataque del centro bajo presión real."),
                new MicrocicloData(4, "Semana 4 — Situacional B", new DateOnly(2027, 4, 20), new DateOnly(2027, 4, 26),
                    "Objetivo: con oposición real, exigir que la llegada de segunda línea se sincronice de verdad con la jugada, ni antes ni después.",
                    "Objetivo: con oposición real, exigir que la llegada de segunda línea se sincronice de verdad con la jugada, ni antes ni después."),
                new MicrocicloData(5, "Semana 5 — Global (primera exposición)", new DateOnly(2027, 4, 27), new DateOnly(2027, 5, 3),
                    "Objetivo: partido condicionado en esta zona, conectando las cuatro fases con exigencia moderada.",
                    "Objetivo: partido condicionado en esta zona, conectando las cuatro fases con exigencia moderada."),
                new MicrocicloData(6, "Semana 6 — Global (evaluación)", new DateOnly(2027, 5, 4), new DateOnly(2027, 5, 10),
                    "Objetivo: mismo ejercicio con mayor exigencia, evaluando sobre todo si el gol llega por la vía identitaria (pase atrás + segunda línea) y no solo por el centro aéreo de siempre.",
                    "Objetivo: mismo ejercicio con mayor exigencia, evaluando sobre todo si el gol llega por la vía identitaria (pase atrás + segunda línea) y no solo por el centro aéreo de siempre."),
            }),
        };

        // ── Cierre de temporada ───────────────────────────────────────────────────────

        private static List<MesocicloData> BuildCierreMesociclos() => new()
        {
            new MesocicloData(1, "Cierre de temporada", new DateOnly(2027, 5, 19), new DateOnly(2027, 6, 15), ZonaIniciacion, new()
            {
                new MicrocicloData(1, "Cierre de temporada — Repaso global", new DateOnly(2027, 5, 19), new DateOnly(2027, 6, 15),
                    "Las últimas semanas de mayo y junio, ya sin competición oficial, sirven de repaso global y evaluación de la temporada: qué parte del modelo está ya interiorizada y qué queda pendiente de cara al año siguiente.",
                    "Las últimas semanas de mayo y junio, ya sin competición oficial, sirven de repaso global y evaluación de la temporada: qué parte del modelo está ya interiorizada y qué queda pendiente de cara al año siguiente."),
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
                mesociclo.Microciclos.Add(new Microciclo(
                    mesociclo.Id, data.Order, data.WeekLabel, data.StartDate, data.EndDate, data.ObjetivoSesionA, data.ObjetivoSesionB));
            }
            else
            {
                microciclo.UpdateWeekLabel(data.WeekLabel);
                microciclo.Reschedule(data.StartDate, data.EndDate);
                microciclo.UpdateObjectives(data.ObjetivoSesionA, data.ObjetivoSesionB);
            }
        }

        private record MesocicloData(int Order, string Name, DateOnly StartDate, DateOnly EndDate, int GameZoneId, List<MicrocicloData> Microciclos);

        private record MicrocicloData(int Order, string WeekLabel, DateOnly StartDate, DateOnly EndDate, string ObjetivoSesionA, string ObjetivoSesionB);
    }
}
