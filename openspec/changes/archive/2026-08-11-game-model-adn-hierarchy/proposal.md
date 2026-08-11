## Why

The Coach "modelo de juego" (game model) currently follows the hierarchy `GameModel → GamePrinciple (per GameMoment × GameZone) → GameScenario → SubPrinciple → SubSubPrinciple → EssentialSkill`, and exercises/sessions can be assigned to a `GameScenario`/`SubPrinciple`/`SubSubPrinciple`.

`docs/game-model/ADN-modelo-de-juego-especificacion-tecnica.md` supersedes this design entirely. The team's identity now lives in a different, ADN-specific hierarchy — `Fase → Principio → Subprincipio → Zona (0..N) → SubSubPrincipio → Habilidad`, plus `Nota` (anchored at any level), a flat `SetPieceRule` list for the "Balón parado" phase, and `OpenIssue` — derived mechanically (with stable, re-importable `key`s) from `docs/game-model/ADN-Modelo-de-Juego-Legible.md`. `GameScenario`, `ZoneRule`, `Trigger`, and `RuleException` disappear as concepts. The user has also decided that exercises and training sessions will no longer reference the game model at all — that linkage is removed, not migrated.

This is a full replacement, not an incremental change: existing `GameModel` data can be deleted, and there is no dual-write/compatibility period.

## What Changes

- **Backend**: replace the domain hierarchy under `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/` with `GameModel → GamePrinciple → Subprincipio → Zona (0..N, optional) → SubSubPrincipio → Habilidad`, plus `Nota` (polymorphic anchor to Principio/Subprincipio/Zona/SubSubPrincipio), `SetPieceRule` (flat, only for the `balon-parado` `GameMoment`), and `OpenIssue`. `GameMoment`/`GameZone` catalogs are kept (they already match `faseSlug`/`zoneKey`). `Habilidad.Nombre` is restricted to the 14-value closed vocabulary from §4 of the spec. A **markdown importer** parses `ADN-Modelo-de-Juego-Legible.md` following the parsing/key-derivation rules in §1–§5 of the spec and upserts by `key`, used both as an EF Core seed (so the real ADN doesn't have to be entered by hand) and as a rerunnable tool if the legible document changes. All existing `GameModel`-family tables are dropped and recreated by a fresh migration — no data-preserving migration path.
- **Backend — unlink exercises/sessions**: remove `SubSubPrincipleId`/`SubPrincipleId`/`ScenarioId` from `TaskTrainingBase`, the `TaskTrainingSkill` join table (Exercise↔EssentialSkill), and `SubPrincipleId` from `TrainingSession`, along with every handler/query that reads or writes them (`CreateExercise`, `UpdateExercise`, `GetExercises`, `GetExerciseById`, `CreateSession`, `GetSession`, `GetSessions`) and the `GetSubSubPrinciple`/`ToggleSkillMastered`/`MoveScenarioLocation`/media-upload endpoints tied to the removed shape.
- **Frontend**: `pages/game-model/` is rewritten to browse/edit the new hierarchy and to render it the way `ADN-Modelo-de-Juego-Legible.md` reads (Fase → Principio → Subprincipio → Zona → SubSubPrincipio → Habilidad, with Notas inline and SetPieceRules as a flat "Balón parado" section) instead of the current tabbed moment/zone accordion. `CreateSessionFromSubPrinciple.tsx`, `SessionsFromSubPrinciple.tsx`, `PrincipleExercisesSection.tsx`, `SubSubPrincipleCard.tsx`'s exercise embedding, and the `subSubPrincipleId`/`subPrincipleId`/`scenarioId` fields on the exercise form (`useExerciseForm.ts`, `ExerciseFormPanel.tsx`, `NewExercisePage.tsx`, `ExerciseDialog.tsx`, `ExerciseCromo.tsx`, `types/training.ts`, `trainingService.ts`) are removed — exercises/sessions become fully independent of the game model.

## Capabilities

### Modified Capabilities
- `game-model`: full replacement of the domain hierarchy and its CRUD API per the new ADN spec; adds a markdown-driven seed/import; drops the moment/zone-scoped `GamePrinciple`/`GameScenario`/`SubPrinciple`/`SubSubPrinciple`/`EssentialSkill` design; read/edit views reproduce the legible document's structure.
- `exercises` / `sessions`: lose every field, endpoint parameter, and UI control that referenced the game model. No replacement linkage.

## Impact

- **Backend** (`Back/ExtractionApi/`): full rewrite of `Domain/Aggregates/GameModels/*`, `Features/Coaches/GameModels/*`, `Infrastructure/Persistence/Configuration/Aggregates/GameModels/*`, `AppDbContext.cs`; new markdown importer service + seed migration; edits to `Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`, `TaskTrainingSkill.cs`, `TrainingSession.cs` and their EF configs; edits to `Features/Coaches/Trainings/Exercises/*` and `Features/Coaches/Trainings/Sessions/*`; all GameModel-related backend tests rewritten.
- **Frontend** (`Front/`): full rewrite of `apps/coach/pages/game-model/*`, `apps/coach/context/GameModelDraftContext.tsx`, `apps/coach/services/gameModelService.ts` + `gameModelMock.ts`, `apps/coach/types/gameModel.ts`; edits to `pages/trainings/**` files listed above to drop the game-model fields; all co-located tests rewritten.
- No changes to `Mobile/`.
