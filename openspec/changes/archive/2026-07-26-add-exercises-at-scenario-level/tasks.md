> ⚠️ El usuario tiene la API backend corriendo localmente. Antes de cualquier `dotnet build`/`dotnet test`/`dotnet run`/`dotnet ef`, avisar y esperar confirmación de que ha parado el proceso.

## 1. Backend — Dominio, persistencia y migración (≈1h30)

- [ ] `TaskTrainingBase.cs`: añadir `ScenarioId`/`Scenario` (design.md §1).
- [ ] `TaskTrainingBaseEntityConfiguration.cs`: columna + FK con `SetNull` (design.md §1).
- [ ] Generar migración `AddScenarioIdToTaskTrainingBase`. **Avisar antes de ejecutar `dotnet ef`.**
- Verificar (avisar antes): `dotnet build`

## 2. Backend — Features y tests (≈2h)

- [ ] Tests primero (Red): extender `CreateExerciseHandlerTests.cs`/`UpdateExerciseHandlerTests.cs` a exclusión mutua de tres vías; añadir caso de filtrado por `scenarioId` en `GetExercisesHandlerTests.cs`; añadir caso de `ScenarioId`/`ScenarioName` en `GetExerciseByIdHandlerTests.cs`.
- [ ] `CreateExercise.cs`/`UpdateExercise.cs`/`GetExercises.cs`/`GetExerciseById.cs`: añadir `ScenarioId` de punta a punta (design.md §2).
- Verificar (avisar antes): `dotnet build && dotnet test`

## 3. Frontend — Tipos y servicios (≈30min)

- [ ] `types/training.ts`, `services/trainingService.ts`: añadir `scenarioId`/`scenarioName` (design.md §5).
- Verificar: `npm run build`

## 4. Frontend — PrincipleExercisesSection (≈1h)

- [ ] `PrincipleLevelKind` gana `"scenario"`; `loadExercises`/`buildExerciseParams` con la rama de escenario (design.md §6).
- Verificar: `npm run build`

## 5. Frontend — ScenarioDetailView + conteo (≈1h30)

- [ ] Tests primero (Red): en `ScenarioAccordion.test.tsx`, caso que monta la sección de ejercicios en el detalle de escenario (mock `trainingService.getExercises`), verifica el chip `{n} ej.` en la cabecera.
- [ ] `ScenarioAccordion.tsx`: cabecera de `ScenarioDetailView` con chip de conteo + `PrincipleExercisesSection` con `levelKind="scenario"` (design.md §7).
- Verificar: `npm run test -- ScenarioAccordion && npm run build`

## 6. Frontend — Formulario de ejercicio (≈2h)

- [ ] Tests primero (Red): `useExerciseForm.test.ts` — `resolveLevelIds` con los tres niveles y prioridad de especificidad; `ExerciseFormPanel.test.tsx` — selector "Vinculado a" con las combinaciones de ids disponibles.
- [ ] `NewExercisePage.tsx`: leer `scenarioId`/`scenarioName` de la URL y pasarlos al hook (design.md §8).
- [ ] `useExerciseForm.ts`: `resolveLevelIds` de tres vías, `setLevel` con tercera rama (design.md §8).
- [ ] `ExerciseFormPanel.tsx`: selector "Vinculado a" con hasta tres opciones (design.md §8).
- Verificar: `npm run test -- useExerciseForm ExerciseFormPanel && npm run build`

## 7. Verificación final (≈30min)

- [ ] `dotnet test` completo (backend) — 100% pass. **Avisar antes de ejecutar.**
- [ ] `npm run test` completo (frontend) — 100% pass, sin tests saltados.
- [ ] `npm run build` — sin errores de TypeScript.
- [ ] Prueba manual: desde el detalle de un escenario en game-model, añadir un ejercicio directamente al escenario; comprobar que aparece el chip de conteo en la cabecera del escenario igual que en subprincipio/sub-subprincipio; editar el ejercicio y reasignarlo a subprincipio o sub-subprincipio y viceversa; comprobar que el filtrado por `scenarioId` en `GetExercises` funciona.
