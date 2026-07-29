> ⚠️ El usuario tiene la API backend corriendo localmente. Antes de cualquier `dotnet build`/`dotnet test`/`dotnet run`, avisar y esperar confirmación de que ha parado el proceso.

## 1. Backend — Validadores y tests (≈1h30)

- [ ] Tests primero (Red): renombrar/invertir `Validator_RejectsNoLevelId` → `Validator_AcceptsNoLevelId` en `CreateExerciseHandlerTests.cs` y `UpdateExerciseHandlerTests.cs`; renombrar/invertir `Create_WithNeitherId_FailsValidation` → `Create_WithNeitherId_Succeeds` en `ExerciseSubPrincipleAssignmentTests.cs`; añadir `Handle_WithNoLevelId_PersistsExerciseUnlinked` (Create) y `Handle_ReassignFromSubPrincipleToNoLevel_ClearsLink` (Update). Confirmar que fallan contra el validador actual.
- [ ] `CreateExercise.cs`/`UpdateExercise.cs`: cambiar `== 1` por `<= 1` en ambos validadores (design.md §1).
- Verificar (avisar antes): `dotnet build && dotnet test`

## 2. Frontend — Tests de regresión (≈45min)

- [ ] `hooks/__tests__/useExerciseForm.test.ts`: casos con los tres ids de contexto ausentes — el formulario inicializa con los tres campos en `null` sin error, y `handleSave` llama a `createExercise` con los tres en `null` (design.md §3). Confirmar que ya pasan hoy (no requieren cambio de producción) o, si algo falla, investigar antes de tocar código — el comportamiento actual ya debería ser correcto.
- Verificar: `npm run test -- useExerciseForm && npm run build`

## 3. Verificación final (≈30min)

- [ ] `dotnet test` completo (backend) — 100% pass. **Avisar antes de ejecutar.**
- [ ] `npm run test` completo (frontend) — 100% pass, sin tests saltados.
- [ ] `npm run build` — sin errores de TypeScript.
- [ ] Prueba manual: crear un ejercicio desde `coach/trainings` sin filtro de sub-subprincipio y guardarlo sin tocar el selector de nivel (no debería ni aparecer) — debe guardarse sin error; editar un ejercicio ya vinculado a un subprincipio desde game-model, y confirmar que el selector "Vinculado a" sigue funcionando igual que antes.
