## Context

- R1:
  - `PlayerSessionEvaluation` (+ `Subprincipios`);
  - `PUT`/`GET`/`DELETE` en `…/session-evaluations/{sessionId}`;
  - `SaveSessionEvaluation.SessionEvaluationDto`.
- Asistencia: `Convocations` (`SportEventId`, `TeamPlayerId`, `AssistanceTypeId`). Los tipos son
  1 Asiste, 2 No asiste con excusa, 3 No asiste sin excusa y 4 Llega tarde.
- Sesiones: `TrainingSession` (`TeamId`, `Name`, `Date?`, `SportEventId?`). El equipo es por temporada.
- Front ya disponible:
  - `trainingService.getSessionById` (detalle con `targets` y `blocks`);
  - `useSessionDetail`;
  - `AssessmentButtons`, `RatingBlock` (con `withHabilidades` opcional), `SessionContent`;
  - `ConfirmDialog`;
  - el bus `rffm.show_snackbar`.
- Bug: `SessionContent` lee `exerciseName`/`exerciseObjetivo`/`exerciseDurationMinutes`, pero la API
  envía `name`/`objetivo`/`durationMinutes`/`urlImage` (`SessionBlockExerciseDetail`). El tipo
  `SessionBlockExercise` del front está mal para la respuesta de `GET /sessions/{id}`.

## Decisions

### D1 · API — `GetPlayerSessionEvaluations.cs`

`GET /api/teams/{teamId}/players/{teamPlayerId}/session-evaluations` →
`PlayerSessionListItemDto[]`, ordenado por fecha descendente:

```csharp
public record PlayerSessionListItemDto(string SessionId, string Name, DateOnly Date, bool IsHeld,
    bool HasCalendarEvent, int? AssistanceTypeId, SessionEvaluationSummaryDto? Evaluation);
public record SessionEvaluationSummaryDto(int Achieved, int Partial, int NotAchieved, DateTime UpdatedAt);
```

- Incluye las sesiones del equipo con `Date != null`. `IsHeld = Date <= hoy (UTC)`.
- `AssistanceTypeId` sale de la convocatoria del jugador al `SportEventId` de la sesión (`null` si no
  hay evento o no hay convocatoria). `HasCalendarEvent = SportEventId != null`.
- Resumen calculado a partir de los `PlayerSessionEvaluations` del jugador con `TrainingSessionId` de
  esas sesiones.
- Tres consultas (sesiones, convocatorias del jugador para esos eventos y seguimientos con sus
  subprincipios) y la composición en memoria. Sin N+1.
- `Roles = Coach`, `GameModel` `Read` e `IRequireTeamMembership`. Si el jugador no es del equipo, `404`.
- Los seguimientos de sesiones borradas (`TrainingSessionId = null`) no aparecen. Queda en el backlog.

### D2 · Front — servicio y hook

`playerTrackingService.ts` añade:
- tipos `PlayerSessionListItem`, `SessionEvaluation`, `SubprincipioEvaluation`,
  `SaveSessionEvaluationItem`;
- `getSessionEvaluations(teamId, teamPlayerId)`;
- `saveSessionEvaluation(teamId, teamPlayerId, sessionId, items)` (`PUT`);
- `getSessionEvaluation(...)` (`GET`);
- `deleteSessionEvaluation(...)` (`DELETE`);
- `attendanceFromAssistanceType(hasEvent, assistanceTypeId)` → `SessionAttendance` (el mismo tipo que
  ya usa `usePlayerSessionAttendance`).

`useSessionEvaluations(teamId, teamPlayerId)` → `{ items, loading, error, reload }`.

### D3 · Front — componentes (`pages/player/components/tracking/`)

- **`SessionEvaluationList`**: tarjetas (sin tablas). Cada una muestra `dd/MM/yyyy · nombre`, un chip
  de asistencia («Asistió», «No asistió (con excusa)», «No asistió (sin excusa)», «Llegó tarde», «Sin
  registrar», «Sin evento») y el estado:
  - sin seguimiento: «Sin valorar»;
  - con seguimiento: «Valorado» con los conteos ✅ N · 🟡 N · ❌ N.
  
  Acciones:
  - sesión futura: texto «Aún no se ha celebrado» y ninguna acción;
  - sin seguimiento: «Crear»;
  - con seguimiento: «Editar» y «Eliminar».
  
  Estados de carga, error con «Reintentar» y vacío («No hay sesiones con fecha en esta temporada»).
- **`SessionEvaluationDialog`**: MUI `Dialog`, `fullScreen` por debajo de `sm`. Props: `open`,
  `teamId`, `teamPlayerId`, `sessions` (la lista), `initialSessionId?` y `onClose(saved)`.
  - Sin `initialSessionId` muestra el selector «Sesión», con las celebradas sin seguimiento.
  - Con sesión elegida, carga su detalle (`useSessionDetail`) y, si ya tiene seguimiento, el seguimiento
    (`getSessionEvaluation`) para precargar.
  - Pinta `SessionEvaluationForm`.
- **`SessionEvaluationForm`**:
  - aviso de asistencia (con `attendanceFromAssistanceType`);
  - `SessionContent` (detalle);
  - un `RatingBlock` por subprincipio de la sesión (agrupando `detail.targets`; sin habilidades), con
    valoración y comentario precargados al editar;
  - si no asistió, el comentario es obligatorio en lo valorado.
  
  «Guardar» se activa con al menos un subprincipio valorado y llama a `saveSessionEvaluation`. Si la
  sesión no tiene subprincipios, se avisa y no se muestra «Guardar».
- **`PlayerTrackingPanel`** se reescribe:
  - botón «Nuevo seguimiento», `SessionEvaluationList`, `SessionEvaluationDialog` y `ConfirmDialog`
    para eliminar;
  - al guardar o borrar: `reload` + `rffm.show_snackbar` («Seguimiento guardado» / «Seguimiento
    eliminado», o el `detail` del error).
- **Bug de `SessionContent`**: el tipo `SessionBlockExercise` se ajusta a lo que envía la API (`name`,
  `objetivo`, `durationMinutes`, `urlImage`) y `SessionContent` usa esos campos. Hay que revisar los
  demás consumidores del tipo (`sessionPrint.ts` usa `ex.exerciseName ?? exercise?.name`).

## Risks / Trade-offs

- Los componentes de la fase 1 (`ObservationForm`, `SessionObservationForm`, `PlayerObservationList`…)
  dejan de usarse desde la pestaña, pero su código sigue hasta la R5, para no mezclar el borrado con
  esta entrega.
- El selector de «Nuevo seguimiento» solo ofrece sesiones celebradas y sin seguimiento. Para editar se
  usa la tarjeta.
