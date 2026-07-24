## Why

Hoy, dentro de `game-model`, un ejercicio de entrenamiento (`TaskTrainingBase`) solo puede vincularse a un `SubSubPrincipio` (nivel "habilidad", `SubSubPrincipleId` en `TaskTrainingBase.cs`), mostrado en `SubSubPrincipleCard.tsx`. Los ejercicios a ese nivel tienden a ser técnicos, de grupos pequeños o de calentamiento/previos al ejercicio principal.

El Coach necesita también poder vincular ejercicios directamente al `SubPrincipio` (un nivel por encima, mostrado en `SubPrincipleDetailView` dentro de `ScenarioAccordion.tsx`), para ejercicios más globales que no son específicos de una sola habilidad/sub-subprincipio.

## What Changes

- **Backend**: se añade `SubPrincipleId` (nullable, `string?`) a `TaskTrainingBase`, análogo a `SubSubPrincipleId`, con su navegación a `SubPrincipio`. Un ejercicio queda vinculado exactamente a uno de los dos niveles (`SubSubPrincipleId` XOR `SubPrincipleId`), nunca a ambos ni a ninguno. Se actualizan:
  - `CreateExercise.cs`: acepta `SubPrincipleId` opcional; validador exige que se informe exactamente uno de los dos IDs.
  - `UpdateExercise.cs`: permite reasignar el ejercicio entre `SubSubPrincipleId` y `SubPrincipleId` (poner uno a un valor implica limpiar el otro).
  - `GetExercises.cs`: acepta filtro opcional `subPrincipleId` (además del ya existente `subSubPrincipleId`); el DTO `ExerciseListItem` incluye `SubPrincipleId`/`SubPrincipleName`.
  - Migración EF Core para la nueva columna nullable.
- **Frontend**: `SubPrincipleDetailView` (en `ScenarioAccordion.tsx`) gana una sección de ejercicios equivalente a la de `SubSubPrincipleCard.tsx`: listar, añadir, editar y eliminar ejercicios vinculados al subprincipio, con contador de ejercicios visible igual que ya existe a nivel de sub-subprincipio. El formulario de ejercicio (`ExerciseDialog`/página de creación) permite elegir el nivel de vinculación (subprincipio o sub-subprincipio) y reasignar un ejercicio existente entre ambos.

## Non-Goals

- No se cambia el modelo de sesiones de entrenamiento (`TrainingSession`/`SubPrincipleId` en `Sessions`), que ya es independiente y no se ve afectado.
- No se permite vincular un ejercicio simultáneamente a subprincipio y sub-subprincipio (relación mutuamente excluyente).
- No se toca la lógica de `EssentialSkills` ni el flag `masteredAt`.

## Impact

- **Back**: `Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`, `Features/Coaches/Trainings/Exercises/{CreateExercise,UpdateExercise,GetExercises,GetExerciseById}.cs`, nueva migración EF Core.
- **Front**: `apps/coach/pages/game-model/components/ScenarioAccordion.tsx`, `apps/coach/pages/game-model/components/SubSubPrincipleCard.tsx` (referencia de patrón), `apps/coach/pages/trainings/components/ExerciseDialog.tsx`, `apps/coach/types/{gameModel,training}.ts`, `apps/coach/services/trainingService.ts`.
