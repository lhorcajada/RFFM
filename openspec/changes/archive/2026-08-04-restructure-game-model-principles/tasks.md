## 1. Backend — domain & EF tests first (~1.5h)
- [x] Domain tests (or handler-level tests if this repo doesn't have a separate domain test project for `RFFM.Api` — check `Back/ExtractionApi/tests/` structure first) for `GamePrinciple`: `Create` with valid/empty title, `UpdateTitle`/`UpdateDescription`/`UpdateOrder`.
- [x] `GameScenario` test: `ReparentTo` changes `GamePrincipleId`.
- **Verify (Red)**: `dotnet test --filter GamePrinciple` from `Back/ExtractionApi` — fails to compile (entity doesn't exist yet).

## 2. Backend — domain & EF implementation (~2h)
- [x] `Domain/Aggregates/GameModels/GamePrinciple.cs` per design.md §1.1.
- [x] `GameScenario.cs`: remove `GameMomentId`/`GameZoneId`/`GameMoment`/`GameZone`/`TacticalPrinciples`/`UpdateMomentAndZone`; add `GamePrincipleId`/`GamePrinciple`/`ReparentTo`; update constructor.
- [x] `GameModel.cs`: `Scenarios` → `Principles` (`List<GamePrinciple>`).
- [x] Delete `ScenarioTacticalPrinciple.cs`, `Domain/Aggregates/Training/TacticalGoalsEnum.cs`.
- [x] New `GamePrincipleConfiguration.cs`; update `GameModelConfiguration.cs`, `GameScenarioConfiguration.cs`; delete `ScenarioTacticalPrincipleConfiguration.cs` and the `TacticalGoalsEnum` EF config file.
- [x] `AppDbContext.cs`: add `GamePrinciples` DbSet, remove `ScenarioTacticalPrinciples`/`TacticalGoals` DbSets.
- **Verify (Green)**: `dotnet build` from `Back/ExtractionApi` — compiles (feature handlers will still reference old shapes until step 4 — expect build errors there until this whole backend section is done; treat steps 1-6 as one red/green unit if the codebase doesn't compile mid-way).

## 3. Backend — migration (~2h)
- [x] Generate scaffold: `dotnet ef migrations add RestructureGameModelPrinciples --project src/RFFM.Api --startup-project src/RFFM.Host` from `Back/ExtractionApi`.
- [x] Hand-edit `Up()`/`Down()` per design.md §3 (schema ops + raw-SQL data migration + drops), following the raw-SQL technique in `20260723162135_FixTacticalPrincipleForeignKeys.cs`.
- [x] Apply locally against the dev DB and verify: every pre-existing `GameScenario` now has a non-null `GamePrincipleId`, and the linked `GamePrinciple.Title` equals the scenario's `Name`.
- [x] Confirm `TacticalGoals`/`ScenarioTacticalPrinciples` tables are gone.
- **Verify**: `dotnet ef database update --project src/RFFM.Api --startup-project src/RFFM.Host` succeeds; manual SQL check of the migrated data.

## 4. Backend — feature files tests first (~2h)
- [x] Rewrite/replace `CreateGameModelHandlerTests`/`UpdateGameModelHandlerTests` (or add if none exist today — check first) for the `Principles` nesting: create/update/delete principle, create/update/delete scenario within a principle, principle matching by id and by `(GameMomentId, GameZoneId, Order)` fallback.
- [x] Rewrite `MoveScenarioLocationHandlerTests` for move-to-principle semantics (design.md §4.3 / spec.md scenarios): move to different principle, no-op on same principle, source-principle renumbering, cross-model target rejected, access denied, unknown scenario/principle.
- [x] Delete `GameModelTacticalPrincipleForeignKeyTests.cs` and `UpdateGameModelResavePrinciplesTests.cs` (their subject no longer exists).
- [x] `GetGameModel` test coverage for the new `Principles`/`PrincipleResponse` shape (no `TacticalPrinciples` in the response).
- **Verify (Red)**: `dotnet test --filter GameModel` from `Back/ExtractionApi` — failing (handlers not yet updated).

## 5. Backend — feature files implementation (~3h)
- [x] `CreateGameModel.cs` / `UpdateGameModel.cs`: `PrincipleRequest`/`ScenarioRequest` restructure per design.md §4.1; handler upsert logic one level deeper; delete the tactical-principles diff block.
- [x] `GetGameModel.cs`: `PrincipleResponse`/`ScenarioResponse` restructure per design.md §4.2; drop `TacticalPrincipleDto`/`TacticalGoalsEnum` lookup.
- [x] `MoveScenarioLocation.cs`: re-scope request/command/handler to move-to-principle per design.md §4.3.
- [x] Delete `Queries/GetTechnicalGoals.cs`.
- **Verify (Green)**: `dotnet test --filter GameModel` from `Back/ExtractionApi` — all green.
- **Verify**: `dotnet build` from `Back/ExtractionApi` — clean, no remaining references to removed types.

## 6. Frontend — types & mocks (~1h)
- [x] `apps/coach/types/gameModel.ts`: add `Principle`, restructure `Zone`, remove `TacticalPrinciple` and `Scenario.tacticalPrinciples` per design.md §6.
- [x] `apps/coach/services/gameModelMock.ts`: restructure fixtures with a `principles` layer per design.md §9; remove `mockAvailableTacticalPrinciples`.
- **Verify**: `npx tsc --noEmit` (or `npm run build`) from `Front/` fails at this point (consumers not yet updated) — expected; proceed to next sections before re-checking.

## 7. Frontend — reducer tests first (~1.5h)
- [x] Extend `apps/coach/context/__tests__/GameModelDraftContext.test.tsx`: `ADD_PRINCIPLE`/`UPD_PRINCIPLE`/`DEL_PRINCIPLE`, `ADD_SCENARIO`/`UPD_SCENARIO`/`DEL_SCENARIO` addressed through the new principle index, `MOVE_SCENARIO_LOCATION` with a principle-target payload (renumber source, append to target).
- **Verify (Red)**: `npm run test -- GameModelDraftContext` from `Front/` — failing.

## 8. Frontend — reducer & service implementation (~1.5h)
- [x] `apps/coach/context/GameModelDraftContext.tsx` per design.md §7.
- [x] `apps/coach/services/gameModelService.ts` per design.md §8: `ApiPrinciple`, restructured mapping functions, remove `getAvailableTacticalPrinciples`, rename to `moveScenarioToPrinciple`.
- **Verify (Green)**: `npm run test -- GameModelDraftContext` from `Front/`.

## 9. Frontend — UI tests first (~2h)
- [x] `ScenarioFormAccordion.test.tsx`: remove "Principios tácticos colectivos" assertions; add principle create/edit/delete coverage; "Mover a…" now targets a principle.
- [x] `ScenarioAccordion.test.tsx`: remove tactical-principles assertions/fixtures; add principle heading assertions.
- **Verify (Red)**: `npm run test -- ScenarioFormAccordion` and `npm run test -- ScenarioAccordion` from `Front/` — failing.

## 10. Frontend — UI implementation (~3h)
- [x] `ScenarioFormAccordion.tsx` per design.md §10: principle section (title/description fields, add/delete), scenarios nested under a principle, remove the tactical-principles `Autocomplete`, re-target the "Mover a…" control to a principle select.
- [x] `ScenarioAccordion.tsx` and `GameModelPrintView.tsx`: principle heading, remove tactical-principles rendering. `GameModelPrintView.tsx` is the component behind the "Imprimir PDF" button (`GameModel.tsx` → `window.print()`) — it renders `zone.principles → principle.title/description → scenarios`, with no tactical-principles block.
- [x] Prune now-unused CSS (`.principlesField`/`.principlesAutocomplete` etc.) from the co-located `.module.css` files.
- [x] New `components/__tests__/GameModelPrintView.test.tsx` (previously had zero dedicated coverage — `GameModel.test.tsx` only mocks it as `<div data-testid="print-view" />`): asserts principle title/description render as a heading above scenarios, empty description is omitted, empty-zone message, no "Principios tácticos colectivos" text anywhere, and the document header (team/season) still renders.
- **Verify (Green)**: `npm run test -- ScenarioFormAccordion`, `npm run test -- ScenarioAccordion`, and `npm run test -- GameModelPrintView` from `Front/` — all passing (5/5 for the new print-view suite).

## 10b. Frontend — PDF/print and UI polish requested after initial review (~1.5h)
- [x] `GameModelPrintView.tsx`/`.module.css`: principle headings now read "Principio: {title}" (was bare title); scenario photos (`mediaType === "image"`) are now rendered as an `<img>` in the print output, videos show a "Vídeo disponible en la aplicación." note instead; removed `break-after`/`page-break-after: avoid` from `.momentTitle`/`.zoneTitle`/`.principleTitle` and `break-inside`/`page-break-inside: avoid` from `.scenario` — chained together these forced the entire first moment/zone/principle/first-scenario into one unbreakable block, which print pagination then pushed whole onto page 2, leaving page 1 with only the document header. New tests in `GameModelPrintView.test.tsx` cover the prefix and image/video rendering.
- [x] `ScenarioAccordion.tsx` (read view): principle detail heading and mobile `detailTitle` also prefixed "Principio: {title}" for consistency with the PDF and with the edit form's existing `Principio: ` prefix in `ScenarioFormAccordion.tsx`.
- [x] `GameModel.tsx` (read view): the heading above the principles list now reads "Principios" instead of repeating the already-visible zone name from the zone chips above it.
- [x] `GameModelCreate.module.css`: `.zoneTab.Mui-selected` had poor contrast (blue text with no background distinction) — now white text on a translucent blue pill background, brighter/thicker selected indicator.
- **Verify (Red → Green)**: `npm run test -- GameModelPrintView GameModel.test ScenarioAccordion.test ScenarioFormAccordion.test GameModelDraftContext.test` from `Front/` — all passing. `npm run build` clean.
- **Not verified**: the PDF pagination fix is a CSS reasoning fix (removing a documented print-pagination "keep-with-next" chaining bug), not something Vitest/jsdom can render/paginate — recommend a manual `window.print()` → "Guardar como PDF" check in a real browser before considering this fully closed.

## 10c. Frontend — follow-up fixes from visual review (~1h)
- [x] `GameModel.module.css` `.zoneChipSelected` (read view) and `GameModelCreate.module.css` `.zoneTab.Mui-selected` (edit view): both had low-contrast selected states (dark-on-dark / translucent). Replaced with a solid `#2f6fa8` background and bold white text, matching in both views; the scenario/principle count chip nested inside also got a matching selected-state override.
- [x] Zone tab/chip counter was summing scenarios across all principles in the zone; changed to `zone.principles.length` in both `GameModel.tsx` and `GameModelCreate.tsx`, since the label is "N principios", not "N escenarios". New `GameModelCreate.test.tsx` (previously had zero coverage) and an updated `GameModel.test.tsx` fixture (principle count now deliberately differs from scenario count) cover this.
- [x] `GameModelPrintView.tsx`: the scenario photo wasn't loading in the printed PDF because `mediaUrl` is typically a relative storage key, not an absolute URL — it needs `resolveMediaUrl()` (same helper `ScenarioAccordion.tsx` already uses for the on-screen viewer) to become `/api/public/storage?url=...`. Applied it; new test asserts a relative media URL resolves correctly.
- **Verify (Green)**: `npm run test -- GameModelPrintView GameModel.test GameModelCreate.test` and `npm run build` from `Front/` — all passing.

## 11. Full verification & manual check (~1h)
- [x] `dotnet build && dotnet test` from `Back/ExtractionApi` — full green.
- [x] `npm run build && npm run test` from `Front/` — full green.
- [x] Manual check in dev: open a migrated game model, confirm each pre-existing scenario now appears under a generated principle titled with its old name; create a new principle with two scenarios; delete a principle; move a scenario to a different principle; confirm the tactical-principles selector is gone from the form and from the read/print views.
- [x] `openspec validate restructure-game-model-principles --strict`.
- [x] Confirm with user before commit/push (per `.claude/rules/git.md` §6.3) — note this touches a **destructive migration** (drops `ScenarioTacticalPrinciples`/`TacticalGoals` tables), flag that explicitly when asking.
- [x] Archive to `openspec/changes/archive/<date>-restructure-game-model-principles/` once merged.
