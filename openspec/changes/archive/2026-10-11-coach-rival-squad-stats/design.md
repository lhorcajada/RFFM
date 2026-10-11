## Context

- `Features/Federation/SquadHistory/` ya resuelve un problema gemelo (informe persistido, cola
  en memoria + `BackgroundService`, reencolado al arrancar) y se toma como patrón.
- `IRffmBackgroundClient` ya ofrece lo necesario, con reintentos, circuit breaker y throttling
  global (`RffmRequestGate`, una petición cada vez con pausa mínima):
  `GetGroupTeamsAsync(groupCode)`, `GetTeamRosterAsync(teamCode)`,
  `GetPlayerSheetAsync(playerCode, seasonId)`.
- La ficha RFFM (`PlayerSheetParser` → `Player`) da los totales de temporada (`SeasonStats`) y
  `Competitions` (equipo, competición, grupo, puntos, posición). No hay desglose por equipo.
- La RFFM responde a veces 200 con `"player": null` aunque el jugador exista (verificado el
  2026-10-11): una ficha vacía no significa «sin actividad».
- El equipo del entrenador (`Team`, `AppDbContext`) guarda `RffmCompetitionId` y `RffmGroupId`;
  la temporada es `RffmOptions.CurrentSeasonId` y la anterior `RffmSeasons.Previous(...)`.
- No existe ninguna tarea programada por día/hora; `MatchResultNotificationWorker` usa
  `PeriodicTimer` con intervalo fijo.

## Goals / Non-Goals

**Goals:** datos persistidos y consultables por liga; mínimo número de peticiones a la RFFM;
generación robusta ante fichas vacías, errores de red y reinicios; actualización semanal sin
intervención; página Coach responsive en tarjetas.

**Non-Goals:** explotación (rankings/comparativas), desglose por equipo o por partido,
Mobile/Federación, más de dos temporadas.

## Decisions

### D1 · Dos niveles de datos: liga (informe) y jugador-temporada (global)
Las estadísticas de un jugador en una temporada no dependen de la liga desde la que se miran,
así que se guardan una sola vez por `(PlayerCode, SeasonId)` y el informe de liga solo guarda
qué jugadores hay en cada equipo. Consecuencias: la temporada pasada se pide una sola vez por
jugador e informe (y se reutiliza si otro informe ya la descargó), y la explotación futura
consulta una única tabla con columnas numéricas.

*Alternativa descartada:* copiar las estadísticas dentro de cada informe (como
`SquadHistoryEntry`). Más simple, pero duplica datos y peticiones entre ligas.

### D2 · Modelo (esquema `federation`, `FederationDbContext`)

```csharp
// Domain/Entities/Federation/LeagueSquadStats/
public sealed class LeagueSquadStatsStatus : SmartEnum<LeagueSquadStatsStatus>
{ Pending(1), Running(2), Completed(3), Failed(4) }

public class LeagueSquadStatsReport : BaseEntity
{
    int SeasonId; int? PreviousSeasonId; string CompetitionCode; string GroupCode;   // único (SeasonId, CompetitionCode, GroupCode)
    LeagueSquadStatsStatus Status;
    int TotalPlayers; int ProcessedPlayers; int FailedPlayers;
    DateTime CreatedAt; DateTime RequestedAt; DateTime? StartedAt;
    DateTime? CompletedAt;            // última generación correcta: «Última actualización»
    string? ErrorMessage;
    IReadOnlyCollection<LeagueSquadTeam> Teams;
    IReadOnlyCollection<LeagueSquadStatsSubscriber> Subscribers;   // quién espera aviso

    static LeagueSquadStatsReport Create(seasonId, previousSeasonId, competitionCode, groupCode, now);
    void Subscribe(string userId, string teamId);          // idempotente por usuario
    IReadOnlyList<(string UserId, string TeamId)> TakePendingNotifications();
    bool RequestRefresh(DateTime now);                     // false si Pending/Running
    bool CanRefresh(DateTime now, TimeSpan minInterval);   // intervalo mínimo desde CompletedAt
    void Start(DateTime now);
    void SetTotals(int totalPlayers);
    void RegisterPlayerProcessed(bool failed);
    void ReplaceSquads(IEnumerable<LeagueSquadTeamData> teams);  // sustituye equipos y jugadores
    void Complete(DateTime now);
    void Fail(string message, DateTime now);               // conserva Teams y CompletedAt anteriores
}

public class LeagueSquadTeam : BaseEntity
{ string ReportId; string TeamCode; string TeamName; string? ShieldUrl;
  IReadOnlyCollection<LeagueSquadPlayer> Players; }

public class LeagueSquadPlayer : BaseEntity
{ string LeagueSquadTeamId; string PlayerCode; string PlayerName; }

public class LeagueSquadStatsSubscriber : BaseEntity      // único (ReportId, UserId)
{ string ReportId; string UserId; string TeamId; bool Notified; }   // TeamId: equipo de Coach para el enlace

public class RffmPlayerSeasonStats : BaseEntity               // único (PlayerCode, SeasonId)
{
    string PlayerCode; int SeasonId; string PlayerName; int? BirthYear; string? Position;
    int Called; int Starter; int Substitute; int Played; int Goals;
    int Yellow; int Red; int DoubleYellow;
    string ParticipationsJson;        // [{competitionName, groupName, teamCode, teamName, teamPoints, teamPosition}]
    bool HasActivity;                 // false = la RFFM confirmó ficha sin actividad esa temporada
    DateTime FetchedAt;

    static RffmPlayerSeasonStats Create(Player sheet, int seasonId, DateTime now);
    void Update(Player sheet, DateTime now);
}
```

