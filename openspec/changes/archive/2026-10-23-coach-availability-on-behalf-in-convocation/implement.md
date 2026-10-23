# Implement — coach-availability-on-behalf-in-convocation

Guion técnico. Seguir `tasks.md` en orden y `design.md` (D1–D4). TDD estricto: cada bloque empieza por
el test, se ejecuta en rojo y después se implementa.

## Backend (`Back/ExtractionApi`)

1. Tests en `UpdateConvocationStatusHandlerTests.cs` con `SeedConvocationAsync(db, eventTypeId: …)`,
   `CurrentUser(coachId, "Coach")` y `Mock<IWebPushNotificationDispatcher>` +
   `Verify(DispatchConvocationStatusChangedAsync, Times.Never/Once)`.
2. `UpdateConvocationStatus.cs`: condición `!isPlayerOrFamilyRole && !isLeagueMatch` con
   `SportEventsConstants.MatchEventTypeId`.
3. `<Version>1.30.1</Version>`.

## Front (`Front/src/apps/coach/pages/convocations`)

1. Hook: mock de `availabilityService` con `respondAvailability` y `decideAvailable`. Estado
   `availabilityRequestIdByPlayer`; `markAvailable`; rama liga `available → called` en `movePlayer`
   con recarga de `getConvocations` para `mgmtConvMap`. Añadir `markAvailable` al tipo de retorno.
2. `ConvocationTab`: prop `onMarkAvailable`; botón «Disponible» en zona `availabilityPending`.
3. `ConvocationMatchDetail.tsx`: pasar la prop.
4. `npm version 1.60.0 --no-git-tag-version`.
