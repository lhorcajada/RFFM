## 1. Backend: dispatcher (~1h)

- [x] 1.1 Red: `tests/RFFM.Api.Tests/UnitTests/AvailabilityNotificationTests.cs`:
  `DispatchAvailabilityCompletedAsync` notifica a los entrenadores del equipo con el cuerpo «Todos los
  jugadores han marcado su disponibilidad para Jornada 7 el 18/10/2026.» y enlace
  `/coach/attendance/{eventId}`; evento sin fecha omite « el …».
- [x] 1.2 Green: método en `IWebPushNotificationDispatcher` + `WebPushNotificationDispatcher` (D2);
  fakes de `tests/RFFM.Api.Tests/IntegrationTests/*` con `Task.CompletedTask`.
- **Verify**: `dotnet test --filter AvailabilityNotificationTests`.

## 2. Backend: disparo en la respuesta (~1h)

- [x] 2.1 Red: `tests/RFFM.Api.Tests/UnitTests/RespondAvailabilityRequestTests.cs`: último pendiente
  responde sí → `DispatchAvailabilityCompletedAsync(eventId)` una vez; queda otro `Requested` → nunca;
  entrenador responde el último → una vez; último responde no → una vez; el otro `Requested` ya está
  convocado → una vez; cambiar `Available` → no disponible → nunca.
- [x] 2.2 Green: `Features/Coaches/Availability/RespondAvailabilityRequest.cs` (D1).
- [x] 2.3 `Directory.Build.props` → `1.30.0`.
- **Verify**: `dotnet build`; `dotnet test`.

## 3. Cierre

- [x] 3.1 `openspec validate availability-completed-notification --strict`.
- [x] 3.2 Commit `feat(mcp-api)`, solo tras la confirmación del usuario.
