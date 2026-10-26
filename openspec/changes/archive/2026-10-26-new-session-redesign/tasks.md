## 1. Página (~2h)

- [x] Red: `NewSessionPage.layout.test.tsx` — secciones «Datos de la sesión», «Cuándo y dónde» y «Resumen»; el resumen cuenta bloques y ejercicios.
- [x] Green: `NewSessionPage.tsx` + `.module.css` (D1–D3).

## 2. Bloques (~1h)

- [x] Red: `SessionBlockEditor.test.tsx` — bloque vacío muestra aviso; la insignia muestra el número de orden.
- [x] Green: `SessionBlockEditor.tsx` + `.module.css` (D4).

## 3. Cierre

- [x] Subir versión minor web (`npm version 1.78.0 --no-git-tag-version`).
- [x] `npx vitest run src/apps/coach/pages/trainings` + `npm run build`.
- [x] `openspec validate new-session-redesign --strict`.
- [x] Commits tras confirmación del usuario.
