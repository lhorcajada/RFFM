## Context

- `PlayerModelObservation` (1a) tiene `Assessment` y `Comment`. La normalización del comentario (recorte,
  en blanco → `null`, máximo 500 caracteres) vive en `NormalizeComment`.
- Patrón de features: `CreatePlayerObservation` / `GetPlayerObservations` con
  `PlayerTrackingGuards.EnsurePlayerInTeamAsync`, `ICommand<T>` y validator anidado.
- El DTO incluye `TrainingSessionName`, que sale de un *join* con la sesión.
- Front: `usePlayerObservations` expone `create`, y `PlayerObservationList` pinta las tarjetas.

## Decisions

### D1 · Dominio

`Update(ObservationAssessment assessment, string? comment)`:
- exige una valoración (no nula);
- reutiliza `NormalizeComment`.

Fecha, subprincipio, sesión y tipo no se modifican: son el «qué y cuándo» de la observación. Si están
mal, se borra y se crea de nuevo.

### D2 · API — `Features/Coaches/PlayerTracking/`

**`UpdatePlayerObservation.cs`**: `PUT /api/teams/{teamId}/players/{teamPlayerId}/observations/{observationId}`.
- `Command : RFFM.Api.Common.ICommand<PlayerObservationDto>`, con `IRequireFeaturePermission`
  (`GameModel` / `ReadWrite`) e `IRequireTeamMembership`.
- Campos: `TeamId`, `TeamPlayerId`, `ObservationId`, `Assessment`, `Comment`.
- Validator: `Assessment` es un nombre de `ObservationAssessment`; `Comment` tiene 500 caracteres como
  máximo.
- Handler:
  1. `EnsurePlayerInTeamAsync`.
  2. Carga la observación con
     `o.Id == ObservationId && o.TeamPlayerId == TeamPlayerId && o.TeamId == TeamId`. Si no existe,
     `NotFoundException(..., ErrorCodes.PlayerObservationNotFound)`.
  3. `Update` y `SaveChangesAsync`.
  4. Devuelve `ToDto(observation, nombreSesión)`, con el nombre de la sesión consultado por
     `TrainingSessionId`.

**`DeletePlayerObservation.cs`**: `DELETE …/observations/{observationId}` → `204`.
- Mismos permisos.
- `Command : RFFM.Api.Common.ICommand` + validator de ids no vacíos.
- Misma búsqueda y mismo `404`; después `Remove` y `SaveChangesAsync`.

### D3 · Front

- **Servicio**:
  - `updatePlayerObservation(teamId, teamPlayerId, id, { assessment, comment })` → `PlayerObservation`;
  - `deletePlayerObservation(teamId, teamPlayerId, id)`.
- **`usePlayerObservations`** añade:
  - `update(id, request)`: sustituye la observación en la lista con la respuesta;
  - `remove(id)`: la quita de la lista.
  
  Ambas propagan el error.
- **`PlayerObservationCard.tsx`** (+ `.module.css`): se extrae de la lista la tarjeta de una observación.
  - Props: `observation`, `onUpdate(id, request): Promise<void>` y `onDelete(observation)`.
  - En modo lectura muestra lo mismo que ahora, más dos `IconButton`: «Editar observación» y
    «Eliminar observación».
  - En modo edición muestra `AssessmentButtons` y el comentario precargados, más «Guardar» y
    «Cancelar». «Guardar» se deshabilita sin valoración o mientras guarda. Si el guardado falla, sigue
    en modo edición.
- **`PlayerObservationList`**:
  - recibe `onUpdate` y `onDelete`, y pinta una `PlayerObservationCard` por observación;
  - la lista sigue siendo de tarjetas, sin tablas.
- **`PlayerTrackingPanel`**:
  - Estado `deleteTarget` + `ConfirmDialog` con el título «Eliminar observación», la descripción
    «¿Eliminar la observación de «{subprincipio}» del {dd/MM/yyyy}? Esta acción no se puede
    deshacer.», el botón «Eliminar» y `processing` mientras borra (patrón de `News.tsx`).
  - Avisos por el bus:
    - «Observación actualizada» o «Observación eliminada» (`success`);
    - en error, el `detail` del ProblemDetails o un mensaje por defecto.

## Tests

- Dominio: `Update` cambia la valoración y el comentario, normaliza el comentario, rechaza uno de más
  de 500 caracteres y rechaza una valoración nula.
- Validators de los dos comandos, y contrato de permisos (`GameModel` `ReadWrite` + membresía).
- Handlers (Postgres):
  - actualizar devuelve el DTO con el nombre de la sesión;
  - observación de otro jugador → `404`;
  - borrar la elimina;
  - borrar una inexistente → `404`.
- Front:
  - servicio;
  - hook (`update`, `remove`);
  - tarjeta (editar, cancelar, guardar y fallo);
  - panel (confirmación antes de borrar, cancelar no borra, avisos).
