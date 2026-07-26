# Implement — Allow Unlinked Exercises

Guion técnico para `openspec-implementer`. Cambio pequeño y acotado: backend (validadores + tests) y tests de regresión en frontend (sin cambios de código de producción en frontend). TDD estricto: ajustar los tests ANTES de tocar el validador, confirmar que fallan (Red), luego aplicar el cambio (Green).

> ⚠️ El usuario tiene la API backend corriendo localmente. Antes de `dotnet build`/`dotnet test`, PARA y pide confirmación explícita de que el proceso está detenido. Si no puedes obtenerla (ejecución no interactiva), NO ejecutes esos comandos; deja el trabajo backend hecho a nivel de código pero sin verificar con `dotnet`, y repórtalo como pendiente.

## Paso 1 — Backend: tests (Red)

1. `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/CreateExerciseHandlerTests.cs`:
   - Renombrar el método `Validator_RejectsNoLevelId` a `Validator_AcceptsNoLevelId`.
   - Cambiar su aserción final de `Assert.False(result.IsValid);` a `Assert.True(result.IsValid);`.
   - Dejar `Validator_RejectsScenarioIdAndSubPrincipleIdTogether` y `Validator_RejectsAllThreeLevelIdsTogether` sin cambios.
   - Añadir un nuevo test `Handle_WithNoLevelId_PersistsExerciseUnlinked` (mismo patrón que `Handle_WithScenarioIdOnly_PersistsScenarioId` si existe, o el patrón general de tests de `Handle` en este archivo: sembrar club, construir `BaseCommand(...)` sin tocar ningún nivel — los tres quedan `null` por defecto —, llamar a `CreateExerciseHandler.Handle(...)`, releer el ejercicio persistido y comprobar `Assert.Null(persisted.ScenarioId); Assert.Null(persisted.SubPrincipleId); Assert.Null(persisted.SubSubPrincipleId);`).
2. `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/UpdateExerciseHandlerTests.cs`:
   - Mismo renombrado/inversión: `Validator_RejectsNoLevelId` → `Validator_AcceptsNoLevelId`, `Assert.True(result.IsValid)`.
   - Dejar `Validator_RejectsAllThreeLevelIdsTogether` sin cambios.
   - Añadir `Handle_ReassignFromSubPrincipleToNoLevel_ClearsLink`: crear un ejercicio vinculado a un subprincipio (patrón de `Handle_ReassignFromSubPrincipleToScenario_ClearsOldLinkAndSetsScenario` si existe, o construir directamente vía `CreateExerciseHandler` con `SubPrincipleId` informado), luego llamar a `UpdateExerciseHandler.Handle` con los tres ids a `null`, releer y comprobar que los tres quedan `null`.
3. `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ExerciseSubPrincipleAssignmentTests.cs`:
   - Renombrar `Create_WithNeitherId_FailsValidation` a `Create_WithNeitherId_Succeeds`, invertir la aserción a `Assert.True(result.IsValid);`.
   - Dejar `Create_WithBothIds_FailsValidation` sin cambios.

Ejecutar (avisar antes si la API local está corriendo): `dotnet build && dotnet test --filter "FullyQualifiedName~CreateExerciseHandlerTests|FullyQualifiedName~UpdateExerciseHandlerTests|FullyQualifiedName~ExerciseSubPrincipleAssignmentTests"`. Confirmar que los tests recién invertidos/añadidos FALLAN (Red) contra el validador actual (`== 1`).

## Paso 2 — Backend: validadores (Green)

1. `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/CreateExercise.cs`, en `CreateExerciseValidator`:
   ```csharp
   RuleFor(x => x)
       .Must(x => new[] { x.ScenarioId, x.SubPrincipleId, x.SubSubPrincipleId }
           .Count(id => !string.IsNullOrEmpty(id)) <= 1)
       .WithMessage("At most one of ScenarioId, SubPrincipleId or SubSubPrincipleId may be provided.");
   ```
2. `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Trainings/Exercises/UpdateExercise.cs`, en `UpdateExerciseValidator`: mismo cambio.

Verificar (avisar antes): `dotnet build && dotnet test`. Confirmar 100% verde.

## Paso 3 — Frontend: tests de regresión

1. `Front/src/apps/coach/pages/trainings/new/hooks/__tests__/useExerciseForm.test.ts`: añadir (si no hay ya un caso equivalente) un test que renderice el hook con `scenarioId: null, subPrincipleId: null, subSubPrincipleId: null` y compruebe que `result.current.form.scenarioId`, `.subPrincipleId`, `.subSubPrincipleId` son todos `null` (sin lanzar error). Añadir otro que llame a `handleSave` en ese mismo estado y compruebe que `trainingService.createExercise` se invoca con los tres campos en `null`.
2. Ejecutar `npm run test -- useExerciseForm`. Estos tests deberían pasar SIN necesidad de tocar `useExerciseForm.ts`/`ExerciseFormPanel.tsx` (el comportamiento ya es correcto); si alguno falla, investigar la causa real antes de "arreglarlo" — puede indicar un supuesto incorrecto en el análisis previo, repórtalo en vez de forzar el test a pasar.

## Paso 4 — Verificación final

1. `dotnet test` completo (backend) → 100% pass. **Avisar antes de ejecutar por si la API está corriendo localmente.**
2. `npm run test` completo (frontend) → 100% pass, sin skips.
3. `npm run build` → sin errores TypeScript.
4. Informar resumen: archivos tocados, tests renombrados/añadidos, y recordatorio de prueba manual (crear ejercicio sin contexto desde `coach/trainings`, guardar sin vínculo; editar un ejercicio vinculado a un nivel y confirmar que el selector "Vinculado a" existente sigue funcionando igual).
