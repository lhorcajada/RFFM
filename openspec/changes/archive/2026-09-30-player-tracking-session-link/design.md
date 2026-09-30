## Context

- `PlayerModelObservation.TrainingSessionId` ya existe (columna nullable, FK a `SessionTrainings` con
  `SetNull`), pero `ForGameModel` no la recibe.
- `TrainingSession` tiene `TeamId` y `Name`. `ErrorCodes.SessionNotFound` ya existe.
- `GetPlayerObservations` lee las observaciones con `AsNoTracking` y las mapea con `ToDto`.
- En el front, `SessionObservationForm` construye las requests con la fecha de la sesión.

## Decisions

### D1 · Dominio

`ForGameModel(..., string createdByUserId, string? trainingSessionId = null)`. Un valor en blanco se
guarda como `null`. La pertenencia al equipo **no** la valida el dominio: requiere BD y la valida el
handler (regla de `dotnet.md` §4.3).

### D2 · API

- `CreatePlayerObservation.Command`: `string? TrainingSessionId`.
- En el handler, si viene informado, se comprueba con
  `db.TrainingSessions.AnyAsync(s => s.Id == id && s.TeamId == request.TeamId)`. Si no se cumple, se
  lanza `NotFoundException(..., ErrorCodes.SessionNotFound)` y no se guarda nada.
- `PlayerObservationDto` añade dos campos al final: `string? TrainingSessionId` y
  `string? TrainingSessionName`.
  - `GetPlayerObservations` rellena el nombre con un *left join* a `TrainingSessions`, en una sola
    consulta.
  - `CreatePlayerObservation` devuelve el nombre que ya tiene de la validación (se proyecta `Name` en
    lugar de `AnyAsync`).
- `ToDto(observation, sessionName)`.

### D3 · Front

- `CreatePlayerObservationRequest.trainingSessionId?: string | null`.
- `PlayerObservation` añade `trainingSessionId: string | null` y `trainingSessionName: string | null`.
- `SessionObservationForm` incluye `trainingSessionId: session.id` en cada request.
- `PlayerObservationList`: si hay `trainingSessionName`, muestra la línea «Sesión: {nombre}» bajo el
  comentario, en texto secundario.

## Tests

- Dominio: `ForGameModel` guarda la sesión, y un valor en blanco se guarda como `null`.
- Handler (Postgres):
  - guarda la sesión y devuelve su nombre;
  - sesión de otro equipo → `NotFoundException` y nada guardado;
  - el listado devuelve el nombre de la sesión, o `null` si la observación no tiene sesión.
- Front:
  - `SessionObservationForm` envía `trainingSessionId`;
  - `PlayerObservationList` muestra «Sesión: Sesión 1» y no muestra la línea si no hay sesión.
