# Design: Pestaña de Estadísticas de plantilla + Estado de forma

## Contexto (estado actual verificado en código)

- `GetSeasonPlayerStats.cs` (`GET /api/catalog/team/{teamId}/season-stats`, sin
  `IRequireFeaturePermission`) ya agrega por jugador: `TotalMinutes`, `TotalGoals`,
  `TotalStarts`, `TotalMatches` — a partir de `MatchParticipations` con
  `MatchPhase == "finished"`. No incluye tarjetas.
- `GetPlayerSeasonCards.cs` (Mobile) calcula además `YellowCards`/`RedCards` parseando
  `CardsJson` vía `PlayerCardCountService.CountCards`, y ya agrega asistencia a
  entrenamiento (`TrainingsAttended`/`TrainingsAbsent`/`TrainingsPossible`) — pero sin
  ventana temporal (histórico completo de temporada) ni desglose por motivo.
- `GetTrainingAttendanceSummary.cs` (`GET /api/attendance/training-summary/{teamId}`) ya
  produce exactamente el desglose de ausencias que necesitamos para el tooltip
  (`AbsenceDetail(EventId, EventTitle, Date, AssistanceTypeId, ExcuseTypeId, Reason)`),
  también sin ventana temporal.
- `Convocation` (`Domain/Aggregates/Assistances/Convocation.cs`) es la fuente de verdad de
  asistencia: `AssistanceTypeId` (`AssistanceType`: Attendance=1/5pt, ExcusedAbsence=2/0pt,
  UnexcusedAbsence=3/0pt, LateArrival=4/2pt — puntos ya existentes no reutilizables tal cual
  para nuestra escala 0-100), `ExcuseTypeId` (`ExcuseTypes`: Injury=1, Study=2, Ill=3,
  FamilyProblem=4, FamilyEvent=5, BirthdayEvent=6, TechnicalDecision=7), `ConvocationStatusId`
  (`ConvocationStatus`: Pending/Accepted/Justified/Deconvoke).
- `MatchParticipation` (`Domain/Entities/TeamPlayers/MatchParticipation.cs`) tiene
  `MinutesPlayed`, `TeamId`, `TeamPlayerId`, `EventId`, `MatchPhase`. `SportEvent` no tiene
  duración en minutos, solo `EveDateTime`/`StartTime?`/`EndTime?` — confirmado con el usuario
  que el componente de entrenamiento cuenta **sesiones asistidas**, no minutos reales.
- `GetPlayersByTeam.cs` ya devuelve `Position` (string) por jugador — reutilizable para el
  filtro de posición en frontend sin tocar backend.
- No existe hoy ningún endpoint que combine estos tres orígenes en una sola respuesta ni que
  aplique una ventana temporal — se construye desde cero, siguiendo el patrón "un fetch para
  todo el equipo" que ya usan `GetSeasonPlayerStats`/`GetTrainingAttendanceSummary`.

## Decisión 1 — Nuevo endpoint `GetTeamPlayerStatistics`

`Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`:

```csharp
public void AddRoutes(IEndpointRouteBuilder app)
{
    app.MapGet(
            "/api/catalog/team/{teamId}/player-stats",
            async (string teamId, IMediator mediator, CancellationToken ct) =>
                Results.Ok(await mediator.Send(new Query { TeamId = teamId }, ct)))
        .WithName(nameof(GetTeamPlayerStatistics))
        .WithTags("Coaches")
        .Produces<List<PlayerStatisticsDto>>();
}

public record Query : IQueryApp<List<PlayerStatisticsDto>>, IRequireFeaturePermission, IRequireTeamMembership
{
    public string TeamId { get; init; } = null!;
    public string FeatureRoute => CoachFeatureRoutes.Squad;
    public string RequiredPermission => "Read";
}

public record PlayerStatisticsDto(
    string TeamPlayerId,
    string DisplayName,
    string? Position,
    int? Dorsal,
    int Goals,
    int YellowCards,
    int RedCards,
    int MinutesPlayed,
    int? FormStatus,                       // 0-100, null = sin datos suficientes en la ventana
    FormStatusBreakdownDto? FormStatusBreakdown);

public record FormStatusBreakdownDto(
    double TrainingComponent,              // 0-100
    double MatchComponent,                 // 0-100
    int TrainingSessionsConsidered,
    int TrainingSessionsBaseline,          // = PlayerFormStatusCalculator.BaselineTrainings
    int MatchMinutesInWindow,
    int MatchMinutesExpected,              // = BaselineMatches * ExpectedMinutesPerMatch
    RecentAbsenceDto[] RecentAbsences);

public record RecentAbsenceDto(string EventId, DateTime? Date, string Reason, int PointsImpact);
```

