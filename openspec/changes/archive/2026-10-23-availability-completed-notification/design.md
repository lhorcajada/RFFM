## Context

`RespondAvailabilityRequest.Handler` cambia el estado de la petición, guarda y, si responde un
jugador/familiar, llama a `IWebPushNotificationDispatcher.DispatchAvailabilityRespondedAsync`. Los
avisos a entrenadores se resuelven con `ResolveTeamCoachUserIdsAsync` dentro del dispatcher.

## Decisions

### D1 — Detección en el handler de respuesta

En `RespondAvailabilityRequest.Handler.Handle`:

```csharp
var wasPending = availability.IsRequested;
// ... MarkAvailable / MarkUnavailable + SaveChangesAsync ...
if (respondedByPlayerOrFamily)
    await _dispatcher.DispatchAvailabilityRespondedAsync(availability.Id, cancellationToken);

if (wasPending && !await HasPendingRequestsAsync(availability.SportEventId, cancellationToken))
    await _dispatcher.DispatchAvailabilityCompletedAsync(availability.SportEventId, cancellationToken);
```

`HasPendingRequestsAsync`: `AvailabilityRequests` del evento en `Requested` sin `Convocation` del
mismo jugador en el evento (regla del grupo «Pendientes de respuesta»). Se evalúa después de
`SaveChangesAsync`, así que la propia petición ya no cuenta, y en el caso «no» la convocatoria
`Deconvoke` creada por `ForceDeconvocationAsync` ya está guardada.

- `wasPending` evita avisar de nuevo cuando se cambia una respuesta ya dada.
- Se descarta un flag persistido «ya avisado»: la reapertura (`Reopen`) devuelve peticiones a
  `Requested`, y el siguiente cierre debe volver a avisar; la transición `Requested → respuesta` ya
  lo modela sin migración.
- Carrera: dos respuestas simultáneas de los dos últimos pendientes podrían avisar dos veces o
  ninguna. Riesgo aceptado (best-effort, igual que el resto de avisos).

### D2 — Nuevo método del dispatcher

`Task DispatchAvailabilityCompletedAsync(string eventId, CancellationToken ct = default)` en
`IWebPushNotificationDispatcher`; implementación en `WebPushNotificationDispatcher` siguiendo
`DispatchAvailabilityRespondedAsync`: try/catch con `LogWarning`, evento inexistente → no hace nada,
destinatarios `ResolveTeamCoachUserIdsAsync(sportEvent.TeamId)`, tipo `AvailabilityCompleted`,
título «Disponibilidad completada», cuerpo
`$"Todos los jugadores han marcado su disponibilidad para {sportEvent.Name}{FormatEventDateSuffix(sportEvent)}."`,
enlace `/coach/attendance/{sportEvent.Id}`.

Las implementaciones fake de `IWebPushNotificationDispatcher` en `tests/.../IntegrationTests/`
añaden el método con `Task.CompletedTask`.

### D3 — Sin cambios en Front ni Mobile

El centro de notificaciones y el service worker del SPA muestran `title`/`body`/`deepLinkPath` sin
depender del tipo.
