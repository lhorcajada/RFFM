# Implement — Remove Sub-Principle Tactical Principles

Guion técnico para `openspec-implementer`. Cambio Frontend + Backend. TDD estricto donde aplique: en los bloques de tests, ajustarlos ANTES del código de producción y verificar que fallan (Red) antes de tocar el código (Green).

> ⚠️ El usuario tiene la API backend corriendo localmente. Antes de `dotnet build`/`dotnet test`/`dotnet run`/`dotnet ef`, avisar y esperar confirmación de que ha parado el proceso.

Regla general de esta refactorización: es una eliminación de campo de punta a punta. En cada paso, **solo tocar el lado subprincipio** (`sp.tacticalPrinciples`, `SubPrinciple.TacticalPrinciples`, `SubPrincipleTacticalPrinciple`, `SubPrincipleRequest.TacticalPrincipleIds`) y dejar intacto el lado escenario (`scenario.tacticalPrinciples`, `GameScenario.TacticalPrinciples`, `ScenarioTacticalPrinciple`, `ScenarioRequest.TacticalPrincipleIds`).

## Paso 1 — Backend: dominio y persistencia

1. `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/SubPrinciple.cs`: eliminar la línea `public List<SubPrincipleTacticalPrinciple> TacticalPrinciples { get; private set; } = new();`.
2. Eliminar los archivos:
   - `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/SubPrincipleTacticalPrinciple.cs`
   - `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/GameModels/SubPrincipleTacticalPrincipleConfiguration.cs`
3. `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs`: eliminar la línea `public DbSet<SubPrincipleTacticalPrinciple> SubPrincipleTacticalPrinciples { get; set; }`.

## Paso 2 — Backend: contrato de API

1. `Features/Coaches/GameModels/Commands/CreateGameModel.cs`:
   - `SubPrincipleRequest`: quitar el parámetro `List<int> TacticalPrincipleIds`.
   - En `CreateGameModelHandler.Handle`, dentro del `foreach (var spr in sr.SubPrinciples)`: quitar el bucle `foreach (var tpId in spr.TacticalPrincipleIds) subPrinciple.TacticalPrinciples.Add(new SubPrincipleTacticalPrinciple(subPrinciple.Id, tpId));`.
2. `Features/Coaches/GameModels/Commands/UpdateGameModel.cs`:
   - Query inicial (`UpdateGameModelHandler.Handle`): quitar `.ThenInclude(sp => sp.TacticalPrinciples)` que cuelga de `.ThenInclude(s => s.SubPrinciples)`.
   - `UpsertSubPrinciples`: en la rama `existing is not null`, quitar el bloque de diff (`requestedSpTpIds`, `spTpToRemove`, `_db.SubPrincipleTacticalPrinciples.RemoveRange(...)`, el `foreach` que borra de `existing.TacticalPrinciples`, `existingSpTpIds` y el `foreach` que añade). En la rama `else`, quitar `foreach (var tpId in spr.TacticalPrincipleIds) newSp.TacticalPrinciples.Add(...)`.
   - `BuildSubPrinciples`: quitar `foreach (var tpId in spr.TacticalPrincipleIds) sp.TacticalPrinciples.Add(...)`.
   - `SubPrincipleRequest` ya no tiene `TacticalPrincipleIds` (se quitó en el paso anterior en `CreateGameModel.cs`, es el mismo record compartido).
3. `Features/Coaches/GameModels/Queries/GetGameModel.cs`:
   - `SubPrincipleResponse`: quitar el parámetro `IEnumerable<TacticalPrincipleDto> TacticalPrinciples`.
   - Query: quitar `.ThenInclude(sp => sp.TacticalPrinciples)` que cuelga de la cadena `.Include(gm => gm.Scenarios).ThenInclude(s => s.SubPrinciples)`.
   - Proyección: en el `Select(sp => new SubPrincipleResponse(...))`, quitar el argumento `sp.TacticalPrinciples.Select(tp => new TacticalPrincipleDto(tp.TechnicalGoalId, tpLookup.GetValueOrDefault(tp.TechnicalGoalId, "")))`.

Verificar (avisar antes): `dotnet build`.

## Paso 3 — Backend: migración EF Core

1. Con la API detenida (confirmar con el usuario), generar la migración:
   ```
   cd Back/ExtractionApi
   dotnet ef migrations add RemoveSubPrincipleTacticalPrinciples --project src/RFFM.Api --startup-project src/RFFM.Host
   ```
   (o usar `.\manage-migrations.ps1` si el proyecto lo tiene configurado así — comprobar el script antes).
