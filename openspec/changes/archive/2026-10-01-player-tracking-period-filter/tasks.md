## 1. Backend (~0,5h)

- [x] Red: `PlayerObservationHandlerTests`: `from`/`to` inclusivos; sin parámetros, todas.
- [x] Red: validator de la query: `from > to` es inválido.
- [x] Green: `GetPlayerObservations` (query, endpoint, validator y filtro) (design.md D1).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet test` (PowerShell, salida dentro del repo).

## 2. Frontend (~1h)

- [x] Red: `periodStart` (fecha fija), servicio con `from`, `usePlayerObservations` (recarga al cambiar `from`; `create` dentro o fuera del periodo).
- [x] Red: `PlayerTrackingPanel.test.tsx`:
  - «Último mes» por defecto con `from`;
  - «Todo» pide sin `from`;
  - «Observaciones (N)»;
  - aviso al guardar fuera del periodo.
- [x] Green: servicio, hook y panel (D2).
- [x] Subir la versión minor de la web.
- **Verify**: `npm run build` + `npx vitest run --maxWorkers=2`.

## 3. Cierre

- [x] `openspec validate player-tracking-period-filter --strict`.
- [x] Comprobación visual a ~360 px.
- [x] Commits tras confirmación del usuario.
