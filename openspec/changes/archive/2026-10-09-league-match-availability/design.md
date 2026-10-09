## Context

- Los estados de convocatoria (`ConvocationStatus`) son Pending(1), Accepted(2), Justified(4) y
  Deconvoke(5). La lista de espera está formada por los jugadores del equipo **sin** fila en
  `Convocations` (`GetEventPlayers`).
- Hay al menos 19 consumidores en backend (estadísticas, `AttributableAbsenceCalculator`,
  `PlayerLoadInputsBuilder`, `GetEventAttendanceSummary`, actas…) y varios en front
  (propuesta de convocatoria, alineación, desconvocatorias) que tratan **cualquier** fila de
  `Convocations` como «el jugador fue convocado / respondió a una convocatoria».
- Los avisos se envían con `IWebPushNotificationDispatcher` (notificación interna + Web Push),
  con el deep link `/coach/attendance/{eventId}`, que abre `AttendanceTabs` tanto para el
  entrenador como para el jugador/familiar.

## Goals / Non-Goals

**Goals**: fase de disponibilidad para partidos de liga sin alterar el significado de una
`Convocation`; listas agrupadas por posición.

**Non-Goals**: recordatorios de disponibilidad, Mobile, amistosos/torneos, caducidad de
peticiones, cambios en las estadísticas.

## Decisions

### D1 · Entidad propia `AvailabilityRequest` (no un nuevo `ConvocationStatus`)

Añadir los estados «Disponibilidad pedida» y «Disponible» a `ConvocationStatus` obligaría a
revisar todos los consumidores de `Convocations`: un jugador «disponible» pero no convocado
contaría como convocado en las estadísticas, en la carga física y en el objetivo de minutos.
Con una entidad aparte, **solo** se crea una `Convocation` cuando hay una decisión real:

| Momento | `AvailabilityRequest` | `Convocation` |
|---|---|---|
| Pedir disponibilidad | `Requested` | — |
| Jugador dice **Sí** | `Available` | — |
| Jugador dice **No** (motivo X) | `Unavailable` | `Deconvoke` + motivo X |
| Entrenador **convoca** desde Disponibles | `Available` (sin cambios) | `Accepted` |
| Entrenador **desconvoca** desde Disponibles | `Available` (sin cambios) | `Deconvoke` + «Decisión técnica» (7) |

Así, las estadísticas existentes siguen siendo correctas y no hace falta tocarlas.

```csharp
// Domain/Aggregates/Assistances/AvailabilityRequestStatus.cs — SmartEnum como ConvocationStatus
public class AvailabilityRequestStatus
{
    public static readonly AvailabilityRequestStatus Requested = new(1, "Requested");
    public static readonly AvailabilityRequestStatus Available = new(2, "Available");
    public static readonly AvailabilityRequestStatus Unavailable = new(3, "Unavailable");
    // Id, Name, List(), From(id)
}

// Domain/Aggregates/Assistances/AvailabilityRequest.cs
public class AvailabilityRequest : BaseEntity
{
    public string SportEventId { get; private set; } = null!;
    public string TeamPlayerId { get; private set; } = null!;
    public int StatusId { get; private set; }
    public DateTime RequestedAt { get; private set; }
    public DateTime? RespondedAt { get; private set; }

    public static AvailabilityRequest Create(string sportEventId, string teamPlayerId, DateTime now);
    public void MarkAvailable(DateTime now);    // Requested|Available → Available
    public void MarkUnavailable(DateTime now);  // Requested|Available → Unavailable
    public void Reopen(DateTime now);           // Unavailable → Requested (nueva petición)
}
```

- Tabla `app."AvailabilityRequests"` con índice único `(SportEventId, TeamPlayerId)` y FK a
  `SportEvents` y `TeamPlayers` con borrado en cascada.
- Configuración EF en
  `Infrastructure/Persistence/Configuration/Aggregates/Assistances/AvailabilityRequestEntityConfiguration.cs`,
  que se descubre por reflexión. `DbSet<AvailabilityRequest> AvailabilityRequests` en `AppDbContext`.
- Migración `AddAvailabilityRequests` (`.\manage-migrations.ps1`), en un commit separado.

