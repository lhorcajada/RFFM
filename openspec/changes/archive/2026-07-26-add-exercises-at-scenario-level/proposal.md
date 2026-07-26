## Why

Hoy un ejercicio (`TaskTrainingBase`) se vincula a exactamente uno de dos niveles del modelo de juego: `SubPrincipleId` o `SubSubPrincipleId` (mutuamente excluyentes, ver cambio archivado `add-exercises-at-subprinciple-level`). El Coach necesita también poder vincular ejercicios directamente al **Escenario** (`GameScenario`, un nivel por encima de subprincipio, mostrado en `ScenarioDetailView` dentro de `ScenarioAccordion.tsx`), para ejercicios globales que no son específicos de un subprincipio ni de una habilidad concreta.

## What Changes

- **Backend**: se añade `ScenarioId` (nullable, `string?`) a `TaskTrainingBase`, análogo a `SubPrincipleId`/`SubSubPrincipleId`, con su navegación a `GameScenario`. Un ejercicio queda vinculado a exactamente **uno** de los tres niveles (`ScenarioId` XOR `SubPrincipleId` XOR `SubSubPrincipleId`), nunca a más de uno ni a ninguno. Se actualizan:
  - `CreateExercise.cs` / `UpdateExercise.cs`: aceptan `ScenarioId` opcional; el validador exige que se informe exactamente uno de los tres ids.
  - `GetExercises.cs`: acepta filtro opcional `scenarioId` (además de los ya existentes); el DTO `ExerciseListItem` incluye `ScenarioId`/`ScenarioName`.
  - `GetExerciseById.cs`: incluye igualmente `ScenarioId`/`ScenarioName` en la respuesta.
  - Migración EF Core para la nueva columna nullable + FK a `GameScenarios` con `OnDelete: SetNull` (mismo patrón que `SubPrincipleId`).
- **Frontend**: `ScenarioDetailView` (en `ScenarioAccordion.tsx`) gana una sección de ejercicios equivalente a la de `SubPrincipleDetailView`/`SubSubPrincipleCard.tsx`: listar, añadir, editar, duplicar y eliminar ejercicios vinculados directamente al escenario, con el mismo chip de conteo (`{n} ej.`) en la cabecera del detalle. `PrincipleExercisesSection` (`PrincipleLevelKind`) gana un tercer valor `"scenario"`. El formulario de ejercicio (`ExerciseFormPanel`/`useExerciseForm`) permite elegir entre los tres niveles disponibles al crear/editar y reasignar un ejercicio existente entre ellos.

## Non-Goals

- No se cambia el modelo de sesiones de entrenamiento (`TrainingSession`), que sigue vinculado a subprincipio y no se ve afectado.
- No se permite vincular un ejercicio a más de un nivel a la vez (relación mutuamente excluyente de tres vías).
- No se toca la lógica de `EssentialSkills`, `masteredAt`, ni los principios tácticos del escenario.

## Impact

- **Back**: `Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs`, `Infrastructure/Persistence/Configuration/Aggregates/Trainings/TaskTrainingBaseEntityConfiguration.cs`, `Features/Coaches/Trainings/Exercises/{CreateExercise,UpdateExercise,GetExercises,GetExerciseById}.cs`, nueva migración EF Core, tests de `CreateExerciseHandlerTests`/`UpdateExerciseHandlerTests`/`GetExercisesHandlerTests`/`GetExerciseByIdHandlerTests`.
- **Front**: `apps/coach/pages/game-model/components/{ScenarioAccordion.tsx, PrincipleExercisesSection.tsx}`, `apps/coach/pages/trainings/new/{hooks/useExerciseForm.ts, components/ExerciseFormPanel.tsx, NewExercisePage.tsx}`, `apps/coach/types/training.ts`, `apps/coach/services/trainingService.ts`.
