## Why

Today the Coach game-model hierarchy is `GameModel → GameScenario` (each `GameScenario` carries its own `GameMomentId`/`GameZoneId`, placing it directly in a Momento de Juego × Zona de Juego cell). Each `GameScenario` also has a "Principios tácticos colectivos" multi-select tied to a static `TacticalGoalsEnum` catalog (`ScenarioTacticalPrinciple` join table).

The coaching staff wants an intermediate grouping level: a **Principio** (title + description) that lives inside a Momento de Juego × Zona de Juego cell and groups one or more `GameScenario`s. The new hierarchy is `GameModel → (Momento de Juego × Zona de Juego) → Principio → GameScenario`. The "Principios tácticos colectivos" selector on the scenario is being removed entirely — it is not being replaced by the new `Principio` concept, and is not used anywhere else in the system, so its backing tables are dropped rather than just unused.

## What Changes

- **Backend**: new domain entity `GamePrinciple` (table `GamePrinciples`, schema `app`) sitting between `GameModel` and `GameScenario`, carrying `GameMomentId`, `GameZoneId`, `Order`, `Title`, `Description`. `GameScenario` drops `GameMomentId`/`GameZoneId`/`TacticalPrinciples` and gains `GamePrincipleId`. `CreateGameModel`/`UpdateGameModel`/`GetGameModel` request/response shapes gain a `Principles` nesting level and lose `TacticalPrincipleIds`/`TacticalPrinciples`. The existing "move scenario" atomic endpoint (`PATCH /api/game-models/scenarios/{scenarioId}/location`, shipped in `move-game-scenario`) is re-scoped to move a scenario to a different `GamePrinciple` instead of a different moment/zone. `ScenarioTacticalPrinciple`, `TacticalGoalsEnum`/`TacticalGoals` table, and the `GET /api/technical-goals` endpoint are removed. A data migration creates one `GamePrinciple` per existing `GameScenario` (same moment/zone, `Title` = the scenario's current name, empty `Description`) so no existing data is lost — coaches edit the generated titles/descriptions afterward.
- **Frontend**: the game-model editor (`GameModelCreate.tsx` / `ScenarioFormAccordion.tsx`) and read view (`GameModel.tsx` / `ScenarioAccordion.tsx` / `GameModelPrintView.tsx`) gain a Principio level (create/edit/delete, title + description fields) between the Zona de Juego tab and the scenario list; scenarios are created/edited/deleted within a principle. The "Principios tácticos colectivos" `Autocomplete` is removed from the scenario form and from both read-only views, with no replacement. `GameModelDraftContext`'s reducer gains a principle index and principle CRUD actions, and loses the tactical-principles catalog/actions. The "Mover a…" scenario control now targets a Principio instead of a moment/zone pair.

### Naming note
The new entity is named `GamePrinciple` in code (not bare `Principle`) to avoid collision with the existing, unrelated `SubPrinciple`/`SubSubPrinciple` entities that nest *inside* a scenario, and with the removed `TacticalPrinciple` catalog type. UI copy still says "Principio".

## Capabilities

### Modified Capabilities
- `game-model`: scenarios are grouped under a new `GamePrinciple` (title + description) instead of sitting directly in a moment/zone cell; the "Principios tácticos colectivos" scenario field is removed entirely; the scenario move endpoint targets a principle instead of a moment/zone pair; existing scenarios are migrated into one generated principle each.

## Impact

- **Backend** (`Back/ExtractionApi/`):
  - New: `Domain/Aggregates/GameModels/GamePrinciple.cs`, `Infrastructure/Persistence/Configuration/Aggregates/GameModels/GamePrincipleConfiguration.cs`, EF migration (schema change + data migration + drops).
  - Modified: `GameModel.cs` (`Scenarios` → `Principles`), `GameScenario.cs` (drop moment/zone/tactical principles, add `GamePrincipleId`), `GameScenarioConfiguration.cs`, `AppDbContext.cs`, `Features/Coaches/GameModels/Commands/CreateGameModel.cs`, `Commands/UpdateGameModel.cs`, `Commands/MoveScenarioLocation.cs` (renamed/re-scoped), `Queries/GetGameModel.cs`.
  - Removed: `Domain/Aggregates/GameModels/ScenarioTacticalPrinciple.cs`, its EF config, `Domain/Aggregates/Training/TacticalGoalsEnum.cs` + its EF config (confirmed unused outside this feature), `Features/Coaches/GameModels/Queries/GetTechnicalGoals.cs`.
  - Backend tests: `GameModelTacticalPrincipleForeignKeyTests.cs` and `UpdateGameModelResavePrinciplesTests.cs` deleted/rewritten (their entire purpose was this FK), new tests for `GamePrinciple` CRUD via `CreateGameModel`/`UpdateGameModel`, new migration data-integrity test.
- **Frontend** (`Front/`):
  - `apps/coach/types/gameModel.ts`, `apps/coach/services/gameModelService.ts`, `apps/coach/services/gameModelMock.ts`, `apps/coach/context/GameModelDraftContext.tsx`, `apps/coach/pages/game-model/components/ScenarioFormAccordion.tsx`, `ScenarioAccordion.tsx`, `GameModelPrintView.tsx` (the "Imprimir PDF" view, printed via `window.print()`), plus all co-located tests under `__tests__/` including new dedicated coverage for `GameModelPrintView.tsx`.
- No changes to `Mobile/`.
