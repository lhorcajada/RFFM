# Implement — rival-simulation-competition-level

Seguir `tasks.md` y `design.md` (D1–D4). TDD estricto.

## Backend (`Back/ExtractionApi`)

1. `src/RFFM.Api/Domain/Services/MatchSimulation/CompetitionLevel.cs` (D1): normalización con
   `string.Normalize(NormalizationForm.FormD)` quitando `UnicodeCategory.NonSpacingMark`; listas ordenadas
   de patrones (nombres largos primero).
2. `SquadStrengthCalculator.cs` (D2): `MinStrength = 0.5`, `MaxStrength = 2`, `K = 0.6`,
   `MinGroupSize = 16`, `NewPlayerPenalty = 0.25`. Mantener la firma pública `Calculate(teamCodes, squads)`.
3. `SeasonSimulator.ModelVersion = 2`.
4. `RffmRoundSimulation.cs`: `ModelVersion`, `IsBackfilled`, `Create(groupCode, seasonId, round, data,
   modelVersion, isBackfilled, now)`, `Replace(data, modelVersion, now)`, `RecomputeBackfilled(...)`.
5. `RivalRoundSimulationService.cs` (D3) y `GetRivalSimulationHistory.cs` (`IsBackfilled`).
6. Migración: borrar los dos archivos `*_AddRffmRoundSimulations*` (locales, nunca aplicados), restaurar
   `FederationDbContextModelSnapshot.cs` con `git checkout` y regenerar con
   `.\manage-migrations.ps1 -Action create -Context FederationDbContext -MigrationName AddRffmRoundSimulations`
   (cadena de conexión ficticia en `ConnectionStrings__FederationConnection`).

## Front (`Front/src/apps/coach`)

7. `rivalStatsService.ts`: `isBackfilled: boolean` en `RoundSimulation`.
8. `RivalSimulation.tsx`: texto «Predicción calculada a posteriori…» si `isBackfilled`.

## Cierre

9. Repetir el diagnóstico de solo lectura (`scratchpad/simdiag`), `openspec validate --strict` y pedir
   confirmación para los commits.