- `Goals`/`YellowCards`/`RedCards`/`MinutesPlayed`: histórico de temporada completa (no
  windowed), mismo cálculo que `GetSeasonPlayerStats` + `PlayerCardCountService.CountCards`
  (reutilizado, no duplicado — se referencia la clase ya existente en
  `Features/Coaches/Players/Services/PlayerCardCountService.cs`).
- `FormStatus`/`FormStatusBreakdown`: ventana móvil de 8 semanas, ver Decisión 2.
- `DisplayName`: mismo fallback alias→nombre que `GetTrainingAttendanceSummary`.

## Decisión 2 — `PlayerFormStatusCalculator` (servicio puro, testable sin DB)

`Features/Coaches/Players/Services/PlayerFormStatusCalculator.cs`, sin dependencias de EF —
recibe listas ya proyectadas y devuelve un resultado. Esto permite tests xUnit puros
(`Domain.Tests`-style, sin `ApiFixture`) que fijan la fecha de referencia y verifican el
algoritmo por Theory de casos.

```csharp
public static class PlayerFormStatusCalculator
{
    public const int WindowWeeks = 8;
    public const int BaselineTrainings = 16;   // sesiones convocadas para "plena forma"
    public const int BaselineMatches = 8;      // partidos convocados para "plena forma"
    public const int ExpectedMinutesPerMatch = 70;
    public const double TrainingWeight = 0.70;
    public const double MatchWeight = 0.30;

    public record TrainingOutcome(
        string EventId, DateTime? EventDate,
        int? AssistanceTypeId, int? ExcuseTypeId, int? ConvocationStatusId);

    public record Result(
        int? FormStatus,
        double TrainingComponent,
        double MatchComponent,
        int SessionsConsidered,
        int MatchMinutesInWindow,
        RecentAbsence[] RecentAbsences);

    public record RecentAbsence(string EventId, DateTime? Date, string Reason, int PointsImpact);

    public static Result Calculate(
        IReadOnlyList<TrainingOutcome> trainingOutcomesInWindow,
        IReadOnlyList<int> matchMinutesInWindow)
    {
        var scored = trainingOutcomesInWindow
            .Select(o => (Outcome: o, Points: PointsFor(o)))
            .Where(x => x.Points is not null)
            .ToList();

        var sessionsConsidered = scored.Count;
        var trainingComponent = sessionsConsidered == 0
            ? 0d
            : Math.Min(100d, scored.Sum(x => x.Points!.Value) / (double)(BaselineTrainings * 100) * 100d);

        var matchMinutes = matchMinutesInWindow.Sum();
        var matchComponent = Math.Min(
            100d,
            matchMinutes / (double)(BaselineMatches * ExpectedMinutesPerMatch) * 100d);

        int? formStatus = sessionsConsidered == 0 && matchMinutes == 0
            ? null
            : (int)Math.Round(TrainingWeight * trainingComponent + MatchWeight * matchComponent);

        var recentAbsences = scored
            .Where(x => x.Points!.Value < 100)
            .Select(x => new RecentAbsence(
                x.Outcome.EventId, x.Outcome.EventDate, ReasonFor(x.Outcome), x.Points!.Value - 100))
            .OrderByDescending(a => a.Date)
            .Take(10)
            .ToArray();

        return new Result(formStatus, trainingComponent, matchComponent, sessionsConsidered, matchMinutes, recentAbsences);
    }

    // Orden de comprobación: motivo de ausencia manda sobre el tipo de asistencia genérico.
    private static int? PointsFor(TrainingOutcome o)
    {
        if (o.ExcuseTypeId == ExcuseTypes.FromId(1)?.Id) return 10;   // Lesión — penalización máxima
        if (o.ExcuseTypeId == ExcuseTypes.FromId(7)?.Id) return null; // Decisión técnica — no penaliza, excluido
        if (o.AssistanceTypeId == AssistanceType.Attendance.Id) return 100;
        if (o.AssistanceTypeId == AssistanceType.LateArrival.Id) return 80;
        if (o.AssistanceTypeId == AssistanceType.UnexcusedAbsence.Id) return 20;
        if (o.AssistanceTypeId == AssistanceType.ExcusedAbsence.Id) return 45; // resto de motivos justificados
        if (o.AssistanceTypeId is null && o.ConvocationStatusId == ConvocationStatus.FromName("Deconvoke").Id) return null; // decisión del coach, excluido
        if (o.AssistanceTypeId is null && o.ConvocationStatusId == ConvocationStatus.FromName("Justified").Id) return 45;
        return null; // pendiente / sin resultado registrado — excluido del cálculo
    }

    private static string ReasonFor(TrainingOutcome o)
    {
        if (o.ExcuseTypeId is not null && ExcuseTypes.FromId(o.ExcuseTypeId.Value) is { } excuse) return excuse.Name;
        if (o.AssistanceTypeId is not null) return AssistanceType.From(o.AssistanceTypeId.Value).Name;
        return "Sin motivo registrado";
    }
}
```