- Longitudes en `Rules` de cada entidad; configuraciones EF en
  `Infrastructure/Persistence/Configurations/` (descubiertas por reflexión); índices únicos
  indicados arriba más `LeagueSquadPlayer(PlayerCode)`.
- `ParticipationsJson` es texto JSON (mismo criterio que `RffmMatchRecord`): solo se muestra,
  no se consulta. Lo que se explotará (totales) va en columnas.
- Migración `AddLeagueSquadStats` sobre `FederationDbContext`, en commit separado.

### D3 · Generación (`LeagueSquadStatsGenerator`, scoped)

```
1. report.Start()                                   → Running
2. teams = client.GetGroupTeamsAsync(groupCode)     (1 petición)   vacío/error → Fail
3. por equipo: roster = client.GetTeamRosterAsync   (≈16 peticiones); equipo sin roster → se
   mantiene su plantilla anterior
4. report.SetTotals(nº jugadores distintos); SaveChanges
5. por jugador (distinto):
     a. ficha temporada actual  → siempre (1 petición)
     b. ficha temporada pasada  → solo si no existe fila (PlayerCode, PreviousSeasonId) o si
        se descargó antes de crearse este informe con esa temporada todavía en curso
        (FetchedAt < report.CreatedAt y la fila se guardó como temporada actual de otro informe)
     c. upsert de RffmPlayerSeasonStats; RegisterPlayerProcessed; SaveChanges cada 10 jugadores
6. report.ReplaceSquads(...); report.Complete()     → Completed
```

- **Ficha vacía ≠ sin actividad.** Si `GetPlayerSheetAsync` devuelve `null`, se reintenta una
  vez tras una pausa; si sigue `null`: en la temporada actual el jugador cuenta como fallido y
  se conserva la fila existente; en la temporada pasada **no** se guarda fila (se volverá a
  intentar en la siguiente actualización). Solo se guarda `HasActivity = false` cuando la ficha
  llega con `player` pero sin convocatorias ni competiciones.
- `HttpRequestException` tras los reintentos del cliente en un jugador → fallido y se continúa;
  en el paso 2 → `Fail`. Un informe fallido conserva los equipos y `CompletedAt` de la última
  generación correcta, de modo que la página sigue mostrando datos.
- Usa `TimeProvider` (ya registrado) para todas las fechas.

Coste estimado por liga (16 equipos × 20 jugadores): primera vez 1 + 16 + 640 ≈ 657 peticiones;
actualización 1 + 16 + 320 ≈ 337. Con `BackgroundMinDelayMs = 800` más latencia de la RFFM:
10–15 min y 5–8 min.

### D4 · Cola y worker
`ILeagueSquadStatsQueue` (canal no acotado, lector único, de `reportId`) y
`LeagueSquadStatsWorker : BackgroundService`, calcados de `SquadHistoryQueue`/`Worker`: un
informe a la vez, reencola `Pending`/`Running` al arrancar, un fallo no detiene el worker. El
throttling global del cliente RFFM ya evita que este worker y los de historial/resultados
saturen la federación a la vez.

### D5 · Planificación semanal (`LeagueSquadStatsScheduler : BackgroundService`)
- Función pura y testeable `WeeklySchedule.NextRun(DateTimeOffset now)` y
  `WeeklySchedule.LastRun(now)`: lunes 00:01 en `Europe/Madrid`
  (`TimeZoneInfo.FindSystemTimeZoneById`, con cambio de hora cubierto por tests).
