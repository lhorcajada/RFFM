## Context

- **Las tres métricas se derivan, no se guardan** (`TeamPlayerCondition` se eliminó en
  `20260916112325_RemoveTeamPlayerCondition`):
  - Estado de forma y Rodaje → `DailyLoadModel.Evaluate` (`PlayerFormStatusCalculator`,
    `PlayerReadinessCalculator`). Reproduce día a día una ventana de 84 días (`ReplayDays`) que
    empieza en 0.
  - Cansancio → `PlayerFatigueCalculator.Calculate`: función pura sobre eventos de los últimos 14
    días (`WindowDays`) con decaimiento por `DaysAgo`.
- `GetTeamPlayerStatistics` (`/api/catalog/team/{teamId}/player-stats`) carga los eventos del equipo y
  construye, **dentro del handler**, las entradas de cada jugador:
  - `TrainingInput` con `FormStatusOutcome.Classify/ReasonFor`.
  - `MatchInput` filtrado por `JoinedDate`/`LeftDate` y con `MatchMissedReason`.
  - Tuplas de Cansancio con `DaysAgo` relativo a `DateTime.UtcNow`.
- La ficha (`PlayerDetail.tsx`, pestaña 0 «Estadísticas») obtiene su fila con `usePlayerFormStats`
  (descarga toda la plantilla y filtra) y pinta `PlayerFormBars` + `MetricInfoDialog`.
- No hay librería de gráficos: `RatingEvolutionPage` usa un SVG propio.

## Goals / Non-Goals

**Goals:** ver en la ficha la evolución diaria de Forma, Rodaje y Cansancio (4, 8 o 12 semanas), con
la garantía de que el último punto coincide con el valor que se ve hoy. Sin snapshots, sin job y sin
migraciones.

**Non-Goals:** congelar «lo que marcaba ese día», comparar jugadores, sparklines en plantilla,
Mobile, PDF.

## Decisions

### D1 · Dónde: ficha del jugador, con enlace desde la plantilla

- La evolución es de **un** jugador, así que va en la ficha: pestaña Estadísticas, debajo de las barras.
- Estadísticas de plantilla es una foto de todo el equipo; solo añade un enlace «Ver evolución» por
  tarjeta hacia `/coach/player/{teamPlayerId}` (la pestaña 0 ya es la de por defecto).
- Descartamos una página aparte hasta que haga falta comparar jugadores.

### D2 · Reconstrucción: una evaluación completa por día

Punto del día D = resultado del cálculo actual con `today = D`:
- **Forma/Rodaje**: `Evaluate(start = D − 83, today = D)`.
- **Cansancio**: eventos de `[asOf − 14 días, asOf]`, con `DaysAgo = (D − fechaEvento).Days`.

Se descarta hacer **una** simulación larga y leer sus valores intermedios. Esa simulación empieza en 0
en `hoy − 83`, así que los primeros días saldrían artificialmente bajos, y cada punto no sería «el valor
de ese día». Con la evaluación por día, el último punto es exactamente el de `player-stats`; ese es el
test de consistencia clave.

Coste: 84 días × 84 simulaciones × 2 métricas, unas 14 000 iteraciones triviales, para un solo
jugador. Despreciable, así que sin caché (no se implementa `ICacheRequest`, igual que
`GetTeamPlayerStatistics`). La historia se recalcula si se corrige una asistencia o cambian los
parámetros del modelo. El usuario ha aceptado este comportamiento (sin job nocturno).

### D3 · Un día pasado es un día cerrado

`DailyLoadModel.Simulate` hoy no cuenta el día `today` como descanso si no hay actividad («un día
sin terminar no es un día de descanso»). Eso es correcto para el hoy real, pero no para un D pasado,
que ya ha terminado.

Se añade un parámetro opcional `bool todayIsClosed = false` a `Simulate`/`Evaluate`, propagado desde
`PlayerFormStatusCalculator.Calculate` y `PlayerReadinessCalculator.Calculate`. Con `true`, `end = today`
siempre. El histórico lo pasa a `true` para D < hoy y a `false` para D = hoy. Así el comportamiento
actual y sus tests no cambian.

Cansancio: `asOf = DateTime.UtcNow` para D = hoy (idéntico a hoy) y `D.Date.AddDays(1).AddTicks(-1)`
para D pasado. Solo cuentan eventos con fecha ≤ `asOf`.

### D4 · Entradas compartidas: `PlayerLoadInputsBuilder`

Nuevo `Features/Coaches/Players/Services/PlayerLoadInputsBuilder.cs`, estático y puro. Se extrae de
`GetTeamPlayerStatistics` (líneas ~257-282, 475-497 y `MatchMissedReason`):

