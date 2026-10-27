## 1. Resumen de liga (~1h)

- [x] Red: `RivalStats.leagueSummary.test.tsx` — equipos y jugadores con estado Completed; sin resumen mientras se genera.
- [x] Green: `RivalStats.tsx` + `.module.css` (D1).

## 2. Tarjetas y simulación (~1h)

- [x] `RivalTeamCard`, `RivalPlayerCard`, `RivalSimulation`, `MatchPredictionCard`, `ProjectedStandingCard` `.module.css` (D2, D3, D4).

## 3. Cierre

- [x] Subir versión minor web (`npm version 1.81.0 --no-git-tag-version`).
- [x] `npx vitest run src/apps/coach/pages/rivalStats` + `npm run build`.
- [x] `openspec validate rival-stats-redesign --strict`.
- [x] Commits tras confirmación del usuario.
