> ⚠️ El usuario tiene la API backend corriendo localmente. Antes de cualquier `dotnet build`/`dotnet test`/`dotnet run`, avisar y esperar confirmación de que ha parado el proceso.

## 1. Backend — Dominio y persistencia (≈2h)

- [ ] Crear `Domain/Aggregates/Training/TasksTraining/ExerciseType.cs` y `TaskTrainingType.cs` (design.md §1).
- [ ] Modificar `TaskTrainingBase.cs`: añadir campos fusionados (`Series`, `DurationSeries`, `RestSeries`, `Time`, `TouchesNumber`, `WildCards`) y `List<TaskTrainingType> Types`.
- [ ] Eliminar `PhysicalTaskTraining.cs`, `TechnicalTaskTraining.cs`, `TacticalTaskTraining.cs`.
- [ ] Nuevas configuraciones EF: `ExerciseTypeConfiguration.cs`, `TaskTrainingTypeConfiguration.cs`; actualizar `TaskTrainingBaseEntityConfiguration.cs` (quitar discriminador, mapear campos fusionados, `HasMany(tb => tb.Types)`).
- [ ] Añadir `DbSet<ExerciseType>` y `DbSet<TaskTrainingType>` a `AppDbContext.cs`.
- [ ] Crear `Infrastructure/Persistence/Seed/ExerciseTypesSeeder.cs` y registrarlo en `WebApplicationExtensions.cs`.
- Verificar (avisar antes): `dotnet build`

## 2. Backend — Migración EF Core (≈2h)

- [ ] Generar migración `AddExerciseTypesManyToMany` (`.\manage-migrations.ps1` o `dotnet ef migrations add`).
- [ ] Editar el `Up()` generado para añadir el SQL de migración de datos (design.md §6, punto 3): insertar los 6 tipos y mapear cada fila `Discriminator` existente a su fila en `TaskTrainingTypes` antes de borrar la columna `Discriminator`.
- [ ] Escribir `Down()` simétrico.
- Verificar (avisar antes, requiere BD de desarrollo parada/disponible): `dotnet ef database update` sobre una copia de la BD de desarrollo, o revisión manual del SQL generado si no es seguro aplicarlo directamente.

## 3. Backend — Features (contrato de API) (≈2h)

- [ ] Tests primero (Red): actualizar/crear `CreateExerciseHandlerTests`, `UpdateExerciseHandlerTests` — casos: 1 tipo, múltiples tipos, 0 tipos rechazado por el validator, reemplazo de tipos en update.
- [ ] `CreateExercise.cs`: `Type: string` → `Types: List<string>`; quitar el `switch` de subclases; validator con `NotEmpty()` + lista fija de 6 valores válidos.
- [ ] `UpdateExercise.cs`: mismo patrón (`RemoveRange`/`AddRange` sobre `Types`, quitar los `if (exercise is PhysicalTaskTraining ...)`).
- [ ] `GetExercises.cs` / `GetExerciseById.cs`: `.Include(tb => tb.Types).ThenInclude(t => t.ExerciseType)`; `ExerciseListItem.Type: string` → `Types: IEnumerable<string>`.
- [ ] Revisar y adaptar `tests/RFFM.Api.Tests/IntegrationTests/ExerciseSubPrincipleAssignmentTests.cs` (usa las subclases eliminadas).
- Verificar (avisar antes): `dotnet build && dotnet test`

## 4. Frontend — Tipos y constantes (≈1h)

- [ ] `types/training.ts`: `ExerciseType` con 6 valores; `Exercise.type`/`CreateExerciseRequest.type`/`SessionExerciseItem.type` → `types: ExerciseType[]`.
- [ ] `constants.ts`: `typeOptions` con los 6 valores (Juego, Cognitivo, Psicológico añadidos); `emptyExercise.types = ["Tactical"]`.
- [ ] Extraer `TYPE_LABELS`/`SECTION_LABELS` duplicados a `apps/coach/pages/trainings/exerciseTypeLabels.ts` (nuevo módulo compartido).
- Verificar: `npm run build`

## 5. Frontend — Formulario de ejercicio (≈2h)

- [ ] Tests primero (Red): `ExerciseFormPanel.test.tsx` — selección múltiple, ambos bloques de campos visibles con Físico+Técnico; `useExerciseForm.test.ts` — `isPhysical`/`isTechTac` con array, bloqueo de guardado con 0 tipos.
- [ ] `ExerciseFormPanel.tsx`: `Select multiple` con chips (`renderValue`), ver design.md §3.
- [ ] `useExerciseForm.ts`: `isPhysical`/`isTechTac` vía `.includes(...)`; `applyExercise` usa `exercise.types`; `handleSave` valida mínimo 1 tipo.
- Verificar: `npm run test -- ExerciseFormPanel useExerciseForm && npm run build`

## 6. Frontend — Tarjetas (≈1h30)

- [ ] Tests primero (Red): `PrincipleExercisesSection.test.tsx` / `ExerciseCromo.test.tsx` (o los tests existentes que cubran estos componentes) — un chip por tipo en `ex.types`.
- [ ] `PrincipleExercisesSection.tsx`: mapear `ex.types` a chips.
- [ ] `ExerciseCromo.tsx`: `TypeIcon` con 3 casos nuevos; badge/borde usa `ex.types[0]` como tipo primario + chips adicionales para el resto; `ExerciseCromo.module.css` con `type_Game`/`type_Cognitive`/`type_Psychological` y `typeBadge_*` equivalentes.
- Verificar: `npm run test -- PrincipleExercisesSection ExerciseCromo && npm run build`

## 7. Verificación final (≈30min)

- [ ] `dotnet test` completo (backend) — 100% pass. **Avisar antes de ejecutar.**
- [ ] `npm run test` completo (frontend) — 100% pass.
- [ ] `npm run build` — sin errores de TypeScript.
- [ ] Prueba manual: crear un ejercicio con 2+ tipos, verificar que la tarjeta muestra todos los chips y que al editar se conservan los tipos seleccionados.
