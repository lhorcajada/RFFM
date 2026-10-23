## Why

En la pestaña «Convocatoria» de un partido de liga (`/coach/convocations/match/...`) el entrenador ve
a los jugadores en «Pendientes de respuesta», pero no puede hacer nada con ellos: si un jugador le
confirma en persona o por WhatsApp, tiene que ir a la pantalla del evento para marcarlo como
disponible. Además, al convocar desde «Disponibles» en esa pestaña el entrenador recibe un aviso
push «{alias} ha aceptado la convocatoria…» de una acción que acaba de hacer él mismo.

## What Changes

- **Marcar disponible desde la convocatoria**: en partidos de liga, cada tarjeta de «Pendientes de
  respuesta» muestra el botón «Disponible» para el entrenador. Responde en nombre del jugador
  (`PUT .../availability-requests/{requestId}/response` con `available: true`, ya permitido a
  Coach/Administrator) y el jugador pasa a «Disponibles».
- **Convocar disponibles sin avisos**: en liga, convocar desde «Disponibles» (selección múltiple o
  arrastrando a «Convocados») usa `POST .../availability-requests/{requestId}/decision` con
  `convoke: true`, que crea la convocatoria `Accepted` sin avisar a nadie, en lugar de
  `addConvocation` + `updateConvocationStatus`.
- **Back (defensa en profundidad)**: `PUT /api/events/{eventId}/convocations/{convocationId}/status`
  deja de avisar a los entrenadores (`ConvocationStatusChanged`) cuando el evento es un partido de
  liga (tipo `Partido`), igual que `AddConvocations` ya no avisa a jugadores en liga. La spec de
  `coach-web-push-notifications` se alinea además con el comportamiento real: solo avisan los cambios
  hechos por Coach/Administrator (los de Player/FamilyMember dejaron de avisar en `15ab3e94`).
- **Versión**: Web minor (`1.60.0`), API patch (`1.30.1`). Mobile no cambia.

## Capabilities

### Modified Capabilities
- `league-match-availability`: acciones del entrenador en la pestaña Convocatoria.
- `coach-web-push-notifications`: el cambio de estado no avisa en partidos de liga.

## Impact

- `Front/src/apps/coach/pages/convocations/hooks/useConvocationManagement.ts`,
  `components/ConvocationTab.tsx`, `ConvocationMatchDetail.tsx`, tests co-ubicados.
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Convocations/UpdateConvocationStatus.cs`,
  `tests/RFFM.Api.Tests/UnitTests/UpdateConvocationStatusHandlerTests.cs`.
- **Fuera de alcance**: «No disponible» desde la pestaña Convocatoria (sigue en la pantalla del
  evento, que pide motivo); aviso `AvailabilityCompleted` cuando responde el entrenador (se mantiene
  por spec); Mobile.
