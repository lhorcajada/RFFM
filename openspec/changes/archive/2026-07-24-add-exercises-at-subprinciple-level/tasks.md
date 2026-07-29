## 1. Backend — Domain + EF migration (~1.5h)

- [ ] `Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`: add `SubPrincipleId` (`string?`) + `SubPrinciple` navigation.
- [ ] `Infrastructure/Persistence/Configuration/Aggregates/Trainings/TaskTrainingBaseEntityConfiguration.cs`: configure `SubPrincipleId` (nullable, max 36) + `HasOne(tb => tb.SubPrinciple)` with `DeleteBehavior.SetNull`.
- [ ] Generate migration: `.\manage-migrations.ps1` (or `dotnet ef migrations add AddSubPrincipleIdToTaskTrainingBase --project src/RFFM.Api --startup-project ../RFFM.Host`).
- [ ] Verify: `dotnet build` from `Back/ExtractionApi`.

## 2. Backend — Exercise write-side tests + implementation (~2h, TDD)

- [ ] RED: in `CreateExercise.Tests.cs` (create if absent, adjacent to `CreateExercise.cs`), add xUnit + Moq tests:
  - creating with `SubPrincipleId` set and `SubSubPrincipleId` null succeeds and persists `SubPrincipleId`.
  - creating with both `SubSubPrincipleId` and `SubPrincipleId` set fails validation.
  - creating with neither set fails validation.
- [ ] RED: in `UpdateExercise.Tests.cs`, add tests:
  - updating an exercise from `SubSubPrincipleId=X` to `SubPrincipleId=Y` (habilidad → subprincipio) clears `SubSubPrincipleId` and sets `SubPrincipleId`.
  - the reverse (subprincipio → habilidad) also works.
  - update with both/neither ids fails validation.
- [ ] GREEN: implement `CreateExercise.cs`/`UpdateExercise.cs` changes per `design.md` (add `SubPrincipleId` to commands, mutual-exclusion validator rule, direct field assignment in `UpdateExerciseHandler`).
- [ ] Verify: `dotnet test --filter "FullyQualifiedName~CreateExercise|FullyQualifiedName~UpdateExercise"`.

## 3. Backend — Exercise read-side tests + implementation (~1.5h, TDD)

- [ ] RED: `GetExercises.Tests.cs` — filtering by `subPrincipleId` returns only exercises linked to that subprincipio; `ExerciseListItem` includes `SubPrincipleId`/`SubPrincipleName`.
- [ ] RED: `GetExerciseById.Tests.cs` — same DTO fields present for a subprincipio-linked exercise.
- [ ] GREEN: implement `GetExercises.cs`/`GetExerciseById.cs` changes (new query param, `.Include(tb => tb.SubPrinciple)`, DTO fields).
- [ ] Verify: `dotnet test --filter "FullyQualifiedName~GetExercises|FullyQualifiedName~GetExerciseById"`.
- [ ] Full backend regression: `dotnet build && dotnet test`.

## 4. Frontend — types + service (~0.5h)

- [ ] `apps/coach/types/training.ts`: add `subPrincipleId`/`subPrincipleName` to `Exercise` and `subPrincipleId` to `CreateExerciseRequest`.
- [ ] `apps/coach/services/trainingService.ts`: change `getExercises` to accept `{ subSubPrincipleId?, subPrincipleId? }` options object; update call sites in `SubSubPrincipleCard.tsx` and `SessionsFromSubPrinciple.tsx`.
- [ ] Verify: `npx tsc --noEmit` (or `npm run build`) to catch call-site breakage.

## 5. Frontend — extract `PrincipleExercisesSection` (~2h, TDD)

- [ ] RED: `apps/coach/pages/game-model/components/__tests__/PrincipleExercisesSection.test.tsx` — renders exercise grid from `trainingService.getExercises` (mocked), shows empty state, add/edit/delete actions navigate/call service as expected, `onCountChange` fires with the loaded count.
- [ ] GREEN: create `PrincipleExercisesSection.tsx` (+ `.module.css`, reusing styles from `SubSubPrincipleCard.module.css` where shared) per `design.md`, extracting the block currently inline in `SubSubPrincipleCard.tsx:192-373`.
- [ ] REFACTOR: update `SubSubPrincipleCard.tsx` to render `<PrincipleExercisesSection levelKind="subSubPrinciple" .../>` instead of the inline block; header exercise-count chip reads `onCountChange` state.
- [ ] Verify: `npm run test -- PrincipleExercisesSection SubSubPrincipleCard` and `npm run build`.

## 6. Frontend — wire subprincipio level into `ScenarioAccordion.tsx` (~1.5h, TDD)

- [ ] RED: extend/adjust tests covering `SubPrincipleDetailView` (new test file if none exists) — renders `PrincipleExercisesSection` with `levelKind="subPrinciple"`, shows exercise-count chip next to "Nueva sesión"/"Ver sesiones".
- [ ] GREEN: add the section + chip to `SubPrincipleDetailView` per `design.md`; pass `subPrincipleApiId={sp.apiId}` / `subPrincipleName={sp.name}` down into `SubSubPrincipleCard`.
- [ ] Verify: `npm run test -- ScenarioAccordion` and `npm run build`.

## 7. Frontend — reassignment UI in the exercise form (~2h, TDD)

- [ ] RED: `apps/coach/pages/trainings/new/hooks/__tests__/useExerciseForm.test.ts` (create if absent) — `setLevel("subPrinciple")` clears `subSubPrincipleId` and sets `subPrincipleId` (and vice versa); `applyExercise` populates both ids correctly from a loaded `Exercise`.
- [ ] GREEN: update `useExerciseForm.ts` per `design.md` (both ids in form state, `setLevel` helper, skills cleared when switching to subprincipio level).
- [ ] RED: `ExerciseFormPanel.test.tsx` — the "Vinculado a" selector only renders when both `subSubPrincipleId` and `subPrincipleId` context props are present; selecting an option calls `form.setLevel`.
- [ ] GREEN: add the selector to `ExerciseFormPanel.tsx`; thread `subPrincipleId`/`subPrincipleName` through `NewExercisePage.tsx` (URL params `subPrincipleId`/`spName`).
- [ ] Verify: `npm run test -- useExerciseForm ExerciseFormPanel NewExercisePage` and `npm run build`.

## 8. Full regression + manual check (~1h)

- [ ] `dotnet build && dotnet test` (backend, from `Back/ExtractionApi`).
- [ ] `npm run test && npm run build` (frontend, from `Front`).
- [ ] Manual smoke test via dev server: add an exercise directly from a Subprincipio (no habilidad in scope), verify it lists/counts correctly; edit an existing habilidad-level exercise and reassign it to its parent subprincipio, verify it disappears from the habilidad's list and appears under the subprincipio's, and vice versa.
