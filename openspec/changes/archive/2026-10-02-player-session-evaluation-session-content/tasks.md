## 1. Datos (~0,5h)

- [x] Red: `useSessionExercises.test.ts` (una petición por ejercicio, descarta `null`, error → mapa vacío) y `sessionHabilidades.test.ts` (unión sin duplicados por subprincipio).
- [x] Green: `useSessionExercises.ts`, `sessionHabilidades.ts` (design.md D1, D2).

## 2. Tarjeta de ejercicio y contenido (~1,5h)

- [x] Red: `SessionExerciseCard.test.tsx`:
  - imagen;
  - pizarra (preview mockeado);
  - tipo y duración;
  - «Ver detalle» con descripción, niveles en lista y relación con el modelo;
  - sin ejercicio completo, sin botón.
- [x] Red: `SessionContent.test.tsx`: cabecera (hora, lugar y evento) y rotación del bloque.
- [x] Green: `SessionExerciseCard.tsx` + `.module.css` y `SessionContent` (D3, D4).

## 3. Formulario y diálogo (~1h)

- [x] Red: `SessionEvaluationForm.test.tsx` («Habilidades trabajadas» por subprincipio; sin habilidades, nada) y `SessionEvaluationDialog.test.tsx` (pide los ejercicios del detalle).
- [x] Green: `SessionEvaluationForm` y `SessionEvaluationDialog` (D5).
- [x] Subir la versión minor de la web.
- **Verify**: `npm run build` + suite del front en 4 tandas (`--maxWorkers=2`).

## 4. Cierre

- [x] `openspec validate player-session-evaluation-session-content --strict`.
- [x] Comprobación visual a ~360 px y en escritorio.
- [x] Commits tras confirmación del usuario.
