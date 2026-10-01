## Context

- `PlayerModelObservation` (1a) ya tiene las columnas `Kind` (SmartEnum, hoy solo `GameModel`) y
  `AttitudeKey` (nullable, 50 caracteres). Las etiquetas de subprincipio son nullable.
- `CreatePlayerObservation` exige `SubprincipioId` y crea con `ForGameModel`.
- El DTO se construye con `ToDto(observation, sessionName)`.
- En el front, `SessionObservationForm` pinta un `fieldset` por subprincipio con `AssessmentButtons` y un
  comentario. Si la sesión no tiene targets, muestra un aviso y ni bloques ni «Guardar».

## Decisions

### D1 · Dominio

- `ObservationKind.Attitude = new(nameof(Attitude), 2)`.
- `AttitudeTraits` es un catálogo estático y cerrado, `IReadOnlyDictionary<string, string>` (clave →
  etiqueta en español), en el orden de la tabla:

  | Clave | Etiqueta |
  |---|---|
  | `defensive-commitment` | Implicación en tareas defensivas |
  | `patience` | Paciencia con balón |
  | `courage-in-duels` | Valentía en los duelos |
  | `off-ball-effort` | Esfuerzo sin balón |
  | `listening` | Escucha y aplicación de consignas |
  | `focus` | Concentración durante la tarea |

- `ForAttitude(teamPlayerId, teamId, date, attitudeKey, assessment, comment, createdByUserId, trainingSessionId = null)`:
  - mismas validaciones de ids, valoración y comentario que `ForGameModel`;
  - `attitudeKey` debe estar en el catálogo (`ArgumentException`);
  - el subprincipio y sus etiquetas quedan en `null`.
- `Update` no cambia: sirve para los dos tipos.

### D2 · API

- `CreatePlayerObservation.Command`:
  - `string Kind` (por defecto `"GameModel"`, para compatibilidad);
  - `string? SubprincipioId` (antes obligatorio);
  - `string? AttitudeKey`.
- Validator:
  - `Kind` es un nombre de `ObservationKind`;
  - con `GameModel`, `SubprincipioId` es obligatorio y `AttitudeKey` debe venir vacío;
  - con `Attitude`, `AttitudeKey` debe estar en el catálogo y `SubprincipioId` debe venir vacío.
- Handler:
  - `GameModel` → flujo actual;
  - `Attitude` → `ForAttitude`, sin consultar subprincipios.
  - La validación de la sesión es común a los dos.
- `PlayerObservationDto` añade al final `string? AttitudeKey` y `string? AttitudeLabel` (del catálogo). Si
  una clave dejara de existir en el catálogo, `AttitudeLabel` devuelve la propia clave.

### D3 · Front

- Tipos:
  - `ObservationKind = "GameModel" | "Attitude"`;
  - `PlayerObservation` añade `attitudeKey` y `attitudeLabel`;
  - `CreatePlayerObservationRequest` pasa a tener `kind?`, `subprincipioId?` y `attitudeKey?`.
- `ATTITUDE_TRAITS: { key, label }[]` en `playerTrackingService.ts`, en el mismo orden que el backend. Es
  una duplicación consciente (`frontend-architecture.md` §1); el backend valida las claves y devuelve la
  etiqueta en el DTO.
- `SessionObservationForm`:
  - Los borradores pasan a indexarse por clave de bloque: `sub:{subprincipioId}` o
    `att:{attitudeKey}`.
  - Tras los subprincipios se muestra una sección `<section aria-label="Actitud">` con título «Actitud»
    y un `fieldset` por rasgo (`aria-label` = etiqueta), cada uno con `AssessmentButtons`
    (`ariaLabel="Valoración de {etiqueta}"`) y el comentario «Comentario sobre {etiqueta}».
  - La obligación de comentar si el jugador no asistió se aplica también a los rasgos.
  - Las requests de actitud son
    `{ kind: "Attitude", attitudeKey, date, assessment, comment, trainingSessionId }`.
  - Las de subprincipio añaden `kind: "GameModel"`.
  - Sesión sin targets: se mantiene el aviso, pero ahora se muestran la sección «Actitud» y «Guardar».
- `PlayerObservationCard`:
  - si `kind === "Attitude"`, la línea de contexto es «Actitud» y el título es `attitudeLabel`;
  - si no, como hasta ahora.
- `PlayerTrackingPanel`: la confirmación de borrado usa `attitudeLabel ?? subprincipioLabel`.

## Tests

- Dominio:
  - `ForAttitude` guarda la clave, el tipo y la sesión, y deja el subprincipio en `null`;
  - clave desconocida → excepción;
  - el catálogo tiene los 6 rasgos en orden.
- Validator: combinaciones de tipo, subprincipio y actitud.
- Handler (Postgres):
  - alta de actitud con sesión → DTO con `attitudeLabel`;
  - el listado mezcla los dos tipos.
- Front:
  - formulario de sesión con la sección Actitud;
  - request de actitud;
  - comentario obligatorio si no asistió;
  - sesión sin targets permite valorar actitud;
  - tarjeta de actitud.
