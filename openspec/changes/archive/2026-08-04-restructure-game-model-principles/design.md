## 1. Backend — domain

### 1.1 New entity — `Domain/Aggregates/GameModels/GamePrinciple.cs`

Follows the `GameScenario` pattern (private setters, factory constructor, intent methods). Lives at the level `GameScenario` used to occupy (owns `GameMomentId`/`GameZoneId`/`Order`), and gains `Title`/`Description`.

```csharp
public class GamePrinciple : BaseEntity
{
    public string GameModelId { get; private set; } = null!;
    public int GameMomentId { get; private set; }
    public int GameZoneId { get; private set; }
    public int Order { get; private set; }
    public string Title { get; private set; } = null!;
    public string Description { get; private set; } = string.Empty;

    public GameModel GameModel { get; private set; } = null!;
    public GameMoment GameMoment { get; private set; } = null!;
    public GameZone GameZone { get; private set; } = null!;

    public List<GameScenario> Scenarios { get; private set; } = new();

    private GamePrinciple() { }

    public GamePrinciple(string gameModelId, int gameMomentId, int gameZoneId, int order, string title, string description)
    {
        GameModelId = gameModelId;
        GameMomentId = gameMomentId;
        GameZoneId = gameZoneId;
        Order = order;
        UpdateTitle(title);
        Description = description ?? string.Empty;
    }

    public void UpdateTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Principle title cannot be empty.", nameof(title));
        Title = title.Trim();
    }

    public void UpdateDescription(string description) => Description = description ?? string.Empty;
    public void UpdateOrder(int order) => Order = order;
}
```

### 1.2 `GameScenario.cs` changes

- Remove: `GameMomentId`, `GameZoneId`, nav `GameMoment`, nav `GameZone`, `TacticalPrinciples`, `UpdateMomentAndZone`.
- Add: `GamePrincipleId` (string), nav `GamePrinciple`, `ReparentTo(string gamePrincipleId)` (mirrors `SubSubPrinciple.ReparentTo`, used by the re-scoped move endpoint).
- Constructor becomes `GameScenario(string gamePrincipleId, int order, string name, string context)`.
- `Order` now means "order within the principle", not "order within the moment/zone cell".

### 1.3 `GameModel.cs` changes

- Rename `List<GameScenario> Scenarios` → `List<GamePrinciple> Principles`.

### 1.4 Removed entities

- `Domain/Aggregates/GameModels/ScenarioTacticalPrinciple.cs` — delete.
- `Domain/Aggregates/Training/TacticalGoalsEnum.cs` — delete (confirmed used only by this feature; do **not** touch the unrelated `TechnicalGoalsEnum`, a different 8-row catalog still used elsewhere in Training).

## 2. Backend — EF configuration & DbContext

- New `Infrastructure/Persistence/Configuration/Aggregates/GameModels/GamePrincipleConfiguration.cs`: table `GamePrinciples`, schema `app`; `HasOne(GameMoment).WithMany().HasForeignKey(GameMomentId).OnDelete(Restrict)`; same for `GameZone`; `HasMany(Scenarios).WithOne(GamePrinciple).HasForeignKey(GamePrincipleId).OnDelete(Cascade)`.
- `GameModelConfiguration.cs`: `HasMany(Principles)` instead of `HasMany(Scenarios)`.
- `GameScenarioConfiguration.cs`: drop the `GameMoment`/`GameZone`/`TacticalPrinciples` config blocks; add `HasOne(GamePrinciple).WithMany(Scenarios).HasForeignKey(GamePrincipleId).OnDelete(Cascade)`.
- Delete `ScenarioTacticalPrincipleConfiguration.cs` and the `TacticalGoalsEnum` EF config (`TacticalGoalsEnumEntityConfiguration.cs` — confirm exact filename by search).
- `AppDbContext.cs`: add `DbSet<GamePrinciple> GamePrinciples`; remove `DbSet<ScenarioTacticalPrinciple> ScenarioTacticalPrinciples` and the `TacticalGoals` DbSet.

## 3. Backend — migration (schema + data + drops)

