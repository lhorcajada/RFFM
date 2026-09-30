## Why

Entrega 1e del seguimiento del modelo de juego. La hoja de ruta está en
`docs/game-model/Seguimiento-Modelo-Juego-Diseno.md`.

Hoy una observación mal registrada (valoración equivocada, un comentario que hay que matizar o una
observación en el jugador que no era) no se puede corregir. Si estas observaciones van a servir para
hablar con las familias, tienen que poder mantenerse correctas.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - `PUT /api/teams/{teamId}/players/{teamPlayerId}/observations/{observationId}` cambia la
    **valoración y el comentario** y devuelve `200` con la observación.
  - `DELETE` de la misma ruta elimina la observación y devuelve `204`.
  - Ambos exigen el permiso `GameModel` `ReadWrite` y pertenencia al equipo. Si la observación no es de
    ese jugador y equipo, responden `404`.
  - **Versión**: API minor.
- **Frontend (Coach, `Front/`)**, en cada tarjeta de observación:
  - **«Editar»**: edición en la propia tarjeta con los tres botones de valoración y el comentario, más
    «Guardar» y «Cancelar».
  - **«Eliminar»**: pide confirmación con `ConfirmDialog` («Esta acción no se puede deshacer») y quita
    la tarjeta de la lista.
  - Avisa del resultado por `rffm.show_snackbar`.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `player-tracking-edit-delete`: corregir y eliminar observaciones.

## Impact

- `Back/ExtractionApi`:
  - `Domain/Entities/TeamPlayers/PlayerModelObservation.cs` (`Update`);
  - `Features/Coaches/PlayerTracking/UpdatePlayerObservation.cs` y `DeletePlayerObservation.cs`
    (nuevos);
  - `ErrorCodes.PlayerObservationNotFound`.
- `Front/`:
  - `playerTrackingService.ts`;
  - `usePlayerObservations.ts`;
  - `PlayerObservationList.tsx`, un `PlayerObservationCard.tsx` nuevo;
  - `PlayerTrackingPanel.tsx`.
- **Fuera de alcance**:
  - cambiar la fecha, el subprincipio o la sesión de una observación (se borra y se crea de nuevo);
  - historial de cambios.
