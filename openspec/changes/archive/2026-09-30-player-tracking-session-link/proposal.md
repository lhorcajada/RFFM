## Why

Entrega 1d del seguimiento del modelo de juego. La hoja de ruta está en
`docs/game-model/Seguimiento-Modelo-Juego-Diseno.md`.

Desde la 1c el entrenador valora a un jugador partiendo de una sesión, pero la observación no guarda a
qué sesión pertenece. Al revisar el historial, o al hablar con una familia, interesa ver «esto fue en la
Sesión 1 del 14/10». Además, el informe de la fase 2 cruzará observaciones con sesiones. La columna
`TrainingSessionId` ya existe desde la 1a; falta usarla.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - `POST …/observations` acepta un `trainingSessionId` opcional. Si llega, debe ser una sesión del mismo
    equipo; si no lo es, `404` `SessionNotFound`.
  - La entidad lo guarda con `ForGameModel(..., trainingSessionId)`.
  - `PlayerObservationDto` añade `trainingSessionId` y `trainingSessionName`. El nombre sale de la sesión
    actual; si la sesión se ha borrado, ambos vienen `null` (la FK es `SetNull`).
  - Sin migración.
  - **Versión**: API minor.
- **Frontend (Coach, `Front/`)**:
  - El formulario de sesión envía el `trainingSessionId` en cada observación.
  - La tarjeta de observación muestra «Sesión: {nombre}» cuando la tiene.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `player-tracking-session-link`: cada observación registrada desde una sesión queda vinculada a ella.

## Impact

- `Back/ExtractionApi`:
  - `Domain/Entities/TeamPlayers/PlayerModelObservation.cs`;
  - `Features/Coaches/PlayerTracking/CreatePlayerObservation.cs` y `GetPlayerObservations.cs`;
  - `Directory.Build.props`.
- `Front/`:
  - `services/playerTrackingService.ts`;
  - `components/tracking/SessionObservationForm.tsx` y `PlayerObservationList.tsx`;
  - `package.json`.
- **Fuera de alcance**: cambiar la sesión de una observación ya creada (llegará con editar, 1e).
