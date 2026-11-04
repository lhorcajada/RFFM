## Proposal

### Why

Una partida en directo vive hoy solo en el estado React local y en `localStorage` de un único dispositivo (`Front/src/apps/coach/pages/convocations/hooks/useLiveMatch.ts`), por lo que no puede recuperarse desde otro dispositivo y varios entrenadores o dispositivos no pueden actuar sobre la misma partida a la vez. Trasladar el estado de la partida, el reloj y las acciones al backend, sincronizados en tiempo real, convierte la partida en directo en un recurso compartido del equipo.

### What Changes

- El estado completo de una partida en directo (alineación, formación, duración, marcador, eventos y reloj) se almacena y se calcula en el backend: un estado por evento deportivo, con una versión monótona y un reloj controlado por el servidor.
- Cada acción del usuario (inicio, fin de la primera parte, segunda parte, finalización, ajuste de minutos, gol, tarjeta, sustitución, cambio de formación, ediciones previas al partido de alineación, formación y duración) se envía al backend con su versión base; si la versión base coincide, el estado se guarda, la versión se incrementa y se difunde el estado completo; en caso contrario la acción se rechaza con un 409 que incluye el estado actual.
- Un hub de SignalR por partido envía el estado completo (`MatchUpdated`) a todos los dispositivos conectados del equipo; al abrir la pantalla, al reconectar o al detectar un salto de versión se obtiene el estado completo.
- Solo los entrenadores asignados al equipo del evento pueden leer o actuar sobre una partida en directo, tanto por REST como por el hub; un administrador sin equipo asignado queda excluido.
- Finalizar una partida en directo convierte el estado en vivo en `MatchParticipation` (reutilizando la lógica de guardado actual) y cierra el estado en vivo en la misma transacción; el front deja de enviar el `POST` final. Eliminar una partida en directo elimina el estado en vivo y el `MatchParticipation`, y cada dispositivo vuelve a la fase previa al partido.
- El front deja de usar la copia de seguridad en `localStorage` y el diálogo de recuperación para los partidos con estado en el servidor; sin conexión las acciones se bloquean con un aviso, mientras el reloj sigue visible desde la última referencia del servidor.
- La edición manual de partidos finalizados y el cambio del motivo de minutos mantienen el flujo actual de `MatchParticipation`.

## Design

### Target State

Tras el último paso, la partida en directo es un recurso compartido y versionado propiedad del backend. Una fila por evento deportivo en `app.LiveMatchStates` contiene los campos que controla el servidor (fase, reloj, marcador, duración, versión) más los documentos de fútbol calculados en el cliente; cuatro slices REST y un hub de SignalR la leen y la modifican; el frontend renderiza lo que envía el servidor.

Forma final del estado que devuelve el servidor (las respuestas REST, los cuerpos 409 y los eventos `MatchUpdated` llevan este mismo objeto):

```json
{
  "eventId": "<SportEvent id>",
  "teamId": "<SportEvent.TeamId>",
  "version": 8,
  "phase": "firstHalf",
  "clock": { "baseSeconds": 0, "referenceUtc": "2026-11-04T10:00:00Z" },
  "matchDurationMinutes": 60,
  "scoreLocal": 1,
  "scoreVisitor": 0,
  "formation": "4-4-2",
  "matchData": {
    "startingLineupJson": "...", "playersJson": "...", "substitutionWindowsJson": "...",
    "ratingSnapshotsJson": "...", "goalsJson": "...", "cardsJson": "...", "formationChangesJson": "..."
  },
  "isClosed": false,
  "serverNowUtc": "2026-11-04T10:12:03Z"
}
```

`phase` es uno de `preMatch`, `firstHalf`, `halftime`, `secondHalf`, `finished` (el `LiveMatchPhase` existente). `clock.referenceUtc` es `null` mientras el reloj está detenido (`preMatch`, `halftime`, `finished`). Segundos transcurridos = `baseSeconds` + (`serverNowUtc` - `referenceUtc`) mientras está en marcha; `baseSeconds` en otro caso.

Tabla `app.LiveMatchStates`: `EventId` (único), `TeamId`, `Version` (int, token de concurrencia de EF), `Phase`, `ClockBaseSeconds`, `ClockReferenceUtc` (anulable), `MatchDurationMinutes`, `ScoreLocal`, `ScoreVisitor`, `Formation`, `MatchDataJson` (texto, misma convención que las columnas JSON de `MatchParticipation`), `ClosedAtUtc` (anulable), `CreatedAtUtc`, `UpdatedAtUtc`, `UpdatedByUserId`.

### Goals / Non-Goals

**Goals**
- Un estado en vivo versionado por evento, con reloj controlado por el servidor, compartido por REST y SignalR entre los entrenadores del equipo del evento (specs `live-match-server-state`, `live-match-realtime-sync`, `live-match-team-access`).
- Finalizar convierte el estado en vivo en `MatchParticipation` con el comportamiento de sanciones sin cambios y cierra el estado en una sola transacción; eliminar borra ambos registros (specs anteriores, más `coach-live-match-tracking` modificada).
- El front renderiza el estado del servidor, bloquea las acciones sin conexión y elimina la copia de seguridad en `localStorage` y el diálogo de recuperación.

**Non-Goals**
- Trasladar las reglas de fútbol (formaciones reducidas, reubicación por expulsión, minutos jugados, límites de ventanas de sustitución) al backend.
- Cambiar la edición manual de partidos finalizados, los flujos del motivo de minutos (`UpdateMatchParticipationReason`, `UpdateConvocationMinutesReason`) o el comportamiento del endpoint `DeleteMatchParticipation` existente.
- Escalado horizontal del hub (sin backplane de Redis/Azure SignalR).
- Importar una copia de seguridad `localStorage` preexistente al estado del servidor.
- Fuera de alcance: un campo `minutesReason` en el payload de participación; hoy se tipa en el front pero no se envía ni se almacena. Revisar cuando el motivo de minutos forme parte del flujo en directo.

### Decisions

#### D1. The server owns phase, clock, score, duration and version; football documents stay client-computed