### D2 · Reglas de pertenencia a cada lista (calculadas en el front con datos del back)

Prioridad: **la convocatoria manda**.

1. Si el jugador tiene `Convocation`, va al grupo que le toca por su estado: Pendientes de
   aceptar, Convocados o Desconvocados, como hoy.
2. Si no tiene convocatoria y su petición es `Requested` → **Pendientes de respuesta**.
3. Si no tiene convocatoria y su petición es `Available` → **Disponibles**.
4. En cualquier otro caso (sin petición, o `Unavailable` sin convocatoria porque el entrenador la
   borró con «Mover a lista de espera») → **Lista de espera**.

Con esto, «Mover a lista de espera» desde Convocados devuelve al jugador a «Disponibles» si había
dicho que sí, y no hace falta tocar `DeleteConvocation`.

### D3 · Endpoints (`Features/Coaches/Availability/`, un `IFeatureModule` por archivo)

Todos devuelven `ProblemDetails` en caso de error, igual que el resto: `DomainException` → 400,
`ForbiddenAccessException` → 403, `ConflictException` → 409.

1. **`RequestAvailability.cs`** — `POST /api/events/{eventId}/availability-requests`
   (`Coach,Administrator`). Respuesta `200 { requestedCount }`.
   - El evento debe ser un partido de liga (`EventTypeId == 1`); si no, 400
     `AvailabilityOnlyForLeagueMatches`. Evento inexistente → 404.
   - Candidatos: jugadores del equipo **sin** `Convocation` para el evento, **no lesionados** en la
     fecha del evento (misma regla que `GetEventPlayers`: lesión iniciada antes del día del
     evento y sin fin o con fin ≥ ese día) y **no bloqueados** por una sanción automática activa
     (misma regla que `BulkAddConvocationHandler`).
   - Sin petición → `Create`. Con petición `Unavailable` (y sin convocatoria) → `Reopen`.
     `Requested`/`Available` → se omite, así que pedirla dos veces no duplica nada ni reenvía
     avisos.
   - Tras guardar: `DispatchAvailabilityRequestedAsync(teamPlayerId, eventId)` por cada petición
     creada o reabierta.
   - Validator FluentValidation: `EventId` no vacío.
2. **`GetEventAvailabilityRequests.cs`** — `GET /api/events/{eventId}/availability-requests`
   (`IQueryApp`, `IRequireTeamMembership`, sin caché para que el refresco automático vea los
   cambios). Respuesta: `[{ id, teamPlayerId, status: "Requested"|"Available"|"Unavailable",
   requestedAt, respondedAt }]`.
3. **`RespondAvailabilityRequest.cs`** —
   `PUT /api/events/{eventId}/availability-requests/{requestId}/response`
   (`Coach,Administrator,Player,FamilyMember`). Body `{ available: bool, excuseTypeId?: int }`.
   - Player/FamilyMember: solo para su propio jugador. Se usa la misma comprobación que en
     `UpdateConvocationStatus` (`UserProfile.PlayerId == TeamPlayerId`); si no coincide → 403.
   - Si ya existe `Convocation` para ese jugador y evento → 409
     `AvailabilityAlreadyDecided`: el entrenador ya decidió.
   - `available == true` → `MarkAvailable`.
   - `available == false` → `excuseTypeId` obligatorio (validator) y distinto de 7 y 8 (validator:
     son motivos solo del entrenador) → `MarkUnavailable` + `ForceDeconvocationAsync(teamPlayerId,
     eventId, excuseTypeId)`. Ese servicio ya crea la `Convocation` en `Deconvoke` con el motivo.
   - Petición inexistente o de otro evento → 404.
   - Tras guardar: `DispatchAvailabilityRespondedAsync(requestId)` a los entrenadores del equipo.
     Solo si responde un Player/FamilyMember, igual que `UpdateConvocationStatus`.
