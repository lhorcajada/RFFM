## Why

Un ejercicio (`TaskTrainingBase`) solo puede guardarse hoy si está vinculado a exactamente uno de tres niveles del modelo de juego: escenario, subprincipio o sub-subprincipio (`CreateExerciseValidator`/`UpdateExerciseValidator`: `Count(id => !string.IsNullOrEmpty(id)) == 1`). Sin embargo, un ejercicio también puede crearse desde el listado general de la biblioteca del club (`coach/trainings`, sin filtro de sub-subprincipio), donde no hay ninguna referencia al modelo de juego disponible — ese flujo hoy falla la validación al guardar.

El Coach necesita poder crear y editar ejercicios **sin vincularlos a ningún nivel** del modelo de juego, además de seguir pudiendo vincularlos o reasignarlos entre escenario/subprincipio/sub-subprincipio cuando ese contexto sí está disponible (selector "Vinculado a" ya existente en `ExerciseFormPanel.tsx`, que se mantiene sin cambios).

## What Changes

- **Backend**: la regla de validación pasa de "exactamente uno" a "como máximo uno" de `ScenarioId`/`SubPrincipleId`/`SubSubPrincipleId` — permite 0 o 1, sigue rechazando 2 o 3 a la vez. Aplica a `CreateExerciseValidator` y `UpdateExerciseValidator`. Sin cambios en el handler (ya asigna los tres campos tal cual vengan, incluidos `null`), ni en `GetExercises`/`GetExerciseById` (un ejercicio sin vincular simplemente no aparece al filtrar por un nivel concreto, sin necesidad de un filtro explícito de "sin vincular").
- **Frontend**: sin cambios de código — `useExerciseForm.ts` (`resolveLevelIds`, `setLevel`, `handleSave`) ya tolera los tres ids a `null` sin forzar ninguno, y `ExerciseFormPanel.tsx` ya oculta el selector "Vinculado a" cuando no hay contexto suficiente. Se añaden tests que fijan este comportamiento y confirman el flujo completo (crear desde `Trainings.tsx` sin ssp, guardar sin vínculo, editar un ejercicio ya vinculado y desvincularlo).

## Non-Goals

- No se construye un selector nuevo tipo árbol para elegir cualquier escenario/subprincipio/sub-subprincipio del modelo; el selector "Vinculado a" existente (limitado al contexto de navegación) se mantiene tal cual.
- No se añade un filtro explícito de "solo ejercicios sin vincular" en `GetExercises`.
- No se migran los ejercicios existentes (todos ya tienen exactamente un nivel asignado; no hay dato que limpiar).

## Impact

- **Back**: `Features/Coaches/Trainings/Exercises/{CreateExercise,UpdateExercise}.cs` (validadores), tests en `tests/RFFM.Api.Tests/UnitTests/{CreateExerciseHandlerTests,UpdateExerciseHandlerTests}.cs` y `tests/RFFM.Api.Tests/IntegrationTests/ExerciseSubPrincipleAssignmentTests.cs`.
- **Front**: `apps/coach/pages/trainings/new/hooks/__tests__/useExerciseForm.test.ts` (nuevos casos de regresión, sin cambios de código de producción).