Cada acción lleva `{ type, baseVersion, payload }`. Para `goal`, `card`, `substitution`, `formationChange` y `setLineup`, el payload contiene los documentos resultantes calculados en el cliente (los mismos campos `*Json` que ya acepta `SaveMatchParticipationRequest`, más `formation` y `scoreLocal`/`scoreVisitor`), y el servidor reemplaza solo los campos que ese tipo de acción puede tocar (lista blanca por tipo), tras comprobar las guardas de fase (alineación solo en `preMatch`; goal/card/substitution/formationChange solo mientras una parte está en curso o en `halftime`; nada una vez `finished`). `kickOff`, `endHalf`, `startSecondHalf`, `adjustClock` y `setDuration` no llevan documentos de fútbol; el servidor calcula su efecto en el reloj desde su propio instante. `finish` tiene el mismo sobre `{ baseVersion, payload }` y las mismas reglas de versión, pero es un slice y una ruta propios (convierte a `MatchParticipation` en lugar de parchear el estado), y su payload añade la lista de minutos por jugador (`players`: `teamPlayerId`, `minutesPlayed`, `isStarter`, `enteredAtMinute`, `exitedAtMinute`), porque los minutos derivan de reglas que permanecen en el front.
- Alternativas consideradas: (a) portar a C# las formaciones, la reubicación por expulsión y el cálculo de minutos para que el servidor calcule todo; descartado: duplica el conjunto de reglas y `useLiveMatch` sigue siendo la referencia para los entrenadores; (b) el servidor almacena un blob opaco y no controla nada; descartado: no puede controlar el reloj ni validar las transiciones de fase.
- Justificación: la especificación hace que el reloj, la versión y las transiciones sean propiedad del servidor, mientras que las reglas ya funcionan en el front y no generan conflicto entre dispositivos una vez que las acciones se serializan por versión.
- **Record family**: adr
- **Provenance**: derived

#### D2. Optimistic concurrency by base version, 409 carries the current state

El handler carga el estado, rechaza con 409 cuando `baseVersion != Version`, y en otro caso aplica la acción, incrementa `Version` y guarda; `Version` es también el token de concurrencia de EF, de modo que dos guardados simultáneos sobre la misma versión dejan un único ganador y una `DbUpdateConcurrencyException` se convierte en un 409 con el estado recargado. El handler devuelve un record de resultado (`State`, `Conflict`) y el endpoint mapea `Conflict` a `Results.Problem(statusCode: 409, extensions: { currentState })`; los fallos de validación siguen siendo ProblemDetails 400. Una acción rechazada no difunde nada.
- **Provenance**: user

#### D3. One row per event, created idempotently; a finished match stays as a closed row

`POST /live-match` inserta una fila `preMatch` y se apoya en el índice único de `EventId`; ante una violación de unicidad devuelve la fila existente, de modo que las creaciones concurrentes observan un único estado. `finish` establece `phase = finished`, `ClosedAtUtc`, incrementa la versión y conserva la fila, de modo que un dispositivo que reconecta después del final sigue leyendo el estado finalizado; las acciones sobre un estado cerrado fallan con un 409 que lo incluye. `DELETE` elimina la fila. El front crea el estado de forma diferida en la primera interacción del entrenador cuando `GET` responde 404.
- Alternativas consideradas: eliminar la fila al finalizar; descartado: los dispositivos tardíos recibirían un 404 y mostrarían una pantalla de prepartido para un partido terminado.
- **Record family**: adr
- **Provenance**: derived

#### D4. Server clock: base seconds plus reference instant

`kickOff` -> `firstHalf`, base 0, referencia = ahora en el servidor. `endHalf` -> `halftime`, base = transcurrido, referencia anulada. `startSecondHalf` -> `secondHalf`, base sin cambios (el total de la primera parte congelado, como hace hoy `useLiveMatch` en L783-785), referencia = ahora en el servidor. `adjustClock(deltaSeconds)` -> base = max(0, transcurrido + delta), referencia = ahora en el servidor mientras está en marcha, sin cambios en otro caso. `finish` congela el reloj. Cada respuesta y evento lleva `serverNowUtc`; el front almacena `offset = serverNowUtc - deviceNow` en el momento de la recepción y calcula el transcurrido con `computeElapsedSeconds`, de modo que un dispositivo con el reloj desajustado muestra el mismo tiempo; sin conexión, el reloj sigue avanzando desde la última referencia.
- **Provenance**: user

#### D5. Finish is one transaction around an extracted `MatchParticipationWriter`

La conversión y la lógica de sanciones automáticas pasan de `SaveMatchParticipation.Handler` a `MatchParticipationWriter`; el handler existente delega en él, de modo que `SaveMatchParticipationHandlerTests` y `SaveMatchParticipationAutomaticSanctionTests` deben seguir en verde sin cambios. El slice `FinishLiveMatch` construye un `SaveMatchParticipationRequest` a partir del estado almacenado (equipo, marcador, duración, documentos `*Json`, formación) más el `players` del payload, valida que la fase almacenada permite finalizar y, dentro de una única transacción explícita de base de datos, llama al writer y cierra el estado. `AppDbContext` se registra con `EnableRetryOnFailure` (`Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs` L121), así que la transacción se abre dentro de `db.Database.CreateExecutionStrategy().ExecuteAsync(...)`; el delegado reintentado recarga el estado y reconstruye la petición en cada intento. Cualquier fallo revierte ambas cosas y deja el estado abierto y sin cambios; la difusión ocurre solo después del commit.
- **Record family**: adr
- **Provenance**: codebase-forced

#### D6. One shared team-membership check

`LiveMatchTeamAccess.IsTeamCoachAsync` resuelve `SportEvent.TeamId` y lo compara con `TeamEditAuthorization.CoachTeamIdsAsync` (`UserTeams` con `Membership.Coach`). Los slices REST mantienen `Roles = "Coach,Administrator"` y después llaman a la comprobación, devolviendo 403 si falla, de modo que un administrador sin equipo queda excluido; `LiveMatchHub.JoinMatch` llama al mismo método y rechaza añadir la conexión si falla. No se reutiliza `CanEditAsync` porque sus permisos a nivel de club superan lo que indica la especificación.
- **Provenance**: user

#### D7. SignalR hub with a group per event

`LiveMatchHub` (`[Authorize]`) se mapea en `/hubs/live-match` con `RequireAuthorization()` para que el `OnMessageReceived` existente conserve el token; el handler se extiende para aceptar `access_token` desde la query string solo cuando la ruta empieza por `/hubs`. Los grupos se llaman `liveMatch-{eventId}`. Los slices difunden a través de `IHubContext<LiveMatchHub>` después de `SaveChangesAsync`: `MatchUpdated(state)` una vez por acción guardada y `MatchDeleted(eventId)` después de un borrado. `RFFM.Api.csproj` ya tiene `FrameworkReference Microsoft.AspNetCore.App` (L34, net9.0), así que `Hub` e `IHubContext` no necesitan ningún paquete NuGet nuevo; los grupos en memoria son válidos porque hay una única réplica. El id de usuario se lee como lo hacen los slices, `FindFirst(ClaimTypes.NameIdentifier) ?? FindFirst("sub")` (`Features/Coaches/ClubJoinRequests/Queries/GetClubJoinRequests.cs` L25-26), desde `Context.User` en el hub.
- **Provenance**: codebase-forced

#### D8. `MatchDeleted` is a second hub event

