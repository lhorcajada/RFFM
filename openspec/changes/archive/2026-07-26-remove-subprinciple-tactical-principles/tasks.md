> ⚠️ El usuario tiene la API backend corriendo localmente. Antes de cualquier `dotnet build`/`dotnet test`/`dotnet run`/`dotnet ef`, avisar y esperar confirmación de que ha parado el proceso.

## 1. Backend — Dominio, persistencia y migración (≈2h)

- [ ] Eliminar `TacticalPrinciples` de `SubPrinciple.cs`; eliminar `SubPrincipleTacticalPrinciple.cs` y su configuración EF; quitar el `DbSet` de `AppDbContext.cs` (design.md §1).
- [ ] Generar migración `RemoveSubPrincipleTacticalPrinciples` con `DropTable` en `Up()` y recreación simétrica en `Down()` (design.md §3). **Avisar antes de ejecutar `dotnet ef`.**
- Verificar (avisar antes): `dotnet build`

## 2. Backend — Features y tests (≈2h)

- [ ] `CreateGameModel.cs` / `UpdateGameModel.cs` / `GetGameModel.cs`: quitar `TacticalPrincipleIds`/`TacticalPrinciples` del lado subprincipio, dejando intacto el de escenario (design.md §2).
- [ ] Tests primero (Red): ajustar `GameModelTacticalPrincipleForeignKeyTests.cs` y `UpdateGameModelResavePrinciplesTests.cs` (design.md §4) — confirmar que fallan por los tipos eliminados antes de tocar el código de producción, luego dejarlos en verde.
- Verificar (avisar antes): `dotnet build && dotnet test`

## 3. Frontend — Tipos, contexto y servicios (≈1h30)

- [ ] `types/gameModel.ts`, `context/GameModelDraftContext.tsx`, `services/gameModelService.ts`, `services/gameModelMock.ts`: quitar `tacticalPrinciples` del lado subprincipio (design.md §5).
- Verificar: `npm run build` (los usos residuales aparecerán como errores de tipos — corregirlos hasta que compile).

## 4. Frontend — Formulario y vistas de solo lectura (≈1h30)

- [ ] Tests primero (Red): actualizar `ScenarioFormAccordion.test.tsx` y `ScenarioAccordion.test.tsx` — caso negativo: el subprincipio no muestra "Principios tácticos colectivos"; caso positivo: el escenario sí lo sigue mostrando.
- [ ] `ScenarioFormAccordion.tsx`, `ScenarioAccordion.tsx`, `GameModelPrintView.tsx`: eliminar los bloques de subprincipio (design.md §6).
- Verificar: `npm run test -- ScenarioFormAccordion ScenarioAccordion && npm run build`

## 5. Frontend — Sesiones desde subprincipio (≈1h)

- [ ] `CreateSessionFromSubPrinciple.tsx`, `SessionsFromSubPrinciple.tsx`: quitar el campo `tacticalPrinciples` de los tipos locales, del render y del HTML de impresión (design.md §7); revisar el punto de construcción de `SubPrincipleInfo` (navegación desde `ScenarioAccordion`) para no seguir pasando el campo.
- [ ] Ajustar tests existentes de estos dos archivos si referencian `tacticalPrinciples` en sus fixtures.
- Verificar: `npm run test -- CreateSessionFromSubPrinciple SessionsFromSubPrinciple && npm run build`

## 6. Verificación final (≈30min)

- [ ] `dotnet test` completo (backend) — 100% pass. **Avisar antes de ejecutar.**
- [ ] `npm run test` completo (frontend) — 100% pass, sin tests saltados.
- [ ] `npm run build` — sin errores de TypeScript (confirma que no queda ningún uso residual de `tacticalPrinciples` a nivel de subprincipio).
- [ ] Prueba manual: abrir un escenario existente con subprincipios — el formulario y las vistas de lectura de subprincipio ya no muestran principios tácticos; el escenario sigue mostrando y permitiendo editar los suyos con normalidad; el flujo de crear/ver sesiones desde un subprincipio funciona sin esa sección.