4. **`DecideAvailableConvocation.cs`** —
   `POST /api/events/{eventId}/availability-requests/{requestId}/decision` (`Coach,Administrator`).
   Body `{ convoke: bool }`.
   - La petición debe estar en `Available` → si no, 409 `AvailabilityNotAvailable`. Si ya existe
     `Convocation` → 409 `AvailabilityAlreadyDecided`.
   - `convoke == true` → `Convocation` con estado `Accepted` (2) + `ResponseDateTime = now` +
     `DispatchConvocationCreatedAsync`, el aviso actual «ha sido convocado».
   - `convoke == false` → `ForceDeconvocationAsync(..., ExcuseTypes.TechnicalDecision.Id)`. No se
     envía aviso, igual que cuando se desconvoca desde la lista de espera.

Los códigos de error nuevos van en `ErrorCodes`: `AvailabilityOnlyForLeagueMatches`,
`AvailabilityAlreadyDecided`, `AvailabilityNotAvailable`, `AvailabilityRequestNotFound` y
`AvailabilityInvalidTransition`. La regla de liga reutiliza `SportEventsConstants.MatchEventTypeId`.
Las comprobaciones que comparten los handlers (gestionar el equipo, ser el propio jugador, obtener
la petición, «ya decidido») viven en `Features/Coaches/Availability/AvailabilityAuthorization.cs`.
Como en `SendConvocationReminders`, el permiso para gestionar el equipo se valida en el handler con
`TeamEditAuthorization`, además del `[Authorize(Roles)]` del endpoint.

### D4 · Avisos (`IWebPushNotificationDispatcher`)

- `DispatchAvailabilityRequestedAsync(teamPlayerId, eventId)` → jugador + familiares. Tipo
  `AvailabilityRequested`, título «¿Estás disponible?», cuerpo
  `¿{alias}, estás disponible para el partido «{evento}» el próximo {dd/MM} a las {HH:mm}?`.
  Si el evento no tiene hora, se omite « a las …». Deep link `/coach/attendance/{eventId}`.
- `DispatchAvailabilityRespondedAsync(requestId)` → entrenadores
  (`ResolveTeamCoachUserIdsAsync`). Tipo `AvailabilityResponded`, título «Disponibilidad», cuerpo
  `{alias} está disponible para {evento} el {dd/MM/yyyy}.` o
  `{alias} no está disponible para {evento} el {dd/MM/yyyy} ({motivo}).`
- Ambos con `try/catch` + `LogWarning`, como el resto: un fallo del aviso nunca hace fallar el
  comando.
- La hora se formatea con la misma hora que muestra la app. `EveDateTime`/`StartTime` se guardan
  como hora local del evento, como en `FormatEventDateSuffix`, así que no hace falta convertirla.

### D5 · Disponibilidad propia en el resumen de eventos

`GetEventAttendanceSummary.EventAttendanceSummaryResponse` añade `MyAvailabilityRequestId` y
`MyAvailabilityStatus` (nulos si no hay petición), calculados con el mismo `myTeamPlayerId` que
ya se usa para `MyConvocationId`. `UpcomingEventsWidget` los usa para mostrar «¿Disponible? Sí /
No» cuando hay una petición `Requested` sin convocatoria.

### D6 · Front

- **`services/availabilityService.ts`** (cliente Axios único):
  `requestAvailability(eventId)`, `getAvailabilityRequests(eventId)`,
  `respondAvailability(eventId, requestId, available, excuseTypeId?)` y
  `decideAvailable(eventId, requestId, convoke)`. Tipos `type AvailabilityRequestItem`, etc.
- **`AttendanceEvent.tsx`** pasa la prop nueva `isLeagueMatch` cuando
  `event.matchCategory === "League"`. Ese campo ya lo calcula el backend a partir de
  `EventTypeId == 1`, así que no se compara por nombre. `isMatch` se mantiene.
