# Design — Remove Sub-Principle Tactical Principles

Eliminación de dato de punta a punta. El nivel **escenario** (`ScenarioTacticalPrinciple`, `ScenarioDetailForm`, campos `s.tacticalPrinciples`/`scenario.tacticalPrinciples`) NO se toca en ningún archivo — solo se elimina la vertiente de **subprincipio** (`sp.tacticalPrinciples`/`subPrinciple.tacticalPrinciples`, tabla `SubPrincipleTacticalPrinciple`).

## 1. Backend — Dominio y persistencia

- `Domain/Aggregates/GameModels/SubPrinciple.cs`: eliminar la propiedad `public List<SubPrincipleTacticalPrinciple> TacticalPrinciples { get; private set; } = new();` (línea 19).
- Eliminar `Domain/Aggregates/GameModels/SubPrincipleTacticalPrinciple.cs` y `Infrastructure/Persistence/Configuration/Aggregates/GameModels/SubPrincipleTacticalPrincipleConfiguration.cs`.
- `Infrastructure/Persistence/AppDbContext.cs`: eliminar `public DbSet<SubPrincipleTacticalPrinciple> SubPrincipleTacticalPrinciples { get; set; }` (línea 114).

No tocar `ScenarioTacticalPrinciple.cs` ni `ScenarioTacticalPrincipleConfiguration.cs` ni el `DbSet<ScenarioTacticalPrinciple>`.

## 2. Backend — Features (contrato de API)

- `Features/Coaches/GameModels/Commands/CreateGameModel.cs`:
  - `SubPrincipleRequest`: eliminar el campo `List<int> TacticalPrincipleIds` (línea 77).
  - Handler: eliminar el bucle `foreach (var tpId in spr.TacticalPrincipleIds) subPrinciple.TacticalPrinciples.Add(...)` (líneas 125-126). El bucle equivalente de `sr.TacticalPrincipleIds` a nivel de escenario (líneas 118-119) se mantiene.
- `Features/Coaches/GameModels/Commands/UpdateGameModel.cs`:
  - En `UpsertSubPrinciples`: eliminar el bloque de diff de `existing.TacticalPrinciples` (líneas 170-183) y el bucle de creación en la rama `else` (línea 191).
  - En `BuildSubPrinciples`: eliminar el bucle `foreach (var tpId in spr.TacticalPrincipleIds) sp.TacticalPrinciples.Add(...)` (líneas 286-287).
  - El `Include(...).ThenInclude(sp => sp.TacticalPrinciples)` sobre `SubPrinciples` en la query inicial (línea 74) se elimina; el de `s.TacticalPrinciples` (escenario, línea 71) se mantiene.
  - No tocar la lógica equivalente de `existing.TacticalPrinciples`/`newScenario.TacticalPrinciples` a nivel de escenario (líneas 111-125, 132-133).
- `Features/Coaches/GameModels/Queries/GetGameModel.cs`:
  - `SubPrincipleResponse`: eliminar `IEnumerable<TacticalPrincipleDto> TacticalPrinciples` (línea 82).
  - Eliminar `.ThenInclude(sp => sp.TacticalPrinciples)` tras `.ThenInclude(s => s.SubPrinciples)` (líneas 123-124); mantener el de `s.Scenarios.ThenInclude(s => s.TacticalPrinciples)` (líneas 116-117).
  - En la proyección, eliminar el argumento `sp.TacticalPrinciples.Select(tp => new TacticalPrincipleDto(...))` de `SubPrincipleResponse` (línea 181); mantener el equivalente de `ScenarioResponse` (línea 171).

## 3. Backend — Migración EF Core

- Generar migración `RemoveSubPrincipleTacticalPrinciples` (`.\manage-migrations.ps1` o `dotnet ef migrations add`, avisando antes si la API está corriendo en local).
- `Up()`: `migrationBuilder.DropTable(name: "SubPrincipleTacticalPrinciples", schema: "app");`
- `Down()`: recrear la tabla con su clave compuesta `(SubPrincipleId, TechnicalGoalId)` y FK a `SubPrinciples` (simétrico al `CreateTable` original de `20260401163621_AddSubPrinciplesTables.cs`), a efectos de reversibilidad del esquema — el contenido de los datos no es recuperable.

## 4. Backend — Tests

- `tests/RFFM.Api.Tests/IntegrationTests/GameModelTacticalPrincipleForeignKeyTests.cs`:
  - `SeedGameModelAsync` ya no necesita sembrar `SubPrincipleTacticalPrinciple` (no lo hace hoy, revisar si queda referencia).
  - El test `SavingScenarioWithTacticalPrincipleIdAbove8_DoesNotThrow` construye un `SubPrincipleRequest` con `TacticalPrincipleIds` (línea ~118) y luego hace `Assert.Single(persistedScenario.SubPrinciples.Single().TacticalPrinciples)` (líneas 142-143): quitar el argumento del constructor de `SubPrincipleRequest` y esas dos aserciones; mantener las aserciones equivalentes de escenario (líneas 140-141).
- `tests/RFFM.Api.Tests/IntegrationTests/UpdateGameModelResavePrinciplesTests.cs`:
  - Setup (líneas 89-91): quitar `subPrinciple.TacticalPrinciples.Add(new SubPrincipleTacticalPrinciple(...))`.
  - `ResavingScenarioWithSameTacticalPrincipleIds_DoesNotThrow`: quitar el argumento `TacticalPrincipleIds` del `SubPrincipleRequest` (línea ~138) y las aserciones de subprincipio (líneas 162-163); mantener las de escenario (líneas 160-161).
  - `ResavingScenarioWithDuplicateTacticalPrincipleIdInSameList_ThrowsInvalidOperationException`: revisar si el `SubPrincipleRequest` de ese test pasa `TacticalPrincipleIds` y ajustarlo igual.
  - Actualizar los comentarios XML que mencionan `SubPrincipleTacticalPrinciples` como ejemplo del patrón (líneas 25-29) para no referenciar una clase eliminada.
