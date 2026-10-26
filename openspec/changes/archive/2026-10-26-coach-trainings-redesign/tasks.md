## 1. Pestañas (~1h)

- [x] Red: test en `Trainings` de que las tres pestañas existen con sus nombres y la activa tiene `aria-selected`.
- [x] Green: restilo segmentado en `Trainings.module.css` (D2).

## 2. Planificación (~2h)

- [x] Red: `SeasonPlanView.test.tsx` — resumen (macrociclos, sesiones, semanas sin sesiones), «Semana actual», sin resumen sin plan.
- [x] Green: `SeasonPlanView.tsx` + `.module.css` (D3, D4).

## 3. Ejercicios (~1h)

- [x] Red: test del recuento («N ejercicios», singular/plural) en `Trainings.exerciseTipoFilter.test.tsx` o archivo nuevo.
- [x] Green: recuento en `Trainings.tsx`; área táctil 44 px en `ExerciseCromo.module.css` (D5).

## 4. Sesiones (~2h)

- [x] Red: `SessionsList.test.tsx` (bloque de fecha) y `Trainings.bulkDeleteSessions.test.tsx` («N sesiones seleccionadas»).
- [x] Green: `SessionsList.tsx` + `.module.css`, barra de selección en `Trainings.tsx` (D6).

## 5. Cierre

- [x] Subir versión minor web (`npm version 1.76.0 --no-git-tag-version`).
- [x] `npx vitest run src/apps/coach/pages/trainings` + `npm run build`.
- [x] `openspec validate coach-trainings-redesign --strict`.
- [ ] Comprobación visual a ~360 px y a escritorio.
- [ ] Commits tras confirmación del usuario.
