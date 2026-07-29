## Why

Los ejercicios de entrenamiento (`TaskTrainingBase`) ya se clasifican por `Section` (Calentamiento/Principal/Vuelta a la calma), `Types` (Físico/Técnico/Táctico/...) y opcionalmente por escenario/subprincipio/sub-subprincipio del modelo de juego. El coach necesita clasificarlos además por **metodología del ejercicio**: Analítico, Integrado o Global — un criterio pedagógico estándar en la planificación de entrenamientos de fútbol base que hoy no existe en el modelo y que se usa para diseñar progresiones de sesión.

## What Changes

- **Backend**: nuevo campo obligatorio `Methodology` (string, valores cerrados `Analitico`/`Integrado`/`Global`) en `TaskTrainingBase`, siguiendo exactamente el mismo patrón que el campo `Section` existente (columna string simple, sin tabla catálogo, validada en `FluentValidation`). Se añade a `CreateExercise`, `UpdateExercise`, `GetExercises` (incluye nuevo filtro opcional `?methodology=`) y `GetExerciseById`.
- **Frontend**: nuevo tipo `ExerciseMethodology`, campo en `Exercise`/`CreateExerciseRequest`, selector en el formulario de creación/edición (clon del selector de "Seccion"), pill en `ExerciseCromo` (tarjeta del listado) y un filtro por metodología en la pestaña "Ejercicios" de `Trainings.tsx`.

## Non-Goals

- No se toca la clasificación por `Types`, `Section` ni por escenario/subprincipio — la metodología es una dimensión adicional e independiente.
- No se añade metodología a `SessionExerciseItem` (vista de ejercicios dentro de una sesión de entrenamiento) — fuera de alcance de esta solicitud, que se centra en el catálogo/listado de ejercicios.
- No se introduce tabla catálogo EF (como `ExerciseType`) porque es de valor único con 3 opciones cerradas — mismo criterio que `Section`.

## Impact

- **Back**: `Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`, `Infrastructure/Persistence/Configuration/Aggregates/Trainings/TaskTrainingBaseEntityConfiguration.cs`, nueva migración EF, `Features/Coaches/Trainings/Exercises/{CreateExercise,UpdateExercise,GetExercises,GetExerciseById}.cs`.
- **Front**: `apps/coach/types/training.ts`, `apps/coach/pages/trainings/new/constants.ts`, `apps/coach/pages/trainings/exerciseTypeLabels.ts`, `apps/coach/pages/trainings/new/components/ExerciseFormPanel.tsx`, `apps/coach/pages/trainings/new/hooks/useExerciseForm.ts`, `apps/coach/pages/trainings/components/ExerciseCromo.tsx`, `apps/coach/pages/trainings/Trainings.tsx`, `apps/coach/services/trainingService.ts`.

## Acceptance Criteria

- El coach puede asignar la metodología (Analítico/Integrado/Global) al crear o editar un ejercicio; es un campo obligatorio (no se puede guardar sin valor).
- El coach puede filtrar el listado de ejercicios por metodología desde la pestaña "Ejercicios".
- La metodología se muestra como pill en la tarjeta (`ExerciseCromo`) del listado de ejercicios.
