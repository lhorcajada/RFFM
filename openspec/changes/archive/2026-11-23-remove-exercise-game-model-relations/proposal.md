> **⚠ POST-HOC RECORD** — This proposal was backfilled after implementation against a user-supplied statement of intent. It describes a decision already made, not one being proposed.

## Why

One exercise can serve several principles of the game model, so fixing the game-model relation ("Relación con el modelo de juego") on the exercise was wrong. The training session already stores its game-model objectives (its sub-subprincipios) and is where the coach decides the focus, so the game model now lives only at session level.

## What Changes

- The exercise API stops carrying game-model relations: `CreateExercise` and `UpdateExercise` no longer accept `ModelRelations` (and their validators are gone), and `GetExercises` and `GetExerciseById` no longer return `ModelRelations` nor `IsAssociatedToGameModel`.
- Saving an exercise never touches its stored relation rows: `UpdateExercise` no longer deletes and rebuilds them, and `TaskTrainingBase.ReplaceModelRelations` and `CreateExerciseHandler.BuildModelRelations` are removed. The `ExerciseModelRelation` and `ExerciseModelRelationItem` entities, tables and configurations stay unchanged, and the change carries no migration.
- `ExampleSessionSeeder` no longer seeds nor removes exercise relations.
- The exercise form no longer has the «Modelo de juego» section (`ModelRelationSection.tsx` and `modelRelationSelection.ts` are deleted, and the `modelRelations` fields leave the form state, request builder and types).
- The exercise list cards no longer show the «Asociado al modelo» chip nor the per-relation chips.
- The exercise sheet no longer prints the game-model line at the end of its side panel.
- Each sheet of a printed session carries one compact «Modelo de juego» line in its header with the session's objectives (`{numero} {rol}` joined by « · »), resolved through the team's game-model catalog for the active season; a session without objectives prints no line, and printing a single exercise never has it. The header grows from 15 to 17 mm and the fit check also measures the header, reporting «Modelo de juego» when the line does not fit.
- In the session evaluation dialog, habilidades come from the session's objectives through the game-model catalog, grouped by subprincipio: every exercise card's «Ver detalle» shows the same «Habilidades de la sesión» set, and each Subprincipio block of the evaluation form shows its «Habilidades trabajadas» from that same source. Objectives the catalog no longer resolves are skipped, and a session without objectives shows no habilidades, with no fallback to the stored exercise relations.
- The API version goes to 1.65.0 and the Front version to 1.148.0.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `exercises`: an exercise no longer references the game model, and the exercise list no longer distinguishes model-linked exercises; the exercise API ignores and no longer returns relations, leaving the stored rows untouched.
- `exercise-a4-sheet-print`: the exercise sheet prints no game-model line, and each session sheet carries the session's game-model objectives in its header.
- `exercise-sheet-fit-check`: the fit check also measures the session sheet header with its game-model line.
- `exercise-form-editing`: the form's fit check no longer depends on game-model relations.
- `new-exercise-redesign`: the data panel no longer has the «Modelo de juego» section.
- `player-session-evaluation-session-content`: the exercise detail and the Subprincipio blocks take their habilidades from the session's objectives through the game-model catalog.

## Impact

New files:
- `Front/src/apps/coach/pages/trainings/sessionGameModel.ts`
- `Front/src/apps/coach/pages/player/hooks/useSessionHabilidades.ts`
- `Front/src/apps/coach/pages/trainings/__tests__/sessionGameModel.test.ts`
- `Front/src/apps/coach/pages/trainings/__tests__/sessionWindow.test.ts`
- `Front/src/apps/coach/pages/player/hooks/__tests__/useSessionHabilidades.test.ts`

Modified files:
- `Back/ExtractionApi/Directory.Build.props`
- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/ExerciseModelRelation.cs`
- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/CreateExercise.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/UpdateExercise.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/GetExercises.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/GetExerciseById.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Seed/ExampleSessionSeeder.cs`
- Backend tests: `ExampleSessionSeederTests.cs`, `CreateExerciseHandlerTests.cs`, `UpdateExerciseHandlerTests.cs`, `GetExercisesHandlerTests.cs`, `GetExerciseByIdHandlerTests.cs`
- `Front/package.json`
- `Front/src/apps/coach/pages/trainings/exerciseSheet.ts`, `exercisePrint.ts`, `sessionPrint.ts`, `sessionWindow.ts`, `sheetMeasure.ts`
- `Front/src/apps/coach/pages/trainings/components/ExerciseCromo.tsx`, `ExerciseCromo.module.css`
- `Front/src/apps/coach/pages/trainings/new/NewExercisePage.tsx`, `constants.ts`, `exerciseRequest.ts`, `components/ExerciseFormPanel.tsx`, `hooks/useExerciseForm.ts`
- `Front/src/apps/coach/pages/player/utils/sessionHabilidades.ts`
- `Front/src/apps/coach/pages/player/components/tracking/SessionContent.tsx`, `SessionEvaluationDialog.tsx`, `SessionEvaluationForm.tsx`, `SessionExerciseCard.tsx`
- `Front/src/apps/coach/services/gameModelService.ts`, `seasonPlanService.ts`
- `Front/src/apps/coach/types/training.ts`, `seasonPlan.ts`
- Related Front tests under `pages/trainings/**/__tests__/` and `pages/player/**/__tests__/`

Deleted files:
- `Front/src/apps/coach/pages/trainings/new/components/ModelRelationSection.tsx`, `ModelRelationSection.module.css`, `modelRelationSelection.ts` and their tests

Not changed: the session form and its objective editing, the session endpoints, Mobile, and the database schema (no migration; stored exercise relation rows stay as unread data).

Out of scope: design.md, tasks.md, implementation.md — not generated by /sai-backfill
