## 1. Backend — domain tests first (~2h)
- [x] Tests for `Subprincipio.Create`, `Zona.Create`, `SubSubPrincipio.Create` (exactly-one-of `SubprincipioId`/`ZonaId`, rejects both-set and both-null), `Habilidad.Create` (accepts the 14-value vocabulary, rejects an unknown name), `Nota.Create` (exactly-one-of the four anchor ids).
- **Verify (Red)**: `dotnet test --filter GameModel` from `Back/ExtractionApi` — fails to compile (new entities don't exist yet).

## 2. Backend — domain implementation (~2.5h)
- [x] New entities per design.md §1: `Subprincipio.cs`, `Zona.cs`, `SubSubPrincipio.cs` (new shape), `Habilidad.cs`, `Nota.cs`, `SetPieceRule.cs`, `OpenIssue.cs`; rewrite `GamePrinciple.cs` (drop `GameZoneId`, add `Key`, `Subprincipios` nav); rewrite `GameModel.cs` (`Principles` stays, add `Notas`, `SetPieceRules`, `OpenIssues`).
- [x] Delete `GameScenario.cs` and the old `SubPrinciple.cs`/`SubSubPrinciple.cs`/`EssentialSkill.cs`.
- **Verify (Green)**: `dotnet test --filter GameModel` from `Back/ExtractionApi` — domain tests pass (build will still fail elsewhere until later sections — expected).

## 3. Backend — EF configuration & DbContext (~1.5h)
- [x] New configs for every new entity under `Infrastructure/Persistence/Configuration/Aggregates/GameModels/`; update `GamePrincipleConfiguration.cs`, `GameModelConfiguration.cs`; delete configs for removed entities.
- [x] `AppDbContext.cs`: add/remove `DbSet<>`s per the new/removed entities.
- **Verify**: `dotnet build` from `Back/ExtractionApi` fails only on `Features/Coaches/GameModels/*` and the exercise/session files touched in §5-6 — confirm no other unexpected errors.

## 4. Backend — unlink exercises/sessions (~2h)
- [x] `TaskTrainingBase.cs`: remove `SubSubPrincipleId`/`SubPrincipleId`/`ScenarioId` + navs. Delete `TaskTrainingSkill.cs`. `TrainingSession.cs`: remove `SubPrincipleId`.
- [x] Update `TaskTrainingBaseEntityConfiguration.cs`; delete `TaskTrainingSkillConfiguration.cs`.
- [x] `CreateExercise.cs`/`UpdateExercise.cs`/`GetExercises.cs`/`GetExerciseById.cs`: drop the three id fields, "at most one" validator rule, `Include()`s, name projections.
- [x] `CreateSession.cs`/`GetSession.cs`/`GetSessions.cs`: drop `SubPrincipleId`.
- [x] Delete `ExerciseSubPrincipleAssignmentTests.cs`; strip game-model fields from `CreateExerciseHandlerTests.cs`, `GetExerciseByIdHandlerTests.cs`, `GetExercisesHandlerTests.cs`, `UpdateExerciseHandlerTests.cs`; delete `DeleteScenarioMediaHandlerTests.cs`, `UploadScenarioMediaHandlerTests.cs`.
- **Verify**: `dotnet build` from `Back/ExtractionApi` — no remaining references to removed exercise/session fields.

## 5. Backend — markdown importer (~3h)
- [x] Golden-fixture test first: use spec §6's example transcription as the expected import output for that fragment of `ADN-Modelo-de-Juego-Legible.md`.
- **Verify (Red)**: importer test fails (importer doesn't exist).
- [x] Implement `AdnLegibleImporter` per design.md §2: heading parsing (spec §2), Zona special cases (spec §3), closed vocabulary check (spec §4), flat `SetPieceRule` parsing (spec §5), two-pass `(misma que X.Y.Z)` resolution (spec §8), reject-not-guess behavior for unresolved Zona/Habilidad.
- **Verify (Green)**: importer golden-fixture test passes; run importer against the full real `ADN-Modelo-de-Juego-Legible.md` and manually spot-check counts (number of Fases/Principios/Subprincipios) look right.

## 6. Backend — feature files tests first (~2h)
- [x] Rewrite `CreateGameModelHandlerTests.cs`/`UpdateGameModelHandlerTests.cs` for the new nested request shape (Principio→Subprincipio→(Zona|direct)→SubSubPrincipio→Habilidad, plus Notas/SetPieceRules/OpenIssues).
- [x] Rewrite `GetGameModelPrincipleShapeTests.cs`/`GetGameModelHandlerMediaTests.cs` (rename/repurpose the latter — no more media) for the new response shape.
- [x] Delete `MoveScenarioLocationHandlerTests.cs`, `GameScenarioReparentToTests.cs`, `GamePrincipleTests.cs` (old shape), `RestructureGameModelPrinciplesMigrationTests.cs` (superseded by the new migration's own test from §7).
- **Verify (Red)**: `dotnet test --filter GameModel` from `Back/ExtractionApi` — failing (handlers not yet updated).

## 7. Backend — feature files implementation + migration (~3.5h)
- [x] `CreateGameModel.cs`/`UpdateGameModel.cs`/`GetGameModel.cs` per design.md §5.
- [x] Delete `MoveScenarioLocation.cs`, `ToggleSkillMastered.cs`, `UploadScenarioMedia.cs`, `DeleteScenarioMedia.cs`, `GetSubSubPrinciple.cs`.
- [x] Generate migration: `dotnet ef migrations add ReplaceGameModelAdnHierarchy --project src/RFFM.Api --startup-project src/RFFM.Host` from `Back/ExtractionApi`; hand-edit per design.md §3 (drop old tables/columns, create new ones); add XML doc comment noting it is data-destructive by design.
- [x] Wire the importer as a one-time seed step (design.md §2.1) targeting the user's real team/season, reading the actual `ADN-Modelo-de-Juego-Legible.md`.
- **Verify (Green)**: `dotnet test --filter GameModel` from `Back/ExtractionApi` — all green. `dotnet ef database update --project src/RFFM.Api --startup-project src/RFFM.Host` succeeds; manual check the seeded model matches the legible document's Fase/Principio counts.
- **Verify**: `dotnet build && dotnet test` from `Back/ExtractionApi` — full green, no remaining references to removed types anywhere.

## 8. Frontend — types, mocks, service (~2h)
- [x] `apps/coach/types/gameModel.ts` per design.md §6.1.
- [x] `apps/coach/services/gameModelMock.ts`: fixtures rebuilt from spec §6's example.
- [x] `apps/coach/services/gameModelService.ts`: mapping functions for the new shape; drop `getSubSubPrincipleSkills`, `uploadScenarioMedia`, `deleteScenarioMedia`, `moveScenarioToPrinciple`, `toggleSkillMastered`.
- **Verify**: `npx tsc --noEmit` from `Front/` fails only in files touched by later sections — expected.

## 9. Frontend — reducer tests first + implementation (~2.5h)
- [x] Extend/rewrite `apps/coach/context/__tests__/GameModelDraftContext.test.tsx` for the new level actions (Principio/Subprincipio/Zona/SubSubPrincipio/Habilidad/Nota/SetPieceRule/OpenIssue CRUD); drop Scenario/media/tactical-principle/mastery tests.
- **Verify (Red)**: `npm run test -- GameModelDraftContext` from `Front/` — failing.
- [x] `apps/coach/context/GameModelDraftContext.tsx` per design.md §6.3.
- **Verify (Green)**: `npm run test -- GameModelDraftContext` from `Front/`.

## 10. Frontend — read view tests first + implementation (~3h)
- [x] Rewrite `GameModel.test.tsx`/`ScenarioAccordion.test.tsx` (rename if the component is renamed) and `GameModelPrintView.test.tsx` for the legible-shaped rendering: Fase→Principio→Subprincipio→Zona/SubSubPrincipio→Habilidad, Notas rendered by `tipo`, flat "Balón parado" section, no exercise embedding.
- **Verify (Red)**: relevant `npm run test` targets fail.
- [x] Implement the shared read/print renderer per design.md §6.2 (consider one component + `print` prop instead of two divergent trees, as noted in design.md).
- **Verify (Green)**: same test targets pass.

## 11. Frontend — edit view tests first + implementation (~3h)
- [x] Rewrite `ScenarioFormAccordion.test.tsx` (rename if applicable) and `GameModelCreate.test.tsx` for CRUD at every new level plus Nota/SetPieceRule/OpenIssue sections.
- **Verify (Red)**: failing.
- [x] Implement per design.md §6.3; delete `CreateSessionFromSubPrinciple.tsx`, `SessionsFromSubPrinciple.tsx`, `components/PrincipleExercisesSection.tsx`, `components/ScenarioMediaField.tsx`, and any now-dead tests/CSS for them; check `DrillDownPanel.tsx` for other consumers before deleting.
- **Verify (Green)**: passing.

## 12. Frontend — unlink exercises/sessions (~2h)
- [x] `pages/trainings/new/hooks/useExerciseForm.ts`, `ExerciseFormPanel.tsx`, `types.ts`, `constants.ts`, `NewExercisePage.tsx`, `pages/trainings/components/ExerciseDialog.tsx`, `ExerciseCromo.tsx`, `Trainings.tsx`, `types/training.ts`, `services/trainingService.ts`: remove `subSubPrincipleId`/`subPrincipleId`/`scenarioId` and the level-picker UI/service call, per design.md §7.
- [x] Update/remove affected tests for those files.
- **Verify**: `npm run build && npm run test` from `Front/` — full green.

## 13. Full verification & manual check (~1h)
- [x] `dotnet build && dotnet test` from `Back/ExtractionApi` — full green.
- [x] `npm run build && npm run test` from `Front/` — full green.
- [x] Manual check in dev: open the seeded game model, confirm it reads like `ADN-Modelo-de-Juego-Legible.md` (Fase order, Principio/Subprincipio numbering, Zona blocks, Notas, "Balón parado" section); create/edit/delete at each level; confirm no exercise/session screen shows or accepts a game-model reference.
