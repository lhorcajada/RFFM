## 1. Tests en rojo (~1h)

- [x] Red: `Injured.tabs.test.tsx` (tablist, aria-selected).
- [x] Red: `InjuryProtocolPanel.test.tsx` (título, chip, barra, solo lectura, actualización).
- [x] Red: `InjuryProtocolDocuments.test.tsx` (zona de subida, PDF, fecha, botones con texto).

## 2. Implementación (~2h)

- [x] Green: selector segmentado en `Injured.tsx` + `.module.css` (D2).
- [x] Green: `InjuryProtocolPanel.tsx` + `.module.css` (D3).
- [x] Green: `InjuryProtocolDocuments.tsx` + `.module.css` (D4).
- [x] Subir la versión minor de la web (`npm version 1.71.0 --no-git-tag-version`).
- **Verify**: `npx vitest run src/apps/coach/pages/injured` + `npm run build`.

## 3. Cierre

- [x] `openspec validate coach-injured-protocol-docs-redesign --strict`.
- [ ] Comprobación visual a ~360 px y a escritorio.
- [ ] Commits tras confirmación del usuario.
