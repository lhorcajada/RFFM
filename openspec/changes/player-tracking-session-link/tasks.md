## 1. Backend (~1h)

- [x] Red: `PlayerModelObservationTests`: guarda `trainingSessionId`; un valor en blanco se guarda como `null`.
- [x] Red: `PlayerObservationHandlerTests` (Postgres):
  - alta con sesión del equipo → nombre en el DTO;
  - sesión de otro equipo → `NotFoundException` y nada guardado;
  - listado con nombre de sesión, o `null` si no tiene.
- [x] Green: dominio, `CreatePlayerObservation` y `GetPlayerObservations` (design.md D1, D2).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet build` + `dotnet test` (PowerShell, salida dentro del repo).

## 2. Frontend (~0,5h)

- [x] Red: `SessionObservationForm.test.tsx` envía `trainingSessionId`; `PlayerObservationList.test.tsx` muestra y oculta «Sesión: …».
- [x] Green: tipos del servicio, formulario de sesión y tarjeta (D3).
- [x] Subir la versión minor de la web.
- **Verify**: `npm run build` + `npm run test`.

## 3. Cierre

- [x] `openspec validate player-tracking-session-link --strict`.
- [ ] Commits `feat(mcp-api)` y `feat(front)` tras confirmación del usuario.
