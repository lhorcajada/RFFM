## 1. Backend: sin aviso de cambio de estado en liga (~1h)

- [x] 1.1 Red: `tests/RFFM.Api.Tests/UnitTests/UpdateConvocationStatusHandlerTests.cs`: coach cambia
  el estado en un partido de liga (tipo 1) → `DispatchConvocationStatusChangedAsync` nunca; coach en
  un entrenamiento → una vez.
- [x] 1.2 Green: `Features/Coaches/Convocations/UpdateConvocationStatus.cs` (D4).
- [x] 1.3 `Directory.Build.props` → `1.30.1`.
- **Verify**: `dotnet build`; `dotnet test`.

## 2. Front: hook (~2h)

- [x] 2.1 Red: `hooks/__tests__/useConvocationManagement.availability.test.tsx`:
  `markAvailable` llama a `respondAvailability(eventId, requestId, true)` y mueve a disponibles;
  error → vuelve a pendientes; en liga convocar un disponible (arrastre y `handleCallPlayers`) llama a
  `decideAvailable(eventId, requestId, true)` y no a `addConvocation`/`updateConvocationStatus`; en
  amistoso sigue `addConvocation`.
- [x] 2.2 Green: `hooks/useConvocationManagement.ts` (D1–D3).

## 3. Front: pestaña Convocatoria (~1h)

- [x] 3.1 Red: `components/__tests__/ConvocationTab.markAvailable.test.tsx`: botón «Disponible» en
  «Pendientes de respuesta» llama a `onMarkAvailable(playerId)`; sin `onMarkAvailable` no se muestra.
- [x] 3.2 Green: `components/ConvocationTab.tsx` + `.module.css`, `ConvocationMatchDetail.tsx` pasa
  `onMarkAvailable={convocation.markAvailable}`.
- [x] 3.3 `Front/package.json` → `1.60.0`.
- **Verify**: `npm run test`; `npm run build`.

## 4. Cierre

- [x] 4.1 `openspec validate coach-availability-on-behalf-in-convocation --strict`.
- [x] 4.2 Commits `fix(mcp-api)` y `feat(front)`, solo tras la confirmación del usuario.
