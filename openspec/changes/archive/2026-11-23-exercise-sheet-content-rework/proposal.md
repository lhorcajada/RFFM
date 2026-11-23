> **⚠ POST-HOC RECORD** — This proposal was backfilled after implementation against a user-supplied statement of intent. It describes a decision already made, not one being proposed.

## Why

The reference coaching sheet (Calentamiento-lateral-y-medio.pdf) describes an exercise as what is done, its rules, its points, its rotations and its setup. The exercise asked instead for teams with per-team objectives, a sequence, "what is seen without saying anything" notes and a goalkeepers note, which coaches do not use and which the sheet does not need. This change aligns the exercise form, the API contract, the A4 sheet and the fit check with the reference sheet.

## What Changes

- Backend: `TaskTrainingBase` gains the line lists `Puntos`, `Rotaciones` and `Montaje`, stored as `jsonb` columns with the existing string-list configuration. The new migration `AddExerciseSheetSections` adds only these three columns with default `'[]'`.
- Backend: `CreateExercise` and `UpdateExercise` accept and persist `puntos`, `rotaciones` and `montaje`, validated with the existing line validator (at most 30 lines, at most 1000 characters per line). `GetExercises` and `GetExerciseById` return the three lists.
- Backend: `jugadores`, `secuencia`, `queSeVe` and `porteros` leave the create, update and read contracts, together with `ExerciseTeamRequest`, its validator, `ExerciseTeamDto` and the team caps. The entity properties, column configuration and earlier migrations of those four fields stay, so their stored values stay in the database unread and are never overwritten.
- Backend: `descripcion` keeps its column and API name and is the field behind «Qué se hace».
- Backend: `ExampleSessionSeeder` no longer sets `Porteros` and fills `Descripcion`, `Puntos`, `Rotaciones` and `Montaje` for the seeded example exercises.
- Front: the exercise form shows its sections in the order Clasificación, Espacio y turno, Objetivo, Qué se hace (a multi-line text field on `descripcion`), Reglas, Puntos, Rotaciones, Montaje, Niveles, Imagen / vídeo. «Jugadores y objetivos», «Secuencia», «Qué se ve sin decir nada» and «Organización» (porteros) are removed, and `TeamsEditor` is deleted. Puntos, Rotaciones and Montaje use the existing lines editor.
- Front: the form drops blank lines of Reglas, Puntos, Rotaciones and Montaje before saving, and the fit check reruns when Qué se hace or any of the three new lists change.
- Front: the A4 sheet side panel prints Qué se hace (one paragraph per non-blank line), Reglas, Puntos, Rotaciones, Montaje and Niveles in that order. It no longer prints the Jugadores, Objetivos, Secuencia or «Qué se ve sin decir nada» blocks. The fit check and the session print keep reading the same sheet content and markup.
- Front: the session block editor and the player session exercise card label `descripcion` as «Qué se hace», and the player card no longer shows the Porteros line.
- Versions: the API (`Directory.Build.props`) and the Front (`package.json`) take a minor bump.

## Capabilities

### New Capabilities

- `exercise-sections-in-session`: the session block editor and the player session exercise card show the exercise description as «Qué se hace», and the player card shows no Porteros line.

### Modified Capabilities

- `exercise-structured-fields`: the exercise stores and exposes Puntos, Rotaciones and Montaje instead of teams, sequence and what-is-seen; the removed fields stay stored and unread.
- `exercises`: the exercise template no longer carries Porteros, and Descripcion is the «Qué se hace» text.
- `legacy-exercise-migration`: the earlier sheet migration targets are now retained, unread columns; the new migration only adds the three new columns.
- `exercise-a4-sheet-print`: the side panel prints Qué se hace, Reglas, Puntos, Rotaciones, Montaje and Niveles.
- `exercise-form-editing`: the form edits Qué se hace, Reglas, Puntos, Rotaciones and Montaje, with no team cards.
- `new-exercise-redesign`: the data panel section order follows the new sections.

## Impact

New files:
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/20261123090000_AddExerciseSheetSections.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/20261123090000_AddExerciseSheetSections.Designer.cs`
- `Front/src/apps/coach/pages/trainings/new/components/__tests__/LinesEditor.test.tsx`

Modified files:
- `Back/ExtractionApi/Directory.Build.props`
- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/CreateExercise.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/UpdateExercise.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/GetExercises.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/AppDbContextModelSnapshot.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/Trainings/TaskTrainingBaseEntityConfiguration.cs`
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Seed/ExampleSessionSeeder.cs`
- Backend tests under `Back/ExtractionApi/tests/RFFM.Api.Tests/` (seeder, sheet-field persistence, validators and create, update and read handlers)
- `Front/package.json`
- `Front/src/apps/coach/types/training.ts`
- `Front/src/apps/coach/pages/trainings/exerciseSheet.ts`
- `Front/src/apps/coach/pages/trainings/new/constants.ts`
- `Front/src/apps/coach/pages/trainings/new/exerciseRequest.ts`
- `Front/src/apps/coach/pages/trainings/new/hooks/useExerciseForm.ts`
- `Front/src/apps/coach/pages/trainings/new/components/ExerciseFormPanel.tsx`
- `Front/src/apps/coach/pages/trainings/new-session/components/SessionBlockEditor.tsx`
- `Front/src/apps/coach/pages/player/components/tracking/SessionExerciseCard.tsx`
- Front tests for the sheet, print, fit check, form panel, request cleanup, form hook, session block editor and player card

Deleted files:
- `Front/src/apps/coach/pages/trainings/new/components/TeamsEditor.tsx`
- `Front/src/apps/coach/pages/trainings/new/components/TeamsEditor.module.css`
- `Front/src/apps/coach/pages/trainings/new/components/__tests__/LinesAndTeamsEditors.test.tsx`

Out of scope: design.md, tasks.md, implementation.md — not generated by /sai-backfill

## Request Additional Notes

Future scope, outside this change: the group timing table (which group does what in each time slot) and the symbol legend of the reference sheet, plus a header line with player count and duration. Undecided: whether those return as exercise fields or stay in the free text of Qué se hace.
