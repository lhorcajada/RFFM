Technical script for the implementer agent(s). Backend first (Frontend depends on the `PATCH /api/game-models/scenarios/{scenarioId}/location` contract), then Frontend. Follow strict TDD (Red → Green → Refactor) per `CLAUDE.md` / `.claude/rules/testing.md` / `.claude/rules/frontend-testing.md`.

## Phase A — Backend (`back-specialist`, `Back/ExtractionApi/`)

1. **Red**: create `tests/RFFM.Api.Tests/IntegrationTests/MoveScenarioLocationHandlerTests.cs`, `[Collection(PostgresCollection.Name)]`, mirroring the seeding pattern in `UpdateGameModelResavePrinciplesTests.cs` (`SeedGameModelWithPrinciplesAsync`-style helper: create Club → Season → Team → UserClub → GameModel with scenarios spread across at least two moment/zone combos, one scenario carrying nested `SubPrinciples`/`SubSubPrinciples`/`EssentialSkills`). Reference `Features.Coaches.GameModels.Commands.MoveScenarioLocationCommand` (doesn't exist yet — compile failure is the expected Red state). Cases:
   - Moving to a different moment/zone updates `GameMomentId`/`GameZoneId`, sets `Order` = (count of existing scenarios already in target moment/zone) + 1, and all nested `TacticalPrinciples`/`SubPrinciples`/`SubSubPrinciples`/`EssentialSkills` ids/content are unchanged.
   - Scenarios remaining in the source moment/zone after the move are renumbered to a contiguous `1..N` sequence ordered by their previous `Order`.
   - Requesting the scenario's current moment/zone is a no-op: `Order` unchanged, no sibling renumbering triggered, handler returns the current order.
   - Unknown `scenarioId` throws `DomainException` with `ErrorCodes.GameModelNotFound`.
   - A user without a `UserClub` link to the scenario's team's club throws `DomainException` with `ErrorCodes.GameModelAccessDenied`.
   - `MoveScenarioLocationValidator` rejects empty `ScenarioId` and non-positive `GameMomentId`/`GameZoneId`.
   Run `dotnet test --filter MoveScenarioLocationHandlerTests` from `Back/ExtractionApi` — confirm failures (compile errors acceptable as Red).

2. **Green**: create `Features/Coaches/GameModels/Commands/MoveScenarioLocation.cs` following the single-purpose PATCH pattern from `Features/Coaches/GameModels/Commands/ToggleSkillMastered.cs` (not `UpdateGameModel`'s full-resave pattern):
   - `IFeatureModule.AddRoutes`: `app.MapPatch("/api/game-models/scenarios/{scenarioId}/location", ...)`, extract `userId` from the `nameidentifier` claim exactly as `ToggleSkillMastered`/`UpdateGameModel` do, `RequireAuthorization()`, tag `GameModelConstants.Tag`.
   - `MoveScenarioLocationRequest(int GameMomentId, int GameZoneId)` — request body.
   - `MoveScenarioLocationCommand(string ScenarioId, int GameMomentId, int GameZoneId, string UserId) : IRequest<MoveScenarioLocationResult>, IRequireFeaturePermission` with `FeatureRoute => CoachFeatureRoutes.GameModel` and `RequiredPermission => "ReadWrite"`.
   - `MoveScenarioLocationResult(int Order)`.
   - Handler (`AppDbContext _db`):
     - Load the scenario by id (`_db.GameScenarios.FirstOrDefaultAsync`); throw `GameModelNotFound` if missing.
     - Access check: join `GameScenarios → GameModels → Teams → UserClubs`, `AnyAsync(uc => uc.ApplicationUserId == request.UserId)` (same shape as `ToggleSkillMastered`); throw `GameModelAccessDenied` if false.
     - Load all sibling scenarios in the same `GameModelId` (excluding itself).
     - If `scenario.GameMomentId == request.GameMomentId && scenario.GameZoneId == request.GameZoneId`, return `new MoveScenarioLocationResult(scenario.Order)` without further changes.
     - Otherwise: capture `(oldMomentId, oldZoneId)`; `newOrder = siblings.Count(s => s.GameMomentId == request.GameMomentId && s.GameZoneId == request.GameZoneId) + 1`; call `scenario.UpdateMomentAndZone(request.GameMomentId, request.GameZoneId)` and `scenario.UpdateOrder(newOrder)`; renumber `siblings.Where(s => s.GameMomentId == oldMomentId && s.GameZoneId == oldZoneId).OrderBy(s => s.Order)` to `1..N` via `UpdateOrder`.
     - `await _db.SaveChangesAsync(ct)`; return `new MoveScenarioLocationResult(scenario.Order)`.
   - `MoveScenarioLocationValidator : AbstractValidator<MoveScenarioLocationCommand>`: `RuleFor(x => x.ScenarioId).NotEmpty()`, `RuleFor(x => x.GameMomentId).GreaterThan(0)`, `RuleFor(x => x.GameZoneId).GreaterThan(0)`.
   - No domain or `AppDbContext`/migration changes — `GameScenario.UpdateMomentAndZone`/`UpdateOrder` already exist.

3. Run `dotnet test --filter MoveScenarioLocationHandlerTests` from `Back/ExtractionApi` — confirm green, then `dotnet build && dotnet test` for the full suite.

## Phase B — Frontend (`front-specialist`, `Front/`)

1. **Red → Green** (reducer): add a test file `apps/coach/context/__tests__/GameModelDraftContext.test.tsx` (new — none exists yet for this context) covering the `MOVE_SCENARIO_LOCATION` action: removes the scenario from the source zone and renumbers remaining source scenarios `1..N`; appends it to the target zone preserving `subPrinciples`/`tacticalPrinciples`/`mediaUrl`/`mediaType` unchanged; defaults `order` to `targetZone.scenarios.length + 1` when the action omits `order` (unsaved-scenario path). Run `npm run test -- GameModelDraftContext` — confirm Red (action type unknown to the reducer, case falls through to `default`).
   Then implement in `apps/coach/context/GameModelDraftContext.tsx`:
   - Add to the `Action` union: `| { type: "MOVE_SCENARIO_LOCATION"; fromMi: number; fromZi: number; si: number; toMi: number; toZi: number; order?: number }`.
   - Add a `case "MOVE_SCENARIO_LOCATION":` per `design.md` (remove-and-renumber-source, then append-to-target using the existing `mapAt` helper — do not introduce a new helper).
   Run `npm run test -- GameModelDraftContext` — confirm green.

2. **Service**: add to `apps/coach/services/gameModelService.ts`:
   ```ts
   async moveScenarioLocation(scenarioApiId: string, gameMomentId: number, gameZoneId: number): Promise<{ order: number }> {
     const res = await client.patch<{ order: number }>(`/api/game-models/scenarios/${scenarioApiId}/location`, { gameMomentId, gameZoneId });
     return res.data;
   },
   ```

3. **Red → Green** (UI): extend `apps/coach/pages/game-model/components/__tests__/ScenarioFormAccordion.test.tsx`:
   - Move selects default to the scenario's current moment/zone (`mi`/`zi` props); the move button is disabled when the selected target equals the current location.
   - For a scenario with `apiId` set: selecting a different target and confirming calls `gameModelService.moveScenarioLocation` with the target moment/zone ids, then dispatches `MOVE_SCENARIO_LOCATION` with the `order` returned by the mocked service.
   - For a scenario without `apiId`: confirming dispatches `MOVE_SCENARIO_LOCATION` directly, without calling the service.
   - When the mocked service rejects: a `rffm.show_snackbar` event is dispatched (assert via a `window.addEventListener` spy) with an error `detail`, and `MOVE_SCENARIO_LOCATION` is NOT dispatched.
   Mock `gameModelService` per the file's existing `vi.mock(...)` conventions (declared before the component import). Run `npm run test -- ScenarioFormAccordion` — confirm Red.
   Then implement in `ScenarioFormAccordion.tsx` (`ScenarioDetailForm`): add the "Mover a…" moment/zone `Select`s (options from `draft.gameMoments` and `draft.gameMoments[targetMi].zones`) + a "Mover" `Button`, `handleMove` exactly as specified in `design.md` (await the service call only when `scenario.apiId` is set; dispatch `MOVE_SCENARIO_LOCATION`; catch → `window.dispatchEvent(new CustomEvent("rffm.show_snackbar", { detail: { message, severity: "error" } }))`). Reuse existing CSS Module classes in `ScenarioFormAccordion.module.css` where the visual shape matches (e.g. field spacing classes already used for `Autocomplete`/`TextField` rows); add new classes only if nothing fits.
   Run `npm run test -- ScenarioFormAccordion` — confirm green.

4. Run `npm run build && npm run test` from `Front/` — confirm full green, no skipped tests.

## Phase C — Verification & handoff

1. `dotnet build && dotnet test` (Back/ExtractionApi) and `npm run build && npm run test` (Front/) both green.
2. Manual check in dev (`cd Back/ExtractionApi && dotnet run --project src/RFFM.Host`, `cd Front && npm run dev`): open a saved game model in edit mode, move a scenario that has sub-principles/skills to a different moment/zone, confirm it disappears from the original tab and appears (content intact) under the new one; reload the page (re-fetch) and confirm the move persisted.
3. `openspec validate move-game-scenario --strict` — no errors.
4. Report back to the user with a diff summary; **do not commit/push** until the user explicitly confirms (per `.claude/rules/git.md` §6.3).