One migration, `RestructureGameModelPrinciples`. Follow the raw-SQL pattern from `20260723162135_FixTacticalPrincipleForeignKeys.cs` for the data-migration part (EF `HasData`/model-diff alone can't express "one new row per existing scenario").

`Up()`, in order:
1. `CreateTable("GamePrinciples", schema: "app", columns: Id (text, PK), GameModelId (text, FK → GameModels, cascade), GameMomentId (int, FK → GameMoments, restrict), GameZoneId (int, FK → GameZones, restrict), Order (int), Title (text), Description (text, default ''))`.
2. `AddColumn<string>("GamePrincipleId", "GameScenarios", schema: "app", nullable: true)`.
3. Raw SQL data migration — one `GamePrinciple` per existing `GameScenario`, joined back by `(GameModelId, GameMomentId, GameZoneId, Order)` which is already unique per scenario (siblings are kept contiguously renumbered by the existing move/update logic):
   ```sql
   INSERT INTO app."GamePrinciples" ("Id", "GameModelId", "GameMomentId", "GameZoneId", "Order", "Title", "Description")
   SELECT gen_random_uuid()::text, s."GameModelId", s."GameMomentId", s."GameZoneId", s."Order", s."Name", ''
   FROM app."GameScenarios" s;

   UPDATE app."GameScenarios" s
   SET "GamePrincipleId" = gp."Id"
   FROM app."GamePrinciples" gp
   WHERE gp."GameModelId" = s."GameModelId"
     AND gp."GameMomentId" = s."GameMomentId"
     AND gp."GameZoneId" = s."GameZoneId"
     AND gp."Order" = s."Order";

   UPDATE app."GameScenarios" SET "Order" = 1;
   ```
   (Each migrated scenario is now the sole scenario of its own principle, so its in-principle order is `1`.)
4. `AlterColumn<string>("GamePrincipleId", "GameScenarios", nullable: false)`.
5. `AddForeignKey` `GameScenarios.GamePrincipleId → GamePrinciples.Id` (cascade).
6. `DropForeignKey`/`DropColumn` `GameScenarios.GameMomentId`, `GameScenarios.GameZoneId`.
7. `DropTable("ScenarioTacticalPrinciples", schema: "app")`.
8. `DropTable("TacticalGoals", schema: "app")` (or equivalent seeded-table name — verify via `TacticalGoalsEnumEntityConfiguration`).

`Down()`: symmetric — recreate `ScenarioTacticalPrinciples`/`TacticalGoals` (empty), re-add `GameMomentId`/`GameZoneId` to `GameScenarios` and backfill from the linked `GamePrinciple`, drop `GamePrincipleId` and `GamePrinciples`.

Generate with:
```
cd Back/ExtractionApi
dotnet ef migrations add RestructureGameModelPrinciples --project src/RFFM.Api --startup-project src/RFFM.Host
```
then hand-edit `Up()`/`Down()` to insert the raw-SQL data-migration statements around the EF-generated schema operations (same technique as `20260723162135_FixTacticalPrincipleForeignKeys.cs`).

## 4. Backend — feature files

### 4.1 `CreateGameModel.cs` / `UpdateGameModel.cs`

Request DTOs gain a principle layer, lose `TacticalPrincipleIds`:

```csharp
public record CreateGameModelCommand(string TeamId, string Name, string Season, List<PrincipleRequest> Principles)
    : IRequest<string>, IRequireFeaturePermission { ... }

public record PrincipleRequest(
    string? Id, int GameMomentId, int GameZoneId, int Order, string Title, string Description,
    List<ScenarioRequest> Scenarios);

public record ScenarioRequest(string? Id, int Order, string Name, string Context, List<SubPrincipleRequest> SubPrinciples);
```

`CreateGameModelHandler`: outer loop builds a `GamePrinciple` per `PrincipleRequest`, inner loop builds `GameScenario`s under it (drop the `TacticalPrincipleIds` loop entirely).

`UpdateGameModelHandler`: same upsert/diff shape as today but one level up — match existing `GamePrinciple`s by `Id` (or by `(GameMomentId, GameZoneId, Order)` when `Id` is empty, mirroring the current scenario-matching fallback), upsert title/description/order, then recurse into scenario upsert (same logic as today minus the tactical-principles diff block, lines ~108-122 in the current handler — delete that block outright). Remove unmatched principles via `_db.GamePrinciples.RemoveRange(...)` (cascades to their scenarios).

### 4.2 `GetGameModel.cs`

```csharp
public record GameModelResponse(string Id, string TeamId, string Name, string Season, IEnumerable<PrincipleResponse> Principles);

public record PrincipleResponse(
    string Id, int GameMomentId, string GameMomentName, int GameZoneId, string GameZoneName,
    int Order, string Title, string Description, IEnumerable<ScenarioResponse> Scenarios);

public record ScenarioResponse(
    string Id, int Order, string Name, string Context,
    IEnumerable<SubPrincipleResponse> SubPrinciples, string? MediaUrl, string? MediaType);
```

Drop `TacticalPrincipleDto` and the `TacticalGoalsEnum.List()` lookup entirely. `Include` chain moves the `GameMoment`/`GameZone`/`ThenInclude` calls from `Scenarios` to `Principles`, and adds `.Include(gm => gm.Principles).ThenInclude(p => p.Scenarios).ThenInclude(s => s.SubPrinciples)...` for the nested chain. Ordering: `Principles.OrderBy(GameMomentId).ThenBy(GameZoneId).ThenBy(Order)`, then `Scenarios.OrderBy(Order)` within each.

### 4.3 `MoveScenarioLocation.cs` → re-scope to move-between-principles

Rename request/response to reflect the new target (keep the file name `MoveScenarioLocation.cs` unless the implementer prefers a rename — functionally it is now "move to a different principle within the same game model"):

```csharp
public record MoveScenarioLocationRequest(string TargetGamePrincipleId);
public record MoveScenarioLocationCommand(string ScenarioId, string TargetGamePrincipleId, string UserId)
    : IRequest<MoveScenarioLocationResult>, IRequireFeaturePermission { ... }
public record MoveScenarioLocationResult(int Order);
```

Handler: load scenario + target principle (must belong to the same `GameModelId` — else `DomainException` with a new `ErrorCodes.PrincipleNotFound` or reuse `GameModelNotFound`), no-op if already in that principle, else `scenario.ReparentTo(targetPrincipleId)`, append order = target principle's scenario count + 1, renumber the source principle's remaining scenarios `1..N` (same renumbering logic as today, just keyed by `GamePrincipleId` instead of `(GameMomentId, GameZoneId)`).

### 4.4 Removed feature

- `Features/Coaches/GameModels/Queries/GetTechnicalGoals.cs` — delete (confirm no other caller of `/api/technical-goals` first — research found none).

## 5. Backend — tests to rewrite/replace

- `GameModelTacticalPrincipleForeignKeyTests.cs`, `UpdateGameModelResavePrinciplesTests.cs` — delete (their entire purpose was the removed FK/diff logic). Replace with principle-focused equivalents if principle upsert has similar change-tracking edge cases worth covering (recommended: at least one test asserting that re-saving an unchanged `GamePrinciple` doesn't churn its `Scenarios`' EF identities).
- New: `CreateGameModelHandlerTests` / `UpdateGameModelHandlerTests` (or extend existing ones if present) covering principle create/update/delete and nested scenario create/update/delete.
- New: `MoveScenarioLocationHandlerTests` (rewrite of the existing one) — move to a different principle in the same model, no-op on same principle, renumbering of source principle siblings, cross-model target rejected.
- New: a migration data-integrity test or a manual verification step (see tasks.md) confirming one `GamePrinciple` is created per pre-existing `GameScenario` with the scenario's name as the title.

## 6. Frontend — types (`apps/coach/types/gameModel.ts`)

```ts
export interface Principle {
  id: number;
  apiId?: string;
  gameMomentId: number;
  gameZoneId: number;
  order: number;
  title: string;
  description: string;
  scenarios: Scenario[];
}

export interface Scenario {
  id: number;
  apiId?: string;
  order: number;
  name: string;
  context: string;
  subPrinciples: SubPrinciple[];
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  // tacticalPrinciples removed — no replacement
}

export interface Zone { id: number; name: string; principles: Principle[]; }   // was: scenarios: Scenario[]
export interface GameMoment { id: number; name: string; zones: Zone[]; }
export interface GameModel { id: string; teamId: string; name: string; season: string; gameMoments: GameMoment[]; }
```

Delete the `TacticalPrinciple` interface entirely.

## 7. Frontend — `context/GameModelDraftContext.tsx`

Every action/reducer case that currently addresses a scenario by `(mi, zi, si)` gains a principle index `(mi, zi, pi, si)`. New action types: `ADD_PRINCIPLE`, `UPD_PRINCIPLE`, `DEL_PRINCIPLE` (mirroring the existing `ADD_SCENARIO`/`UPD_SCENARIO`/`DEL_SCENARIO` shape, addressed by `(mi, zi)` + principle index/id). `ADD_SCENARIO`/`UPD_SCENARIO`/`DEL_SCENARIO` gain the `pi` index. `MOVE_SCENARIO_LOCATION` becomes "move to target principle": payload changes from `{ targetMomentId, targetZoneId }` to `{ targetPrincipleId }` (or `(mi, zi, pi)` triple identifying the target within the draft tree), removes the scenario from its source principle's list (renumbering `1..N`), appends to the target principle's list.

Remove entirely: `availablePrinciples` from `DraftContextValue`, and any action/state tied to the tactical-principles catalog.

## 8. Frontend — `services/gameModelService.ts`

- `ApiScenario`: drop `tacticalPrinciples`.
- New `ApiPrinciple { id: string; gameMomentId: number; gameZoneId: number; order: number; title: string; description: string; scenarios: ApiScenario[] }`.
- `ApiGameModel.principles: ApiPrinciple[]` (or however the backend nests it — matches `GameModelResponse.Principles`).
- `mapApiToGameModel()` / `mapModelToRequest()`: rebuild around the extra nesting level, dropping `tacticalPrincipleIds`.
- Delete `getAvailableTacticalPrinciples()` (and its call site).
- Rename `moveScenarioLocation(scenarioApiId, gameMomentId, gameZoneId)` → `moveScenarioToPrinciple(scenarioApiId, targetPrincipleApiId)`, calling the re-scoped `PATCH /api/game-models/scenarios/{id}/location` with `{ targetGamePrincipleId }`.

## 9. Frontend — `services/gameModelMock.ts`

Restructure every fixture (`mockGameModel`, `mockGameModel_2024_2025`, `createEmptyDraft()`) to insert a `principles: [...]` array between each zone and its scenarios (at least one principle per populated zone in the existing fixtures, title derived from the scenario names it groups, to keep fixture data meaningful). Delete `mockAvailableTacticalPrinciples`.

## 10. Frontend — UI components

### `ScenarioFormAccordion.tsx`
- Add a Principio-level accordion/section per zone tab: title + description text fields, "Añadir principio" button, delete-principle control (with a confirm dialog matching the existing scenario-delete confirm pattern, if one exists).
- Nest the existing per-scenario form inside the principle it belongs to; "Añadir escenario" now adds to the selected principle, not directly to the zone.
- Remove the `Autocomplete` block (lines ~392-409) rendering "Principios tácticos colectivos" and its `styles.principlesField`/`styles.principlesAutocomplete` CSS (drop from the `.module.css` if unused elsewhere).
- "Mover a…" control (`handleMove`, the two `Select`s at ~324-371): replace the Momento/Zona `Select`s with a single Principio `Select` (grouped by Momento/Zona for discoverability, e.g. MUI `Autocomplete`/`Select` with `groupBy`), calling `moveScenarioToPrinciple` when the scenario has an `apiId`, else dispatching the local-draft `MOVE_SCENARIO_LOCATION` action directly.

### `ScenarioAccordion.tsx` (read view)
- Render each principle as a heading (title + description) above its scenarios, replacing the current flat scenario list per zone.
- Remove the tactical-principles chip block (~lines 187-196).

### `GameModelPrintView.tsx`
- Same restructuring: principle title/description as a print heading above its scenarios.
- Remove the tactical-principles text block (~lines 44-51).

### Naming collision to watch
`PrincipleExercisesSection.tsx` exports `PrincipleLevelKind = "subSubPrinciple" | "subPrinciple" | "scenario"` — unrelated to the new `Principle` entity (it's about which nesting level an exercise is linked to). Leave it as-is; do not rename unless it becomes genuinely ambiguous once the new `Principle` type exists alongside it in the same files — if so, prefer renaming the new frontend type to `GamePrinciple` (matching the backend entity name) rather than touching `PrincipleExercisesSection`.

## 11. Frontend — tests to rewrite

- `ScenarioFormAccordion.test.tsx`: remove the "Principios tácticos colectivos" label assertions; add principle create/edit/delete coverage; update "Mover a…" tests for the new principle-target control.
- `ScenarioAccordion.test.tsx`: remove tactical-principles text assertions and fixture fields; add principle heading assertions.
- `GameModelDraftContext.test.tsx`: extend for the new principle index/actions; update `MOVE_SCENARIO_LOCATION` test for the principle-target payload.