- **`AttendanceTabs.tsx`**, solo si `isLeagueMatch`:
  - carga `getAvailabilityRequests` junto al resto y en el refresco automático;
  - lista de espera: el botón «Convocar toda la lista de espera» pasa a ser **«Pedir
    disponibilidad»**. Se abre un `ConfirmDialog`; al confirmar, se envía un snackbar «Disponibilidad
    pedida a N jugadores». Las acciones individuales Convocar/Desconvocar de cada jugador se
    mantienen, para que el entrenador pueda saltarse el flujo (por ejemplo, con un jugador sin
    la app);
  - grupo **«Pendientes de respuesta»** (lo ven todos; el jugador/familiar ve en su tarjeta los
    botones **«Sí, disponible»** y **«No disponible»**);
  - grupo **«Disponibles»** (entrenador: botones **«Convocar»** y **«Desconvocar»**, este último
    con `ConfirmDialog`: «Se desconvocará por decisión técnica»);
  - «No disponible» reutiliza `DeconvokeDialog` con `hideCoachOnly` (oculta los ids 7 y 8),
    título «¿Por qué no está disponible?» y motivo obligatorio. No se crea un
    `AvailabilityResponseDialog` nuevo;
  - las tarjetas de los dos grupos nuevos las pinta `components/AvailabilityList.tsx`, que usa
    las mismas clases «cromo» de `AttendanceTabs.module.css` y agrupa por posición;
  - tras cada acción se recargan convocatorias, jugadores y peticiones (como `handleAdd`). Los
    errores se notifican con `rffm.show_snackbar` usando el `detail` de `ProblemDetails`; no
    se usa `alert()` en el código nuevo.
- **Agrupación por posición** (todos los eventos), en `utils/positionGroups.ts`:

  ```ts
  export type PositionGroupKey = "goalkeepers" | "defenders" | "midfielders" | "wingers" | "forwards" | "unknown";
  export const POSITION_GROUPS: { key: PositionGroupKey; label: string }[] = [
    { key: "goalkeepers", label: "Porteros" },
    { key: "defenders", label: "Defensas" },
    { key: "midfielders", label: "Medios" },
    { key: "wingers", label: "Extremos" },
    { key: "forwards", label: "Delanteros" },
    { key: "unknown", label: "Sin posición" },
  ];
  export function positionGroupOf(position?: string | null): PositionGroupKey;
  export function groupByPosition<T>(items: T[], getPosition: (t: T) => string | null | undefined): { key; label; items: T[] }[]; // solo grupos no vacíos, en orden
  ```

  Clasificación por nombre normalizado (minúsculas, sin tildes), contra los nombres de
  `DemarcationMaster`:
  - `portero` → Porteros;
  - `lateral`, `defensa central`, `central`, `libero`, `carrilero` → Defensas;
  - `extremo` → Extremos;
  - `delantero` (Delantero Centro, Segundo Delantero) → Delanteros;
  - `medio`/`mediocampista`/`pivote`/`interior`/`mediapunta` → Medios;
  - el resto, o vacío → Sin posición.

  `extremo` y `delantero` se evalúan antes que `medio` para evitar falsos positivos.
- **`components/PositionGroupedList.tsx`** (+ `.module.css`): recibe `items`, `getPosition` y
  `renderItem` y pinta un subtítulo por grupo (con el contador) y sus tarjetas en la rejilla
  responsive actual. Se usa dentro de cada `CollapsibleGroup` (lista de espera, pendientes de
  respuesta, disponibles, pendientes de aceptar, convocados y desconvocados) y dentro de
  `NotConvokedList`. No se usan tablas, se mantienen las tarjetas y funciona a 360px.
- `UpcomingEventsWidget.tsx`: si `myAvailabilityStatus === "Requested"` y no hay
  `myConvocationId`, muestra «¿Disponible?» con los botones «Sí» y «No» (este abre
  `DeconvokeDialog` con `hideCoachOnly`).

## Risks / Trade-offs

- **Dos fuentes para una misma lista** (peticiones + convocatorias): se mitiga con la regla de
  prioridad D2, que se aplica en un único selector del front, y con la comprobación 409 en el back.
- **Concurrencia** (el jugador responde mientras el entrenador decide): el índice único de
  `Convocations` y las comprobaciones 409 evitan dobles convocatorias; el perdedor recibe
  un `ProblemDetails` legible.
- **Partidos antiguos** sin peticiones: siguen funcionando igual. La lista de espera muestra a
  todos y el entrenador puede convocar uno a uno.

## Migration Plan

1. Migración `AddAvailabilityRequests` (solo crea la tabla; no hay backfill).
2. Desplegar la API antes que la Web. La Web antigua no llama a los endpoints nuevos y la nueva
   necesita que existan.