- Verificar: `dotnet build && dotnet test` (avisar antes si la API está corriendo en local).

## 5. Frontend — Tipos, contexto y servicios

- `types/gameModel.ts`: eliminar `tacticalPrinciples: TacticalPrinciple[];` de `SubPrinciple` (línea 35). No tocar el de `Scenario` (línea 45).
- `context/GameModelDraftContext.tsx`:
  - `UPD_SP`: `changes: Partial<Pick<SubPrinciple, "name" | "context" | "tacticalPrinciples">>` → quitar `"tacticalPrinciples"` (línea 40).
  - `ADD_SP`: quitar `tacticalPrinciples: [],` del objeto `SubPrinciple` inicial (línea 183). No tocar el de `ADD_SCENARIO` (línea 127).
- `services/gameModelService.ts`:
  - `ApiSubPrinciple`: quitar `tacticalPrinciples: ApiTacticalPrinciple[];` (línea 41).
  - `mapApiToGameModel`: quitar `tacticalPrinciples: sp.tacticalPrinciples,` del mapeo de subprincipio (línea 105). No tocar el de escenario (línea 95).
  - `mapModelToRequest`: quitar `tacticalPrincipleIds: sp.tacticalPrinciples.map((tp) => tp.id),` (línea 160). No tocar el de escenario (línea 153).
- `services/gameModelMock.ts`: quitar el campo `tacticalPrinciples` de cada subprincipio de los datos mock (las ocurrencias anidadas dentro de `subPrinciples: [...]`); conservar las de nivel escenario. Verificar cada una por contexto, no por número de línea (el archivo puede haber cambiado de tamaño).

## 6. Frontend — Formulario y vistas

- `components/ScenarioFormAccordion.tsx`: eliminar el bloque `<Autocomplete multiple ... value={sp.tacticalPrinciples} ... dispatch({ type: "UPD_SP", ... tacticalPrinciples ... })>` completo (líneas 158-175) dentro de `SubPrincipleDetailForm`. No tocar el `Autocomplete` equivalente de `ScenarioDetailForm` (líneas 318-335).
- `components/ScenarioAccordion.tsx`: eliminar el bloque `{sp.tacticalPrinciples.length > 0 && (...)}` (líneas 109-118). Verificar si queda un bloque análogo para `scenario.tacticalPrinciples` en el mismo archivo (no tocar).
- `components/GameModelPrintView.tsx`: eliminar el bloque `{sp.tacticalPrinciples.length > 0 && (...)}` (líneas 61-68). No tocar el de `scenario.tacticalPrinciples` (líneas 44-51).

## 7. Frontend — Sesiones desde subprincipio

- `pages/game-model/CreateSessionFromSubPrinciple.tsx`:
  - `SubPrincipleInfo`: quitar `tacticalPrinciples: TacticalPrinciple[];` (línea 26); si el import de `TacticalPrinciple` queda sin uso, eliminarlo.
  - Eliminar el bloque `{subPrinciple.tacticalPrinciples.length > 0 && (...)}` (líneas 210-224).
- `pages/game-model/SessionsFromSubPrinciple.tsx`:
  - `SubPrincipleInfo`: quitar `tacticalPrinciples: TacticalPrinciple[];` (línea 52).
  - `PrintContext`: quitar `tacticalPrinciples: TacticalPrinciple[];` (línea 221); si `TacticalPrinciple` queda sin uso, eliminar el import.
  - `buildPrintHtml`: eliminar `principlesHtml` (líneas 284-288) y el bloque condicional que lo inserta en el HTML (líneas 317-319).
  - Eliminar el bloque `{subPrinciple.tacticalPrinciples.length > 0 && (...)}` del banner de contexto (líneas 815-829).
  - Al construir `printContext` para `SessionCard` (línea 869), quitar `tacticalPrinciples: state.subPrinciple.tacticalPrinciples,`.
  - Verificar el origen de `state.subPrinciple` (dónde se construye `SubPrincipleInfo` a partir de la respuesta de `GetGameModel`, probablemente en `useLocation().state` pasado desde `ScenarioAccordion.tsx`/navegación) y quitar ahí también el campo si se construye explícitamente.

## 8. Tests (TDD)

Al ser una eliminación de campo, TypeScript señala en compilación (`npm run build`) cualquier uso residual — usarlo como red de seguridad además de los tests dirigidos:

- `ScenarioFormAccordion.test.tsx`: quitar/actualizar los casos que ejercitan el Autocomplete de principios a nivel de subprincipio; añadir/mantener un caso que confirme que **no** se renderiza el label "Principios tácticos colectivos" dentro del formulario de subprincipio, mientras que sigue apareciendo en el de escenario.
- `ScenarioAccordion.test.tsx`: quitar el caso que verifica el chip de principios a nivel de subprincipio (o convertirlo en caso negativo: no se renderiza aunque el subprincipio tenga el campo).
- Revisar tests de `CreateSessionFromSubPrinciple`/`SessionsFromSubPrinciple` si existen y ajustar los fixtures que ya no incluyen `tacticalPrinciples` en subprincipio.
- Backend: actualizar los dos archivos de test listados en §4 (Red→Green: confirmar que fallan por los tipos eliminados, luego ajustar).
