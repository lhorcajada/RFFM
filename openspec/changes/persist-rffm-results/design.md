## Context

Verificado en vivo contra la RFFM el 29/09/2026 (grupo 26738048, Superliga Cadete):

| Petición | Tamaño | Tiempo | Contenido |
|---|---|---|---|
| `api/results?idGroup=&round=` | ~10 KB | 0,19 s | 8 partidos + `listado_jornadas` (número, nombre, fecha) |
| `acta-partido/{codacta}` (HTML, `__NEXT_DATA__`) | ~267 KB | 0,5 s | acta completa de un partido |
| `_next/data/{buildId}/acta-partido/…json` | ~183 KB | 0,43 s | lo mismo, pero `buildId` cambia en cada despliegue |
| `api/match`, `api/game`, `api/acta`… `?codacta=` | ~268 KB | — | página HTML de fallback; **no existen** |

- **No hay una API JSON por partido.** El refresco se hace por jornada, y el acta solo se pide
  para el detalle, una vez.
- `api/competitions?temporada=` trae `minutos_juego` y `numero_partes` por competición
  (60/70/80/90, siempre 2 partes). No coincide con la categoría: División de Honor Cadete = 90,
  Superliga Cadete = 80.
- Partido sin horario: `hora: ""`. Partido definitivo: `acta_cerrada: "1"` y goles rellenos. En
  toda la temporada 21 revisada, todos los partidos acabaron con `estado=1` y `acta_cerrada=1`; los
  aplazamientos solo aparecen en `observaciones`.
- Hoy `GetCalendarMatchDay` hace, por cada petición, 3 llamadas a la RFFM (`group-rounds`,
  `standings` y `results`) y no cachea nada: no implementa `ICacheRequest`.
- Hay infraestructura reutilizable de `federation-squad-history`: `IRffmBackgroundClient` (con
  reintentos y throttling), `ActaParser`, el patrón cola + `BackgroundService` y
  `PostgresContainerFixture`.

## Goals / Non-Goals

**Goals:** datos de la RFFM compartidos en BD; como mucho una petición a la RFFM (`results`) en el
camino interactivo, y solo cuando falten datos; acta completa guardada; contrato HTTP intacto.

**Non-Goals:** `GET /calendar`, el calendario de Mobile, marcador en directo, UI del acta.

## Decisions

### D1 · Modelo (`FederationDbContext`, esquema `federation`)

`Domain/Entities/Federation/Results/`:

```csharp
// Se llama RffmCompetitionGroup porque ya existe un record RffmGroup en SquadHistory.Services.
public class RffmCompetitionGroup : BaseEntity    // raíz; índice único GroupCode
{
    string GroupCode; int SeasonId; string CompetitionCode; string CompetitionName; string GroupName;
    int MatchMinutes; int MatchParts;             // de api/competitions; 90/2 si no se encuentra
    string? StandingsJson; DateTime? StandingsSyncedAt;   // jsonb: List<TeamResponse> tal cual
    DateTime CreatedAt;
    static RffmCompetitionGroup Create(...); void UpdateStandings(string json, DateTime now);
}

public class RffmRound : BaseEntity               // raíz; índice único (GroupCode, Number)
{
    string GroupCode; int Number; string Name; DateOnly? Date;
    DateTime? LastSyncedAt;                       // null = partidos nunca descargados
    IReadOnlyCollection<RffmMatch> Matches;       // private List<>, cascade
    static RffmRound Create(groupCode, number, name, date);
    void UpdateInfo(string name, DateOnly? date);
    RoundSyncResult ApplySnapshot(IEnumerable<RffmMatchSnapshot> matches, DateTime syncedAt);
}

public class RffmMatch                            // único (RffmRoundId, RecordCode); índices RecordCode, RecordClosed
{
    string RffmRoundId; string RecordCode; int SortOrder;  // SortOrder = orden en la respuesta de la RFFM
    DateOnly? MatchDate; TimeOnly? KickoffTime;   // derivados de Date/Time ("" → null), para la política
    // todos los campos tal cual los manda la RFFM (strings recortados), goles incluidos:
    string HasRecords, RecordClosed, GameSituation, Observations, Date, Time, Field, FieldCode, Status,
           StatusReason, MatchInProgress, ProvisionalResult, Referee, Penalties, ExtraTimeWin,
           ExtraTimeWinnerTeam, LocalTeamCode, LocalTeamName, LocalTeamImageUrl, LocalTeamWithdrawn,
           LocalGoals, LocalPenalties, VisitorTeamCode, VisitorTeamName, VisitorTeamImageUrl,
           VisitorTeamWithdrawn, VisitorGoals, VisitorPenalties, OriginRecordCode;
    DateTime UpdatedAt;
    bool IsFinal => RecordClosed == "1";
}

public class RffmMatchRecord : BaseEntity         // acta; índice único RecordCode
{
    string RecordCode; string GroupCode; string PayloadJson /* jsonb: MatchRffm */; DateTime FetchedAt;
}
```