```csharp
public static class PlayerLoadInputsBuilder
{
    public record TrainingRow(string EventId, DateTime Date, IReadOnlyList<string> TrainingTypes,
        int? AssistanceTypeId, int? ConvocationStatusId, int? ExcuseTypeId);
    public record MatchRow(string EventId, DateTime Date, int EventTypeId);           // partidos del equipo con alguna participación finished
    public record MatchConvocationRow(string EventId, int? AssistanceTypeId, int? ConvocationStatusId, int? ExcuseTypeId);

    public static IReadOnlyList<DailyLoadModel.TrainingInput> Trainings(IEnumerable<TrainingRow> rows, DateTime asOf);
    public static IReadOnlyList<DailyLoadModel.MatchInput> Matches(
        IEnumerable<MatchRow> teamMatches, IReadOnlyDictionary<string, int> minutesByEvent,
        IReadOnlyDictionary<string, MatchConvocationRow> convocationByEvent,
        DateTime joinedDate, DateTime? leftDate, DateTime asOf);
    public static (trainings, matches) FatigueEvents(
        IEnumerable<DailyLoadModel.TrainingInput> attendedTrainings, IEnumerable<DailyLoadModel.MatchInput> playedMatches, DateTime asOf);
}
```

(Los tipos exactos de la tupla de Cansancio son los que ya acepta `PlayerFatigueCalculator.Calculate`.)

- `GetTeamPlayerStatistics` pasa a usarlo sin cambiar su salida; sus tests actuales
  (`GetTeamPlayerStatisticsHandlerTests`) son la red de regresión.
- Criterio de Cansancio: se mantiene el actual (asistencia = `Attendance` o `LateArrival`, partidos con
  participación `finished` de cualquier tipo en la ventana). Hay que comprobar al extraer que coincide
  con `FormStatusOutcome.Attended`. Si no coincide, el helper conserva los dos criterios por separado:
  no se cambia el comportamiento en este change.

### D5 · Serie: `PlayerPhysicalEvolutionCalculator`

Nuevo `Services/PlayerPhysicalEvolutionCalculator.cs`, puro:

```csharp
public static IReadOnlyList<Point> Calculate(
    IReadOnlyList<DailyLoadModel.TrainingInput> trainings, IReadOnlyList<DailyLoadModel.MatchInput> matches,
    DateTime today, DateTime nowUtc, int days, int? categoryHalfMinutes);
public record Point(DateTime Date, int? FormStatus, int? Readiness, int Fatigue);
```

Por cada D: filtra las entradas con fecha ≤ fin de D y llama a los tres calculadores existentes (D2, D3).
Toda la lógica de la serie se prueba con tests unitarios, sin BD.

### D6 · Endpoint `GetPlayerPhysicalEvolution` (vertical slice)

`Features/Coaches/Players/Queries/GetPlayerPhysicalEvolution.cs`:

- `GET /api/catalog/team/{teamId}/players/{teamPlayerId}/physical-evolution?days=28`.
- `Query : IQueryApp<PlayerPhysicalEvolutionDto>, IRequireFeaturePermission, IRequireTeamMembership`,
  con `FeatureRoute = CoachFeatureRoutes.Squad` y `RequiredPermission = "Read"`, igual que
  `GetTeamPlayerStatistics`.
- `Validator`: `Days ∈ {28, 56, 84}` → `400 ValidationProblemDetails` vía `ValidationBehavior`.
- Handler (`AppDbContext`, `AsNoTracking`): comprueba que el `TeamPlayer` existe con ese `TeamId`; si
  no, `404 ProblemDetails` (patrón de error del proyecto para not found). Luego carga **solo este
  jugador** desde `loadStart = today − (days − 1) − (ReplayDays − 1)` (hasta 167 días):
  - Entrenos del equipo y sus convocatorias del jugador.
  - Partidos del equipo (Liga/Amistoso/Torneo) con participación `finished`, las participaciones del
    jugador y sus convocatorias a partidos.
  - Sus lesiones.
  - La categoría (`MatchDurationMinutesByCategory`).

  Construye las entradas con `PlayerLoadInputsBuilder` y la serie con
  `PlayerPhysicalEvolutionCalculator`.