**Tabla de puntos por sesión (0-100, resta relativa a "Asiste"=100 mostrada como
`PointsImpact`)**:

| Motivo | Puntos | Impacto |
|---|---|---|
| Asiste | 100 | 0 |
| Llega tarde | 80 | -20 |
| Ausencia justificada (Estudios/Enfermedad/Prob. familiar/Evento familiar/Cumpleaños) | 45 | -55 |
| Ausencia injustificada | 20 | -80 |
| Ausencia por lesión | 10 | -90 |
| Decisión técnica del entrenador | excluido (no cuenta) | — |
| Sin resultado / pendiente | excluido (no cuenta) | — |

**Fórmula final**: `FormStatus = round(0.70 × TrainingComponent + 0.30 × MatchComponent)`,
`null` si no hay ningún entrenamiento con resultado ni ningún minuto jugado en la ventana
(jugador recién incorporado o sin actividad reciente) — el frontend muestra "Sin datos" en
ese caso en vez de un 0% engañoso.

**Supuesto documentado**: `ExpectedMinutesPerMatch = 70` es una aproximación para categorías
base; queda como constante simple (no configurable por equipo) en esta iteración, igual que
`BaselineTrainings`/`BaselineMatches` (ya confirmados con el usuario: 16 entrenamientos + 8
partidos en 8 semanas).

## Decisión 3 — Handler: proyección de datos para el calculador

