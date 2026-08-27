## 1. Backend — `GetTeamConvocationsSummary`

- [x] 1.1 Escribir test (RED) en
      `Back/ExtractionApi/tests/RFFM.Api.Tests/` (nuevo archivo
      `GetTeamConvocationsSummaryHandlerTests.cs`, patrón de
      `GetTrainingAttendanceSummary` tests si existen, o del patrón general de
      handlers): dado un equipo con convocaciones en varios eventos, el handler
      devuelve un `ConvocationRow` por convocación con el `eventId` correcto; dado un
      equipo sin convocaciones, devuelve un array vacío. Confirmar que falla.
- [x] 1.2 Crear
      `Features/Coaches/Assistances/Queries/GetTeamConvocationsSummary.cs` (endpoint
      `GET /api/attendance/team-convocations/{teamId}`, `Query`, `ConvocationRow`,
      `Handler`) siguiendo el patrón de `GetTrainingAttendanceSummary.cs` (GREEN).
- [x] 1.3 `dotnet build` + `dotnet test --filter GetTeamConvocationsSummary` en verde.

## 2. Frontend — servicio

- [x] 2.1 Escribir test (RED) en
      `apps/coach/services/__tests__/attendanceSummaryService.test.ts` (crear si no
      existe): `getTeamConvocationsSummary(teamId)` hace `GET
      /api/attendance/team-convocations/{teamId}` y devuelve `resp.data`. Confirmar
      que falla.
- [x] 2.2 Añadir `TeamConvocationRow` y `getTeamConvocationsSummary` a
      `attendanceSummaryService.ts` (GREEN).

## 3. Frontend — refactor de `AttendanceSummaryContent.tsx`

- [x] 3.1 Escribir/actualizar tests (RED) en
      `apps/coach/pages/attendance/components/summary/__tests__/` (crear
      `AttendanceSummaryContent.httpCalls.test.tsx` si no existe uno equivalente):
      mockear `convocationService.getConvocations`, `getIdealLineup`,
      `attendanceSummaryService.getTeamConvocationsSummary` y verificar que, para un
      equipo con N eventos (N > 1) y M partidos oficiales (M > 1):
      - `getConvocations` (por evento) **no** se llama ninguna vez.
      - `getTeamConvocationsSummary` se llama exactamente una vez.
      - `getIdealLineup` se llama exactamente una vez (no M veces).
      Confirmar que fallan contra el código actual (hoy `getConvocations` se llama N
      veces y `getIdealLineup` M veces).
- [x] 3.2 Reemplazar el `Promise.all(allEvents.map(getConvocations))` por una llamada a
      `attendanceSummaryService.getTeamConvocationsSummary(teamId)` agrupada por
      `eventId` en memoria, adaptando cada `TeamConvocationRow` al shape
      `ConvocationItem` que ya consume el resto del archivo (GREEN parcial).
- [x] 3.3 Mover el cálculo de `seasonId` (`new URLSearchParams(...)`) antes del bloque
      de partidos, y reemplazar el `Promise.all(officialMatchEvents.map(getIdealLineup))`
      por una única llamada `getIdealLineup(teamId, seasonId)`, usando ese mismo
      resultado para todas las entradas de `lineupByEventId` (GREEN).
- [x] 3.4 Eliminar el import de `convocationService.getConvocations` si queda sin uso
      en el archivo (mantener `addConvocation`/`updateConvocationStatus` si se usan en
      otro lado del mismo módulo; verificar antes de borrar el import completo).
- [x] 3.5 Ejecutar la suite de `AttendanceSummaryContent`/`AttendanceSummary` y
      confirmar verde, incluyendo que Dashboard/Entrenamientos/Partidos renderizan
      exactamente los mismos datos que antes del refactor (regresión visual mediante
      tests existentes, no manual).

## 4. Verificación final

- [x] 4.1 `dotnet build` + `dotnet test` (backend) en verde (2 fallos preexistentes
      no relacionados en `AdnLegibleImporter`/`GameModelSeeder`, sin regresión).
- [x] 4.2 `npm run build` + `npm run test` (frontend) en verde, sin regresiones fuera de
      los archivos tocados.
- [x] 4.3 `openspec validate attendance-summary-bulk-convocations --strict` sin errores.
