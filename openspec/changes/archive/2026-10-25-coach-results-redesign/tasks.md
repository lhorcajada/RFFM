## 1. Lógica pura (~1h)

- [x] Red: `utils/__tests__/ownMatch.test.ts`: `isOwnMatch`, `isPlayed`, `isBye`, `ownOutcome` (local/visitante, V/E/D, sin jugar), `splitRound` (propio, descanso propio, sin código) y `seasonSummary` (D1).
- [x] Green: `utils/ownMatch.ts`.
- **Verify**: `npx vitest run src/apps/coach/pages/results/utils`.

## 2. Temporada del equipo (~1h)

- [x] Red: `hooks/__tests__/useOwnTeamSeason.test.tsx`: una llamada a `getCalendar` con temporada, competición y grupo; `ownByRound` por número de jornada (incluido «bye»); sin parámetros no llama; error expuesto (D2).
- [x] Green: `hooks/useOwnTeamSeason.ts`.
- **Verify**: `npx vitest run src/apps/coach/pages/results/hooks`.

## 3. Componentes (~3h)

- [x] Red: `components/__tests__/RoundRail.test.tsx`: navegación «nav Jornadas», anterior/siguiente y extremos, `aria-pressed`, nombres accesibles con resultado, «Jornada actual» (D4).
- [x] Red: `components/__tests__/OwnMatchCard.test.tsx`: jugado local/visitante (Victoria/Derrota con marcador propio), sin jugar con hora, «Descansa», «Ver acta» (D5).
- [x] Red: `components/__tests__/RoundMatchList.test.tsx`: tarjetas con marcador u hora y «Ver acta» (D6).
- [x] Red: `components/__tests__/SeasonPanel.test.tsx`: balance, filas, selección, error (D7).
- [x] Green: `RoundRail`, `OwnMatchCard`, `RoundMatchList`, `SeasonPanel` + CSS Modules y tokens en `muiGameTheme.ts` (D4–D8).
- **Verify**: `npx vitest run src/apps/coach/pages/results/components`.

## 4. Página (~2h)

- [x] Red: actualizar `__tests__/Results.test.tsx`: sin pestañas, barra «Jornadas», «Tu partido» primero y fuera del resto, «Partidos de la jornada» sin código de equipo, prioridad de la jornada cargada (D3), panel solo en escritorio.
- [x] Green: `Results.tsx` + `Results.module.css` (layout con `flex-wrap`, D3, D7).
- **Verify**: `npx vitest run src/apps/coach/pages/results`.

## 5. Ajustes tras revisión (~2h)

- [x] Red → Green: `TeamCrest` (escudo con `resolveShield`, iniciales sin escudo) en «Tu partido», «Resto de la jornada» y «Tu temporada»; nombres completos sin recortar (D9).
- [x] Red → Green: `isSuspended` (estado «3»), etiqueta «Suspendido» en tarjeta propia, resto, barra («Susp.») y panel; no cuenta como jugado (D10).
- [x] «Tu temporada» sin scroll propio (D7).
- [x] Red → Green: avisos de resultados como campana en la barra de acciones con panel emergente (D11).

## 6. Cierre (~1h)

- [x] Subir la versión minor de la web (`Front/package.json`).
- [x] `npm run build` + `npx vitest run --maxWorkers=2`.
- [x] `openspec validate coach-results-redesign --strict`.
- [x] Comprobación visual a ~360 px y en escritorio.
- [x] Commits tras confirmación del usuario.
