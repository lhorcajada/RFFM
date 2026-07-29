## Why

Hoy un ejercicio (`TaskTrainingBase`) solo puede tener **un tipo**, modelado como herencia TPH de EF Core (`PhysicalTaskTraining`, `TechnicalTaskTraining`, `TacticalTaskTraining`), con un discriminador de columna (`TaskTrainingBaseEntityConfiguration.cs`). El frontend (`ExerciseFormPanel.tsx`) usa un `Select` simple (no `multiple`) para elegir uno de los 3 tipos, y las tarjetas (`PrincipleExercisesSection.tsx`, `ExerciseCromo.tsx`) muestran un único chip de tipo.

El coach necesita poder etiquetar un ejercicio con **varios tipos a la vez** (p. ej. un ejercicio puede ser Físico y Táctico simultáneamente), y se añaden 3 tipos nuevos: **Juego**, **Cognitivo** y **Psicológico** (total 6: Físico, Técnico, Táctico, Juego, Cognitivo, Psicológico).

Como el tipo hoy determina la subclase (y por tanto qué campos existen: Series/DurationSeries/RestSeries/Time para Físico, TouchesNumber/WildCards para Técnico/Táctico), pasar a multi-tipo obliga a eliminar la herencia TPH y modelar el tipo como una **relación many-to-many**, igual que ya existe para `EssentialSkill` vía `TaskTrainingSkill`.

## What Changes

- **Backend**:
  - Se elimina la jerarquía TPH (`PhysicalTaskTraining`/`TechnicalTaskTraining`/`TacticalTaskTraining` desaparecen como clases; `TaskTrainingBase` pasa a ser la única entidad concreta, ya sin discriminador).
  - Los campos hoy exclusivos de una subclase (`Series`, `DurationSeries`, `RestSeries`, `Time`, `TouchesNumber`, `WildCards`) se fusionan como columnas opcionales en `TaskTrainingBase`; se muestran/rellenan según qué tipos tenga el ejercicio, sin restricción de exclusión entre bloques.
  - Nueva tabla de tipos (`ExerciseType`: Id, Name — con los 6 valores) y tabla puente `TaskTrainingType` (`TaskTrainingBaseId` + `ExerciseTypeId`), análoga a `TaskTrainingSkill`.
  - Nuevo seeder `ExerciseTypesSeeder.cs` (siguiendo el patrón de `FormationsSeeder.cs`/`ClubKitsSeeder.cs`) que carga los 6 tipos.
  - `CreateExercise.cs`/`UpdateExercise.cs`: el request pasa de `Type: string` a `Types: string[]` (mínimo 1 elemento, validado por `Validator`), y el switch de instanciación de subclase se sustituye por asignación directa de `Types` a la tabla puente.
  - `GetExercises.cs`/`GetExerciseById.cs`: el cálculo de tipo por nombre de clase (`tb.GetType().Name.Replace(...)`) se sustituye por proyección de `Types` (lista de strings) desde la relación many-to-many.
  - Migración EF Core: nueva tabla `ExerciseTypes` + `TaskTrainingTypes`, columnas fusionadas en `TaskTrainingBases`, eliminación del discriminador, y migración de datos existentes (cada fila TPH actual pasa a tener exactamente 1 registro en `TaskTrainingTypes` con su tipo original).

- **Frontend**:
  - `ExerciseType` (`training.ts`) pasa de union type único a lista de 6 valores; `Exercise.type`/`CreateExerciseRequest.type` pasan a `types: ExerciseType[]`.
  - `ExerciseFormPanel.tsx`: el `Select` pasa a `multiple` (chips dentro del propio select), mínimo 1 tipo seleccionado (no se permite guardar sin ninguno).
  - `useExerciseForm.ts`: `isPhysical`/`isTechTac` pasan a comprobar pertenencia en el array (`form.types.includes(...)`); se muestran **todos** los bloques de campos que apliquen a los tipos seleccionados (pueden mostrarse varios bloques a la vez).
  - `constants.ts`: `typeOptions` añade Juego, Cognitivo, Psicológico; `emptyExercise.types` inicia como `["Tactical"]` (mantiene el valor por defecto actual; el coach puede quitarlo y elegir otros).
  - `PrincipleExercisesSection.tsx` y `ExerciseCromo.tsx`: renderizan un chip/badge por cada tipo en `ex.types` en lugar de uno solo; `TYPE_LABELS` se extiende con los 3 nuevos tipos (evaluar extraer a módulo compartido dado que ya está duplicado en 2 sitios).

## Non-Goals

- No se añade lógica de negocio nueva basada en combinaciones de tipos (p. ej. no se valida que "Físico + Cognitivo" tenga sentido pedagógico); cualquier combinación de 1 a 6 tipos es válida.
- No se toca `Section` (Calentamiento/Principal/VueltaALaCalma), que sigue siendo un campo simple sin relación.
- No se migra el enfoque a un `SmartEnum` compartido entre capas; los tipos siguen siendo strings en el contrato de API, respaldados por la tabla `ExerciseType` en BD.
- No se introduce icono/color nuevo por tipo salvo que ya exista un patrón reusable en `ExerciseCromo.tsx` (`TypeIcon`); si hace falta icono para Juego/Cognitivo/Psicológico se define en design.md.

## Impact

- **Back**: `Domain/Aggregates/Training/TasksTraining/{TaskTrainingBase,PhysicalTaskTraining,TechnicalTaskTraining,TacticalTaskTraining}.cs`, nueva entidad `ExerciseType.cs` + `TaskTrainingType.cs`, `Infrastructure/Persistence/Configuration/.../TaskTrainingBaseEntityConfiguration.cs`, nueva migración, nuevo `Infrastructure/Persistence/Seed/ExerciseTypesSeeder.cs`, `Features/Coaches/Trainings/Exercises/{CreateExercise,UpdateExercise,GetExercises,GetExerciseById}.cs`.
- **Front**: `apps/coach/types/training.ts`, `apps/coach/pages/trainings/new/components/ExerciseFormPanel.tsx`, `apps/coach/pages/trainings/new/hooks/useExerciseForm.ts`, `apps/coach/pages/trainings/new/constants.ts`, `apps/coach/pages/game-model/components/PrincipleExercisesSection.tsx`, `apps/coach/pages/trainings/components/ExerciseCromo.tsx`.
