## 1. Backend (~1h)

- [x] Red: `GetSessionsHandlerTests`: filtro por `seasonId` (plan de la temporada / de otra, libre dentro y fuera de fechas, sin fecha, sin `seasonId`).
- [x] Red: `GetSessionsHandlerTests`: jerarquía (micro/meso/macro) en el item.
- [x] Green: `GetSessions` (query, endpoint, filtro y jerarquía) (design.md D1, D2).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet build` + `dotnet test --filter GetSessionsHandlerTests`.

## 2. Frontend: datos y agrupación (~1h)

- [x] Red: `sessionsGrouping.test.ts` (D4).
- [x] Red: `trainingService` envía `seasonId` (D3).
- [x] Green: tipos, servicio y `groupSessions`.

## 3. Frontend: UI (~2h)

- [x] Red: `SessionsList.test.tsx` (cabeceras, libres, «Ver más»).
- [x] Red: `Trainings.sessionsSeasonFilter.test.tsx` (temporada por defecto, cambio de temporada) y actualizar el test de orden.
- [x] Green: `SessionsList` + CSS Module y selector de temporada en `Trainings.tsx` (D5, D6).
- [x] Subir la versión minor de la web.
- **Verify**: `npm run build` + `npx vitest run --maxWorkers=2`.

## 4. Cierre

- [x] `openspec validate training-sessions-list-grouping --strict`.
- [x] Comprobación visual a ~360 px.
- [x] Commits tras confirmación del usuario.
