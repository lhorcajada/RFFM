# Remove Sub-Principle Tactical Principles

## Why

En `game-model` (Coach), tanto el **escenario** como cada **subprincipio** dentro de él tienen un selector "Principios tácticos colectivos" (relación many-to-many con `TechnicalGoalsEnum`). El de nivel subprincipio ya no aporta valor — se decide eliminarlo por completo (formulario, vistas de lectura, contrato de API y modelo de datos), sin retro-compatibilidad: los subprincipios que ya tuvieran principios tácticos asignados **pierden ese dato** en la migración.

El selector a nivel de **escenario** (`ScenarioDetailForm`, tabla `ScenarioTacticalPrinciple`) no se toca.

## What Changes

- **Backend**:
  - `SubPrinciple.cs`: se elimina la propiedad `TacticalPrinciples` (lista de `SubPrincipleTacticalPrinciple`).
  - Se elimina la entidad `SubPrincipleTacticalPrinciple.cs` y su configuración EF `SubPrincipleTacticalPrincipleConfiguration.cs`.
  - `AppDbContext.cs`: se elimina `DbSet<SubPrincipleTacticalPrinciple>`.
  - `CreateGameModel.cs` / `UpdateGameModel.cs`: `SubPrincipleRequest` pierde `TacticalPrincipleIds`; se elimina la lógica de creación/diff de `SubPrincipleTacticalPrinciple` en ambos handlers.
  - `GetGameModel.cs`: `SubPrincipleResponse` pierde `TacticalPrinciples`; se elimina el `.ThenInclude(sp => sp.TacticalPrinciples)` correspondiente.
  - Nueva migración EF Core: `DROP TABLE app."SubPrincipleTacticalPrinciples"` (los datos existentes se pierden, aceptado explícitamente).
  - Tests afectados: `GameModelTacticalPrincipleForeignKeyTests.cs` y `UpdateGameModelResavePrinciplesTests.cs` referencian `SubPrinciple.TacticalPrinciples`/`SubPrincipleTacticalPrinciple` — se actualizan para dejar de ejercitar ese camino, conservando la cobertura del nivel escenario (que sigue existiendo).

- **Frontend**:
  - `types/gameModel.ts`: `SubPrinciple` pierde el campo `tacticalPrinciples`.
  - `context/GameModelDraftContext.tsx`: `UPD_SP` deja de aceptar `tacticalPrinciples` en `changes`; `ADD_SP` deja de inicializarlo.
  - `services/gameModelService.ts`: `ApiSubPrinciple` pierde `tacticalPrinciples`; se quita del mapeo API→modelo y modelo→API (`tacticalPrincipleIds` de subprincipio ya no se envía).
  - `services/gameModelMock.ts`: se quita `tacticalPrinciples` de los subprincipios de los datos mock (se conserva a nivel de escenario).
  - `components/ScenarioFormAccordion.tsx`: se elimina el `Autocomplete` "Principios tácticos colectivos" de `SubPrincipleDetailForm` (el de `ScenarioDetailForm` se mantiene intacto).
  - `components/ScenarioAccordion.tsx` y `components/GameModelPrintView.tsx`: se elimina el bloque de solo-lectura que muestra los principios tácticos del subprincipio (el de escenario se mantiene).
  - `pages/game-model/CreateSessionFromSubPrinciple.tsx` y `pages/game-model/SessionsFromSubPrinciple.tsx`: se elimina el campo/uso de `tacticalPrinciples` del subprincipio (tipos locales, render y HTML de impresión de sesión).

## Non-Goals

- No se toca el selector ni la relación de principios tácticos a nivel de **escenario**.
- No se migran ni se conservan de otra forma los datos existentes de `SubPrincipleTacticalPrinciples`; se eliminan con la migración.
- No se renombra ni se toca `TechnicalGoalsEnum` (el catálogo de principios tácticos sigue existiendo para el nivel escenario).

## Impact

- **Back**: `Domain/Aggregates/GameModels/{SubPrinciple.cs, SubPrincipleTacticalPrinciple.cs (eliminado)}`, `Infrastructure/Persistence/Configuration/Aggregates/GameModels/SubPrincipleTacticalPrincipleConfiguration.cs (eliminado)`, `Infrastructure/Persistence/AppDbContext.cs`, `Features/Coaches/GameModels/{Commands/CreateGameModel.cs, Commands/UpdateGameModel.cs, Queries/GetGameModel.cs}`, nueva migración EF Core, `tests/RFFM.Api.Tests/IntegrationTests/{GameModelTacticalPrincipleForeignKeyTests.cs, UpdateGameModelResavePrinciplesTests.cs}`.
- **Front**: `apps/coach/types/gameModel.ts`, `apps/coach/context/GameModelDraftContext.tsx`, `apps/coach/services/{gameModelService.ts, gameModelMock.ts}`, `apps/coach/pages/game-model/components/{ScenarioFormAccordion.tsx, ScenarioAccordion.tsx, GameModelPrintView.tsx}`, `apps/coach/pages/game-model/{CreateSessionFromSubPrinciple.tsx, SessionsFromSubPrinciple.tsx}` + tests correspondientes.
