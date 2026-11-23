> **⚠ POST-HOC RECORD** — This proposal was backfilled after implementation against a user-supplied statement of intent. It describes a decision already made, not one being proposed.

## Why

Coaches want printed exercise sheets with a large pitch drawing on the left and a fixed side panel (players, objectives, sequence, rules, what is seen, levels), one exercise per page. The previous exercise form only held free text, and the session print split drawings across pages, so every printed sheet had a different shape and drawings did not stay with their exercise.

## What Changes

- **Structured exercise fields (backend).** `TaskTrainingBase` gains `Espacio`, `TurnoMinutos`, `NivelDibujo`, and the lists `Secuencia`, `Reglas`, `QueSeVe` and `Jugadores` (teams with palette color, name, player count, roles and objective lines, as the new `ExerciseTeam` record). The lists persist as `jsonb` columns. `CreateExercise` and `UpdateExercise` accept the fields through the shared `IExerciseSheetFields` contract and `ExerciseSheetMapper`; `GetExercises` and `GetExerciseById` return them through `ExerciseListItem`. `UpdateExercise` still keeps the stored `BoardStateJson` when the request sends it as null.
- **Finite caps (backend).** The new `ExerciseSheetFieldsValidator` caps teams (6), lines per list (30), line length (1000), team name (100), roles (500), players per team (0..50), space length (2000) and turn minutes (1..240). It restricts the team color to blue, yellow, gray or none, and requires `NivelDibujo` to be an existing `Niveles` row. It does not decide whether the content fits one sheet.
- **Legacy free text is no longer required.** The create and update validators no longer require `Logistica` or `Descripcion`, and the form no longer edits Logística, Descripción or Objetivo por rol.
- **Migration.** `AddExerciseSheetFields` adds the columns and copies the legacy text literally: `Descripcion` to one line of `Secuencia`, `Logistica` to `Espacio`, and `ObjetivoPorRol` to one objective line of a single team with no color. Empty legacy text creates no line. The legacy columns, `Dibujo` included, stay in the table.
- **Exercise form.** `ExerciseFormPanel` adds stacked-card sections "Espacio y turno", "Jugadores y objetivos" (`TeamsEditor`), "Secuencia", "Reglas", "Qué se ve sin decir nada" (`LinesEditor`) and "Niveles", where `NivelesEditor` marks the drawing level. Deleting the marked row clears the marker and shows a warning. Blank lines, empty teams and a blank space are dropped before saving.
- **A4 landscape sheet.** `exerciseSheet.ts` and `exercisePrint.ts` build one landscape A4 sheet per exercise: header with name, subtitle and pills; the drawing on the left, cropped by `detectBoardViewport` to the half pitch it uses; the material legend under the drawing when it fits; the side panel on the right; and a footer. Empty blocks are left out. A missing drawing shows "Sin dibujo". The legacy Dibujo text is no longer printed.
- **Session print.** `sessionPrint.ts` prints one sheet per session exercise occurrence, with no cover or summary page, and the footer `Sesión: {name} · Bloque: {block}`. `sessionPrintLayout.ts` (drawing page-splitting) is deleted.
- **Fit check.** `sheetMeasure.ts` renders the real side panel off screen and compares its height with one page. The form shows the overflow reason and blocks saving. Before a print, `usePrintFitGuard` shows a `ConfirmDialog` listing the sheets that do not fit, with "Editar ejercicio", "Imprimir igualmente" and "Cancelar"; no print window opens before the coach chooses.
- **Shared dialog.** `ConfirmDialog` gains an optional third action (`secondaryText` / `onSecondary`).
- Versions: API `1.64.0`, Front `1.147.0`.

## Capabilities

### New Capabilities

- `exercise-structured-fields`: the exercise stores space, turn minutes, drawing level, teams, sequence, rules and what-is-seen as structured data; the create, update and read endpoints expose them, with finite backend caps.
- `exercise-form-editing`: the exercise form edits the structured fields with stacked cards, marks the drawing level, and blocks saving while the content does not fit one sheet.
- `exercise-a4-sheet-print`: a single exercise and a session print as landscape A4 sheets, one exercise per page, with the drawing cropped to the pitch it uses and a material legend.
- `exercise-sheet-fit-check`: one measurement of the real sheet panel decides whether an exercise fits one page; the form and the print flow both use it.
- `legacy-exercise-migration`: existing exercises keep their data through a literal copy of the old free text into the new fields.

### Modified Capabilities

- `exercises`: `Logistica` and `Descripcion` become optional legacy text, and the exercise carries the structured sheet fields.
- `new-exercise-redesign`: the data panel gains the structured sheet sections, and the Niveles editor is shown again with a drawing-level marker; the legacy «Dibujo» field stays hidden.

## Impact

New files:
- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/ExerciseTeam.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/20261122174432_AddExerciseSheetFields.cs` (+ `.Designer.cs`)
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ExerciseSheetFieldsPersistenceTests.cs`
- `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/ExerciseSheetFieldsValidatorTests.cs`
- `Front/src/apps/coach/pages/trainings/exerciseSheet.ts`, `sheetMeasure.ts`, `printHtml.ts`, `usePrintFitGuard.tsx`
- `Front/src/apps/coach/pages/trainings/new/components/LinesEditor.tsx`, `TeamsEditor.tsx` (+ CSS Modules, `NivelesEditor.module.css`)
- Front tests: `exerciseSheet.test.ts`, `sheetMeasure.test.ts`, `Trainings.printFitCheck.test.tsx`, `exerciseRequest.test.ts`, `LinesAndTeamsEditors.test.tsx`, `NivelesEditor.drawingLevel.test.tsx`, `useExerciseForm.sheetFields.test.ts`, `ConfirmDialog.test.tsx`

Modified files:
- `Back/ExtractionApi/Directory.Build.props`, `ValidationConstants.cs`, `TaskTrainingBase.cs`, `CreateExercise.cs`, `UpdateExercise.cs`, `GetExercises.cs`, `TaskTrainingBaseEntityConfiguration.cs`, `AppDbContextModelSnapshot.cs`
- `Front/package.json`, `Front/src/apps/coach/types/training.ts`, `Trainings.tsx`, `ExerciseCromo.tsx`, `exercisePrint.ts`, `sessionPrint.ts`, `sessionWindow.ts`, `new-session/NewSessionPage.tsx`, `new/NewExercisePage.module.css`, `new/components/ExerciseFormPanel.tsx`, `new/components/NivelesEditor.tsx`, `new/constants.ts`, `new/exerciseRequest.ts`, `new/hooks/useExerciseForm.ts`, `Front/src/shared/components/ui/ConfirmDialog/ConfirmDialog.tsx`
- Front tests: `exercisePrint.test.ts`, `sessionPrint.test.ts`, `Trainings.sessionsOrderAndViewPrint.test.tsx`, `ExerciseFormPanel.test.tsx`

Deleted files:
- `Front/src/apps/coach/pages/trainings/sessionPrintLayout.ts` and `__tests__/sessionPrintLayout.test.ts`

Out of scope: design.md, tasks.md, implementation.md — not generated by /sai-backfill
