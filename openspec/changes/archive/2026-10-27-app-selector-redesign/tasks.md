## 1. Cabecera y tarjetas (~1h)

- [x] Red: `AppSelector.redesign.test.tsx` — cabecera, línea de acceso y «Entrar».
- [x] Green: `AppCard.tsx` (prop `access`, pie) + `AppSelector.tsx` (cabecera, D1, D2).

## 2. Estilos (~1h)

- [x] `AppSelector.module.css`: recuadro de icono, pie, cabecera y fila móvil (D3, D4).

## 3. Cabecera sin indicadores

- [x] Red/Green: `AppHeader.hideIndicators.test.tsx` + prop `hideIndicators` (D5).

## 4. Cierre

- [x] Subir versión minor web (`npm version 1.80.0 --no-git-tag-version`).
- [x] `npx vitest run src/shared/pages/AppSelector` + `npm run build`.
- [x] `openspec validate app-selector-redesign --strict`.
- [ ] Commits tras confirmación del usuario.
