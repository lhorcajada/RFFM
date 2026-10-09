## 1. Backend: dominio y persistencia (~1.5h)

- [x] Red: `tests/RFFM.Api.Tests/UnitTests/AvailabilityRequestTests.cs`:
  - `Create` → `Requested`, `RequestedAt` = now, `RespondedAt` null;
  - `MarkAvailable` desde `Requested` → `Available` + `RespondedAt`;
  - `MarkUnavailable` desde `Requested`/`Available` → `Unavailable`;
  - `Reopen` desde `Unavailable` → `Requested`, `RespondedAt` null; desde `Requested` → lanza excepción.
- [x] Green: `AvailabilityRequestStatus.cs`, `AvailabilityRequest.cs`,
  `AvailabilityRequestEntityConfiguration.cs`, `DbSet` en `AppDbContext` (D1).
- [x] Migración `AddAvailabilityRequests` (`.\manage-migrations.ps1`), en un commit separado.
- **Verify**: `dotnet test --filter AvailabilityRequestTests`; `dotnet build`.

## 2. Backend: pedir y listar disponibilidad (~2h)

- [x] Red: `tests/RFFM.Api.Tests/UnitTests/RequestAvailabilityTests.cs` (Postgres):
  - tres jugadores en lista de espera → 3 peticiones, `requestedCount` 3;
  - se omiten los convocados, los lesionados y los sancionados;
  - segunda llamada → `requestedCount` 0 y sin avisos nuevos;
  - `Unavailable` sin convocatoria → se reabre;
  - amistoso/entrenamiento → 400 `AvailabilityOnlyForLeagueMatches`;
  - Player → 403.
- [x] Red: `tests/RFFM.Api.Tests/UnitTests/AvailabilityNotificationTests.cs`: texto exacto, con
  y sin hora; destinatarios jugador + familiares.
- [x] Green: `Features/Coaches/Availability/RequestAvailability.cs`,
  `GetEventAvailabilityRequests.cs`, `DispatchAvailabilityRequestedAsync` y los `ErrorCodes`
  nuevos (D3.1, D3.2, D4).
- **Verify**: `dotnet test --filter "RequestAvailabilityTests|AvailabilityNotificationTests"`.

## 3. Backend: responder y decidir (~2h)

- [x] Red: `tests/RFFM.Api.Tests/UnitTests/RespondAvailabilityRequestTests.cs` (Postgres):
  - sí → `Available`, sin convocatoria, aviso a entrenadores;
  - no + «Enfermedad» → `Unavailable` + `Deconvoke` con ese motivo;
  - no sin motivo → 400; no + «Decisión técnica» → 400;
  - jugador ajeno → 403; ya convocado → 409 `AvailabilityAlreadyDecided`.
- [x] Red: `tests/RFFM.Api.Tests/UnitTests/DecideAvailableConvocationTests.cs` (Postgres):
  - convocar → `Accepted` + aviso de convocatoria;
  - desconvocar → `Deconvoke` + «Decisión técnica»;
  - petición `Requested` → 409 `AvailabilityNotAvailable`; ya convocado → 409.
- [x] Green: `RespondAvailabilityRequest.cs`, `DecideAvailableConvocation.cs`,
  `DispatchAvailabilityRespondedAsync` (D3.3, D3.4, D4).
- **Verify**: `dotnet test --filter "RespondAvailabilityRequestTests|DecideAvailableConvocationTests"`.

## 4. Backend: resumen propio + versión (~0.5h)

- [x] Red: ampliar `GetEventAttendanceSummaryHandlerTests` → `MyAvailabilityRequestId`/`MyAvailabilityStatus`.
- [x] Green: `GetEventAttendanceSummary.cs` (D5).
- [x] `Directory.Build.props` → `1.22.0`.
- **Verify**: `dotnet build`; `dotnet test` (suite completa en verde).

## 5. Front: agrupación por posición (~1.5h)

- [x] Red: `pages/attendance/utils/__tests__/positionGroups.test.ts` (clasificación de todas las
  demarcaciones de `DemarcationMaster`, carrilero, vacío, orden, grupos vacíos omitidos).
- [x] Red: `pages/attendance/components/__tests__/PositionGroupedList.test.tsx` (subtítulos y
  orden).
- [x] Green: `utils/positionGroups.ts`, `components/PositionGroupedList.tsx` + `.module.css`
  (D6).
- [x] Integrar `PositionGroupedList` en `NotConvokedList` y en los grupos de `AttendanceTabs`
  (todos los eventos). Los tests existentes de `AttendanceTabs*` siguen en verde.
- **Verify**: `npm run test -- positionGroups PositionGroupedList AttendanceTabs`.

## 6. Front: flujo de disponibilidad en `AttendanceTabs` (~2h)

- [x] Red: `pages/attendance/__tests__/AttendanceTabs.availability.test.tsx`:
  - partido de liga → «Pedir disponibilidad» visible y sin «Convocar toda la lista de espera»;
  - amistoso → «Convocar toda la lista de espera» y sin grupos de disponibilidad;
  - confirmar «Pedir disponibilidad» → llama a `requestAvailability` y muestra el snackbar;
  - `Requested` sin convocatoria → «Pendientes de respuesta»; `Available` → «Disponibles»;
    con convocatoria → grupo de la convocatoria;
  - entrenador «Convocar» en Disponibles → `decideAvailable(…, true)`;
  - entrenador «Desconvocar» + confirmar → `decideAvailable(…, false)`;
  - jugador «Sí, disponible» → `respondAvailability(…, true)`;
  - jugador «No disponible» → diálogo sin «Decisión técnica»/«Sanción deportiva», motivo
    obligatorio → `respondAvailability(…, false, id)`.
- [x] Green: `services/availabilityService.ts`, `components/AvailabilityList.tsx` (reutiliza `DeconvokeDialog`),
  `AttendanceTabs.tsx`, prop `isLeagueMatch` en `AttendanceEvent.tsx` (D6).
- **Verify**: `npm run test -- AttendanceTabs`.

## 7. Front: panel «Próximos eventos» + versión (~1h)

- [x] Red: `UpcomingEventsWidget.availability.test.tsx`: con `Requested` sin convocatoria → «Sí»
  / «No»; «No» pide el motivo.
- [x] Green: `UpcomingEventsWidget.tsx`, `eventAttendanceSummaryService.ts` (tipos).
- [x] `npm version 1.35.0 --no-git-tag-version`.
- [ ] Comprobación visual a 360px y en escritorio (tema Coach).
- **Verify**: `npm run build`; `npm run test` (suite completa en verde).

## 8. Cierre

- [x] `openspec validate league-match-availability --strict`.
- [ ] Revisión con los agentes Back/Front Code Reviewer.
- [x] Commits (migración aparte; `feat(mcp-api)` y `feat(front)` por separado), solo tras la
  confirmación del usuario.