2. Revisar el `Up()` generado: debe contener `migrationBuilder.DropTable(name: "SubPrincipleTacticalPrinciples", schema: "app");`. Si EF genera pasos adicionales innecesarios, simplificar a ese único `DropTable`.
3. Completar el `Down()` si EF no lo genera completo: recrear la tabla `SubPrincipleTacticalPrinciples` en el esquema `app` con clave primaria compuesta `(SubPrincipleId, TechnicalGoalId)`, `SubPrincipleId` como `varchar(36)` no nulo, y FK a `SubPrinciples` — mirar el `CreateTable` original en `Infrastructure/Migrations/20260401163621_AddSubPrinciplesTables.cs` como referencia exacta de tipos y FKs.
4. No aplicar la migración a la base de datos (`dotnet ef database update`) sin permiso explícito adicional del usuario — dejarla generada y avisar que está pendiente de aplicar.

## Paso 4 — Backend: tests

1. `tests/RFFM.Api.Tests/IntegrationTests/GameModelTacticalPrincipleForeignKeyTests.cs`:
   - En `SavingScenarioWithTacticalPrincipleIdAbove8_DoesNotThrow`, el `new SubPrincipleRequest(...)` deja de recibir el argumento de lista de ids de principios tácticos (ajustar la posición/aridad según el nuevo record).
   - Quitar `Assert.Single(persistedScenario.SubPrinciples.Single().TacticalPrinciples);` y `Assert.Equal(tacticalPrincipleId, persistedScenario.SubPrinciples.Single().TacticalPrinciples.Single().TechnicalGoalId);`. Mantener las aserciones equivalentes sobre `persistedScenario.TacticalPrinciples`.
   - Si la query de verificación incluye `.ThenInclude(sp => sp.TacticalPrinciples)`, quitarlo.
2. `tests/RFFM.Api.Tests/IntegrationTests/UpdateGameModelResavePrinciplesTests.cs`:
   - En el setup, quitar `subPrinciple.TacticalPrinciples.Add(new SubPrincipleTacticalPrinciple(subPrinciple.Id, technicalGoalId: 1));`.
   - En `ResavingScenarioWithSameTacticalPrincipleIds_DoesNotThrow`: ajustar el `new SubPrincipleRequest(...)` (sin la lista de ids), quitar `Assert.Single(persistedScenario.SubPrinciples.Single().TacticalPrinciples);` y la aserción del id. Mantener las de escenario.
   - En `ResavingScenarioWithDuplicateTacticalPrincipleIdInSameList_ThrowsInvalidOperationException`: revisar si construye algún `SubPrincipleRequest` con lista de ids y ajustarlo igual.
   - Actualizar los comentarios XML de cabecera que mencionan `SubPrincipleTacticalPrinciples` como ejemplo, para no referenciar una clase eliminada (puede simplemente quedarse con el ejemplo de `ScenarioTacticalPrinciple`).

Verificar (avisar antes): `dotnet build && dotnet test`. Confirmar 100% verde antes de continuar.

## Paso 5 — Frontend: tipos, contexto y servicios

1. `Front/src/apps/coach/types/gameModel.ts`: quitar `tacticalPrinciples: TacticalPrinciple[];` de la interfaz `SubPrinciple`.
2. `Front/src/apps/coach/context/GameModelDraftContext.tsx`:
   - Acción `UPD_SP`: cambiar `changes: Partial<Pick<SubPrinciple, "name" | "context" | "tacticalPrinciples">>` a `changes: Partial<Pick<SubPrinciple, "name" | "context">>`.
   - Reducer `ADD_SP`: quitar `tacticalPrinciples: [],` del objeto `SubPrinciple` que se crea.
3. `Front/src/apps/coach/services/gameModelService.ts`:
   - `ApiSubPrinciple`: quitar `tacticalPrinciples: ApiTacticalPrinciple[];`.
   - `mapApiToGameModel`: quitar `tacticalPrinciples: sp.tacticalPrinciples,` del objeto de subprincipio mapeado.
   - `mapModelToRequest`: quitar `tacticalPrincipleIds: sp.tacticalPrinciples.map((tp) => tp.id),` del objeto de subprincipio.
4. `Front/src/apps/coach/services/gameModelMock.ts`: localizar cada aparición de `tacticalPrinciples:` dentro de un objeto de subprincipio (los que están anidados bajo `subPrinciples: [...]`, distintos de los de nivel escenario que cuelgan directamente de `scenarios: [...]`) y eliminar esa línea.

Verificar: `npm run build`. TypeScript señalará cualquier uso residual de `tacticalPrinciples` sobre un `SubPrinciple` — corregir cada error hasta que compile limpio.

## Paso 6 — Frontend: formulario y vistas de solo lectura (TDD)

