## 1. Backend — Dominio y persistencia (≈45min)

- [x] Añadir `Methodology` a `TaskTrainingBase.cs` (default `"Integrado"`).
- [x] Configurar `Methodology` en `TaskTrainingBaseEntityConfiguration.cs` (`IsRequired().HasMaxLength(50)`).
- [x] Generar migración EF con `.\manage-migrations.ps1` (nombre `AddExerciseMethodology`), con default `'Integrado'` para backfill de filas existentes.
- Verificar: `dotnet build`.

## 2. Backend — `CreateExercise.cs` (≈45min)

- [x] Tests (Red primero) en `CreateExerciseHandlerTests.cs`: persiste `Methodology`; validador rechaza valor inválido/vacío, acepta los 3 valores válidos.
- [x] Añadir `Methodology` a `CreateExerciseCommand`, regla `.Must(...)` en `CreateExerciseValidator`, asignación en el handler.
- Verificar: `dotnet test --filter CreateExerciseHandlerTests`.

## 3. Backend — `UpdateExercise.cs` (≈30min)

- [x] Tests (Red primero) en `UpdateExerciseHandlerTests.cs`: actualizar `Methodology` de un ejercicio existente se persiste; validador rechaza valor inválido.
- [x] Añadir `Methodology` a `UpdateExerciseCommand`, misma regla en `UpdateExerciseValidator`, asignación en el handler.
- Verificar: `dotnet test --filter UpdateExerciseHandlerTests`.

## 4. Backend — `GetExercises.cs` / `GetExerciseById.cs` (≈45min)

- [x] Tests (Red primero): `GetExercisesHandlerTests` — `ExerciseListItem.Methodology` poblado; filtro `?methodology=` devuelve solo coincidencias. `GetExerciseByIdHandlerTests` — `Methodology` poblado.
- [x] Añadir `Methodology` a `ExerciseListItem` (record compartido), poblarlo en ambas proyecciones; añadir filtro opcional `methodology` a `GetExercisesQuery` + endpoint + handler.
- Verificar: `dotnet test --filter "GetExercisesHandlerTests|GetExerciseByIdHandlerTests"`.

## 5. Frontend — Tipos y catálogo (≈20min)

- [x] `types/training.ts`: `ExerciseMethodology`, campo `methodology` en `Exercise`/`CreateExerciseRequest`.
- [x] `pages/trainings/new/constants.ts`: `methodologyOptions`, `emptyExercise.methodology = "Integrado"`.
- [x] `pages/trainings/exerciseTypeLabels.ts`: `METHODOLOGY_LABELS`.

## 6. Frontend — Formulario (≈45min)

- [x] Test (Red primero): test del selector de metodología en `ExerciseFormPanel` o del hook `useExerciseForm` (carga de valor al editar).
- [x] `ExerciseFormPanel.tsx`: nuevo `Select` (clon del de "Seccion") para metodología.
- [x] `useExerciseForm.ts`: `applyExercise` carga `methodology` del ejercicio existente.
- Verificar: `npm run test -- useExerciseForm ExerciseFormPanel`.

## 7. Frontend — Tarjeta `ExerciseCromo` (≈30min)

- [x] Test (Red primero) en `ExerciseCromo.test.tsx`: pill de metodología visible con la etiqueta correcta para los 3 valores; actualizar `buildExercise()` para incluir `methodology`.
- [x] `ExerciseCromo.tsx`: pill de metodología en `metaRow`.
- Verificar: `npm run test -- ExerciseCromo`.

## 8. Frontend — Filtro en `Trainings.tsx` (≈45min)

- [x] Test (Red primero): nuevo test de `Trainings.tsx` (o crear archivo si no existe) — selector de filtro por metodología presente; al cambiarlo, `trainingService.getExercises` se llama con `methodology` actualizado.
- [x] `trainingService.ts`: `getExercises` acepta `methodology` en `opts` y lo envía como querystring.
- [x] `Trainings.tsx`: estado `methodologyFilter`, `Select` en `toolbarRow` de la pestaña Ejercicios, se pasa a `getExercises` en carga inicial y `refreshExercises`.
- Verificar: `npm run test -- Trainings`.

## 9. Verificación final (≈30min)

- [x] `dotnet build && dotnet test` completo (backend) — 100% pass.
- [x] `npm run build && npm run test` completo (frontend) — 100% pass.
- [x] Prueba manual: crear ejercicio sin metodología no permite guardar (o guarda con default visible); editar ejercicio cambia metodología; filtro por metodología en el listado funciona; pill visible en la tarjeta.
