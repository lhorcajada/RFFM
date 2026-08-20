## Why

Coaches currently build training exercises one at a time with no link to a season-long plan. `docs/game-model/Plan-de-Temporada.docx` describes a structured methodology (periodización táctica) — Macrociclo (depth layer) → Mesociclo (weeks focused on one field zone, working all 4 phases together) → Microciclo (a week, split into an analítico/situacional/global progression) — that the club already follows on paper but has no digital counterpart. Exercises created in `Trainings.tsx` have no way to say "this exercise is for week 2 of Mesociclo 1.1".

## What Changes

- **Backend**: new aggregate root `SeasonPlan` (1 per Team+Season) under `Domain/Aggregates/SeasonPlans/`, holding ordered `Macrociclo → Mesociclo (tagged with a `GameZone`) → Microciclo (week label + two free-text session objectives)` children, edited as a whole via full-aggregate `PUT` (same pattern as `UpdateGameModel`/`TeamRulesSet`). `TaskTrainingBase` gains a nullable `MicrocicloId` FK. A rerunnable importer service (mirroring `GameModelKeys`' deterministic-key upsert pattern) seeds the real Plan de Temporada content into a target Team+Season, wired as an EF migration data step.
- **Frontend**: new "Planificación" tab in `apps/coach/pages/trainings/Trainings.tsx`, with a tree editor (create/edit/delete/reorder macro/meso/microciclos, mirroring `game-model/components/GameModelFormEditor.tsx`) and a per-Microciclo exercise-count badge (0 = highlighted as uncovered). Each Microciclo card offers "Crear ejercicio", opening `NewExercisePage` pre-linked to that week; the exercise form also gets an optional Microciclo selector for the existing "Ejercicios" tab flow.

## Capabilities

### New Capabilities
- `season-plan`: CRUD for the Macrociclo/Mesociclo/Microciclo tree per Team+Season, seeded from the real season plan document, surfaced as a new Coach UI tab with exercise-coverage visibility.

### Modified Capabilities
- `exercises`: `TaskTrainingBase`/`Exercise` gain an optional link to a `Microciclo`, settable at creation from either the Planificación tab or the Ejercicios tab.

## Impact

- **Backend** (`Back/ExtractionApi/`): new `Domain/Aggregates/SeasonPlans/*`, new `Infrastructure/Persistence/Configuration/Aggregates/SeasonPlans/*`, new `Features/Coaches/SeasonPlans/*` (Commands/Queries), new migration (schema + seed data step), edits to `TaskTrainingBase.cs` + its EF config + `Features/Coaches/Trainings/Exercises/*` (Create/Update/Get).
- **Frontend** (`Front/`): new `apps/coach/types/seasonPlan.ts`, `apps/coach/services/seasonPlanService.ts`, new components under `pages/trainings/season-plan/`, edits to `Trainings.tsx`, `types/training.ts`, `trainingService.ts`, `NewExercisePage.tsx`, `useExerciseForm.ts`, `ExerciseFormPanel.tsx`.
- No changes to `Mobile/`.