Las especificaciones nombran solo `MatchUpdated`, y un estado eliminado no tiene una versión siguiente que difundir. Por ello `DELETE /live-match` emite `MatchDeleted(eventId)`; el front vuelve a la fase previa al partido y vuelve a leer el estado (404). `DeleteMatchParticipation` existente se mantiene sin cambios para los partidos finalizados sin estado en vivo; el front llama al nuevo borrado solo cuando tiene estado en el servidor.
- **Provenance**: derived

#### D9. Frontend: server state is the source of truth

Un nuevo hook `useLiveMatchServerState` gestiona conexión, estado, versión, offset y `send`. `useLiveMatch` mantiene su forma de retorno pública, pero sus acciones pasan a ser llamadas `send(...)` que aplican el estado devuelto; no guarda ninguna copia autoritativa, no escribe copia de seguridad en `localStorage` y `PartidoEnDirectoTab.tsx` deja de renderizar `LiveMatchRecoveryDialog`. El cliente pide el estado completo al abrir, al reconectar y cuando una versión recibida no es `current + 1`; ante un 409 aplica el estado devuelto, descarta la acción local y dispara `rffm.show_snackbar` pidiendo al entrenador que repita la acción; sin conexión bloquea las acciones con un aviso. Se eliminan el `POST` final y los helpers de copia de seguridad de `liveMatchService.ts`. `vite.config.ts` añade un proxy de `/hubs` con `ws: true`. `@microsoft/signalr` se añade a `Front/package.json`; el token procede de la misma fuente `coachAuthToken` que usa el interceptor de Axios.
- **Provenance**: user

#### D10. Pre-existing local backups are discarded, not imported

Las especificaciones retiran la copia de seguridad y el diálogo de recuperación para los partidos con estado en el servidor, y recuperan desde el servidor; no dicen nada sobre una copia escrita por la versión anterior. Cuando la pantalla no encuentra estado en el servidor para el evento y existe una copia heredada en `localStorage`, el front la elimina silenciosamente y muestra la fase de prepartido. Importar un partido local al estado del servidor queda fuera de alcance (Non-Goals).
- **Provenance**: derived

### Risks / Trade-offs

- [El servidor no aplica las reglas de fútbol, así que un cliente defectuoso o antiguo podría almacenar una alineación o unos minutos inconsistentes] -> Mitigación: listas blancas de campos por acción y guardas de fase, serialización por versión y validación en `finish` de la fase y de los rangos del marcador; las reglas siguen en un único lugar (el front).
- [`MatchParticipationWriter` llama varias veces a `SaveChangesAsync`, y la estrategia de ejecución con reintentos rechaza una transacción iniciada por el usuario fuera de `ExecuteAsync`] -> Mitigación: envolver la transacción en `CreateExecutionStrategy().ExecuteAsync(...)` (D5) y cubrir el rollback con un test que fuerza un fallo del writer.
- [`OnMessageReceived` solo conserva el token para endpoints con metadatos de `AuthorizeAttribute` (`Startup.cs` L101); un hub mapeado sin ellos rechazaría todas las conexiones] -> Mitigación: `RequireAuthorization()` en el endpoint del hub más un test de integración que conecta con un token en la query string y otro que lo envía a una ruta que no es de hub.
- [`Startup.cs` L42 también llama a `AddDbContext<AppDbContext>()` sin opciones, sin reconciliar con el registro que habilita la estrategia de reintentos] -> Mitigación: el test de finalización se ejecuta contra la configuración real del host y falla si la transacción se abre fuera de la estrategia de ejecución.
- [Una sola réplica: los grupos de hub en memoria pierden conexiones al reiniciar o al escalar] -> Mitigación: los clientes se reincorporan y piden el estado completo al reconectar; escalar requeriría un backplane, registrado como non-goal.
- [Las partidas en curso en el momento del despliegue pierden su copia de seguridad solo local (D10)] -> Mitigación: desplegar fuera de las ventanas de partido.
- [La actualización a websocket puede fallar tras el ingress de Azure Container Apps o el proxy de desarrollo] -> Mitigación: permitir el fallback de SSE/long-polling de SignalR y verificarlo en la comprobación manual de humo.

### Migration Plan

1. Añadir la entidad `LiveMatchStates`, el `DbSet` y la configuración, y después generar la migración con `manage-migrations.ps1 -Action create` en su propio commit, separado del código de aplicación.
2. Desplegar primero la API: los nuevos endpoints y el hub son aditivos, `DeleteMatchParticipation` y `SaveMatchParticipation` siguen funcionando para la web antigua.
3. Desplegar la web después de la API; la web usa los nuevos endpoints para todos los partidos.
4. Rollback: web vuelve a la build anterior (sigue enviando el guardado final), API vuelve a la imagen anterior; la tabla `LiveMatchStates` es aditiva y puede quedarse, así que no se ejecuta ninguna migración inversa sobre una base de datos en producción.

### Open Questions

Ninguna: las dos preguntas planteadas durante la redacción quedaron resueltas: los tipos de servidor de SignalR están disponibles mediante la referencia de framework `Microsoft.AspNetCore.App` (D7), y el tratamiento de las copias de seguridad locales heredadas se decide en D10.

### Manual Verification

- Deriva de artefactos generados: la nueva migración y `AppDbContextModelSnapshot.cs` coinciden con la configuración de la entidad `LiveMatchState` (volver a ejecutar `manage-migrations.ps1 -Action create` no produce más cambios), y `Front/package-lock.json` lista `@microsoft/signalr`.
- Prueba de humo end-to-end sobre runtimes reales: con la API sobre PostgreSQL real y el servidor de desarrollo de Vite (`/hubs` con proxy), abrir el mismo evento en dos navegadores como dos entrenadores de un mismo equipo; iniciar el partido en uno y confirmar que el otro muestra el reloj en marcha en menos de un segundo, registrar un gol en el segundo y verlo en el primero, finalizar y confirmar que el banner de partido guardado aparece en ambos. Después cortar la red de un dispositivo: el reloj sigue avanzando, las acciones muestran el aviso de sin conexión, y al reconectar muestra el estado actual del servidor sin diálogo de recuperación.
- Transporte del hub desplegado: contra el entorno de Azure Container Apps, confirmar que la conexión `/hubs/live-match` se mantiene activa (websocket o fallback) durante una parte completa.

## Step 1: Live match state aggregate and clock rules

### Interfaces

