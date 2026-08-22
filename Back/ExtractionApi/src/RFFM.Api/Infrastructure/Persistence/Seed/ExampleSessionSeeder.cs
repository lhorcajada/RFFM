using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Seed
{
    /// <summary>
    /// Rebuilds the example "Sesión 1 — Defensa organizada 1.1 + Transición defensa-ataque 1.1"
    /// from <c>docs/game-model/Ejemplo-Sesion.md</c>, per the `session-exercise-plan-redesign`
    /// OpenSpec change (design.md §3): one Microciclo (upserted into the team's existing
    /// SeasonPlan), one TrainingSession linked to it, four SessionBlocks, and the five exercises
    /// they contain (with Bloque 2's "Defensa organizada, bloque medio" and "Circuito físico
    /// preseason" wired as a parallel pair).
    ///
    /// Not run automatically on every app startup — same rationale as
    /// <see cref="GameModelSeeder"/>: a one-off operator/tooling action for a specific
    /// team/season, safely re-runnable because every node is upserted by a stable key
    /// (Microciclo/Mesociclo/Macrociclo by <c>Order</c>, the TrainingSession/exercises by
    /// <c>Name</c> within the club/team). Requires the team to already have a <see cref="GameModel"/>
    /// imported (via <see cref="GameModelSeeder"/>) — the exercises' "Relación con el modelo de
    /// juego" resolves Subprincipio/SubSubPrincipio ids from it.
    /// </summary>
    public static class ExampleSessionSeeder
    {
        private const int FaseDefensaOrganizada = 1;
        private const int FaseTransicionDefensaAtaque = 3;

        public static async Task SeedAsync(AppDbContext db, string clubId, string teamId, string seasonId, CancellationToken ct = default)
        {
            var microcicloId = await UpsertMicrocicloAsync(db, teamId, seasonId, ct);

            var rondo = await UpsertExerciseAsync(db, clubId, await BuildRondoConPorteriasAsync(db, teamId, ct), ct);
            var defensaBloqueMedio = await UpsertExerciseAsync(db, clubId, await BuildDefensaBloqueMedioAsync(db, teamId, ct), ct);
            var circuitoFisico = await UpsertExerciseAsync(db, clubId, BuildCircuitoFisico(), ct);
            var transicion = await UpsertExerciseAsync(db, clubId, await BuildTransicionAsync(db, teamId, ct), ct);
            var retoDeToques = await UpsertExerciseAsync(db, clubId, BuildRetoDeToques(), ct);

            await UpsertSessionAsync(db, teamId, microcicloId,
                new List<(string Nombre, string ComoConecta, string? Rotacion, List<(string ExerciseId, int Position)> Exercises)>
                {
                    ("Bloque 1 — Calentamiento",
                        "Primer bloque de la sesión — aísla perfilamiento y anticipación antes de meter oposición real.",
                        null,
                        new List<(string, int)> { (rondo, 1) }),
                    ("Bloque 2 — Ejercicio principal 1",
                        "Mismo terreno ya montado, mismo objetivo de fondo (perfilamiento/anticipación) pero ahora con oposición real y objetivo de bloque colectivo.",
                        "Cada 6 min (3 rotaciones), 5 jugadores pasan de un ejercicio al otro y viceversa, procurando que a lo largo del bloque roten jugadores distintos.",
                        new List<(string, int)> { (defensaBloqueMedio, 1), (circuitoFisico, 2) }),
                    ("Bloque 3 — Ejercicio principal 2 (Transición defensa-ataque)",
                        "Cada punto arranca igual que el bloque anterior — Azul construyendo desde su Zona de Creación (Rival) contra el bloque medio de Rojo — pero aquí esa fase queda integrada como el arranque del propio ejercicio, y el punto no se detiene hasta que el balón sale o hay gol.",
                        null,
                        new List<(string, int)> { (transicion, 1) }),
                    ("Bloque 4 — Vuelta a la calma",
                        "Cierre de la sesión, sin contenido táctico nuevo.",
                        null,
                        new List<(string, int)> { (retoDeToques, 1) }),
                }, ct);
        }

        // ── Microciclo (upsert into the team's SeasonPlan by Order) ────────────────────

        private static async Task<string> UpsertMicrocicloAsync(AppDbContext db, string teamId, string seasonId, CancellationToken ct)
        {
            var plan = await db.SeasonPlans
                .Include(sp => sp.Macrociclos).ThenInclude(m => m.Mesociclos).ThenInclude(m => m.Microciclos)
                .FirstOrDefaultAsync(sp => sp.TeamId == teamId && sp.SeasonId == seasonId, ct);

            if (plan is null)
            {
                plan = new SeasonPlan(teamId, seasonId);
                await db.SeasonPlans.AddAsync(plan, ct);
            }

            var macrociclo = plan.Macrociclos.FirstOrDefault(m => m.Order == 1);
            if (macrociclo is null)
            {
                macrociclo = new Macrociclo(plan.Id, 1, "Macrociclo 1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21));
                plan.Macrociclos.Add(macrociclo);
            }

            var mesociclo = macrociclo.Mesociclos.FirstOrDefault(m => m.Order == 1);
            if (mesociclo is null)
            {
                // GameZoneId 2 = Creación en Campo Propio (see GameZoneConfiguration) — Semana 1
                // trains in Zona de Creación Propia per the example's Objetivo general.
                mesociclo = new Mesociclo(macrociclo.Id, 1, "Mesociclo 1.1", new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 21), gameZoneId: 2);
                macrociclo.Mesociclos.Add(mesociclo);
            }

            var microciclo = mesociclo.Microciclos.FirstOrDefault(m => m.Order == 1);
            if (microciclo is null)
            {
                microciclo = new Microciclo(mesociclo.Id, 1,
                    "Semana 1 — Organizar el bloque medio en Zona de Creación Propia para frenar la progresión rival por dentro",
                    new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 7));
                mesociclo.Microciclos.Add(microciclo);
            }

            await db.SaveChangesAsync(ct);
            return microciclo.Id;
        }

        // ── Session + Blocks (upsert by Name within the team) ──────────────────────────

        private static async Task UpsertSessionAsync(AppDbContext db, string teamId, string microcicloId,
            List<(string Nombre, string ComoConecta, string? Rotacion, List<(string ExerciseId, int Position)> Exercises)> blocks,
            CancellationToken ct)
        {
            const string sessionName = "Sesión 1 — Defensa organizada 1.1 + Transición defensa-ataque 1.1";

            var session = await db.TrainingSessions
                .Include(s => s.Blocks).ThenInclude(b => b.Exercises)
                .FirstOrDefaultAsync(s => s.TeamId == teamId && s.Name == sessionName, ct);

            if (session is null)
            {
                session = new TrainingSession { Name = sessionName, TeamId = teamId, Date = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc) };
                await db.TrainingSessions.AddAsync(session, ct);
            }

            session.MicrocicloId = microcicloId;
            session.StartTime = TimeSpan.FromHours(18);
            session.ObjetivoGeneral =
                "Que el equipo defienda organizado en bloque medio impidiendo la entrada rival por dentro en Zona de " +
                "Iniciación, y que al recuperar el balón lo asegure jugándolo atrás bajo presión inmediata del rival, " +
                "en vez de perderlo con una salida precipitada.";
            session.MapaCampoTexto = "(dibujo de referencia: ejercicio1_mapa_campo.png — dimensiones y espacio de cada bloque quedan marcados en el propio dibujo)";

            db.RemoveRange(session.Blocks.SelectMany(b => b.Exercises));
            db.RemoveRange(session.Blocks);
            session.Blocks.Clear();

            var order = 0;
            foreach (var blockData in blocks)
            {
                order++;
                var block = new SessionBlock(session.Id, order, blockData.Nombre, blockData.ComoConecta, blockData.Rotacion);
                block.ReplaceExercises(blockData.Exercises);
                session.Blocks.Add(block);
            }

            await db.SaveChangesAsync(ct);
        }

        // ── Exercises (upsert by Name within the club) ─────────────────────────────────

        private static async Task<string> UpsertExerciseAsync(AppDbContext db, string clubId, ExerciseData data, CancellationToken ct)
        {
            var exercise = await db.TaskTrainingBases
                .Include(e => e.ModelRelations).ThenInclude(r => r.Items)
                .FirstOrDefaultAsync(e => e.ClubId == clubId && e.Name == data.Name, ct);

            if (exercise is null)
            {
                exercise = new TaskTrainingBase { Name = data.Name, ClubId = clubId };
                await db.TaskTrainingBases.AddAsync(exercise, ct);
            }

            exercise.Tipo = data.Tipo;
            exercise.Objetivo = data.Objetivo;
            exercise.ObjetivoPorRol = data.ObjetivoPorRol;
            exercise.Logistica = data.Logistica;
            exercise.DurationMinutes = data.DurationMinutes;
            exercise.Porteros = data.Porteros;
            exercise.Dibujo = "(pendiente)";
            exercise.Descripcion = data.Descripcion;
            exercise.UpdateNiveles(data.NivelesColumnas, data.Niveles);

            if (exercise.ModelRelations.Count > 0)
                db.RemoveRange(exercise.ModelRelations.SelectMany(r => r.Items));
            db.RemoveRange(exercise.ModelRelations);
            exercise.ReplaceModelRelations(data.ModelRelations);

            await db.SaveChangesAsync(ct);
            return exercise.Id;
        }

        private sealed record ExerciseData(
            string Name, string Tipo, string Objetivo, string? ObjetivoPorRol, string Logistica,
            int? DurationMinutes, string? Porteros, string Descripcion,
            List<string> NivelesColumnas, List<ExerciseLevelRow> Niveles,
            IEnumerable<(string SubprincipioId, bool IsFoco, IEnumerable<string>? Habilidades,
                IEnumerable<(string SubSubPrincipioId, bool IsFoco)> Items)> ModelRelations);

        private static async Task<ExerciseData> BuildRondoConPorteriasAsync(AppDbContext db, string teamId, CancellationToken ct)
        {
            var relations = new List<(string, bool, IEnumerable<string>?, IEnumerable<(string, bool)>)>();
            var subprincipioId = await AdnLookup.ResolveSubprincipioIdAsync(db, teamId, FaseDefensaOrganizada, "1.1", ct);
            if (subprincipioId is not null)
            {
                relations.Add((subprincipioId, false,
                    new List<string> { "Perfilamiento", "Anticipación", "Intercepción" },
                    new List<(string, bool)>()));
            }

            return BuildRondoConPorteriasData(relations);
        }

        private static ExerciseData BuildRondoConPorteriasData(
            IEnumerable<(string SubprincipioId, bool IsFoco, IEnumerable<string>? Habilidades, IEnumerable<(string, bool)> Items)> relations) => new(
            "Rondo con porterías centrales", "Situacional",
            "Que perfilarse antes de recibir y anticiparse a la trayectoria del pase sean decisiones reales, no automáticas — el espacio y las reglas empujan a ello, no la instrucción del entrenador.",
            "Atacantes — decidir entre pase seguro en diagonal (rodeando las porterías) o intento de gol (cruzándolas). Defensores — anticiparse a la trayectoria del pase para interceptar sin descubrir portería.",
            "12 min (3 series de 4 min, cambio de roles atacante/defensor cada serie) · Conos/picas para 4 \"porterías\" de 1-2m agrupadas en el centro de cada cuadro · 20 jugadores (dos grupos de 7 en 4v3, uno de 6 en 4v2 — las 3 réplicas van a la vez, no rotan entre sí) · Comodín por grupo si sobran o faltan jugadores.",
            12, "No participan — en circuito o esperando su bloque de trabajo técnico.",
            "4 porterías de 1-2m agrupadas en el centro del cuadro. Atacantes fuera, uno por lado; defensores dentro. Todos los pases viajan por dentro del cuadrado — la única regla es la trayectoria respecto a las porterías centrales: cruzarlas es intento de gol, rodearlas (hay espacio de sobra) es circulación segura. Gol = pase que atraviesa limpio una portería central (+1 atacantes / -1 defensores); intercepción = +1 defensores. El equipo que pierda cada serie hace 15\" de plancha.",
            new List<string> { "Porterías activas", "Tamaño portería", "Espacio (cuadro)", "Toques" },
            new List<ExerciseLevelRow>
            {
                new(1, new Dictionary<string, string> { ["Porterías activas"] = "defensores + 1", ["Tamaño portería"] = "pequeña (~1m)", ["Espacio (cuadro)"] = "reducido (~8x8)", ["Toques"] = "libres" }),
                new(2, new Dictionary<string, string> { ["Porterías activas"] = "defensores + 1", ["Tamaño portería"] = "media (~1.5m)", ["Espacio (cuadro)"] = "reducido-medio (~10x10)", ["Toques"] = "libres" }),
                new(3, new Dictionary<string, string> { ["Porterías activas"] = "defensores + 2", ["Tamaño portería"] = "media (~1.5m)", ["Espacio (cuadro)"] = "medio (~12x12)", ["Toques"] = "libres" }),
                new(4, new Dictionary<string, string> { ["Porterías activas"] = "defensores + 2", ["Tamaño portería"] = "grande (~2m)", ["Espacio (cuadro)"] = "amplio (~14x14)", ["Toques"] = "2 toques" }),
                new(5, new Dictionary<string, string> { ["Porterías activas"] = "defensores + 2", ["Tamaño portería"] = "grande (~2m)", ["Espacio (cuadro)"] = "amplio (~16x16)", ["Toques"] = "1 toque" }),
            },
            relations);

        private static async Task<ExerciseData> BuildDefensaBloqueMedioAsync(AppDbContext db, string teamId, CancellationToken ct)
        {
            var relations = new List<(string, bool, IEnumerable<string>?, IEnumerable<(string, bool)>)>();
            var subprincipioId = await AdnLookup.ResolveSubprincipioIdAsync(db, teamId, FaseDefensaOrganizada, "1.1", ct);
            if (subprincipioId is not null)
            {
                var items = new List<(string, bool)>();
                foreach (var (numero, isFoco) in new (string, bool)[]
                         {
                             ("1.1.20", true), ("1.1.21", false), ("1.1.22", false), ("1.1.23", true), ("1.1.24", false),
                         })
                {
                    var itemId = await ResolveSubSubPrincipioIdAsync(db, subprincipioId, numero, ct);
                    if (itemId is not null)
                        items.Add((itemId, isFoco));
                }

                relations.Add((subprincipioId, true,
                    new List<string> { "Perfilamiento", "Anticipación", "Temporización" }, items));
            }

            return new ExerciseData(
                "Defensa organizada, bloque medio", "Situacional",
                "Que el bloque medio propio (Rojo) impida la progresión central del rival (Azul) hacia Zona de Iniciación, empujando el juego hacia banda sin que eso resuelva nada a favor del rival.",
                "Azul — progresar por dentro con pase a la espalda (sin fuera de juego) o conducción por carril central. Rojo — mantener las dos líneas organizadas y basculando para cerrar el interior.",
                "18 min, compartido con el circuito físico de este mismo bloque, con el montaje fijo de la sesión sin ajuste · 15 jugadores (7 Azul + 8 Rojo) · Cambio de roles Azul/Rojo a mitad del bloque (min 9) · Comodín en línea de medios (Rojo) o interiores (Azul) si faltan jugadores.",
                18, "No participan en este ejercicio.",
                "Azul ataca desde Zona de Creación Rival intentando progresar hacia Zona de Iniciación. Rojo defiende en bloque medio con línea defensiva (4) pegada a Zona de Iniciación y línea de medios (4) unos 12m por delante, dentro de Zona de Creación Propia. Profundidad cedida si Azul entra con balón controlado en Zona de Iniciación por dentro — la banda no resuelve la jugada, sigue viva. Robo válido = Rojo recupera antes de esa entrada. Punto para Rojo por robo, punto en contra por profundidad cedida.",
                new List<string> { "Anchura del carril central", "Línea de medios Rojo", "Arranque de Azul" },
                new List<ExerciseLevelRow>
                {
                    new(1, new Dictionary<string, string> { ["Anchura del carril central"] = "28m (estrecho)", ["Línea de medios Rojo"] = "4 (normal)", ["Arranque de Azul"] = "parado, con señal de inicio" }),
                    new(2, new Dictionary<string, string> { ["Anchura del carril central"] = "32m", ["Línea de medios Rojo"] = "4 (normal)", ["Arranque de Azul"] = "parado, con señal de inicio" }),
                    new(3, new Dictionary<string, string> { ["Anchura del carril central"] = "36m", ["Línea de medios Rojo"] = "4 (normal)", ["Arranque de Azul"] = "ventana corta (1-2 pases antes de contar)" }),
                    new(4, new Dictionary<string, string> { ["Anchura del carril central"] = "39m (el actual)", ["Línea de medios Rojo"] = "3 (sin un interior)", ["Arranque de Azul"] = "ventana corta" }),
                    new(5, new Dictionary<string, string> { ["Anchura del carril central"] = "42m (ampliado)", ["Línea de medios Rojo"] = "3 (sin un interior)", ["Arranque de Azul"] = "sin ventana, ya en marcha" }),
                },
                relations);
        }

        private static ExerciseData BuildCircuitoFisico() => new(
            "Circuito físico preseason", "Analitico",
            "Mantener activo con carga aeróbica y de fuerza moderada al grupo que rota fuera del ejercicio táctico, sin dejarlo sin piernas para cuando vuelva a él.",
            null,
            "18 min, compartido con el ejercicio táctico de este mismo bloque, con el montaje fijo de la sesión · Conos, escalera de coordinación · ~5 jugadores (variable según rotación) — el circuito admite cualquier número sin ajuste si faltan.",
            18, null,
            "4 estaciones, rotando cada 45-60s con transición breve: (1) trote continuo con cambios de ritmo / skipping, (2) core (plancha frontal/lateral), (3) coordinación y cambios de dirección (escalera/conos), (4) fuerza de tren inferior con autocarga (sentadillas, zancadas). Cada jugador pasa por las 4 una o dos veces según lo que dure su turno.",
            new List<string> { "Nº estaciones", "Duración por estación" },
            new List<ExerciseLevelRow>
            {
                new(1, new Dictionary<string, string> { ["Nº estaciones"] = "4", ["Duración por estación"] = "45s" }),
                new(2, new Dictionary<string, string> { ["Nº estaciones"] = "4", ["Duración por estación"] = "60s" }),
            },
            new List<(string, bool, IEnumerable<string>?, IEnumerable<(string, bool)>)>());

        private static async Task<ExerciseData> BuildTransicionAsync(AppDbContext db, string teamId, CancellationToken ct)
        {
            var relations = new List<(string, bool, IEnumerable<string>?, IEnumerable<(string, bool)>)>();
            var subprincipioId = await AdnLookup.ResolveSubprincipioIdAsync(db, teamId, FaseTransicionDefensaAtaque, "1.1", ct);
            if (subprincipioId is not null)
            {
                var items = new List<(string, bool)>();
                foreach (var (numero, isFoco) in new (string, bool)[] { ("1.1.3", true), ("1.1.4", true) })
                {
                    var itemId = await ResolveSubSubPrincipioIdAsync(db, subprincipioId, numero, ct);
                    if (itemId is not null)
                        items.Add((itemId, isFoco));
                }

                relations.Add((subprincipioId, true, new List<string> { "Perfilamiento", "Comunicación" }, items));
            }

            return new ExerciseData(
                "Transición defensa-ataque: balón atrás y presión/repliegue", "Situacional",
                "Que Rojo defienda organizado en bloque medio y que, al recuperar el balón, la decisión dependa de dónde lo recupera — si es en su propia Zona de Creación, que lo asegure jugándolo atrás; si es ya en Zona de Creación Rival, que decida entre transición rápida o temporizar, llegando en cualquier caso a medio campo con balón controlado — y que si pierde el balón, repliegue de nuevo a bloque medio sin que el juego se pare.",
                "Rojo — defender organizado en bloque medio; al recuperar, decidir según la zona; replegar a bloque medio si pierde el balón de nuevo. Azul — construir siempre desde su Zona de Creación, buscando gol en una miniportería central o en la portería de F11; presionar tras la pérdida para recuperar antes de que Rojo se asiente.",
                "15 min · Montaje que requiere liberar el ancho completo del campo · Conos para las miniporterías centrales (número y tamaño según nivel) · 20 jugadores (10 Azul, 10 Rojo, ambos en 4-4-2) + 1 portero activo.",
                15, "Alternan jugada a jugada (cambia el portero activo cada vez que termina un punto).",
                "Cada punto arranca con Azul construyendo desde Zona de Creación Rival contra el bloque medio de Rojo. Si Rojo roba en su propia Zona de Creación, entra en fase de aseguramiento atrás — las miniporterías centrales son el objetivo del pase atrás. Si Rojo roba ya en Zona de Creación Rival, decide entre transición rápida o temporizar y montar un ataque organizado. Si Azul recupera el balón, Rojo repliega de inmediato a bloque medio y se reinicia el ciclo, sin detener el punto. Puntos: gol de Azul = punto Azul; Rojo suma punto llegando a medio campo con balón controlado, o metiendo el pase atrás en una miniportería tras robar en banda.",
                new List<string> { "Nº miniporterías", "Tamaño" },
                new List<ExerciseLevelRow>
                {
                    new(1, new Dictionary<string, string> { ["Nº miniporterías"] = "2", ["Tamaño"] = "pequeña (~1m)" }),
                    new(2, new Dictionary<string, string> { ["Nº miniporterías"] = "2", ["Tamaño"] = "media-baja (~1.3m)" }),
                    new(3, new Dictionary<string, string> { ["Nº miniporterías"] = "3", ["Tamaño"] = "media (~1.6m)" }),
                    new(4, new Dictionary<string, string> { ["Nº miniporterías"] = "3", ["Tamaño"] = "grande (~2m)" }),
                    new(5, new Dictionary<string, string> { ["Nº miniporterías"] = "4", ["Tamaño"] = "muy grande (~2.5m)" }),
                },
                relations);
        }

        private static ExerciseData BuildRetoDeToques() => new(
            "Reto de toques y cierre", "Analitico",
            "Bajar pulsaciones y cerrar la sesión dejando buen recuerdo del entrenamiento, sin contenido táctico nuevo.",
            null,
            "~9 min · Música si es posible · 20 jugadores + 2 porteros, todos juntos. Espacio libre — puede aprovechar los cuadros del calentamiento u otro espacio abierto, sin requerir Dibujo propio.",
            9, null,
            "(1) Reto de toques en parejas o tríos, 3-4 min — cuántos toques seguidos sin que caiga el balón, o malabares sencillos. (2) Estiramientos en pareja (uno ayuda al otro) — cadena posterior, cuádriceps, aductores, gemelos, ~20-30s cada uno. (3) Cierre en círculo — el entrenador destaca 1-2 cosas concretas que hayan salido bien, deja un momento para que ellos digan qué les ha gustado, y cierra con el gesto habitual del equipo.",
            new List<string> { "Fase", "Duración" },
            new List<ExerciseLevelRow>
            {
                new(1, new Dictionary<string, string> { ["Fase"] = "Reto de toques", ["Duración"] = "3-4 min" }),
                new(2, new Dictionary<string, string> { ["Fase"] = "Estiramientos + cierre", ["Duración"] = "5-6 min" }),
            },
            new List<(string, bool, IEnumerable<string>?, IEnumerable<(string, bool)>)>());

        // ── ADN lookup (SubSubPrincipio by Numero within its Subprincipio; Subprincipio lookup
        // now lives in AdnLookup, shared with SeasonPlanImporter) ──────────────────────────

        private static async Task<string?> ResolveSubSubPrincipioIdAsync(AppDbContext db, string subprincipioId, string numero, CancellationToken ct) =>
            await db.SubSubPrincipios
                .AsNoTracking()
                .Where(s => s.SubprincipioId == subprincipioId && s.Numero == numero)
                .Select(s => s.Id)
                .FirstOrDefaultAsync(ct);
    }
}