```csharp
public class Handler(AppDbContext db) : IRequestHandler<Query, List<PlayerStatisticsDto>>
{
    public async ValueTask<List<PlayerStatisticsDto>> Handle(Query request, CancellationToken ct)
    {
        var windowStart = DateTime.UtcNow.AddDays(-7 * PlayerFormStatusCalculator.WindowWeeks);
        var trainingEventTypeId = SportEventType.FromName("Entrenamiento").Id;
        var matchEventTypeId = SportEventType.FromName("Partido").Id;

        var teamPlayers = await db.TeamPlayers.AsNoTracking()
            .Include(tp => tp.Player)
            .Where(tp => tp.TeamId == request.TeamId)
            .ToListAsync(ct); // + Position vía Demarcation, igual que GetPlayersByTeam

        // Temporada completa (igual que GetSeasonPlayerStats / GetPlayerSeasonCards)
        var finishedParticipations = await db.MatchParticipations.AsNoTracking()
            .Where(mp => mp.TeamId == request.TeamId && mp.MatchPhase == "finished")
            .ToListAsync(ct);

        // Ventana de 8 semanas para el componente de partidos del estado de forma
        var matchEventsInWindow = await db.SportEvents.AsNoTracking()
            .Where(se => se.TeamId == request.TeamId && se.EventTypeId == matchEventTypeId
                         && se.EveDateTime >= windowStart)
            .Select(se => se.Id)
            .ToListAsync(ct);
        var participationsInWindow = finishedParticipations
            .Where(mp => matchEventsInWindow.Contains(mp.EventId))
            .ToList();

        // Ventana de 8 semanas para el componente de entrenamiento
        var trainingEventsInWindow = await db.SportEvents.AsNoTracking()
            .Where(se => se.TeamId == request.TeamId && se.EventTypeId == trainingEventTypeId
                         && se.EveDateTime >= windowStart)
            .Select(se => new { se.Id, se.EveDateTime })
            .ToListAsync(ct);
        var trainingEventIds = trainingEventsInWindow.Select(e => e.Id).ToList();

        var trainingConvocationsInWindow = await db.Convocations.AsNoTracking()
            .Where(c => trainingEventIds.Contains(c.SportEventId))
            .ToListAsync(ct);

        // ... agrupar por TeamPlayerId (igual patrón que GetPlayerSeasonCards),
        // mapear a PlayerFormStatusCalculator.TrainingOutcome / minutos por jugador,
        // llamar PlayerFormStatusCalculator.Calculate(...) por jugador,
        // combinar con Goals/YellowCards/RedCards/MinutesPlayed de temporada completa.
    }
}
```

Sin `Include`/joins cruzados innecesarios — se cargan listas planas por `TeamId` y se agrupan
en memoria, igual que el resto de queries de este feature.

## Decisión 4 — Frontend: pestaña "Estadísticas" en `Squad.tsx`

- Nuevo tab (`<Tab label="Estadísticas" />`) visible para `!isFan` (misma regla que
  "Valoraciones"); los roles `isPlayerOrFamily` ven solo su propia fila (mismo patrón de
  `associatedTeamPlayerId` ya usado en el tab de Ranking/Alineación).
- Nuevo `apps/coach/pages/squad/components/SquadStatistics.tsx`:
  - Carga los datos con un nuevo `apps/coach/services/teamPlayerStatisticsService.ts`
    (`getTeamPlayerStatistics(teamId): Promise<PlayerStatistics[]>`), único punto que llama a
    `api.get('/catalog/team/{teamId}/player-stats')`, tipos `PlayerStatistics` /
    `FormStatusBreakdown` co-ubicados en el mismo archivo (patrón `*Service.ts` con `type`
    exportado, como `teamplayerService.ts`).
  - Tabla MUI (`Table`/`TableSortLabel`) con columnas: Dorsal, Jugador, Posición, Goles,
    Amarillas, Rojas, Minutos, Estado de forma. Estado ordenable con `useState<{key, dir}>`
    local (mismo patrón simple que el resto de tablas de la app, sin librería nueva).
  - Filtro de posición: `Select` MUI poblado con las posiciones distintas presentes en
    `players` (reutiliza `position` ya devuelto por `teamplayerService.getPlayersByTeam`, sin
    tocar el backend).
  - Celda "Estado de forma": barra de progreso (`LinearProgress` MUI) coloreada por rango
    (verde ≥80, ámbar 50-79, rojo <50, gris "Sin datos" si `null`) + `Tooltip` con el
    desglose (`FormStatusBreakdown`): "% entreno", "% partidos", y lista de
    `RecentAbsences` (fecha + motivo + impacto).
  - Botón "Exportar PDF" → nuevo `apps/coach/pages/squad/squadStatsPdfExport.ts`
    (`exportSquadStatisticsPdf(rows, teamName)`), tabla simple con `jsPDF` (mismo patrón de
    dibujo directo que `squadPdfExport.ts`, sin reutilizar sus helpers de valoraciones que no
    aplican aquí).