**Red**: en `components/__tests__/ScenarioFormAccordion.test.tsx`, ajustar/añadir un caso que renderice `SubPrincipleDetailForm` (o el árbol que lo contiene) y compruebe que **no** existe ningún elemento con el texto "Principios tácticos colectivos" dentro del bloque de subprincipio, mientras que sigue existiendo dentro del bloque de escenario. En `components/__tests__/ScenarioAccordion.test.tsx`, ajustar de forma equivalente para la vista de lectura.

**Green**:
1. `components/ScenarioFormAccordion.tsx`: en `SubPrincipleDetailForm`, eliminar el `<Autocomplete multiple ... value={sp.tacticalPrinciples} ...>` completo (incluye su `renderInput`/`renderTags`). Dejar intacto el `Autocomplete` equivalente dentro de `ScenarioDetailForm`. Si `availablePrinciples` deja de usarse dentro de `SubPrincipleDetailForm`, no hace falta quitarlo del destructuring de `useGameModelDraft()` si otra parte del componente lo sigue usando — comprobar antes de tocarlo.
2. `components/ScenarioAccordion.tsx`: eliminar el bloque `{sp.tacticalPrinciples.length > 0 && (<Box className={styles.principlesRow}>...</Box>)}` que muestra "Principios tácticos colectivos:" para el subprincipio. Dejar intacto el bloque equivalente de escenario si existe en el mismo archivo.
3. `components/GameModelPrintView.tsx`: eliminar el bloque equivalente de subprincipio (`{sp.tacticalPrinciples.length > 0 && (...)}`), dejando el de `scenario.tacticalPrinciples` intacto.

Verificar: `npm run test -- ScenarioFormAccordion ScenarioAccordion && npm run build`.

## Paso 7 — Frontend: sesiones desde subprincipio

1. `pages/game-model/CreateSessionFromSubPrinciple.tsx`:
   - Interfaz `SubPrincipleInfo`: quitar `tacticalPrinciples: TacticalPrinciple[];`.
   - Eliminar el bloque JSX que renderiza `subPrinciple.tacticalPrinciples` (chips de "Principios tácticos").
   - Si el import `type { TacticalPrinciple } from "../../types/gameModel";` queda sin uso, eliminarlo.
   - Buscar dónde se construye el objeto `SubPrincipleInfo` que llega por `location.state` (probablemente en `ScenarioAccordion.tsx` o donde se navega hacia esta página) y quitar ahí el campo `tacticalPrinciples` si se pasa explícitamente.
2. `pages/game-model/SessionsFromSubPrinciple.tsx`:
   - Interfaz `SubPrincipleInfo`: quitar `tacticalPrinciples: TacticalPrinciple[];`.
   - Interfaz `PrintContext`: quitar `tacticalPrinciples: TacticalPrinciple[];`.
   - En `buildPrintHtml`: eliminar la constante `principlesHtml` y el bloque condicional `${ctx.tacticalPrinciples.length > 0 ? \`...\${principlesHtml}\` : ""}` dentro del HTML generado.
   - Eliminar el bloque JSX del banner de contexto que renderiza `subPrinciple.tacticalPrinciples`.
   - Al construir el objeto `printContext` pasado a `SessionCard`, quitar la línea `tacticalPrinciples: state.subPrinciple.tacticalPrinciples,`.
   - Si el import de `TacticalPrinciple` queda sin uso, eliminarlo.
   - Localizar de dónde viene `state.subPrinciple` (navegación desde `ScenarioAccordion.tsx` con `navigate(..., { state: { subPrinciple: {...} } })` o similar) y quitar el campo ahí también.
3. Revisar si existen tests para estos dos archivos (`__tests__/CreateSessionFromSubPrinciple.test.tsx`, `__tests__/SessionsFromSubPrinciple.test.tsx`) y actualizar sus fixtures/aserciones si referencian `tacticalPrinciples` en el objeto de subprincipio.

Verificar: `npm run test -- CreateSessionFromSubPrinciple SessionsFromSubPrinciple && npm run build`.

## Paso 8 — Verificación final

1. `npm run test` completo (frontend) → 100% pass, sin skips.
2. `npm run build` → sin errores TypeScript.
3. `dotnet test` completo (backend) → 100% pass. **Avisar antes de ejecutar por si la API está corriendo localmente.**
4. Informar resumen: archivos tocados (backend y frontend), migración generada (recordar que queda pendiente de aplicar a la BD), tests ajustados, y recordatorio de prueba manual (abrir un escenario con subprincipios existentes, confirmar que ya no aparecen principios tácticos a ese nivel y que el nivel escenario sigue funcionando).
