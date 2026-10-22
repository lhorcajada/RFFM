# Implement — rival-match-simulation

Guion técnico. Seguir `tasks.md` en orden y `design.md` (D1–D7). TDD estricto: cada bloque empieza
por el test, se ejecuta en rojo y después se implementa.

## Backend (`Back/ExtractionApi`)

1. **Modelo puro** en `src/RFFM.Api/Domain/Services/MatchSimulation/` (namespace
   `RFFM.Api.Domain.Services.MatchSimulation`), clases `static` salvo los records:
   - `SimulationInput.cs`: `SimTeam`, `SimMatch`, `SimPlayerParticipation`, `SimPlayer`,
     `SimulationInput` (D1). Reutiliza `RffmPointsSystem` de
     `Domain/Entities/Federation/Results/RffmStandingsCalculator.cs`.
   - `SquadStrengthCalculator.Calculate(IReadOnlyCollection<string> teamCodes,
     IReadOnlyDictionary<string, IReadOnlyList<SimPlayer>> squads) → IReadOnlyDictionary<string, double>` (D2).
   - `TeamRatingsCalculator.Calculate(SimulationInput, IReadOnlyDictionary<string,double> strength)
     → TeamRatings` con `MuHome`, `MuAway`, `Attack`, `Defense` por equipo y
     `ExpectedGoals(local, visitor) → (double, double)` (D3). Constantes `K = 6`, `M = 10`,
     `DefaultHome = 1.5`, `DefaultAway = 1.2`, límites `[0.1, 8]`.
   - `MatchProbabilities.Calculate(double λLocal, double λVisitor) → (pHome, pDraw, pAway,
     mostLikelyLocal, mostLikelyVisitor)` (D4), 0–10 goles por lado y renormalizado.
   - `SeasonSimulator.Run(SimulationInput input, int iterations = 10_000, int seed = 20261022)
     → SimulationResult` (D5): calcula fuerza, ratings, predicciones de los pendientes y clasificación
     proyectada. Poisson por Knuth (`L = e^-λ`). Orden por puntos, DG, GF y desempate aleatorio.
   Tests en `tests/RFFM.Api.Tests/UnitTests/` (`SquadStrengthCalculatorTests`,
   `TeamRatingsCalculatorTests`, `MatchProbabilitiesTests`, `SeasonSimulatorTests`), xUnit + FluentAssertions
   si ya está referenciado en el proyecto de tests (si no, `Assert`, como los tests vecinos), con
   builders privados de calendario.
2. **Endpoint** `src/RFFM.Api/Features/Coaches/RivalStats/GetRivalSimulation.cs` (D6), mismo
   esqueleto que `GetRivalStats.cs` (`IFeatureModule`, `IRequest<RivalSimulationResponse?>`,
   `IRequireFeaturePermission`, `IRequireTeamMembership`, `Handler(AppDbContext, FederationDbContext,
   IOptions<RffmOptions>)`). Carga:
   - `db.RffmRounds.AsNoTracking().Include(r => r.Matches).Where(r => r.GroupCode == league.GroupCode)`;
     `SimMatch` con `int.TryParse` de `LocalGoals`/`VisitorGoals`; equipos a partir de los partidos
     (como `RffmResultsSyncService.RecomputeAsync`).
   - `db.RffmCompetitionGroups.AsNoTracking().FirstOrDefault(g => g.GroupCode == league.GroupCode)` →
     `Points` y `RffmStandingsMapper.Sanctions(RffmStandingsMapper.Parse(OfficialStandingsJson))`.
   - Informe `LeagueSquadStatsReports` `Completed` con `Teams.Players` (consulta de `GetRivalStats`),
     `RffmPlayerSeasonStats` de sus `PlayerCode` para `league.SeasonId` y
     `RffmSeasons.Previous(...)`; `HasPreviousSeason = stats previa con HasActivity`;
     participaciones con `PlayerSeasonTotalsMapper.ReadParticipations`.
   - `null` si no hay partidos → 404 «Calendario no disponible».
   Test de integración `tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationTests.cs`
   (`[Collection(PostgresCollection.Name)]`, seeds de `RivalStatsTests` + `RffmRound.Create` /
   `ApplySnapshot` con `RffmMatchSnapshot`).
3. `<Version>1.28.0</Version>` en `Directory.Build.props`. Verify: `dotnet build`, `dotnet test`.

## Front (`Front/src/apps/coach`)

4. `services/rivalStatsService.ts`: tipos (`type`, no `interface`) `MatchPrediction`,
   `ProjectedStanding`, `RivalSimulation` y `getRivalSimulation(teamId)` →
   `client.get(`${basePath(teamId)}/simulation`)`; añadir al `default`.
5. `hooks/useRivalSimulation.ts` (patrón de `useRivalStats`): `{ simulation, loading, error }`.
6. `pages/rivalStats/simulation/components/MatchPredictionCard.tsx` y
   `ProjectedStandingCard.tsx` (+ `.module.css`, `Paper`, tokens del tema Coach, sin `style={{}}`
   salvo el ancho de los segmentos de barra, que va por CSS custom property vía `sx`).
7. `pages/rivalStats/simulation/RivalSimulation.tsx` (+ `.module.css`): `BaseLayout hideFooterMenu`
   + `ContentLayout`, `useTeamAndClub`, `TeamCompetitionMissing` si no hay competición, `Tabs`
   «Partidos»/«Clasificación», `Switch` «Solo mi equipo», `EmptyState`, `Alert` (D7).
8. `routes.tsx`: `const RivalSimulation = lazy(() => import("./pages/rivalStats/simulation/RivalSimulation"));`
   y ruta `rival-stats/simulation` con `RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Convocations}`.
9. `pages/rivalStats/RivalStats.tsx`: botón «Simulación» (`Link` a `/coach/rival-stats/simulation`
   conservando la query string) en la barra de acciones.
10. Tests: `services/__tests__/rivalStatsService.simulation.test.ts`,
    `components/__tests__/*.test.tsx`, `simulation/__tests__/RivalSimulation.test.tsx` (mocks de
    `useTeamAndClub`, servicio y `useAuditPageAccess` como `rivalStats/__tests__/RivalStats.test.tsx`).
11. `npm version 1.57.0 --no-git-tag-version`. Verify: `npm run test`, `npm run build`.

## Cierre

12. `openspec validate rival-match-simulation --strict`; mostrar `git status` y pedir confirmación
    para los commits.