- CSS Modules nuevo `SquadStatistics.module.css`, coherente con el tema Coach
  (oscuro/naranja) ya usado por el resto de `squad/components/*.module.css`.

## Addendum — tarjetas responsive + entrenamientos/partidos/lesión reciente

Confirmado con el usuario tras la primera implementación: el listado debe presentarse como
**tarjetas responsive** (mobile-first), no como tabla, y se añaden 4 campos nuevos al DTO.

### Backend — `PlayerStatisticsDto` gana 4 campos

```csharp
public record PlayerStatisticsDto(
    string TeamPlayerId,
    string DisplayName,
    string? Position,
    int? Dorsal,
    int Goals,
    int YellowCards,
    int RedCards,
    int MinutesPlayed,
    int TrainingsAttended,        // nuevo — histórico de temporada
    int MatchesPlayed,            // nuevo — histórico de temporada
    int? DaysSinceLastInjury,     // nuevo — null si no ha tenido ninguna lesión esta temporada
    int? LastInjuryDurationDays,  // nuevo — null si no ha tenido lesión, o si la lesión activa aún no tiene EndDate (en curso)
    int? FormStatus,
    FormStatusBreakdownDto? FormStatusBreakdown);
```

- `TrainingsAttended`: mismo cálculo que `GetPlayerSeasonCards.TrainingsAttended`
  (`AssistanceTypeId == Attendance.Id || LateArrival.Id`, histórico completo, no windowed).
- `MatchesPlayed`: mismo cálculo que `GetSeasonPlayerStats.TotalMatches` (conteo de
  `MatchParticipations` `finished`, histórico completo).
- Lesión reciente: `db.TeamPlayerInjuries.Where(i => i.TeamPlayerId == player.Id).OrderByDescending(i => i.StartDate).FirstOrDefault()`.
  Como `TeamPlayer` ya está scopeado a una temporada+equipo concreto, no hace falta un filtro
  de temporada adicional — todas las lesiones de ese `TeamPlayerId` pertenecen a la temporada
  actual.
  - Si no hay ninguna → `DaysSinceLastInjury = null`, `LastInjuryDurationDays = null`.
  - Si hay una → `DaysSinceLastInjury = (int)(DateTime.UtcNow - injury.StartDate).TotalDays`
    (días transcurridos desde que **empezó** la lesión, tenga o no `EndDate` ya).
  - `LastInjuryDurationDays = injury.EndDate.HasValue ? (int)(injury.EndDate.Value -
    injury.StartDate).TotalDays : null` (si `EndDate` es `null` la lesión sigue en curso — el
    frontend muestra "En curso" en vez de un número).

### Frontend — tarjetas en vez de tabla

- `SquadStatistics.tsx` deja de usar `Table`/`TableSortLabel` y renderiza un grid responsive
  de tarjetas (`Box` con `display: grid` + `gridTemplateColumns: repeat(auto-fill, minmax(...))`
  en CSS Module, 1 columna en móvil), una tarjeta por jugador — mismo espíritu que
  `SquadRanking.tsx`/`PlayerCromo.tsx`, que ya usan tarjetas en esta misma página.
- El control de orden (antes cabeceras de columna) pasa a un `Select`/`ToggleButtonGroup` MUI
  encima del grid: "Ordenar por: Estado de forma / Dorsal / Goles / Amarillas / Rojas /
  Minutos", con un botón de dirección asc/desc. El filtro de posición se mantiene igual.
