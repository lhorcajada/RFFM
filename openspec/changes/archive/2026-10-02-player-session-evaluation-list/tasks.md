## 1. Backend (~1h)

- [x] Red: `PlayerSessionListHandlerTests` (Postgres):
  - asistencia y resumen;
  - sesión futura con `isHeld = false`;
  - sin fecha, excluida;
  - orden descendente;
  - jugador de otro equipo → 404.
- [x] Red: autorización (403 para los roles que no son Coach) y contrato de permisos.
- [x] Green: `GetPlayerSessionEvaluations.cs` (design.md D1).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet test`.

## 2. Frontend — datos y bug (~0,5h)

- [x] Red: servicio (`GET` lista, `PUT`, `GET` detalle, `DELETE`), `attendanceFromAssistanceType` y `useSessionEvaluations`.
- [x] Red: `SessionContent.test.tsx` con los campos reales de la API (`name`, `objetivo`, `durationMinutes`).
- [x] Green: servicio, hook, tipo `SessionBlockExercise` y `SessionContent` (D2, D3).

## 3. Frontend — componentes (~1,5h)

- [x] Red: `SessionEvaluationList.test.tsx`:
  - chips de asistencia;
  - estado y conteos;
  - acciones según el estado;
  - futura;
  - estados de carga, error y vacío.
- [x] Red: `SessionEvaluationForm.test.tsx`:
  - bloques por subprincipio;
  - precarga;
  - comentario obligatorio si no asistió;
  - envío;
  - sin subprincipios.
- [x] Red: `SessionEvaluationDialog.test.tsx`: selector de sesión con las celebradas sin seguimiento; con `initialSessionId`, sin selector.
- [x] Red: `PlayerTrackingPanel.test.tsx`:
  - crear desde la tarjeta guarda y recarga;
  - eliminar con confirmación;
  - avisos.
- [x] Green: componentes y panel (D3).
- [x] Subir la versión minor de la web.
- **Verify**: `npm run build` + `npx vitest run --maxWorkers=2`.

## 4. Cierre

- [x] `openspec validate player-session-evaluation-list --strict`.
- [x] Comprobación visual a ~360 px y en escritorio.
- [x] Commits tras confirmación del usuario.
