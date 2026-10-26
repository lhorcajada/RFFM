## 1. Etapa 1 · Estructura común + pestaña Plantilla (~6h)

- [x] Red: `__tests__/Squad.roster.test.tsx` (bloque «pestañas»): las pestañas visibles según rol (aficionado sin Valoraciones/Estadísticas/Ranking/Ideal; jugador sin Ranking/Ideal) y sin `variant="scrollable"` (no hay botones de scroll) (D2).
- [x] Red: `components/__tests__/LeagueStatsBlock.test.tsx` (los casos de «Solo liga» de `PlayerCromo.leagueStats.test.tsx`, que se elimina) y `PlayerCromo` ya no admite `leagueStats` (D3).
- [x] Red: `components/__tests__/SquadPlayerCard.test.tsx`: nombre/alias, dorsal, posición, chip «Lesionado» y acción de quitar lesión, barras Ef/R/C, bloque «Solo liga», enlace a la ficha (D3).
- [x] Red: `components/__tests__/SquadSummary.test.tsx` y `SquadFilters.test.tsx`: total y lesionados; recuento por posición en los chips; chip filtra; buscador por nombre/alias; «Quitar filtros» (D4).
- [x] Green: `Squad.tsx` + `Squad.module.css` (pestañas con `flex-wrap`), `SquadPlayerCard`, `LeagueStatsBlock`, `SquadSummary`, `SquadFilters`; actualizar `Squad.leagueStats.test.tsx` y `Squad.plantillaFormBars.test.tsx`.
- **Verify**: `npx vitest run src/apps/coach/pages/squad`.

## 2. Etapa 2 · Valoraciones (~4h)

- [x] Red: `SquadRatings.cards.test.tsx`: tarjeta con media y cuatro barras; «Ver subvaloraciones» abre el panel en la tarjeta y cierra la anterior; chips de orden; botones de la barra (D5).
- [x] Green: `SquadRatings.tsx` + CSS Module.
- **Verify**: `npx vitest run src/apps/coach/pages/squad/components/__tests__/SquadRatings`.

## 3. Etapa 3 · Estadísticas (~3h)

- [x] Red: la lógica (orden, filtro, PDF, métricas) no cambia y sus tests existentes (`SquadStatistics.*.test.tsx`) siguen en verde; la etapa es solo de maquetación (D6).
- [x] Green: `SquadStatistics.tsx` + CSS Module.
- **Verify**: `npx vitest run src/apps/coach/pages/squad/components/__tests__/SquadStatistics`.

## 4. Etapa 4 · Ranking (~3h)

- [x] Red: `SquadRanking.layout.test.tsx`: podio de tres, filas `#n`, empates, «Sin valorar» con «Valorar» (D7).
- [x] Green: `SquadRanking.tsx` + CSS Module.
- **Verify**: `npx vitest run src/apps/coach/pages/squad/components/__tests__/SquadRanking`.

## 5. Etapa 5 · Alineación ideal (~3h)

- [x] Red: `IdealLineup.layout.test.tsx`: selector de sistema accesible (`aria-pressed`), lista de jugadores con insignias (D8).
- [x] Green: `IdealLineup.tsx` (marcado de cabecera) + `IdealLineup.module.css`.
- **Verify**: `npx vitest run src/apps/coach/pages/squad src/apps/coach/pages/convocations`.

## 6. Cierre de cada etapa (~1h)

- [x] Subir versión minor de la web (`Front/package.json` y `package-lock.json`): 1.69.0 (las cinco etapas se entregan juntas).
- [x] `npm run build` + `npx vitest run --maxWorkers=2`.
- [x] `openspec validate squad-tabs-redesign --strict`.
- [x] Comprobación visual a ~360 px y en escritorio, sin scroll horizontal.
- [x] Commit tras confirmación del usuario.