**Interfaces**:
```csharp
namespace RFFM.Api.Domain.Aggregates.LiveMatches;

public static class LiveMatchPhases { public const string PreMatch = "preMatch", FirstHalf = "firstHalf", Halftime = "halftime", SecondHalf = "secondHalf", Finished = "finished"; }

public static class LiveMatchActionTypes
{
    public const string SetLineup = "setLineup", SetDuration = "setDuration", KickOff = "kickOff", EndHalf = "endHalf",
        StartSecondHalf = "startSecondHalf", AdjustClock = "adjustClock", Goal = "goal", Card = "card",
        Substitution = "substitution", FormationChange = "formationChange";
}

public sealed record LiveMatchDocuments(string? StartingLineupJson, string? PlayersJson, string? SubstitutionWindowsJson,
    string? RatingSnapshotsJson, string? GoalsJson, string? CardsJson, string? FormationChangesJson);

public sealed record LiveMatchActionInput(string Type, int? DurationMinutes, int? DeltaSeconds, string? Formation,
    int? ScoreLocal, int? ScoreVisitor, LiveMatchDocuments? Documents);

public sealed class LiveMatchState
{
    public string EventId { get; }  public string TeamId { get; }  public int Version { get; }
    public string Phase { get; }  public int ClockBaseSeconds { get; }  public DateTime? ClockReferenceUtc { get; }
    public int MatchDurationMinutes { get; }  public int ScoreLocal { get; }  public int ScoreVisitor { get; }
    public string? Formation { get; }  public LiveMatchDocuments Documents { get; }  public DateTime? ClosedAtUtc { get; }
    public bool IsClosed { get; }

    public static LiveMatchState Create(string eventId, string teamId, int matchDurationMinutes, DateTime serverNow, string? userId);
    public LiveMatchApplyResult Apply(LiveMatchActionInput action, DateTime serverNow, string? userId);
    public LiveMatchApplyResult Close(DateTime serverNow, string? userId);   // finish transition, allowed only from secondHalf
    public int ElapsedSeconds(DateTime serverNow);
}

public sealed record LiveMatchApplyResult(bool IsSuccess, string? ErrorCode, string? ErrorMessage);
```

**Test assertions**:
- `Create("e1","t1",60, now, "u1")` produce Version 1, Phase `preMatch`, ClockBaseSeconds 0, ClockReferenceUtc null, IsClosed false (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Single live state per event, scenario "Live state is created for an event without one").
- `Apply(kickOff)` en `preMatch` con now = T: Phase `firstHalf`, ClockBaseSeconds 0, ClockReferenceUtc T, Version 2 (misma especificación § Server-owned match clock, escenario "Kick-off sets the clock reference"; § Monotonic state version).
- `Apply(endHalf)` durante `firstHalf` iniciado en T, aplicado en T+1800s: Phase `halftime`, ClockBaseSeconds 1800, ClockReferenceUtc null; `ElapsedSeconds(T+2400s)` devuelve 1800 (escenario "End of half freezes the clock"; escenario "Clock after a frozen phase" de la especificación realtime en `openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md`).
- `Apply(startSecondHalf)` en `halftime` con base 1800 en T2: Phase `secondHalf`, ClockBaseSeconds 1800, ClockReferenceUtc T2; `ElapsedSeconds(T2+60s)` devuelve 1860.
- `Apply(adjustClock, DeltaSeconds=+120)` en un partido en marcha cuyo transcurrido es 1800 en el momento actual: ClockBaseSeconds 1920, ClockReferenceUtc now; con DeltaSeconds=-5000 la base nunca baja de 0 (escenario "Minutes adjustment moves the clock").
- `Apply(setLineup)` en `preMatch` guarda la alineación, la formación y los documentos e incrementa Version; la misma acción en `firstHalf` devuelve `IsSuccess=false` con un código de error de fase y deja Version sin cambios (§ Pre-match lineup, formation and duration are stored).
- `Apply(setDuration, DurationMinutes=70)` en `preMatch` guarda 70 e incrementa Version; DurationMinutes 0 o por encima de la duración máxima del partido devuelve `IsSuccess=false` (escenario "Match duration is stored").
- `Apply(goal, ScoreLocal=1, ScoreVisitor=0, Documents{GoalsJson})` en `firstHalf` guarda marcador y goles e ignora cualquier campo de documento fuera de la lista blanca de gol; `Apply(goal)` en `finished` o `preMatch` devuelve `IsSuccess=false`.
- `Apply(substitution)` en `halftime` tiene éxito; `Apply(card)` y `Apply(formationChange)` siguen la misma guarda de parte en curso o descanso.
- Cualquier acción sobre un estado cerrado devuelve `IsSuccess=false` con un código de error de estado cerrado y Version sin cambios.
- `Close(serverNow)` sobre un estado en `secondHalf` establece Phase `finished`, congela el reloj en los segundos transcurridos, fija ClosedAtUtc e incrementa Version (§ Finishing converts the live state into match participation).

### Tasks

**Files Affected**:
```text
- A Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/LiveMatches/LiveMatchState.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchStateTests.cs
```

## Step 2: Persistence, EF configuration and migration

### Interfaces

**Interfaces**:
```csharp
// AppDbContext
public DbSet<LiveMatchState> LiveMatchStates => Set<LiveMatchState>();

// IEntityTypeConfiguration<LiveMatchState>
public sealed class LiveMatchStateEntityConfiguration : IEntityTypeConfiguration<LiveMatchState>
{
    public void Configure(EntityTypeBuilder<LiveMatchState> builder);
}
```
Tabla `app.LiveMatchStates`: índice único en `EventId`, `Version` como token de concurrencia, columna de texto `MatchDataJson`.

**Test assertions**:
- Insertar dos filas `LiveMatchState` con el mismo `EventId` lanza `DbUpdateException` causada por el índice único (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Single live state per event, escenario "Concurrent creation keeps one state").
- Cargar una fila en dos contextos, guardar una acción en el primero y después guardar en el segundo lanza `DbUpdateConcurrencyException` (§ Actions carry the base version, escenario "Two simultaneous actions on the same version").
- Guardar y recargar un estado conserva Phase, campos del reloj, marcador, formación y los siete documentos JSON byte a byte.

### Tasks

**Files Affected**:
```text
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/LiveMatchStateEntityConfiguration.cs
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddLiveMatchStates.cs — generated count=1
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddLiveMatchStates.Designer.cs — generated count=1
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/AppDbContextModelSnapshot.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchStateConfigurationTests.cs
```

## Step 3: Team access check and state response mapping

### Interfaces

**Interfaces**:
```csharp
public static class LiveMatchTeamAccess
{
    public static Task<bool> IsTeamCoachAsync(AppDbContext db, string userId, string eventId, CancellationToken ct);
}

public sealed record LiveMatchClockResponse(int BaseSeconds, DateTime? ReferenceUtc);
public sealed record LiveMatchMatchDataResponse(string? StartingLineupJson, string? PlayersJson, string? SubstitutionWindowsJson,
    string? RatingSnapshotsJson, string? GoalsJson, string? CardsJson, string? FormationChangesJson);
public sealed record LiveMatchStateResponse(string EventId, string TeamId, int Version, string Phase, LiveMatchClockResponse Clock,
    int MatchDurationMinutes, int ScoreLocal, int ScoreVisitor, string? Formation, LiveMatchMatchDataResponse MatchData,
    bool IsClosed, DateTime ServerNowUtc)
{
    public static LiveMatchStateResponse From(LiveMatchState state, DateTime serverNow);
}
```

