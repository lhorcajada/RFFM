## Why

En un partido de liga el entrenador pide disponibilidad y recibe un aviso por cada respuesta
(`AvailabilityResponded`), pero no sabe cuándo han contestado **todos**: tiene que entrar en la
convocatoria y revisar que «Pendientes de respuesta» esté vacío antes de decidir la convocatoria.
Quiere un aviso push cuando la disponibilidad del partido esté completa.

## What Changes

- **Nuevo aviso `AvailabilityCompleted`** (notificación in-app + Web Push) a los entrenadores del
  equipo (los mismos que reciben `AvailabilityResponded`: entrenadores del equipo y entrenadores /
  directivos a nivel de club): «Todos los jugadores han marcado su disponibilidad para {evento} el
  {dd/MM/yyyy}.», con enlace a `/coach/attendance/{eventId}`.
- **Cuándo**: al responder una petición que estaba en `Requested` (sí o no), si ya no queda ninguna
  petición pendiente del partido. Pendiente = petición en `Requested` cuyo jugador no tiene
  convocatoria en el evento (misma regla que el grupo «Pendientes de respuesta»).
- **Quién la dispara**: cualquiera que responda — jugador, familiar o entrenador en nombre del
  jugador.
- **Sin duplicados**: cambiar una respuesta ya dada (`Available` → `Unavailable`) no vuelve a avisar.
  Si el entrenador vuelve a pedir disponibilidad (se reabren las `Unavailable`), al completarse de
  nuevo se vuelve a avisar.
- El aviso individual del último jugador se mantiene; el entrenador recibe ambos.
- **Versión**: API minor (`1.30.0`). Web y Mobile no cambian.

## Capabilities

### Modified Capabilities
- `league-match-availability`: aviso de disponibilidad completada.

## Impact

- `Back/ExtractionApi`: `IWebPushNotificationDispatcher` / `WebPushNotificationDispatcher`
  (`DispatchAvailabilityCompletedAsync`), `Features/Coaches/Availability/RespondAvailabilityRequest.cs`,
  fakes del dispatcher en tests de integración.
- **Fuera de alcance**: avisar cuando el último pendiente se resuelve por otra vía (convocatoria
  directa desde la pantalla de convocatoria, lesión, sanción); Mobile (Expo push); resumen con
  recuento de disponibles / no disponibles.