- `RffmMatchSnapshot` es un record de dominio con los mismos campos en crudo. `ApplySnapshot`
  añade o actualiza cada partido **solo si algún campo cambia** (así `UpdatedAt` refleja cambios
  reales), fija `LastSyncedAt` y devuelve `RoundSyncResult(bool Changed, IReadOnlyList<string>
  NewlyFinalRecordCodes)`.
- **El acta y la clasificación se guardan en `jsonb`**: se leen siempre enteras, son estructuras
  profundas (alineaciones, goles, tarjetas, cambios, técnicos, árbitros) y así no se pierde ningún
  campo. Normalizarlas en unas 10 tablas no aporta nada mientras no haya consultas relacionales
  sobre ellas, y `jsonb` sigue siendo consultable en Postgres. Ya hay precedente de `jsonb` en el
  proyecto (`AddTeamRulesStructuredData`).
- Todos los campos de la RFFM (goles incluidos) se guardan como strings para devolverlos idénticos;
  `MatchDate`/`KickoffTime` se derivan de ellos porque la política calcula el fin estimado.
- `ApplySnapshot` elimina los partidos que ya no vienen en la jornada, salvo si la RFFM devuelve la
  jornada vacía (respuesta anómala: no se borra nada).

### D2 · Política de refresco (`RffmRoundRefreshPolicy`, dominio, pura)

```csharp
public sealed class RoundRefreshReason : SmartEnum<RoundRefreshReason>
{ None(0), NeverSynced(1), MissingSchedule(2), AwaitingResult(3), UpcomingRecheck(4) }

RoundRefreshReason Evaluate(RffmRound round, int matchMinutes, int matchParts, DateTime nowUtc, RffmResultsRefreshSettings s)
```

- `LastSyncedAt == null` → `NeverSynced`.
- Para cada partido con `!IsFinal`, siendo `elapsed = now − LastSyncedAt`:
  - Sin `MatchDate` o sin `KickoffTime` → `MissingSchedule` si `elapsed ≥ 6 h`.
  - `end = MatchDate + KickoffTime + matchMinutes + 10 × (matchParts − 1)` (hora de Madrid).
    Si `now ≥ end` → `AwaitingResult` si `elapsed ≥ 10 min`; cuando `now − end > 48 h` (suspendido
    o acta que no se cierra) el umbral pasa a `24 h`.
  - Si `now < kickoff ≤ now + 7 días` → `UpcomingRecheck` si `elapsed ≥ 24 h` (cambios de horario).
- Devuelve el primer motivo que aplique, o `None`.
- Umbrales en `RffmOptions.Results` (`MissingScheduleRefreshHours = 6`,
  `AwaitingResultRefreshMinutes = 10`, `StaleResultAfterHours = 48`, `StaleResultRefreshHours = 24`,
  `UpcomingWindowDays = 7`, `UpcomingRefreshHours = 24`, `HalfTimeBreakMinutes = 10`).
- "Ahora" sale de `TimeProvider` (UTC); el inicio del partido se convierte de `Europe/Madrid` a UTC
  (IANA; .NET 9 lo resuelve también en Windows).

### D3 · Servicio de sincronización (`Features/Federation/MatchResults/Services/`)

`IRffmResultsSyncService.GetMatchDayAsync(int groupId, round, seasonId, ct)` →
`CalendarMatchDayWithRoundsResponse`:

1. Carga el grupo y la ronda de la BD, sin tracking. Si no existen o la política devuelve algo
   distinto de `None`, sigue; si no, **mapea desde la BD y termina**.
2. `IKeyedLock` (singleton, `SemaphoreSlim` por grupo: así tampoco se crea el grupo dos veces) y relee con
   tracking. La política se evalúa de nuevo: si otra petición ya refrescó, se sirve la BD. Así, dos
   peticiones simultáneas generan una sola llamada a la RFFM.
3. `IRffmResultsClient.GetRoundAsync(groupCode, round)` (cliente interactivo, ver D5).
   - Si el grupo no existe: `GetCompetitionDurationAsync(seasonId, codigo_competicion)` → crea
     `RffmCompetitionGroup` (con duración; si esa llamada falla, 90/2) y un `RffmRound` por cada
     entrada de `listado_jornadas`.
   - Siempre: `UpdateInfo` de las jornadas con `listado_jornadas` (detecta cambios de fecha) y
     `ApplySnapshot` de la jornada pedida.
4. `SaveChangesAsync`. Después se encola un `FetchMatchRecord` por cada acta nueva y, si hay actas
   nuevas o el grupo no tiene clasificación, `RefreshStandings(groupCode, última jornada cuya fecha
   ya ha llegado)`.
5. Cualquier fallo (RFFM caída, timeout, JSON inválido o violación de índice único por una carrera
   entre instancias) → warning, se descarta el contexto y se sirven los datos de BD. Si no hay nada,
   se devuelve la respuesta vacía de hoy (`{ Round, GroupId }`).

Las posiciones (`LocalTeamPosition`/`VisitorTeamPosition`) salen de `StandingsJson` (en el mapper). Ya
no se llama a `group-rounds` ni a `standings` en el camino interactivo.

