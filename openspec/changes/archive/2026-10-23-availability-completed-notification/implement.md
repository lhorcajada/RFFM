# Implement — availability-completed-notification

Guion técnico. Seguir `tasks.md` en orden y `design.md` (D1–D2). TDD estricto: cada bloque empieza por el
test, se ejecuta en rojo y después se implementa.

## Backend (`Back/ExtractionApi`)

1. **Dispatcher**:
   - Tests en `tests/RFFM.Api.Tests/UnitTests/AvailabilityNotificationTests.cs` con los helpers de
     `AvailabilityTestSupport` (`SeedTeamAsync`, `SeedEventAsync`, `SeedCoachAsync`) y
     `new WebPushNotificationDispatcher(db, Mock.Of<IWebPushSender>())`; asertar sobre
     `db.Notifications` con `Type == "AvailabilityCompleted"`.
   - `src/RFFM.Api/Features/Coaches/Notifications/Services/IWebPushNotificationDispatcher.cs`: añadir
     `DispatchAvailabilityCompletedAsync(string eventId, CancellationToken ct = default)` tras
     `DispatchAvailabilityRespondedAsync`.
   - `WebPushNotificationDispatcher.cs`: implementación tras `DispatchAvailabilityRespondedAsync` (D2).
   - Fakes: buscar `DispatchAvailabilityRespondedAsync(string availabilityRequestId` en
     `tests/RFFM.Api.Tests/IntegrationTests/` y añadir debajo
     `public Task DispatchAvailabilityCompletedAsync(string eventId, CancellationToken ct = default) => Task.CompletedTask;`.
2. **Handler** `src/RFFM.Api/Features/Coaches/Availability/RespondAvailabilityRequest.cs` (D1):
   `wasPending` antes de marcar; tras guardar y tras el aviso individual, consulta de pendientes
   (`_db.AvailabilityRequests.AnyAsync(r => r.SportEventId == eventId && r.StatusId == Requested &&
   !_db.Convocations.Any(c => c.SportEventId == r.SportEventId && c.TeamPlayerId == r.TeamPlayerId))`).
   Tests con `Mock<IWebPushNotificationDispatcher>` y `Verify(..., Times.Once/Never)`, siembra con
   `SeedRequestAsync` / `SeedConvocationAsync`.
3. `<Version>1.30.0</Version>`. Verify: `dotnet build`, `dotnet test`.
4. `openspec validate availability-completed-notification --strict`.
