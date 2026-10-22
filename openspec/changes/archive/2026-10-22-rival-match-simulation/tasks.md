## 1. Backend: fuerza de plantilla y ratings (~2h)

- [x] 1.1 Red: `tests/RFFM.Api.Tests/UnitTests/SquadStrengthCalculatorTests.cs` (sin BD):
  - equipo cuyos jugadores quedaron más arriba → fuerza mayor;
  - todos los jugadores nuevos → fuerza ligeramente inferior a 1;
  - sin plantillas → fuerza 1 para todos;
  - un titular habitual pesa más que un jugador sin minutos;
  - fuerza acotada a `[0.6, 1.6]`;
  - `N` del grupo se estima con las participaciones (mínimo 10).
- [x] 1.2 Red: `tests/RFFM.Api.Tests/UnitTests/TeamRatingsCalculatorTests.cs`:
  - sin partidos → ataque = fuerza, defensa = 1 / fuerza;
  - 20 victorias con plantilla débil → ataque > 1;
  - medias de liga encogidas hacia 1.5/1.2 con pocos partidos;
  - goles esperados acotados a `[0.1, 8]`.
- [x] 1.3 Green: `Domain/Services/MatchSimulation/SimulationInput.cs`,
  `SquadStrengthCalculator.cs`, `TeamRatingsCalculator.cs` (D1–D3).
- **Verify**: `dotnet test --filter "SquadStrengthCalculator|TeamRatingsCalculator"`.

## 2. Backend: probabilidades y Monte Carlo (~2h)

- [x] 2.1 Red: `tests/RFFM.Api.Tests/UnitTests/MatchProbabilitiesTests.cs`:
  - suma 1; λ iguales → victoria local = visitante; λ local mayor → favorito local;
  - marcador más probable (`λ = 0.1/0.1` → 0-0).
- [x] 2.2 Red: `tests/RFFM.Api.Tests/UnitTests/SeasonSimulatorTests.cs`:
  - probabilidades por equipo y por puesto suman 1;
  - puntos esperados ≥ actuales;
  - sin pendientes → puesto actual con probabilidad 1;
  - sanción descontada de los puntos actuales;
  - determinista: dos ejecuciones → mismo resultado;
  - solo se predicen los partidos pendientes, ordenados por jornada.
- [x] 2.3 Green: `MatchProbabilities.cs`, `SeasonSimulator.cs` (D4–D5).
- **Verify**: `dotnet test --filter "MatchProbabilities|SeasonSimulator"`.

## 3. Backend: endpoint (~2h)

- [x] 3.1 Red: `tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationTests.cs` (Postgres, patrón de
  `RivalStatsTests`): liga con partidos jugados y pendientes → respuesta con predicciones y
  clasificación; sin informe → `UsesSquadStrength = false`; con informe `Completed` → `true`;
  sin jornadas → `null`; equipo sin competición → `ConflictException`; equipo inexistente →
  `NotFoundException`; sanción oficial descontada.
- [x] 3.2 Green: `Features/Coaches/RivalStats/GetRivalSimulation.cs` (D6).
- [x] 3.3 Autorización: añadir el endpoint a la batería de autorización existente si aplica
  (`IRequireTeamMembership` → 403 a usuarios ajenos).
- [x] 3.4 `Directory.Build.props` → `1.28.0`.
- **Verify**: `dotnet build`; `dotnet test`.

## 4. Front: servicio, hook y tarjetas (~2h)

- [x] 4.1 Red + Green: `services/__tests__/rivalStatsService.simulation.test.ts` →
  `getRivalSimulation(teamId)`.
- [x] 4.2 Red: `pages/rivalStats/simulation/components/__tests__/MatchPredictionCard.test.tsx`
  (porcentajes, marcador más probable, goles esperados) y `ProjectedStandingCard.test.tsx` (puntos
  actuales → esperados, puesto más probable, campeón, resaltado del propio equipo).
- [x] 4.3 Green: `hooks/useRivalSimulation.ts`, `MatchPredictionCard.tsx`,
  `ProjectedStandingCard.tsx` + CSS Modules (D7).
- **Verify**: `npm run test -- rivalStatsService MatchPredictionCard ProjectedStandingCard`.

## 5. Front: página, entrada y versión (~2h)

- [x] 5.1 Red: `pages/rivalStats/simulation/__tests__/RivalSimulation.test.tsx`: pestañas
  «Partidos»/«Clasificación»; agrupado por jornada; filtro «Solo mi equipo» activo por defecto;
  aviso sin fuerza de plantilla; sin pendientes → «No quedan partidos por disputar»; error de carga.
- [x] 5.2 Green: `RivalSimulation.tsx` + `.module.css`; ruta lazy `rival-stats/simulation`.
- [x] 5.3 Red + Green: `RivalStats.test.tsx` → botón «Simulación».
- [x] 5.4 `npm version 1.57.0 --no-git-tag-version`.
- [ ] 5.5 Comprobación visual a 360px y en escritorio (tema Coach).
- **Verify**: `npm run build`; `npm run test` (suite completa en verde).

## 6. Cierre

- [x] 6.1 `openspec validate rival-match-simulation --strict`.
- [x] 6.2 Commits (`feat(mcp-api)` y `feat(front)` por separado), solo tras la confirmación del
  usuario.