- Cada tarjeta muestra: dorsal + nombre + posición (cabecera), barra de estado de forma con
  tooltip de desglose (igual que antes), y una fila de estadísticas compactas: goles,
  amarillas, rojas, minutos, entrenamientos, partidos. Si `DaysSinceLastInjury != null`, una
  línea adicional "Lesión: hace N días (M días de baja)" o "Lesión: hace N días (en curso)"
  cuando `LastInjuryDurationDays == null`; si nunca ha tenido lesión, esa línea no se muestra.

## Addendum 2 — las ausencias no pueden superar a un partido realmente jugado

Bug detectado tras la primera implementación: un jugador con una única convocatoria a
entrenamiento marcada como ausencia justificada (45/100 puntos) obtenía un `FormStatus` mayor
(2%) que un jugador que sí jugó ~20 minutos de un partido reciente (1%), porque el
entrenamiento pesa 70% y una sola sesión de 45 puntos sobre el baseline fijo de 16 ya supera,
tras ponderar, a un partido con pocos minutos ponderado al 30%.

**Fix**: se separa "puntos para el tooltip" (severidad informativa, sin cambios — lesión sigue
siendo la peor, luego injustificada, luego justificada media, luego tarde) de "puntos para el
cálculo del `TrainingComponent`". Solo `AssistanceType.Attendance` (100) y
`AssistanceType.LateArrival` (80) contribuyen positivamente al numerador de
`TrainingComponent`. Cualquier ausencia (lesión, injustificada, justificada, motivo no
especificado) contribuye **0** al numerador — nunca resta por debajo de 0, simplemente no
suma — pero sigue contando en `SessionsConsidered` y sigue apareciendo en `RecentAbsences` con
su `PointsImpact` original (basado en la tabla de severidad ya existente), que sigue siendo
puramente informativo para el desglose, no para el cálculo del `FormStatus`.

Efecto: `TrainingComponent` de un jugador cuya única actividad en la ventana son ausencias es
siempre `0`, así que `FormStatus = round(0.3 × MatchComponent)` en ese caso — nunca puede
superar a un jugador que sí jugó minutos reales, sea cual sea la ventana de entrenamiento.

`PlayerFormStatusCalculator.Calculate` pasa a acumular dos sumas distintas sobre `scored`:
`scoringSum` (solo `Attendance`/`LateArrival`) para `TrainingComponent`, y se mantiene
`PointsFor`/`ReasonFor` sin cambios para `RecentAbsences`.

**Test afectado**: `PlayerFormStatusCalculatorTests.InjuryAbsence_PenalizesMoreThanJustifiedAbsence`
ya no puede comparar `FormStatus` (ambos casos dan 0 de `TrainingComponent` al ser la única
sesión una ausencia) — se sustituye por una comprobación sobre `RecentAbsences[0].PointsImpact`
(lesión = -90, estudios = -55), y se añade un test nuevo que reproduce exactamente el bug:
un jugador con 1 ausencia justificada y sin partidos debe dar `FormStatus == 0` (nunca > 0), y
un jugador con minutos reales de partido y sin entrenamientos debe dar `FormStatus` mayor que
el anterior.

## Non-goals reiterados
- Sin persistencia del `FormStatus` calculado ni histórico de su evolución.
- Sin tocar `TeamPlayerInjury` ni el flujo de sanciones.
- Constantes de ventana/baseline no configurables por equipo en esta iteración.

## Decisiones confirmadas con el usuario
- Señal de lesión = `ExcuseTypeId == Injury` en la convocatoria (no `TeamPlayerInjury`).
- Entrenamiento cuenta como sesión completa (no hay minutos reales fiables en `SportEvent`).
- Ventana: últimas 8 semanas. Baseline: 16 entrenamientos + 8 partidos.
- Peso 70% entrenamiento / 30% partidos.
- Penalización: lesión (alta) > injustificada > justificada media (todas iguales salvo
  lesión) > tarde (baja); decisión técnica del entrenador no penaliza.
- Componente de partidos: minutos reales jugados, proporcional sobre un máximo esperado.
