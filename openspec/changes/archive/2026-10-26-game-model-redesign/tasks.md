## 1. Vista de lectura (~2h)

- [x] Red: `components/__tests__/GameModelView.test.tsx` (fases, cambio de fase, balón parado, tarjetas, zonas, chips, notas, pendientes, vacío).
- [x] Green: `GameModelView.tsx` + `GameModelView.module.css` (D1–D7).
- [x] `GameModel.tsx` usa `GameModelView` en pantalla y mantiene `GameModelTree print` (D1, D8).
- [x] Subir versión minor web (`npm version 1.75.0 --no-git-tag-version`).
- **Verify**: `npx vitest run src/apps/coach/pages/game-model` + `npm run build`.

## 2. Cierre

- [x] `openspec validate game-model-redesign --strict`.
- [x] Comprobación visual a ~360 px y a escritorio.
- [ ] Commits tras confirmación del usuario.
