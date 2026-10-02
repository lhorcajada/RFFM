## Why

Primera entrega (R1) del rediseño «seguimiento por sesión» del seguimiento del modelo de juego por
jugador. El contexto y las decisiones del usuario están en la planificación local.

Tras probar la fase 1, el entrenador concluye que una lista única de observaciones sueltas (cada una con
su fecha y su subprincipio) es inmanejable. Él piensa por **sesión**: «en la sesión del 14/10, este
jugador, en cada subprincipio que trabajamos, lo hace / a veces / no lo hace». El nuevo modelo es **un
seguimiento por jugador y sesión** con una valoración por subprincipio trabajado en ella. La fecha y los
subprincipios salen de la sesión, no se eligen.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Nueva entidad `PlayerSessionEvaluation`: un seguimiento por (jugador, sesión) con sus
    `SubprincipioEvaluation`.
    - Cada valoración guarda la valoración (Lo hace / A veces / No lo hace), un comentario y las
      etiquetas del subprincipio.
    - Se guardan también el nombre y la fecha de la sesión, para que el seguimiento sobreviva si se
      borra la sesión o se cambia el modelo de juego.
  - Migración `AddPlayerSessionEvaluations` (dos tablas nuevas).
  - Endpoints por sesión en `/api/teams/{teamId}/players/{teamPlayerId}/session-evaluations/{sessionId}`:
    - `PUT`: crea o sustituye el seguimiento. Solo admite subprincipios trabajados en la sesión y
      sesiones ya celebradas.
    - `GET`: detalle.
    - `DELETE`: elimina.
  - Solo el rol Coach, con el permiso `GameModel` y pertenencia al equipo, como el resto del
    seguimiento.
  - **Versión**: API minor.

## Capabilities

### New Capabilities
- `player-session-evaluation`: seguimiento de un jugador por sesión con la valoración de cada subprincipio
  trabajado.

## Impact

- `Back/ExtractionApi`:
  - `Domain/Entities/TeamPlayers/PlayerSessionEvaluation.cs`, `SubprincipioEvaluation.cs` y
    `SubprincipioSnapshot.cs` (este se mueve fuera de `PlayerModelObservation.cs`);
  - configuraciones EF, `AppDbContext` y la migración;
  - `Features/Coaches/PlayerTracking/SaveSessionEvaluation.cs`, `GetSessionEvaluation.cs` y
    `DeleteSessionEvaluation.cs`;
  - `ErrorCodes`.
- **Fuera de alcance**:
  - la lista de sesiones con asistencia y estado (R2);
  - la web (R2–R3);
  - los comentarios evaluables (R4);
  - borrar el modelo antiguo de observaciones (R5).
