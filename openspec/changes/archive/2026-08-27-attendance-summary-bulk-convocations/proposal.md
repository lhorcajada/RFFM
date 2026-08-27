## Why

`AttendanceSummaryContent.tsx` (resumen de asistencias, Coach) hace hoy dos patrones
N+1 al cargar la página de un equipo:

1. Un `convocationService.getConvocations(event.id)` por **cada evento** del equipo
   (`Promise.all(allEvents.map(...))`), para construir el resumen total/entrenamiento/
   partido/otros y la tabla de la pestaña Partidos.
2. Un `getIdealLineup(teamId, event.id)` por **cada partido oficial**
   (`Promise.all(officialMatchEvents.map(...))`), a pesar de que el endpoint backend
   (`GetTeamIdealLineup`) solo depende de `teamId` + `seasonId` y no del evento — el
   resultado es idéntico en cada llamada, así que hoy se repite trabajo redundante
   `officialMatchEvents.length` veces.

Con un equipo con muchos eventos en la temporada esto dispara decenas de llamadas HTTP
en cascada al abrir la página, degradando el tiempo de carga.

## What Changes

- **Backend**: nuevo endpoint `GET /api/attendance/team-convocations/{teamId}`
  (`Features/Coaches/Assistances/Queries/GetTeamConvocationsSummary.cs`, mismo patrón
  vertical-slice que `GetTrainingAttendanceSummary.cs`) que devuelve, en una sola
  llamada, todos los eventos del equipo junto con sus convocaciones (`teamPlayerId`,
  `playerId`, `alias`, `statusId`, `assistanceTypeId`, `excuseTypeId`) y los datos de
  evento necesarios para clasificar tipo/amistoso/rival/fecha en el frontend.
- **Frontend**:
  - `attendanceSummaryService.ts`: añade `getTeamConvocationsSummary(teamId, seasonId?)`
    que llama al nuevo endpoint.
  - `AttendanceSummaryContent.tsx`: sustituye el `Promise.all` de
    `convocationService.getConvocations(event.id)` por una única llamada al nuevo
    endpoint, y sustituye el `Promise.all` de `getIdealLineup(teamId, event.id)` por
    una única llamada `getIdealLineup(teamId, seasonId)` (sin loop por evento).
  - La llamada paginada a `sportEventService.getSportEvents` se mantiene igual (ya es
    O(páginas), no O(eventos)); se usa solo para metadatos que el nuevo endpoint no
    tenga si hiciera falta, o se elimina si el nuevo endpoint ya cubre todo lo
    necesario (se decide en diseño).

## Impact

- Backend: nuevo archivo
  `Features/Coaches/Assistances/Queries/GetTeamConvocationsSummary.cs`.
- Frontend: `apps/coach/services/attendanceSummaryService.ts`,
  `apps/coach/pages/attendance/components/summary/AttendanceSummaryContent.tsx`.
- No cambia el comportamiento visible de ninguna de las tres pestañas (Dashboard,
  Entrenamientos, Partidos); solo el número de llamadas HTTP necesarias para cargarlas.
- No afecta a Mobile ni a la app Federación.

## Out of Scope

- Cambiar el endpoint `GetTrainingAttendanceSummary` existente (se sigue usando tal
  cual para la pestaña Entrenamientos).
- Cambiar el comportamiento o contrato de `getIdealLineup` / `GetTeamIdealLineup` — solo
  se corrige cuántas veces se llama desde el frontend.
- Paginar o cachear el nuevo endpoint de convocaciones — se asume que un equipo tiene un
  volumen de eventos/convocaciones manejable en una sola respuesta (igual que ya asume
  `GetTrainingAttendanceSummary`).