- El alcance lo fija `ILeagueSquadStatsScheduleService.EnqueueDueAsync(dueBefore)`: lee de
  `AppDbContext` los pares distintos `(RffmCompetitionId, RffmGroupId)` de los `Team` con ambos
  configurados, crea el informe de la temporada actual si no existe y encola los que no estén
  `Pending`/`Running` y cuya última actualización sea anterior a `dueBefore`. Un informe de una
  liga que ya no tiene equipos de Coach no se toca.
- Al arrancar: `EnqueueDueAsync(LastRun(now))` → recupera una ejecución perdida.
- Después: `Task.Delay(NextRun(now) - now, TimeProvider)` en bucle y `EnqueueDueAsync(now)`.
- La actualización semanal ignora el intervalo mínimo de D6 y no suscribe a nadie, así que no
  genera notificaciones (D8).
- Día y hora configurables en `RffmOptions.LeagueSquadStats` (`WeeklyDay = Monday`,
  `WeeklyTime = "00:01"`, `MinRefreshMinutes = 60`); `WeeklyEnabled = false` desactiva la
  actualización automática (útil en desarrollo, donde cada arranque recuperaría la ejecución).
- Cola en memoria ⇒ se asume una única instancia de la API, igual que el resto de workers.

### D6 · Endpoints (`Features/Coaches/RivalStats/`, un `.cs` por feature)
Todos con `IRequireFeaturePermission` (`CoachFeatureRoutes.Convocations`, como Resultados y
Clasificación) e `IRequireTeamMembership`. La liga se resuelve en backend a partir del equipo;
el cliente nunca envía competición ni grupo.

| Endpoint | Contrato |
|---|---|
| `POST /api/teams/{teamId}/rival-stats/requests` body `{ refresh: bool }` | `ICommand<RivalStatsStatusResponse>` + `Validator`. 202 si se encola o ya está en curso; 200 si está completado y no se pide actualizar, o si la actualización es demasiado reciente. 409 ProblemDetails si el equipo no tiene competición. |
| `GET /api/teams/{teamId}/rival-stats` | `IRequest` (no `IQueryApp`: el estado cambia y no debe cachearse). Estado + progreso + `completedAt` + `nextRefreshAllowedAt` + equipos `{ teamCode, teamName, shieldUrl, playerCount }`. 404 ProblemDetails si no hay informe; 409 si no hay competición. |
| `GET /api/teams/{teamId}/rival-stats/teams/{teamCode}` | `IRequest`. Jugadores del equipo con sus temporadas: `{ playerCode, playerName, birthYear, position, seasons: [{ seasonId, seasonName, stats, teams }] }`, ordenados por partidos jugados de la temporada actual desc. 404 si el equipo no está en el informe. |

```csharp
public record RivalStatsStatusResponse(string Status, int TotalPlayers, int ProcessedPlayers,
    int FailedPlayers, DateTime? CompletedAt, DateTime? NextRefreshAllowedAt, string? ErrorMessage);
```

Dos GET en vez de uno para que el sondeo de progreso (cada 5 s) no arrastre las ~320 fichas.
La creación concurrente del informe se resuelve como en `RequestSquadHistory` (índice único +
recuperación ante `DbUpdateException`).

### D8 · Notificación al terminar
- `RequestRivalStats` suscribe al usuario (`report.Subscribe(userId, teamId)`) siempre que la
  petición deja o encuentra el informe en curso.
- Al completar o fallar, el generador llama a
  `IWebPushNotificationDispatcher.DispatchRivalStatsFinishedAsync(recipients, succeeded)`
  (nuevo método, misma mecánica que `DispatchMatchResultAsync`: fila `Notification` + web push
  best-effort, un fallo de envío no rompe la generación). Enlace por destinatario:
  `/coach/rival-stats?teamId={teamId}`. Tipos `RivalStatsReady` / `RivalStatsFailed`.
- `TakePendingNotifications()` marca `Notified = true`; una nueva petición lo vuelve a poner a
  `false`. Los informes lanzados por el planificador no tienen suscriptores pendientes.

### D9 · Código RFFM del equipo (`Team.RffmTeamCode`)
- `Team` (`AppDbContext`) gana `RffmTeamCode` (`string?`, máx. 50) con
  `UpdateRffmTeamCode(string?)`; `TeamModelBase`, `CreateTeam` y `GetTeam` lo exponen.
