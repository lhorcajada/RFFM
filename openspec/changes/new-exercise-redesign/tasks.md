## 1. Panel de datos (~2h)

- [x] Red: `ExerciseFormPanel.test.tsx` — sin Niveles ni Dibujo; Tipo como grupo de botones que llama a `setField("tipo", …)`; secciones presentes.
- [x] Green: `ExerciseFormPanel.tsx` + estilos (D3, D4, D5).

## 2. Cabecera y herramientas (~2h)

- [x] Red: `NewExercisePage.test.tsx` — título editable en la cabecera; herramientas con `aria-pressed` que alternan.
- [x] Green: `NewExercisePage.tsx` + `.module.css` (D1, D2).

## 3. Niveles por defecto (~1h)

- [x] Red: `useExerciseForm.test.ts` — cargar ejercicio sin niveles deja 2 por defecto; con niveles los conserva.
- [x] Green: `useExerciseForm.ts` (D5).

## 4. Cierre

- [x] Subir versión minor web (`npm version 1.77.0 --no-git-tag-version`).
- [x] `npx vitest run src/apps/coach/pages/trainings` + `npm run build`.
- [x] `openspec validate new-exercise-redesign --strict`.
- [x] Comprobación visual a escritorio y ~980 px.
- [ ] Commits tras confirmación del usuario.