`RffmMatchDayMapper` (estático, puro) convierte `CalendarRffm` → `RffmMatchSnapshot` y
`RffmRound` + posiciones → `CalendarMatchDayWithRoundsResponse`. Reproduce exactamente el mapeo de
`CalendarService.MapMatchDay` (prefijo `https://appweb.rffm.es/` en escudos,
`Date = DateTimeParser.ParseOrMinValue`, resto de campos tal cual) y ordena por `SortOrder`.

### D4 · Actas y clasificación en segundo plano

- `IRffmResultsJobQueue` sobre `Channel<RffmResultsJob>` (unbounded, `SingleReader`), singleton. Los
  jobs son `FetchMatchRecord(RecordCode, SeasonId, CompetitionCode, GroupCode)` y
  `RefreshStandings(GroupCode, Round)`.
- `RffmResultsWorker : BackgroundService`, con un scope por job, que no muere nunca (mismo patrón
  que `SquadHistoryWorker`):
  - `FetchMatchRecord`: si ya existe `RffmMatchRecord`, no hace nada (idempotente). Si no,
    `IRffmBackgroundClient.GetActaAsync` → guarda `PayloadJson`. Si devuelve `null`, se registra un
    warning; volverá a intentarse al siguiente arranque.
  - `RefreshStandings`: `IRffmBackgroundClient.GetStandingsAsync(groupCode, round)` (**nuevo**,
    `api/standings?idGroup=&round=`, con el mismo mapeo a `TeamResponse` que
    `CompetitionService.GetClassification`, extraído a `StandingsMapper`) → `UpdateStandings`.
  - Al arrancar, encola `FetchMatchRecord` de los partidos con `RecordClosed = "1"` y sin
    `RffmMatchRecord`.
- Usar el cliente de fondo (throttling de 800 ms y reintentos) evita ráfagas: una jornada que se
  cierra entera genera 8 actas espaciadas.

### D5 · Cliente interactivo (`IRffmResultsClient`)

`HttpClient` con nombre `"RffmResults"`: `BaseAddress https://www.rffm.es/`, `User-Agent`
`RFFM.Extractor/1.0`, `Timeout = 10 s`, **sin reintentos ni throttling**. El usuario está
esperando, y si falla se sirve la BD. No se reutiliza `"RffmBackground"` porque su semáforo global
pondría la petición del usuario detrás de un historial de plantilla de varios minutos. Métodos:
`GetRoundAsync(groupCode, round)` → `CalendarRffm?` y `GetCompetitionDurationAsync(seasonId, code)`
→ `RffmCompetitionDuration?`. `CompetitionRffm` gana `numero_partes`.

### D6 · Endpoints

- `GetCalendarMatchDay.cs`: la query pasa a ser `IRequest<CalendarMatchDayWithRoundsResponse>`
  (no `IQueryApp`: ahora escribe en BD y no debe entrar nunca en el `CachingBehavior`), añade
  `Season` (`season` de la ruta; si falta, `RffmOptions.CurrentSeasonId`) y delega en
  `IRffmResultsSyncService`. La ruta, los parámetros y la respuesta no cambian.
- `ActaService` (usado por `GET /acta/{codActa}`, `GetTeamCallups` y `GetGoalSectors`): busca
  primero `RffmMatchRecord` por `codActa` y devuelve el `MatchRffm` deserializado. Si no está, sigue
  el flujo actual; si el acta descargada tiene `acta_cerrada = "1"`, la guarda. Hacerlo en el
  servicio y no en el endpoint extiende la mejora a todos sus consumidores.
- `ICalendarService.GetCalendarMatchDayAsync` se elimina: se ha quedado sin uso.

### D7 · Frontend

Sin cambios: `useCalendar` → `GET /calendar/matchday` mantiene su contrato, así que Resultados
(Coach), Calendario y Jornada (Federación) pasan a leer de BD de forma transparente.

## Risks / Trade-offs

- **Horarios que cambian dentro de la semana**: un cambio en un partido que empieza a más de 7 días
  vista no se ve hasta que entra en la ventana. Es aceptable, porque la RFFM publica los cambios
  con poca antelación.
- **Clasificación**: se actualiza unos segundos después del resultado (vía worker). Mientras tanto,
  las posiciones pueden ir una jornada por detrás.
- **Una sola instancia**: el `IKeyedLock` es en memoria. Con varias instancias podría haber dos
  llamadas a la RFFM, pero los índices únicos y el reintento de lectura en el paso 5 mantienen los
  datos consistentes.
- **Scraping del acta**: depende de `__NEXT_DATA__`. `ActaParser` ya está aislado y tiene tests.

## Migration Plan

Migración `AddRffmResults` sobre `FederationDbContext` (4 tablas con índices únicos
`RffmCompetitionGroups.GroupCode`, `RffmRounds(GroupCode, Number)`,
`RffmMatches(RffmRoundId, RecordCode)` y `RffmMatchRecords.RecordCode`), en un commit separado. No hay backfill: las tablas se llenan con el
uso. Rollback: revertir la migración y el handler; ningún dato existente se ve afectado.
