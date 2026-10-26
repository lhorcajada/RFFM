## 1. Lógica pura (~0.5h)

- [x] Red: `injuryRecovery.test.ts` (D3).
- [x] Green: `injuryRecovery.ts`.

## 2. Pestaña Lesionados (~2h)

- [x] Red: actualizar `InjuredPlayersList.test.tsx` (Actualizar, contadores, filtros, vacíos, barra).
- [x] Green: `InjuredPlayersList.tsx` + `.module.css` (D1, D2, D4, D5).
- [x] Subir la versión minor de la web (`npm version 1.70.0 --no-git-tag-version`).
- **Verify**: `npx vitest run src/apps/coach/pages/injured` + `npm run build`.

## 3. Cierre

- [x] `openspec validate coach-injured-redesign --strict`.
- [ ] Comprobación visual a ~360 px y a escritorio.
- [ ] Commits tras confirmación del usuario.