- `UpdateTeamCompetitionCommand` añade `RffmTeamCode`; si llega competición o grupo a `null`, el
  código se guarda `null`. Validador: longitud máxima y solo permitido con competición y grupo.
- Migración `AddRffmTeamCodeToTeam` (`AppDbContext`), commit separado.
- Frontend: nuevo `RffmTeamSelect` («Equipo RFFM») junto a `RffmCompetitionSelect`, cargado con
  los equipos del grupo (clasificación del grupo, que ya trae código y nombre); cambiar
  competición o grupo lo vacía. `EditTeam.tsx` lo envía en `updateTeamCompetition`.
- `GetRivalStats` devuelve `ownTeamCode` y marca `isOwnTeam` en cada equipo.

### D7 · Frontend (Coach)
- `apps/coach/services/rivalStatsService.ts`: `getRivalStats`, `requestRivalStats(refresh)`,
  `getRivalTeamStats`, con sus tipos (`type`, no `interface`). `suppressErrorRedirect` no hace
  falta: 404/409 no redirigen.
- `apps/coach/pages/rivalStats/RivalStats.tsx` (+ `.module.css`), lazy en `routes.tsx` con
  `RequireFeaturePermission` de `Convocations`; mismo esqueleto que `Results.tsx`
  (`BaseLayout`, `ContentLayout`, `useTeamAndClub`, `TeamCompetitionMissing`, botón «Volver»).
- Hook `hooks/useRivalStats.ts`: carga, 404 → «sin generar», sondeo cada 5 s mientras
  `Pending`/`Running` (con limpieza al desmontar), `generate()` / `refresh()`.
- `components/RivalTeamCard.tsx`: tarjeta desplegable por equipo (escudo, nombre, nº de
  jugadores); al abrirla carga sus jugadores una sola vez. El equipo propio va el primero con la
  etiqueta «Tu equipo»; si el equipo no tiene `rffmTeamCode`, aviso con enlace a su edición.
- `components/RivalPlayerCard.tsx`: nombre, año de nacimiento, posición y un bloque por
  temporada.
- Se extrae de `federation/pages/Squad/components/PlayerSeasonsDetail.tsx` la parte
  presentacional (fila de estadísticas + equipos de la temporada) a
  `shared/components/ui/PlayerSeasonStats/PlayerSeasonStats.tsx`; `PlayerSeasonsDetail` pasa a
  usarla sin cambiar su comportamiento ni sus tests.
- Tarjeta «Estadísticas de rivales» en `TeamDashboardCards.tsx`, junto a Resultados y Clasificación (el catálogo «Rivales» ya existente no cambia).
- Resultado de generar/actualizar por `rffm.show_snackbar`; sin tablas; probado a ~360 px.

## Risks / Trade-offs

- **Carga sobre la RFFM** → un informe a la vez, throttling global, intervalo mínimo de 60 min
  para actualizaciones a demanda, la semanal solo sobre informes existentes.
- **Fichas vacías intermitentes** → reintento y conservación de datos previos; el informe
  muestra cuántos jugadores fallaron.
- **Generación larga (10–15 min)** → progreso en la página y notificación al terminar.
- **La semanal crea informes de ligas que nadie ha abierto** → más tráfico a la RFFM el primer
  lunes (≈ 650 peticiones por liga nueva); después solo la actualización ligera.
- **Reinicio a mitad de generación** → se reencola y empieza de nuevo, pero las fichas de la
  temporada pasada ya guardadas no se vuelven a pedir.
- **Cambio de temporada RFFM** (`CurrentSeasonId` 22 → 23) → se crea un informe nuevo por liga.
  La temporada 22 pasa a ser «la pasada» y sus filas pueden estar a falta de las últimas
  jornadas; por eso la primera generación del informe nuevo vuelve a pedirlas una vez (regla
  3.b de D3) y a partir de ahí no se tocan más.
- **Varias instancias de la API** → no soportado (cola en memoria), como el resto de workers.

## Migration Plan

Tablas nuevas (`AddLeagueSquadStats`, `FederationDbContext`) y una columna nullable
(`AddRffmTeamCodeToTeam`, `AppDbContext`); sin cambios en datos existentes. Los equipos ya
configurados quedan sin `RffmTeamCode` hasta que se elija en su edición. Rollback: revertir el
despliegue y eliminar las cinco tablas y la columna.

## Open Questions

Ninguna. Confirmado por el usuario (2026-10-11): intervalo mínimo de 60 min; la semanal cubre
las ligas de los equipos de Coach; notificación al terminar; se guarda el código RFFM del equipo.
