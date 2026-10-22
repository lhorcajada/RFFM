## 1. Backend: dominio (~2h)

- [x] 1.1 Red: `tests/RFFM.Api.Tests/UnitTests/RffmRoundSimulationTests.cs`: crear; `Replace` actualiza y
  devuelve `true`; congelada → `Replace` devuelve `false` y no cambia; `Freeze` idempotente; grupo vacío
  → `ArgumentException`.
- [x] 1.2 Red: `tests/RFFM.Api.Tests/UnitTests/SimulationAsOfTests.cs`: quita resultados de `Round >= N`;
  conserva los anteriores; `ignoreCurrentInvolvement` pone a 0 la temporada actual y no toca la anterior.
- [x] 1.3 Red: `tests/RFFM.Api.Tests/UnitTests/RoundSimulationPolicyTests.cs`: `Status`
  (Played / InProgress por resultado / InProgress por fecha / Upcoming sin fechas); `RoundsToSimulate`
  (hasta la primera Upcoming incluida; todas si no hay); `PredictedOutcome` (mayor probabilidad;
  empates Draw > Home > Away); `ActualOutcome`.
- [x] 1.4 Green: `RffmRoundSimulation.cs`, `SimulationAsOf.cs`, `RoundSimulationPolicy.cs` (D1–D2).
- **Verify**: `dotnet test --filter "RffmRoundSimulation|SimulationAsOf|RoundSimulationPolicy"`.

## 2. Backend: persistencia y servicio (~2h)

- [x] 2.1 Configuración EF en `RffmResultsEntityConfiguration.cs` + `DbSet<RffmRoundSimulation>
  RffmRoundSimulations` en `FederationDbContext`.
- [x] 2.2 Migración `AddRffmRoundSimulations` (`FederationDbContext`) — commit separado.
- [x] 2.3 Refactor (verde): `RivalSimulationContracts.cs`, `RivalSimulationMapper.cs` y
  `Services/RivalSimulationInputLoader.cs`; `GetRivalSimulation` los usa. `RivalSimulationTests` sigue
  en verde sin cambios.
- [x] 2.4 Red: `tests/RFFM.Api.Tests/IntegrationTests/RivalRoundSimulationServiceTests.cs` (Postgres,
  `FixedTimeProvider`): jornadas 1–2 jugadas y 3 futura → simulaciones 1, 2 (congeladas) y 3 (abierta);
  la 2 ignora resultados de la 2; la 3 se recalcula si cambia un resultado; al empezar la 3 se congela
  sin recalcular; una congelada no cambia; sin calendario no guarda nada.
- [x] 2.5 Green: `Services/RivalRoundSimulationService.cs` (D3) + registro DI.
- **Verify**: `dotnet test --filter "RivalRoundSimulationService|RivalSimulationTests"`.

## 3. Backend: endpoints (~1.5h)

- [x] 3.1 Red: `tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationHistoryTests.cs`: sincronizar →
  historial ordenado; acierto (`Home` y 2-1) y fallo (1-1); pendiente sin evaluar; totales; puesto
  real actual en la clasificación guardada; equipo sin competición → `ConflictException`; sin
  calendario → historial vacío.
- [x] 3.2 Red: validador de `SyncRivalSimulationRoundsCommand` (`TeamId` vacío).
- [x] 3.3 Green: `SyncRivalSimulationRounds.cs` y `GetRivalSimulationHistory.cs` (D4).
- [x] 3.4 `Directory.Build.props` → `1.29.0`.
- **Verify**: `dotnet build`; `dotnet test`.

## 4. Front: servicio, hook y tarjetas (~1.5h)

- [x] 4.1 Red + Green: `rivalStatsService.simulation.test.ts` → `syncRivalSimulationRounds` (PUT) y
  `getRivalSimulationHistory` (GET).
- [x] 4.2 Red + Green: `hooks/__tests__/useRivalSimulation.test.ts`: sincroniza antes de pedir el
  historial; si falla la sincronización pide el historial igualmente; si falla el historial,
  `history = null` y la simulación actual sigue disponible.
- [x] 4.3 Red + Green: `MatchPredictionCard.test.tsx` (resultado real, «Acertado»/«Fallado») y
  `ProjectedStandingCard.test.tsx` («Puesto real: 3º»).
- **Verify**: `npm run test -- rivalStatsService useRivalSimulation MatchPredictionCard ProjectedStandingCard`.

## 5. Front: página (~2h)

- [x] 5.1 Red: `RivalSimulation.test.tsx` (bloque «historial»): selector con «Próximos partidos» y
  jornadas guardadas; jornada con tarjetas acertada/fallada; «Aciertos en la jornada: 3 de 4» y
  «Aciertos totales: 5 de 8 (63 %)»; «Antes de la jornada 2» con puesto real; historial `null` → solo
  la simulación actual.
- [x] 5.2 Green: `RivalSimulation.tsx` + CSS (D6).
- [x] 5.3 `npm version 1.58.0 --no-git-tag-version`.
- [ ] 5.4 Comprobación visual a 360px y en escritorio (tema Coach).
- **Verify**: `npm run build`; `npm run test` (suite completa).

## 6. Cierre

- [x] 6.1 `openspec validate rival-simulation-history --strict`.
- [x] 6.2 Commits (migración, `feat(mcp-api)`, `feat(front)`), solo tras la confirmación del usuario.
