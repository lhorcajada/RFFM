## 1. Resumen (~1h)

- [x] Red: `SanctionsSummaryCards.progress.test.tsx` — barra y texto «cobrados de».
- [x] Green: `SanctionsSummaryCards.tsx` + `.module.css` (D1).

## 2. Tarjeta (~1h)

- [x] Red: `SanctionCard.moneyAndActions.test.tsx` — barra de pago, «Pendiente X €», botones con texto.
- [x] Green: `SanctionCard.tsx` + `.module.css` (D3, D4).

## 3. Filtros (~1h)

- [x] Red: `Sanctions.filterCounts.test.tsx` — contadores por filtro.
- [x] Green: `Sanctions.tsx` + `.module.css` (D2).

## 4. Cierre

- [x] Subir versión minor web (`npm version 1.79.0 --no-git-tag-version`).
- [x] `npx vitest run src/apps/coach/pages/sanctions` + `npm run build`.
- [x] `openspec validate coach-sanctions-redesign --strict`.
- [x] Commits tras confirmación del usuario.
