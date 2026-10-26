## 1. Backend: endpoint de liga (~3h)

- [x] Red: tests de la calculadora `GetLeaguePlayerStats.Calculator` (goles propios, minutos, titularidades, tarjetas, convocatorias sin desconvocados, jugador sin datos, orden) (D2, D3). El handler queda sin test de integración: Postgres de tests no disponible (sin Docker).
- [x] Green: `Features/Coaches/Players/Queries/GetLeaguePlayerStats.cs` (endpoint, query, DTO, handler).
- **Verify**: `dotnet test --filter GetLeaguePlayerStats`.

## 2. Servicio frontend (~1h)

- [x] Red: `services/__tests__/leagueStatsService.test.ts`: devuelve los datos; en error devuelve `[]` (D4).
- [x] Green: `services/leagueStatsService.ts`.
- **Verify**: `npx vitest run src/apps/coach/services/__tests__/leagueStatsService`.

## 3. Cromo con bloque «Solo liga» (~2h)

- [x] Red: `components/__tests__/PlayerCromo.leagueStats.test.tsx`: etiqueta «Solo liga», seis cifras, ceros visibles, sin `leagueStats` no hay bloque; ya no se muestra la fila de temporada.
- [x] Green: `PlayerCromo.tsx` + CSS Module (prop `leagueStats` sustituye a `seasonStats`).
- **Verify**: `npx vitest run src/apps/coach/pages/squad/components/__tests__/PlayerCromo`.

## 4. Página y aviso (~2h)

- [x] Red: `__tests__/Squad.leagueStats.test.tsx`: aviso visible para entrenador, solo el propio jugador para jugador/familia, nada para aficionado, fallo de carga no rompe la página.
- [x] Green: `Squad.tsx` (carga no bloqueante, visibilidad, aviso).
- **Verify**: `npx vitest run src/apps/coach/pages/squad`.

## 5. Cierre (~1h)

- [x] Subir versión minor: `Back/ExtractionApi/Directory.Build.props` y `Front/package.json`.
- [x] `dotnet build` + `dotnet test` y `npm run build` + `npx vitest run --maxWorkers=2`.
- [x] `openspec validate squad-league-stats --strict`.
- [x] Comprobación visual a ~360 px y en escritorio.
- [ ] Commits tras confirmación del usuario (API y web por separado).