```csharp
public record PlayerPhysicalEvolutionDto(
    string TeamPlayerId, int Days, bool FormStatusAvailable,
    PhysicalEvolutionPointDto[] Points,        // más antiguo primero, Points[^1] = hoy
    PhysicalEvolutionEventDto[] Events,        // entrenos asistidos y partidos con minutos dentro del rango
    PhysicalEvolutionInjuryDto[] Injuries);    // lesiones que solapan el rango
public record PhysicalEvolutionPointDto(DateTime Date, int? FormStatus, int? Readiness, int Fatigue);
public record PhysicalEvolutionEventDto(DateTime Date, string EventId, int EventTypeId, string Kind,  // "Training" | "Match"
    IReadOnlyList<string> TrainingTypes, int MinutesPlayed);
public record PhysicalEvolutionInjuryDto(DateTime StartDate, DateTime? EndDate);
```

### D7 · Frontend

- **Dependencia**: `@mui/x-charts@^7.29.1`. La v8+ exige MUI 7 y el proyecto está en `@mui/material` 5.18.
  La v7 admite `^5.15.14` y React 19. Se importa por subruta (`@mui/x-charts/LineChart`,
  `@mui/x-charts/ChartsReferenceLine`) para no inflar el bundle. La página ya es lazy.
- **Servicio**: en `apps/coach/services/teamPlayerStatisticsService.ts`, tipos `PlayerPhysicalEvolution*`
  (`type`) y `getPlayerPhysicalEvolution(teamId, teamPlayerId, days)` con el cliente Axios único.
- **Hook**: `pages/player/hooks/usePlayerPhysicalEvolution.ts` con `{ data, loading, error, days,
  setDays, retry }`. Vuelve a pedir la serie al cambiar `days`.
- **Componente**: `pages/player/components/PlayerPhysicalEvolution.tsx` + `.module.css`, renderizado en
  `PlayerDetail` (pestaña 0) bajo `statsFormRow`:
  - Cabecera «Evolución física» + `ToggleButtonGroup` («4 semanas» / «8 semanas» / «12 semanas»).
  - Resumen textual (accesible y útil en móvil): «Forma 62 (+8) · Rodaje 70 (−3) · Cansancio 35 (+12)».
    Variación = último punto − primer punto no nulo del rango.
  - `LineChart` de altura 240, ancho del contenedor, eje Y 0-100, eje X de fecha (`dd/MM`, `date-fns`)
    y `connectNulls: false`. No hay serie de Forma si `formStatusAvailable = false`.
  - `ChartsReferenceLine` en días de partido y en el inicio de cada lesión.
  - Día seleccionado (`onAxisClick`, por defecto hoy): fecha, tres valores y eventos («Entreno ·
    Físico, Táctico», «Partido · 60'»).
  - Estados: `CircularProgress`; error «No se pudo cargar la evolución» + botón «Reintentar»; vacío
    «Sin actividad en este periodo».
- **Colores de serie**: salen del tema Coach (`theme.palette`), sin hex nuevos. Propuesta:
  - Forma = `primary.main` (naranja).
  - Rodaje = `info.main`.
  - Cansancio = `error.main`.

  **Pendiente de aprobación del usuario** (react.md §5).
- **Plantilla**: `SquadStatistics.tsx` recibe una prop opcional `onOpenPlayer(teamPlayerId)` y
  muestra en cada tarjeta un botón «Ver evolución». `Squad.tsx` navega a `/coach/player/{teamPlayerId}`
  (`player/:id` recibe el `teamPlayerId`, igual que `usePlayerFormStats`). Se usa un callback y no un
  `Link` interno para que `SquadStatistics` no dependa del router: sus tests actuales lo renderizan
  sin `MemoryRouter`.
- **Tests**: se mockea `@mui/x-charts/LineChart` con un componente que expone sus `series`/`xAxis`
  por texto (jsdom no mide SVG). Se prueban el resumen, el selector, el día seleccionado y los estados.

## Risks / Trade-offs

- **La historia cambia con correcciones de datos o de parámetros** → aceptado (D2) y explicado con
  un texto de ayuda en la sección: «Calculado con los datos actuales».
- **Refactor de `GetTeamPlayerStatistics`**: riesgo de alterar valores actuales → mitigado con su suite
  existente y con el test de consistencia hoy = `player-stats`.
- **Tamaño del bundle** de x-charts (~100-150 kB gz) → solo en la ficha, que ya es lazy. Se revisa
  la salida de `npm run build`.
- **Doble carga en la ficha**: `usePlayerFormStats` sigue descargando toda la plantilla. Se deja igual
  (fuera de alcance), aunque el nuevo endpoint podría sustituirlo más adelante.

## Open Questions

1. ~~¿Colores de serie propuestos en D7?~~ Aprobados por el usuario (2026-09-30): Forma =
   `primary.main`, Rodaje = `info.main`, Cansancio = `error.main`.
