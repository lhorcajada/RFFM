# Design — Allow Unlinked Exercises

## 1. Backend — Validadores

- `Features/Coaches/Trainings/Exercises/CreateExercise.cs` (`CreateExerciseValidator`):
  ```csharp
  RuleFor(x => x)
      .Must(x => new[] { x.ScenarioId, x.SubPrincipleId, x.SubSubPrincipleId }
          .Count(id => !string.IsNullOrEmpty(id)) <= 1)
      .WithMessage("At most one of ScenarioId, SubPrincipleId or SubSubPrincipleId may be provided.");
  ```
  (cambia `== 1` por `<= 1`, y el mensaje de "Exactly one" a "At most one").
- `Features/Coaches/Trainings/Exercises/UpdateExercise.cs` (`UpdateExerciseValidator`): mismo cambio.

No se toca el handler de ninguno de los dos: `CreateExerciseHandler` ya asigna `ScenarioId = request.ScenarioId` (etc.) directamente, que puede ser `null`; `UpdateExerciseHandler` ya hace `exercise.ScenarioId = request.ScenarioId;` sin condicional, así que reasignar a `null` (desvincular) ya funciona en cuanto el validador lo permite.

## 2. Backend — Tests a actualizar

- `tests/RFFM.Api.Tests/UnitTests/CreateExerciseHandlerTests.cs`:
  - `Validator_RejectsNoLevelId` → renombrar a `Validator_AcceptsNoLevelId` e invertir la aserción (`Assert.True(result.IsValid)`); el comando base ya tiene los tres ids a `null` (comentario existente: "BaseCommand already has all three level ids null").
  - `Validator_RejectsScenarioIdAndSubPrincipleIdTogether` y `Validator_RejectsAllThreeLevelIdsTogether`: sin cambios (siguen rechazando 2 y 3 ids a la vez).
  - Añadir `Handle_WithNoLevelId_PersistsExerciseUnlinked`: llama al handler (no solo al validador) con los tres ids a `null` y comprueba que el ejercicio se persiste con `ScenarioId`/`SubPrincipleId`/`SubSubPrincipleId` todos `null` (cubre el camino real de creación desde `Trainings.tsx`, no solo la validación).
- `tests/RFFM.Api.Tests/UnitTests/UpdateExerciseHandlerTests.cs`:
  - `Validator_RejectsNoLevelId` → mismo tratamiento (`Validator_AcceptsNoLevelId`).
  - Añadir `Handle_ReassignFromSubPrincipleToNoLevel_ClearsLink`: crea un ejercicio vinculado a un subprincipio, lo actualiza con los tres ids a `null`, y comprueba que queda desvinculado (cubre el criterio de aceptación 4: desvincular un ejercicio ya vinculado).
- `tests/RFFM.Api.Tests/IntegrationTests/ExerciseSubPrincipleAssignmentTests.cs`:
  - `Create_WithNeitherId_FailsValidation` → renombrar a `Create_WithNeitherId_Succeeds` e invertir la aserción.
  - `Create_WithBothIds_FailsValidation`: sin cambios (sigue rechazando 2 ids a la vez).

## 3. Frontend — Verificación (sin cambios de código)

- `useExerciseForm.ts`: `resolveLevelIds(null, null, null)` ya devuelve `{ scenarioId: null, subSubPrincipleId: null, subPrincipleId: null }` (última rama de la función); `handleSave` no exige ningún nivel antes de guardar. `Trainings.tsx`'s `goToExercisePage`/`duplicateExercise` ya solo pasan `subSubPrincipleId` cuando hay filtro activo (`initialSspId`), dejando los otros dos ausentes — es decir, crear desde ahí sin filtro YA produce un `CreateExerciseCommand` con los tres ids ausentes; hoy solo lo bloquea el validador del backend.
- `ExerciseFormPanel.tsx`: el selector "Vinculado a" ya solo se muestra si al menos dos de los tres ids de contexto están disponibles (`Number(!!scenarioId) + Number(!!subPrincipleId) + Number(!!subSubPrincipleId) >= 2`); con cero o un id de contexto, simplemente no se muestra selector — comportamiento correcto y ya existente, no requiere cambios.
- Añadir tests de regresión en `hooks/__tests__/useExerciseForm.test.ts`:
  - `resolveLevelIds`-equivalente: inicializar el hook sin `scenarioId`/`subSubPrincipleId`/`subPrincipleId` (los tres `null`) y comprobar que `form.scenarioId`/`form.subPrincipleId`/`form.subSubPrincipleId` quedan `null` sin lanzar error ni forzar un valor.
  - `handleSave` con los tres ids `null`: comprobar que `trainingService.createExercise` se llama con los tres campos en `null` (no se bloquea ni se autocompleta nada en el frontend).

## 4. Sin cambios en `GetExercises`/`GetExerciseById`

Un ejercicio con los tres ids a `null` simplemente no cumple ningún `Where(tb => tb.XId == id)` al filtrar por nivel, por lo que no aparece en listados filtrados por escenario/subprincipio/sub-subprincipio — comportamiento correcto sin cambios de código. No se añade un filtro explícito de "sin vincular" (Non-Goal).
