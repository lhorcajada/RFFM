## Context

`useConvocationManagement` carga `convocations` + `availabilityRequests` (solo liga) y reparte a los
jugadores en `mgmtWaiting` / `mgmtAvailabilityPending` / `mgmtAvailable` / `mgmtCalled` /
`mgmtNotCalled`. `movePlayer(pid, "called")` hace `addConvocation` (estado Pending, sin push en liga)
y luego `updateConvocationStatus(…, 2)`, que en el back llama a
`DispatchConvocationStatusChangedAsync` → aviso a los entrenadores. `ConvocationTab` pinta las zonas;
las tarjetas de «Pendientes de respuesta» no tienen acciones.

La pantalla del evento (`AttendanceTabs`) ya usa `availabilityService.respondAvailability` (botón
«Disponible» del entrenador) y `availabilityService.decideAvailable` (botón «Convocar»).

## Decisions

### D1 — Id de petición por jugador en el hook

El hook guarda `availabilityRequestIdByPlayer: Record<string, string>` a partir de las peticiones
cargadas (todas, no solo las abiertas). No se expone: lo usan las acciones nuevas.

### D2 — `markAvailable(playerId)`

Nuevo handler del hook, solo con efecto en liga y si el jugador está en `mgmtAvailabilityPending` y
tiene petición:

```ts
async function markAvailable(playerId: string) {
  const requestId = availabilityRequestIdByPlayer[playerId];
  if (!mgmtEventId || !mgmtIsLeagueMatch || !requestId) return;
  // optimista: availabilityPending → available
  try {
    await availabilityService.respondAvailability(mgmtEventId, requestId, true);
  } catch (err) {
    // rollback + emitConvocationBlockedError(err)
  }
}
```

`ConvocationTab` recibe `onMarkAvailable?: (playerId: string) => Promise<void>` y, en la zona
`availabilityPending`, muestra un botón «Disponible» bajo cada cromo (mismo patrón visual que la fila
«Convocar» de la zona `available`, con `stopPropagation` en mousedown/dragstart). Deshabilitado
mientras la petición está en curso para ese jugador.

### D3 — Convocar disponibles en liga vía `decision`

En `movePlayer`, si `mgmtIsLeagueMatch && from === "available" && zone === "called"` y hay
`requestId`, se llama a `availabilityService.decideAvailable(eventId, requestId, true)` en lugar de
`addConvocation` + `updateConvocationStatus`. Tras el éxito se recargan las convocatorias del evento
para rellenar `mgmtConvMap[pid]` (el endpoint devuelve `204` sin id); si la recarga falla el jugador
queda en «Convocados» sin id y la siguiente acción sobre él lo resolverá al recargar la página
(mismo riesgo que hoy cuando `addConvocation` no devuelve id). `handleCallPlayers` ya pasa por
`movePlayer`, así que la selección múltiple hereda el cambio.

«Desconvocar» desde «Disponibles» no se toca (sigue `addConvocation` + `updateConvocationStatus` con
motivo elegido); con D4 tampoco avisa al entrenador.

### D4 — Back: sin `ConvocationStatusChanged` en liga

`UpdateConvocationStatus.Handler`:

```csharp
var isLeagueMatch = conv.SportEvent.EventTypeId == SportEventsConstants.MatchEventTypeId;
if (!isPlayerOrFamilyRole && !isLeagueMatch)
    await _webPushDispatcher.DispatchConvocationStatusChangedAsync(conv.Id, cancellationToken);
```

Misma constante que `AddConvocations`. En liga quien cambia estados es el entrenador y los jugadores
responden por el flujo de disponibilidad, que ya tiene sus propios avisos.

### D5 — Sin cambios en Mobile ni en la pantalla del evento
