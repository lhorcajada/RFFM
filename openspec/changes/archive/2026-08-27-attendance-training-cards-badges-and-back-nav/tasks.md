## 1. Backend — `HasConvokedPlayers` en `GetSportEvents`

- [x] 1.1 Escribir test (RED) en
      `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/` (nuevo archivo
      `GetSportEventsHandlerTests.cs`, patrón de `DeleteSportEventHandlerTests.cs`):
      handler devuelve `HasConvokedPlayers = true` cuando hay una `Convocation` para el
      evento y `false` cuando no hay ninguna. Confirmar que falla.
- [x] 1.2 Añadir `HasConvokedPlayers` a `SportEventResponse` y a la proyección del
      handler en `Features/Coaches/SportEvents/Queries/GetSportEvents.cs` (GREEN).
- [x] 1.3 `dotnet build` + `dotnet test --filter GetSportEvents` en verde.

## 2. Frontend — tipo y servicio

- [x] 2.1 Añadir `hasConvokedPlayers?: boolean | null` a `SportEventResponse` en
      `apps/coach/services/sportEventService.ts`.

## 3. Frontend — `EventCard` (chips + borde)

- [x] 3.1 Escribir tests (RED) en
      `apps/coach/pages/attendance/__tests__/EventCard.trainingBadges.test.tsx`:
      - Entrenamiento con `arrivalDate` → chip de hora de llegada visible.
      - Entrenamiento sin `arrivalDate` → chip de hora de llegada ausente.
      - Entrenamiento con `hasConvokedPlayers: true` → texto "Convocatoria abierta" +
        clase de borde correspondiente.
      - Entrenamiento con `hasConvokedPlayers: false`/`undefined` → texto "Convocatoria
        sin iniciar" + clase de borde correspondiente.
      - Partido/Torneo con `hasConvokedPlayers: true` → ninguno de los dos chips
        aparece.
      Confirmar que fallan contra el código actual.
- [x] 3.2 Implementar en `EventCard.tsx`: `isTraining`, cálculo de `arrivalTimeStr`
      (reutilizando el parseo de `AttendanceEvent.tsx`), los dos `Chip` nuevos en el
      body, y la clase de borde condicional en el `div.card` raíz (GREEN).
- [x] 3.3 Añadir `.cardConvocationOpen` / `.cardConvocationPending` a
      `EventCard.module.css` (mismo patrón que `.cardMatch`).
- [x] 3.4 Ejecutar la suite de `EventCard`/`Attendance` y confirmar verde sin
      regresiones.

## 4. Frontend — fix navegación "Volver" en `AttendanceEvent`

- [x] 4.1 Escribir test (RED) en
      `apps/coach/pages/attendance/__tests__/AttendanceEvent.backNav.test.tsx`: clic en
      "Volver" navega a `/coach/attendance?teamId=<teamId del evento>`, no al dashboard
      del equipo. Confirmar que falla contra el código actual.
- [x] 4.2 Cambiar el `onClick` del botón "Volver" en `AttendanceEvent.tsx` para navegar
      al listado de eventos (GREEN). Eliminar el import de `useTeamDashboardBack` si
      queda sin uso en el archivo.
- [x] 4.3 Confirmar que la rama "evento no encontrado" (botón "Volver al listado") sigue
      pasando sin cambios.

## 5. Verificación final

- [x] 5.1 `dotnet build` + `dotnet test` (backend) en verde.
- [x] 5.2 `npm run build` + `npm run test` (frontend) en verde, sin regresiones fuera de
      los archivos tocados.
- [ ] 5.3 Revisión visual manual (dev server) de una tarjeta de Entrenamiento con y sin
      convocados, y del flujo Volver desde el detalle de un evento. (Omitida a petición
      del usuario — se archiva sin verificación visual manual.)
