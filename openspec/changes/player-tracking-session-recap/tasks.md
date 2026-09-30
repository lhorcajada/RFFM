## 1. Hooks (~0,5h)

- [x] Red → Green: `useRecentSessions`: solo sesiones con fecha de los últimos 30 días, de la más reciente a la más antigua; error → `[]`.
- [x] Red → Green: `useSessionDetail`: con `null` no pide nada; con un id expone el detalle.
- [x] Red: `usePlayerSessionAttendance.test.ts`:
  - `no-event` sin llamar a la API;
  - `attended`, `late`, `absent-excused` y `absent-unexcused` según `assistanceTypeId`;
  - jugador ausente de la lista o error → `unknown`.
- [x] Green: `usePlayerSessionAttendance.ts` (design.md D1).
- **Verify**: `npx vitest run useRecentSessions useSessionDetail usePlayerSessionAttendance`.

## 2. Componentes base (~0,5h)

- [x] Refactor: extraer `AssessmentButtons` de `ObservationForm`. Sus tests siguen en verde **sin tocarlos** (D2).
- [x] Red: `SessionContent.test.tsx`: objetivo, ejercicios visibles por bloque con objetivo y duración, sin ejercicios y carga.
- [x] Green: `SessionContent.tsx` + `.module.css` (D3).
- **Verify**: `npx vitest run ObservationForm SessionContent`.

## 3. Formulario de sesión (~1h)

- [x] Red: `SessionObservationForm.test.tsx`:
  - sin campo de fecha ni buscador;
  - un bloque por subprincipio con roles y zonas;
  - «Guardar» deshabilitado sin valoraciones;
  - una request por bloque valorado con la fecha de la sesión;
  - fallo parcial: conserva los bloques fallidos;
  - sesión sin targets;
  - avisos de asistencia (ausente, tarde, sin registro, sin evento, asistió);
  - ausente → comentario obligatorio.
- [x] Green: `SessionObservationForm.tsx` + `.module.css` (D4).
- **Verify**: `npx vitest run SessionObservationForm`.

## 4. Panel (~0,5h)

- [x] Red: `PlayerTrackingPanel.test.tsx`:
  - sin sesiones no hay selector;
  - elegir sesión muestra el formulario de sesión;
  - guardar varias → «2 observaciones guardadas» y aparecen en la lista;
  - fallo → snackbar de error.
- [x] Green: `PlayerTrackingPanel.tsx` (D5).
- **Verify**: `npx vitest run tracking PlayerDetail`.

## 5. Cierre

- [x] `npm run build` + `npm run test` (suite completa).
- [ ] Comprobación visual a ~360 px y en escritorio.
- [x] Subir la versión minor de la web (1.2.0).
- [x] `openspec validate player-tracking-session-recap --strict`.
- [ ] Commit `feat(front)` tras confirmación del usuario.