**Test assertions**:
- Un usuario con una fila `UserTeams` de membresía de entrenador del equipo del evento: `IsTeamCoachAsync` devuelve true (`openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md` § Only coaches of the event team can read and act, escenario "Assigned coach reads the live match").
- Un entrenador asignado a otro equipo devuelve false (escenario "Coach of another team").
- Un administrador sin fila `UserTeams` devuelve false (escenario "Administrator without team"); una membresía que no sea de entrenador en el mismo equipo también devuelve false.
- Un id de evento desconocido devuelve false.
- `LiveMatchStateResponse.From(state, now)` lleva `ServerNowUtc == now`, la versión del estado y un `Clock.ReferenceUtc` nulo cuando el reloj está congelado (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Monotonic state version, escenario "Reading returns the full state with its version").

### Tasks

**Files Affected**:
```text
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchTeamAccess.cs
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchStateResponse.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchTeamAccessTests.cs
```

## Step 4: SignalR hub, broadcaster and hub authentication

### Interfaces

**Interfaces**:
```csharp
public sealed class LiveMatchHub : Hub
{
    public static string GroupName(string eventId);          // "liveMatch-{eventId}"
    public Task JoinMatch(string eventId);                    // throws HubException when not a team coach
    public Task LeaveMatch(string eventId);
}

public interface ILiveMatchBroadcaster
{
    Task BroadcastUpdatedAsync(string eventId, LiveMatchStateResponse state, CancellationToken ct);
    Task BroadcastDeletedAsync(string eventId, CancellationToken ct);
}

public sealed class LiveMatchBroadcaster(IHubContext<LiveMatchHub> hub) : ILiveMatchBroadcaster { }

public static class LiveMatchHubAuthentication
{
    public static bool AllowsQueryStringToken(PathString path);   // true only under "/hubs"
}
```
Eventos del hub enviados a los clientes: `MatchUpdated(LiveMatchStateResponse)` y `MatchDeleted(string eventId)`. Endpoint mapeado en `/hubs/live-match` con `RequireAuthorization()`.

**Test assertions**:
- `AllowsQueryStringToken("/hubs/live-match")` es true; `AllowsQueryStringToken("/api/events/e1/live-match")` es false (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § Hub authentication through the access token query string, escenario "Query-string token outside the hub").
- `JoinMatch("e1")` por un entrenador del equipo añade la conexión al grupo `liveMatch-e1` (`openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md` § Hub join is restricted to the event team, escenario "Authorized join").
- `JoinMatch("e1")` por un usuario que no es entrenador del equipo lanza `HubException` y no añade ningún grupo (escenario "Unauthorized join"); la comprobación REST y el hub deciden igual para el mismo usuario y evento (§ One shared membership check).
- `BroadcastUpdatedAsync` envía exactamente un `MatchUpdated` al grupo `liveMatch-{eventId}` con el estado indicado (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § One SignalR group per match, escenario "Saved action is broadcast"); `BroadcastDeletedAsync` envía un `MatchDeleted`.

### Tasks

**Files Affected**:
```text
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchHub.cs
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchBroadcaster.cs
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/LiveMatchHubAuthentication.cs
- M Back/ExtractionApi/src/RFFM.Host/Startup.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/LiveMatchHubTests.cs
```

## Step 5: Read and create live match slices

### Interfaces

**Interfaces**:
```csharp
public class GetLiveMatch : IFeatureModule
{
    public record GetLiveMatchQuery(string EventId, string UserId) : IQueryApp<LiveMatchStateResponse>;
    public class Handler : IRequestHandler<GetLiveMatchQuery, LiveMatchStateResponse> { }   // NotFoundException when no state, ForbiddenException-style failure when not a team coach
}

public class CreateLiveMatch : IFeatureModule
{
    public record CreateLiveMatchCommand(string EventId, string UserId) : ICommand<CreateLiveMatchResult>;
    public record CreateLiveMatchResult(LiveMatchStateResponse State, bool Created);
    public class Handler : IRequestHandler<CreateLiveMatchCommand, CreateLiveMatchResult> { }
    public class Validator : AbstractValidator<CreateLiveMatchCommand> { }
}
```
Rutas: `GET` y `POST` sobre el recurso de partido en directo de un evento, roles `Coach,Administrator`; los fallos son ProblemDetails (404 sin estado, 403 si no es entrenador del equipo).

**Test assertions**:
- Get sobre un evento sin estado en vivo falla con not-found (404) (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Single live state per event).
- Get por un entrenador asignado devuelve el estado con `ServerNowUtc` informado y la Version almacenada (§ Monotonic state version, escenario "Reading returns the full state with its version").
- Get por un entrenador de otro equipo y por un administrador sin equipo fallan ambos con 403 (`openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md` escenarios "Coach of another team" y "Administrator without team").
- Create sobre un evento sin estado devuelve `Created=true`, Phase `preMatch`, Version 1; un segundo Create devuelve `Created=false` con la misma Version (escenario "Live state is created for an event without one" de la especificación de estado del servidor).
- Dos llamadas Create concurrentes dejan exactamente una fila y ambos resultados llevan el mismo EventId y Version (escenario "Concurrent creation keeps one state").

### Tasks

**Files Affected**:
```text
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/GetLiveMatch.cs
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/CreateLiveMatch.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetLiveMatchHandlerTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/CreateLiveMatchHandlerTests.cs
```

## Step 6: Apply live match actions

### Interfaces

**Interfaces**:
```csharp
public class ApplyLiveMatchAction : IFeatureModule
{
    public record ApplyLiveMatchActionRequest(string Type, int BaseVersion, ActionPayload? Payload);
    public record ActionPayload(int? DurationMinutes, int? DeltaSeconds, string? Formation, int? ScoreLocal, int? ScoreVisitor,
        LiveMatchDocuments? Documents);

    public record ApplyLiveMatchActionCommand(string EventId, string UserId, ApplyLiveMatchActionRequest Request)
        : ICommand<ApplyLiveMatchActionResult>;
    public record ApplyLiveMatchActionResult(LiveMatchStateResponse State, bool Conflict);

    public class Handler : IRequestHandler<ApplyLiveMatchActionCommand, ApplyLiveMatchActionResult> { }
    public class Validator : AbstractValidator<ApplyLiveMatchActionCommand> { }
}
```
Endpoint: `POST` sobre el subrecurso de acciones del partido en directo; 200 con el estado, 409 ProblemDetails con la extensión `currentState` cuando `Conflict`, 400 ProblemDetails ante fallo de validación, 403 si no es entrenador del equipo.

