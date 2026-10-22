# Implement — rival-simulation-history

Guion técnico. Seguir `tasks.md` en orden y `design.md` (D1–D6). TDD estricto: cada bloque empieza por el
test, se ejecuta en rojo y después se implementa.

## Backend (`Back/ExtractionApi`)

1. **Dominio**:
   - `src/RFFM.Api/Domain/Entities/Federation/Results/RffmRoundSimulation.cs` (D1), patrón de
     `RffmStandingsSnapshot` (constructor privado, `Create`, métodos con intención).
   - `src/RFFM.Api/Domain/Services/MatchSimulation/SimulationAsOf.cs` y `RoundSimulationPolicy.cs`
     (`RoundStatus`, `MatchOutcomeKind`) (D2).
   - Tests unitarios en `tests/RFFM.Api.Tests/UnitTests/` con `Assert` y nombres en español, como
     `SeasonSimulatorTests`.
2. **Persistencia**: `RffmRoundSimulationEntityConfiguration` en
   `Infrastructure/Persistence/Configuration/Entities/RffmResultsEntityConfiguration.cs`; `DbSet` en
   `FederationDbContext`. Migración:
   `.\manage-migrations.ps1 -Action create -Context FederationDbContext -MigrationName AddRffmRoundSimulations`
   (queda en `Infrastructure/Migrations/Federation/`).
3. **Refactor** en `Features/Coaches/RivalStats/`: `RivalSimulationContracts.cs` (records movidos),
   `RivalSimulationMapper.cs` (`ToMatchResponse`, `ToStandingResponse`, redondeos),
   `Services/RivalSimulationInputLoader.cs` (carga del handler actual). `GetRivalSimulation.Handler`
   pasa a `Handler(AppDbContext, RivalSimulationInputLoader, IOptions<RffmOptions>)` o mantiene su firma
   creando el loader con `FederationDbContext` + `IOptions<RffmOptions>` — elegir la que no rompa
   `RivalSimulationTests` (preferible mantener la firma y construir el loader dentro).
4. **Servicio** `Services/RivalRoundSimulationService.cs` (D3), registrado como scoped en
   `DependencyInjection/ServiceCollectionExtensions.cs`. JSON con `System.Text.Json` (opciones web por
   defecto, camelCase) para `MatchesJson`/`StandingsJson`.
5. **Endpoints** `SyncRivalSimulationRounds.cs` (`RFFM.Api.Common.ICommand`, `Validator`, `Handler` que
   resuelve la liga y llama al servicio) y `GetRivalSimulationHistory.cs` (`IRequest`), esqueleto de
   `RequestRivalStats.cs` / `GetRivalStats.cs` (D4).
   Tests de integración con los seeds de `RivalSimulationTests` (`RffmRound.Create` + `ApplySnapshot`,
   fechas `dd/MM/yyyy` en `RffmMatchSnapshot.Date`) y `FixedTimeProvider`.
6. `<Version>1.29.0</Version>`. Verify: `dotnet build`, `dotnet test`.

## Front (`Front/src/apps/coach`)

7. `services/rivalStatsService.ts`: tipos (`type`) y `syncRivalSimulationRounds` (`client.put`) /
   `getRivalSimulationHistory` (`client.get`) sobre `${basePath(teamId)}/simulation/rounds`.
8. `hooks/useRivalSimulation.ts`: `{ simulation, history, loading, error }` (D6).
9. `MatchPredictionCard.tsx` (`result`) y `ProjectedStandingCard.tsx` (`actualPosition`) + CSS Modules
   (`.hit`, `.miss` con `--mui-palette-success-main` / `--mui-palette-error-main`).
10. `RivalSimulation.tsx`: selectores «Ver» y «Proyección» (`Select` MUI, `size="small"`), resúmenes de
    aciertos, reutilizando `groupByRound` y el filtro «Solo mi equipo».
11. `npm version 1.58.0 --no-git-tag-version`. Verify: `npm run test`, `npm run build`.

## Cierre

12. `openspec validate rival-simulation-history --strict`; mostrar `git status` y pedir confirmación para
    los commits (migración aparte).
