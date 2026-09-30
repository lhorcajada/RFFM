## 1. Backend (~1,5h)

- [x] Red: `PlayerModelObservationTests`: `Update` cambia la valoración y el comentario, normaliza el comentario, rechaza uno de más de 500 caracteres y una valoración nula.
- [x] Red: validators + contrato de permisos de `UpdatePlayerObservation` y `DeletePlayerObservation`.
- [x] Red: `PlayerObservationHandlerTests` (Postgres):
  - actualizar devuelve el DTO con el nombre de la sesión;
  - actualizar la de otro jugador → `NotFoundException`;
  - borrar la elimina;
  - borrar una inexistente → `NotFoundException`.
- [x] Green: `Update` en el dominio, `UpdatePlayerObservation.cs`, `DeletePlayerObservation.cs` y `ErrorCodes.PlayerObservationNotFound` (design.md D1, D2).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet build` + `dotnet test`.

## 2. Frontend (~1,5h)

- [x] Red: servicio (`PUT`/`DELETE`) y `usePlayerObservations` (`update` sustituye, `remove` quita).
- [x] Red: `PlayerObservationCard.test.tsx`: editar precarga los valores, cancelar no envía nada, guardar llama a `onUpdate` y sale de edición, y un fallo mantiene la edición.
- [x] Red: `PlayerTrackingPanel.test.tsx`: eliminar pide confirmación, cancelar no borra, confirmar borra y avisa, y editar avisa «Observación actualizada».
- [x] Green: servicio, hook, `PlayerObservationCard`, `PlayerObservationList` y `PlayerTrackingPanel` (D3).
- [x] Subir la versión minor de la web.
- **Verify**: `npm run build` + `npm run test`.

## 3. Cierre

- [x] `openspec validate player-tracking-edit-delete --strict`.
- [x] Comprobación visual a ~360 px.
- [x] Commits tras confirmación del usuario.