**Test assertions**:
- Estado en la versión 7, acción `goal` con BaseVersion 7: resultado `Conflict=false`, Version almacenada 8, una llamada a `BroadcastUpdatedAsync` (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Actions carry the base version, escenario "Action with matching base version").
- Estado en la versión 8, BaseVersion 7: `Conflict=true`, `State.Version == 8`, estado almacenado sin cambios, sin difusión (escenario "Action with obsolete base version"; `openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` escenario "Rejected action is not broadcast").
- Dos comandos con el mismo BaseVersion se ejecutan concurrentemente: exactamente un resultado tiene `Conflict=false`, el otro `Conflict=true` con el estado ganador (escenario "Two simultaneous actions on the same version").
- `Type` desconocido, `BaseVersion` negativo o un campo de payload ausente para el tipo (por ejemplo `adjustClock` sin `DeltaSeconds`) falla la validación y deja el estado almacenado sin cambios (§ Invalid actions are rejected with ProblemDetails).
- Un usuario que no es entrenador del equipo recibe 403 y el estado no cambia (`openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md` escenario "Unauthorized action").
- `kickOff` almacena el instante del servidor como `ClockReferenceUtc` y la respuesta lleva `ServerNowUtc` (especificación de estado del servidor § Server-owned match clock).

### Tasks

**Files Affected**:
```text
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/ApplyLiveMatchAction.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/ApplyLiveMatchActionHandlerTests.cs
```

## Step 7: Extract the match participation writer

### Interfaces

**Interfaces**:
```csharp
internal sealed class MatchParticipationWriter
{
    public MatchParticipationWriter(/* the dependencies SaveMatchParticipation.Handler already holds */);
    public Task SaveAsync(SaveMatchParticipation.SaveMatchParticipationRequest request, CancellationToken ct);
}
// SaveMatchParticipation.Handler: constructor and Handle signature unchanged; Handle delegates to MatchParticipationWriter.SaveAsync.
```

**Test assertions**:
- Las suites sin cambios `SaveMatchParticipationHandlerTests`, `SaveMatchParticipationAutomaticSanctionTests` y `SaveMatchParticipationMinutesLimitSanctionTests` pasan sin editar, incluyendo: un estado de partido finalizado actualiza los goles del evento para el calendario, una quinta amarilla cíclica crea una sanción automática, una roja crea una, y volver a guardar el mismo partido finalizado no crea duplicados (`openspec/changes/live-match-server-sync/specs/coach-live-match-tracking/spec.md` § Match data is saved automatically when the match ends, escenario "Ending the match saves it").

### Tasks

**Files Affected**:
```text
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/MatchParticipationWriter.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/SaveMatchParticipation.cs
```

## Step 8: Finish slice converts the live state

### Interfaces

**Interfaces**:
```csharp
public class FinishLiveMatch : IFeatureModule
{
    public record FinishLiveMatchRequest(int BaseVersion, List<FinishPlayer> Players);
    public record FinishPlayer(string TeamPlayerId, int MinutesPlayed, bool IsStarter, int? EnteredAtMinute, int? ExitedAtMinute);
    public record FinishLiveMatchCommand(string EventId, string UserId, FinishLiveMatchRequest Request) : ICommand<FinishLiveMatchResult>;
    public record FinishLiveMatchResult(LiveMatchStateResponse State, bool Conflict);
    public class Handler : IRequestHandler<FinishLiveMatchCommand, FinishLiveMatchResult> { }
    public class Validator : AbstractValidator<FinishLiveMatchCommand> { }
}
// Handler: builds SaveMatchParticipation.SaveMatchParticipationRequest(MatchPhase = "finished", scores, *Json documents,
// MatchDurationMinutes, StartingLineupJson, Players from the request), then runs MatchParticipationWriter.SaveAsync and
// LiveMatchState.Close inside db.Database.CreateExecutionStrategy().ExecuteAsync with one transaction.
```
Ruta: `POST` sobre el subrecurso de finalización del partido en directo, roles `Coach,Administrator`; 200 con el estado cerrado, 409 ProblemDetails con `currentState`, 400, 403. `Players` exige al menos una entrada.

**Test assertions**:
- Finalizar sobre un estado `secondHalf` con jugadores: existen filas `MatchParticipation` del evento con el marcador final y los minutos indicados, el estado en vivo tiene Phase `finished` y ClosedAtUtc informado, y ambos se confirmaron juntos (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Finishing converts the live state into match participation, escenario "Finish converts and closes").
- Un fallo forzado del writer deja cero filas `MatchParticipation` y el estado en vivo abierto con la misma Version (escenario "Conversion failure keeps the live state").
- Una tarjeta roja almacenada produce la misma sanción automática que crearía un guardado directo (comportamiento de `SaveMatchParticipationAutomaticSanctionTests`; `openspec/changes/live-match-server-sync/specs/coach-live-match-tracking/spec.md` § Match data is saved automatically when the match ends).
- Tras una finalización correcta se envía exactamente un `BroadcastUpdatedAsync` con Phase `finished` (escenario "Finish broadcasts to all devices" de la especificación de estado del servidor); una acción enviada después por el slice de acciones devuelve `Conflict=true` con el estado cerrado.
- Finalizar con un BaseVersion obsoleto devuelve `Conflict=true` y no cambia nada; finalizar con la lista `Players` vacía o desde `preMatch` falla la validación y no cambia nada; un usuario que no es entrenador del equipo recibe 403.

### Tasks

**Files Affected**:
```text
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/FinishLiveMatch.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/FinishLiveMatchHandlerTests.cs
```

## Step 9: Delete live match and API version bump

### Interfaces

**Interfaces**:
```csharp
public class DeleteLiveMatch : IFeatureModule
{
    public record DeleteLiveMatchCommand(string EventId, string UserId) : ICommand;
    public class Handler : IRequestHandler<DeleteLiveMatchCommand, Unit> { }
    public class Validator : AbstractValidator<DeleteLiveMatchCommand> { }
}
```
Ruta: `DELETE` sobre el recurso de partido en directo de un evento, roles `Coach,Administrator`, 204 en caso de éxito. `<Version>` de `Directory.Build.props` pasa a 1.47.0.

**Test assertions**:
- Delete sobre un evento con estado en vivo y filas `MatchParticipation` elimina ambos y envía un único `BroadcastDeletedAsync` (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Deleting a live match removes its state and participation, escenarios "Delete removes both records" y "Devices return to pre-match").
- Delete sobre un evento sin ninguno de los dos registros tiene éxito sin error (idempotente) para un entrenador del equipo.
- Un usuario que no es entrenador del equipo recibe 403 y no se elimina nada (`openspec/changes/live-match-server-sync/specs/live-match-team-access/spec.md` § Only coaches of the event team can read and act).
- El comportamiento del endpoint existente de borrado de participación no cambia: sigue borrando solo filas de participación.

