## 1. Backend — tests first (~1.5h)
- [ ] `tests/RFFM.Api.Tests/IntegrationTests/MoveScenarioLocationHandlerTests.cs` (new, `[Collection(PostgresCollection.Name)]`, same seeding pattern as `UpdateGameModelResavePrinciplesTests.cs`): seed a `GameModel` with scenarios across at least two moment/zone combos, including one scenario with nested `SubPrinciples`/`SubSubPrinciples`/`EssentialSkills`.
  - [ ] Moving to a different moment/zone updates `GameMomentId`/`GameZoneId`, sets `Order` = target-zone-count + 1, leaves nested content untouched.
  - [ ] Remaining scenarios in the source moment/zone are renumbered contiguously `1..N`.
  - [ ] Requesting the scenario's current moment/zone is a no-op (order unchanged, no renumbering).
  - [ ] Unknown `scenarioId` → `GameModelNotFound`.
  - [ ] User without club access → `GameModelAccessDenied`.
  - [ ] Validator: empty `ScenarioId`, non-positive `GameMomentId`/`GameZoneId` rejected.
- **Verify (Red)**: `dotnet test --filter MoveScenarioLocationHandlerTests` from `Back/ExtractionApi` — compile error / all failing (command doesn't exist yet).

## 2. Backend — implement `MoveScenarioLocation` feature (~1.5h)
- [ ] `Features/Coaches/GameModels/Commands/MoveScenarioLocation.cs`: `IFeatureModule` (`PATCH /api/game-models/scenarios/{scenarioId}/location`), `MoveScenarioLocationCommand`/`Result`, handler (access check pattern from `ToggleSkillMastered.cs`), `MoveScenarioLocationValidator`.
- [ ] Handler logic: load scenario + siblings in same `GameModelId`, no-op on same location, compute target order, call `GameScenario.UpdateMomentAndZone`/`UpdateOrder`, renumber source-zone siblings, `SaveChangesAsync`.
- **Verify (Green)**: `dotnet test --filter MoveScenarioLocationHandlerTests` from `Back/ExtractionApi` — all green.
- **Verify**: `dotnet build` from `Back/ExtractionApi`.

## 3. Frontend — reducer tests first (~1h)
- [ ] Add/extend a `GameModelDraftContext` test file under `apps/coach/context/__tests__/` (new, follow `frontend-testing.md` co-location convention) covering the `MOVE_SCENARIO_LOCATION` reducer case:
  - [ ] Removes scenario from source zone, renumbers remaining source scenarios `1..N`.
  - [ ] Appends scenario to target zone with the given `order`, preserving nested `subPrinciples`/`tacticalPrinciples`/`mediaUrl` unchanged.
  - [ ] Defaults `order` to `targetZone.scenarios.length + 1` when not provided (unsaved-scenario path).
- **Verify (Red)**: `npm run test -- GameModelDraftContext` from `Front/` — failing (action type doesn't exist yet).

## 4. Frontend — reducer + service implementation (~1h)
- [ ] `apps/coach/context/GameModelDraftContext.tsx`: add `MOVE_SCENARIO_LOCATION` action + reducer case (remove + renumber source, append to target).
- [ ] `apps/coach/services/gameModelService.ts`: add `moveScenarioLocation(scenarioApiId, gameMomentId, gameZoneId)` calling `PATCH /api/game-models/scenarios/{id}/location`.
- **Verify (Green)**: `npm run test -- GameModelDraftContext` from `Front/`.

## 5. Frontend — UI control tests first (~1.5h)
- [ ] Extend `apps/coach/pages/game-model/components/__tests__/ScenarioFormAccordion.test.tsx`:
  - [ ] Move selects default to current moment/zone; move button disabled when target unchanged.
  - [ ] Scenario with `apiId`: confirming calls `gameModelService.moveScenarioLocation` with correct ids and dispatches `MOVE_SCENARIO_LOCATION` with the returned `order`.
  - [ ] Scenario without `apiId`: confirming dispatches `MOVE_SCENARIO_LOCATION` without calling the service.
  - [ ] Service rejection: emits `rffm.show_snackbar` error event, does not dispatch `MOVE_SCENARIO_LOCATION`.
- **Verify (Red)**: `npm run test -- ScenarioFormAccordion` from `Front/` — failing (no move control yet).

## 6. Frontend — UI control implementation (~1.5h)
- [ ] `ScenarioFormAccordion.tsx` (`ScenarioDetailForm`): add "Mover a…" moment/zone `Select`s + move `Button`, `handleMove` per design.md (calls service when `apiId` present, dispatches reducer action, error → snackbar event).
- [ ] Co-located `.module.css` additions only if needed for the new control (reuse existing form field styling patterns first).
- **Verify (Green)**: `npm run test -- ScenarioFormAccordion` from `Front/`.

## 7. Full verification & manual check (~0.5h)
- [ ] `dotnet build && dotnet test` from `Back/ExtractionApi` — full green.
- [ ] `npm run build && npm run test` from `Front/` — full green.
- [ ] Manual check in dev: open a saved game model, move a scenario with existing sub-principles/skills to a different moment/zone, confirm it disappears from the original tab and appears (with content intact) under the new one, and that reloading the page (re-fetch from API) still shows it there.
- [ ] `openspec validate move-game-scenario --strict`.
- [ ] Confirm with user before commit/push (per `.claude/rules/git.md` §6.3).
- [ ] Archive to `openspec/changes/archive/<date>-move-game-scenario/` once merged.
