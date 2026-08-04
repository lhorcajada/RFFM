## Why

The Coach game-model editor (`GameModelCreate.tsx`) organizes `GameScenario`s in a fixed grid of Momento de Juego × Zona de Juego tabs. Today the only way to reclassify a scenario into a different moment/zone is to delete it and recreate it from scratch, losing its tactical principles, sub-principles, sub-sub-principles, essential skills and media — or to hand-edit `GameMomentId`/`GameZoneId` in a full model resave. The domain already exposes `GameScenario.UpdateMomentAndZone(momentId, zoneId)`, but no endpoint calls it. Coaches need to move a scenario (with all its content intact) to a different moment/zone directly from the edit view, saved immediately, without waiting for the general "Guardar cambios" action.

## What Changes

- **Backend**: new atomic endpoint `PATCH /api/game-models/scenarios/{scenarioId}/location` (`MoveScenarioLocation` feature, `Features/Coaches/GameModels/Commands/`) that reassigns a `GameScenario`'s `GameMomentId`/`GameZoneId`, appends it to the end of the target moment/zone's order, and renumbers the remaining scenarios left behind in the source moment/zone. All nested content (tactical principles, sub-principles, sub-sub-principles, essential skills, media) is untouched — only the FKs and `Order` change.
- **Frontend**: in `ScenarioFormAccordion.tsx` (`ScenarioDetailForm`), add a "Mover a…" control with two selects (Momento de Juego, Zona de Juego) and a confirm button. For an already-persisted scenario (`scenario.apiId` set), confirming calls the new endpoint immediately and updates the local draft on success. For a scenario not yet saved (no `apiId`), the move only updates the local draft (nothing to persist yet). The scenario disappears from its previous moment/zone tab and appears under the new one without a full page reload.

## Capabilities

### Modified Capabilities
- `game-model`: `GameScenario` gains an atomic move operation independent from `UpdateGameModel`'s full resave; Coach editor UI gains a per-scenario relocate control.

## Impact

- **Backend** (`Back/ExtractionApi/`): new `Features/Coaches/GameModels/Commands/MoveScenarioLocation.cs` (command + handler + validator), no domain changes (reuses existing `GameScenario.UpdateMomentAndZone`/`UpdateOrder`), handler tests.
- **Frontend** (`Front/`): `apps/coach/services/gameModelService.ts` (new `moveScenarioLocation` call), `apps/coach/context/GameModelDraftContext.tsx` (new `MOVE_SCENARIO_LOCATION` action), `apps/coach/pages/game-model/components/ScenarioFormAccordion.tsx` (new move control), corresponding tests.
- No changes to `Mobile/`.