### Tasks

**Files Affected**:
```text
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LiveMatch/DeleteLiveMatch.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/DeleteLiveMatchHandlerTests.cs
- M Back/ExtractionApi/Directory.Build.props
```

## Step 10: Frontend types, server clock helper and REST wrappers

### Interfaces

**Interfaces**:
```ts
// liveMatch.types.ts
export type LiveMatchServerClock = { baseSeconds: number; referenceUtc: string | null };
export type LiveMatchServerState = {
  eventId: string; teamId: string; version: number; phase: LiveMatchPhase; clock: LiveMatchServerClock;
  matchDurationMinutes: number; scoreLocal: number; scoreVisitor: number; formation: string | null;
  matchData: { startingLineupJson: string | null; playersJson: string | null; substitutionWindowsJson: string | null;
    ratingSnapshotsJson: string | null; goalsJson: string | null; cardsJson: string | null; formationChangesJson: string | null };
  isClosed: boolean; serverNowUtc: string;
};
export type LiveMatchActionType = 'setLineup' | 'setDuration' | 'kickOff' | 'endHalf' | 'startSecondHalf' | 'adjustClock'
  | 'goal' | 'card' | 'substitution' | 'formationChange';
export type LiveMatchFinishPlayer = { teamPlayerId: string; minutesPlayed: number; isStarter: boolean;
  enteredAtMinute: number | null; exitedAtMinute: number | null };
export type LiveMatchActionRequest = { type: LiveMatchActionType; baseVersion: number; payload?: Record<string, unknown> };
export type LiveMatchActionResult = { conflict: false; state: LiveMatchServerState } | { conflict: true; state: LiveMatchServerState };

// utils/liveMatchClock.ts
export function computeElapsedSeconds(clock: LiveMatchServerClock, serverOffsetMs: number, nowMs: number): number;
export function computeServerOffsetMs(serverNowUtc: string, deviceReceivedAtMs: number): number;

// services/liveMatchService.ts (additions)
export function getLiveMatch(eventId: string): Promise<LiveMatchServerState | null>;          // 404 -> null
export function createLiveMatch(eventId: string): Promise<LiveMatchServerState>;
export function sendLiveMatchAction(eventId: string, request: LiveMatchActionRequest): Promise<LiveMatchActionResult>; // 409 -> conflict true
export function finishLiveMatch(eventId: string, baseVersion: number, players: LiveMatchFinishPlayer[]): Promise<LiveMatchActionResult>; // 409 -> conflict true
export function deleteLiveMatch(eventId: string): Promise<void>;
```

**Test assertions**:
- Reloj en marcha `{ baseSeconds: 600, referenceUtc: T }` con offset 0 en `T + 90 s` devuelve 690; un reloj congelado (`referenceUtc: null`) devuelve 600 en cualquier momento (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § Clock displayed with the server offset, escenario "Clock after a frozen phase").
- Un dispositivo 20 s adelantado respecto al servidor: `computeServerOffsetMs(serverNowUtc, deviceReceivedAtMs)` devuelve -20000 y `computeElapsedSeconds` entonces iguala el valor que calcularía un dispositivo correcto (escenario "Device clock differs from the server clock").
- El resultado nunca baja de 0 y se redondea hacia abajo a segundos enteros.
- `getLiveMatch` resuelve `null` cuando el cliente rechaza con estado 404 y el estado en otro caso; `sendLiveMatchAction` resuelve `{ conflict: true, state }` usando el campo `currentState` del cuerpo 409, y relanza otros errores; cada wrapper llama al cliente compartido, nunca a una nueva instancia de Axios (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § Rejected action discards the local action).

### Tasks

**Files Affected**:
```text
- M Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts
- A Front/src/apps/coach/pages/convocations/utils/liveMatchClock.ts
- M Front/src/apps/coach/services/liveMatchService.ts
- A Front/src/apps/coach/pages/convocations/utils/__tests__/liveMatchClock.test.ts
- A Front/src/apps/coach/services/__tests__/liveMatchService.test.ts
```

## Step 11: SignalR client service, dependency and dev proxy

### Interfaces

**Interfaces**:
```ts
// services/liveMatchRealtimeService.ts
export type LiveMatchConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type LiveMatchRealtimeHandlers = {
  onMatchUpdated: (state: LiveMatchServerState) => void;
  onMatchDeleted: (eventId: string) => void;
  onReconnected: () => void;
  onStatusChange: (status: LiveMatchConnectionStatus) => void;
};
export type LiveMatchRealtimeConnection = {
  joinMatch(eventId: string): Promise<void>;
  leaveMatch(eventId: string): Promise<void>;
  stop(): Promise<void>;
};
export function connectLiveMatch(handlers: LiveMatchRealtimeHandlers): Promise<LiveMatchRealtimeConnection>;
```
`vite.config.ts` hace proxy de la ruta del hub con soporte websocket; `Front/package.json` lista `@microsoft/signalr`.

**Test assertions**:
- `connectLiveMatch` construye una conexión a la ruta del hub de partidos en directo cuya función de token de acceso devuelve el valor almacenado bajo `coachAuthToken`, con reconexión automática habilitada (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § Hub authentication through the access token query string, escenario "Hub connection with a valid token").
- Un mensaje `MatchUpdated` invoca `onMatchUpdated` una vez con el estado recibido; `MatchDeleted` invoca `onMatchDeleted` con el id del evento.
- Tras notificar la conexión como reconectada, se invoca `onReconnected` y `onStatusChange` pasa de `reconnecting` a `connected` (escenario "Reconnection").
- `joinMatch("e1")` invoca el método del hub `JoinMatch` con `"e1"`; `leaveMatch` invoca `LeaveMatch`.

### Tasks

**Files Affected**:
```text
- A Front/src/apps/coach/services/liveMatchRealtimeService.ts
- M Front/package.json
- M Front/package-lock.json
- M Front/vite.config.ts
- A Front/src/apps/coach/services/__tests__/liveMatchRealtimeService.test.ts
```

## Step 12: Server state hook

### Interfaces

**Interfaces**:
```ts
// hooks/useLiveMatchServerState.ts
export type UseLiveMatchServerStateReturn = {
  state: LiveMatchServerState | null;
  status: 'loading' | 'ready' | 'offline';
  isOnline: boolean;
  serverOffsetMs: number;
  send: (type: LiveMatchActionType, payload?: Record<string, unknown>) => Promise<{ ok: boolean; conflict: boolean }>;
  finish: (players: LiveMatchFinishPlayer[]) => Promise<{ ok: boolean; conflict: boolean }>;
  ensureCreated: () => Promise<void>;
  remove: () => Promise<void>;
};
export function useLiveMatchServerState(eventId: string | undefined): UseLiveMatchServerStateReturn;
```

**Test assertions**:
- Al montar, el hook llama a `getLiveMatch`, aplica el estado devuelto, se une al grupo del hub y expone `status: 'ready'` (`openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md` § Full state recovery, escenario "Opening the screen"); un 404 deja `state: null` hasta que se llama a `ensureCreated`.
- Tras un callback de reconexión vuelve a llamar a `getLiveMatch` y aplica el resultado (escenario "Reconnection").
- Con la versión 5 y al recibir `MatchUpdated` con la versión 8, dispara `getLiveMatch` y no aplica el evento recibido (escenario "Version gap"); la versión 6 se aplica directamente.
- Un `MatchUpdated` de otro dispositivo sustituye el estado (escenario "State from another device").
- `send('goal', payload)` en la versión 4 llama a `sendLiveMatchAction` con `baseVersion: 4` y aplica el estado devuelto (§ Server state is the source of truth in the frontend, escenario "Action sent with the base version").
- Un resultado de conflicto aplica el estado devuelto, no aplica la acción local y dispara `rffm.show_snackbar` con un mensaje que pide repetir la acción (§ Rejected action discards the local action, escenario "Rejection by obsolete version").
- Cuando el estado de la conexión no es conectado, `send` devuelve `{ ok: false, conflict: false }`, no llama al servicio y dispara un aviso de sin conexión (§ Actions are blocked without connection, escenario "Action while offline"); el `serverOffsetMs` expuesto no cambia para que el reloj siga avanzando (escenario "Clock while offline").
- `MatchDeleted` para el evento abierto restablece `state` a null y vuelve a leer el estado (escenario "Devices return to pre-match" de la especificación de estado del servidor en `openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md`).

### Tasks

**Files Affected**:
```text
- A Front/src/apps/coach/pages/convocations/hooks/useLiveMatchServerState.ts
- A Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatchServerState.test.tsx
```

## Step 13: Switch useLiveMatch and PartidoEnDirectoTab to server state

### Interfaces

**Interfaces**:
```ts
// hooks/useLiveMatch.ts: UseLiveMatchReturn keeps its existing members except the removed backup members
//   (backup, acceptBackup, discardBackup) and gains:
//   isOnline: boolean;
//   serverVersion: number | null;
// Actions keep their names and signatures (adjustClock, addGoal, addCard, changeFormation, setMatchDuration,
//   replaceWindows, deleteParticipation, ...), but each resolves by sending a server action and applying the returned state.

// services/liveMatchService.ts: removes saveLiveMatchBackup, loadLiveMatchBackup, clearLiveMatchBackup;
//   saveMatchParticipation and getMatchParticipation remain for manual edits of finished matches.
// liveMatch.types.ts: removes LiveMatchBackup.
// LiveMatchRecoveryDialog component file is deleted; PartidoEnDirectoTab no longer imports or renders it.

// hooks/__tests__/fakeLiveMatchServer.ts (test fixture)
export function createFakeLiveMatchServer(initial?: Partial<LiveMatchServerState>): {
  getLiveMatch: jest-compatible mock; sendLiveMatchAction: mock; finishLiveMatch: mock; emitUpdate(state: LiveMatchServerState): void;
  setOffline(offline: boolean): void; readonly state: LiveMatchServerState;
};
```

**Test assertions**:
- Finalizar el partido llama a `finishLiveMatch` una vez con los minutos de los jugadores y nunca llama a `saveMatchParticipation`, y el banner de partido guardado aparece tras llegar el estado del servidor con fase finished (`openspec/changes/live-match-server-sync/specs/coach-live-match-tracking/spec.md` § Match data is saved automatically when the match ends, escenarios "Frontend does not post the final participation" y "Ending the match saves it").
- Una finalización fallida (petición rechazada) muestra el error con una acción de reintento y conserva los datos de la pantalla (escenario "Save fails"); no se renderiza ningún botón "Guardar datos del partido" (escenario "No manual save button").
- Recargar a mitad de partido tras una expulsión restaura la formación reducida desde el estado del servidor sin diálogo de recuperación (escenario "Current formation survives a reload"; escenario "Returning to the screen" de `openspec/changes/live-match-server-sync/specs/live-match-realtime-sync/spec.md`).
- Salir de la pantalla de un partido con estado en el servidor no escribe nada en `localStorage` (escenario "Leaving the screen mid-match"); sin estado en el servidor y con una copia heredada en `localStorage`, la clave de la copia se elimina y se muestra la fase de prepartido.
- `adjustClock(+2 minutes)` envía una acción `adjustClock` con `deltaSeconds: 120` y el tiempo mostrado sigue al reloj del servidor devuelto; un gol enviado con la versión base 4 solo aparece tras aplicar el estado devuelto (§ Server state is the source of truth in the frontend de la especificación realtime).
- Mientras `isOnline` es false, cada acción se bloquea con un aviso y el reloj mostrado sigue avanzando desde la última referencia del servidor (§ Actions are blocked without connection de la especificación realtime).
- Un borrado de partido con estado en el servidor llama a `deleteLiveMatch` y devuelve la pantalla a la fase de prepartido en todos los dispositivos (`openspec/changes/live-match-server-sync/specs/live-match-server-state/spec.md` § Deleting a live match removes its state and participation).
- Las suites `useLiveMatch.*` adaptadas mantienen sus aserciones originales de comportamiento (orden de goles, formación por expulsión, sanciones por límite de minutos, duración del partido, alineación inicial, ajuste del marcador) ejecutadas a través del servidor simulado en lugar del estado local.

### Tasks

**Files Affected**:
```text
- M Front/src/apps/coach/pages/convocations/hooks/useLiveMatch.ts
- M Front/src/apps/coach/pages/convocations/components/PartidoEnDirectoTab.tsx
- D Front/src/apps/coach/pages/convocations/components/simulation/LiveMatchRecoveryDialog.tsx
- M Front/src/apps/coach/services/liveMatchService.ts
- M Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts
- M Front/package.json
- A Front/src/apps/coach/pages/convocations/hooks/__tests__/fakeLiveMatchServer.ts
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.autoSave.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.adjustClock.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.deleteReset.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.setScore.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.minuteLimitSanctions.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.timerPersistence.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.goalsOrdering.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.expulsion.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.startingLineup.test.tsx
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useLiveMatch.matchDuration.test.tsx
- D Front/src/apps/coach/pages/convocations/components/__tests__/PartidoEnDirectoTab.backupRecovery.test.tsx
- A Front/src/apps/coach/pages/convocations/components/__tests__/PartidoEnDirectoTab.serverState.test.tsx
```
