# Implementation script — add-coach-season-planning

Follow `tasks.md` order. Every backend file must follow the exact style of `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/GameModels/GameModel.cs` and `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/GameModels/Commands/{CreateGameModel,UpdateGameModel}.cs` — read those two files first, they are the template this whole feature mirrors (full-aggregate upsert-by-key, plain constructors, `IFeatureModule`, `IRequireFeaturePermission`). TDD: write the test file before the production file in every backend/frontend step that has one.

## 1. Domain — `Domain/Aggregates/SeasonPlans/`

**`SeasonPlan.cs`**
```csharp
namespace RFFM.Api.Domain.Aggregates.SeasonPlans
{
    /// <summary>Aggregate root for a team's season training plan (one per team per season).</summary>
    public class SeasonPlan : BaseEntity, IAggregateRoot
    {
        public string TeamId { get; private set; } = null!;
        public string SeasonId { get; private set; } = null!;

        public List<Macrociclo> Macrociclos { get; private set; } = new();

        private SeasonPlan() { }

        public SeasonPlan(string teamId, string seasonId)
        {
            UpdateTeamId(teamId);
            UpdateSeasonId(seasonId);
        }

        private void UpdateTeamId(string teamId)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("TeamId cannot be empty.", nameof(teamId));
            TeamId = teamId;
        }

        private void UpdateSeasonId(string seasonId)
        {
            if (string.IsNullOrWhiteSpace(seasonId))
                throw new ArgumentException("SeasonId cannot be empty.", nameof(seasonId));
            SeasonId = seasonId;
        }
    }
}
```

**`Macrociclo.cs`**
```csharp
namespace RFFM.Api.Domain.Aggregates.SeasonPlans
{
    public class Macrociclo : BaseEntity
    {
        public string SeasonPlanId { get; private set; } = null!;
        public int Order { get; private set; }
        public string Name { get; private set; } = null!;
        public DateOnly StartDate { get; private set; }
        public DateOnly EndDate { get; private set; }

        public List<Mesociclo> Mesociclos { get; private set; } = new();

        private Macrociclo() { }

        public Macrociclo(string seasonPlanId, int order, string name, DateOnly startDate, DateOnly endDate)
        {
            SeasonPlanId = seasonPlanId;
            UpdateOrder(order);
            UpdateName(name);
            Reschedule(startDate, endDate);
        }

        public void UpdateOrder(int order) => Order = order;

        public void UpdateName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Macrociclo name cannot be empty.", nameof(name));
            Name = name.Trim();
        }

        public void Reschedule(DateOnly startDate, DateOnly endDate)
        {
            if (endDate < startDate)
                throw new ArgumentException("EndDate cannot be before StartDate.", nameof(endDate));
            StartDate = startDate;
            EndDate = endDate;
        }
    }
}
```

**`Mesociclo.cs`** — same shape as `Macrociclo` plus `MacrocicloId`, `GameZoneId` (int, required — FK to the existing `GameZone` catalog), `Microciclos: List<Microciclo>`. Constructor `Mesociclo(string macrocicloId, int order, string name, DateOnly startDate, DateOnly endDate, int gameZoneId)`. Add `UpdateGameZoneId(int gameZoneId)` (no validation beyond non-negative — FK constraint enforces the catalog membership at the DB level, matching how `GamePrinciple.GameMomentId` is handled).

**`Microciclo.cs`** — same shape plus `MesocicloId`, `WeekLabel` (string, replaces `Name`), `ObjetivoSesionA`, `ObjetivoSesionB` (both required strings). Constructor `Microciclo(string mesocicloId, int order, string weekLabel, DateOnly startDate, DateOnly endDate, string objetivoSesionA, string objetivoSesionB)`. Mutators: `UpdateWeekLabel`, `Reschedule`, `UpdateObjectives(string sesionA, string sesionB)` (both required, `ArgumentException` if blank).

Verify: `dotnet build` from `Back/ExtractionApi`.

## 2. Persistence

**`Infrastructure/Persistence/Configuration/Aggregates/SeasonPlans/SeasonPlanConfiguration.cs`** (and one file per entity, same folder) — follow `Configuration/Aggregates/GameModels/GameModelConfiguration.cs` exactly for style (schema `"app"`, `HasKey(x => x.Id)`, cascade `HasMany(...).WithOne().OnDelete(DeleteBehavior.Cascade)` parent→child, `HasIndex` on `(TeamId, SeasonId)` unique on `SeasonPlan`). `Mesociclo` config adds `HasOne<GameZone>().WithMany().HasForeignKey(m => m.GameZoneId).OnDelete(DeleteBehavior.Restrict)`. `SeasonPlan` config adds `HasOne<Season>().WithMany().HasForeignKey(sp => sp.SeasonId).OnDelete(DeleteBehavior.Restrict)` (read `Infrastructure/Persistence/Configuration/.../SeasonConfiguration.cs` first to match the existing `Season` FK style used by `Team`).

**`AppDbContext.cs`** — add near the existing `GameModels` DbSets:
```csharp
public DbSet<SeasonPlan> SeasonPlans => Set<SeasonPlan>();
public DbSet<Macrociclo> Macrociclos => Set<Macrociclo>();
public DbSet<Mesociclo> Mesociclos => Set<Mesociclo>();
public DbSet<Microciclo> Microciclos => Set<Microciclo>();
```

**`TaskTrainingBase.cs`** — add `public string? MicrocicloId { get; set; }`. In `TaskTrainingBaseEntityConfiguration.cs`, add `HasOne<Microciclo>().WithMany().HasForeignKey(t => t.MicrocicloId).OnDelete(DeleteBehavior.SetNull)`.

Migration:
```
cd Back/ExtractionApi
dotnet ef migrations add AddSeasonPlan --project src/RFFM.Api --startup-project src/RFFM.Host
```
(confirm exact `--project`/`--startup-project` paths against `manage-migrations.ps1` if this differs). Inspect the generated migration — it must create `SeasonPlans`, `Macrociclos`, `Mesociclos`, `Microciclos` tables in schema `app` and add the `MicrocicloId` column to `TaskTrainingBases`. Do not hand-edit the generated schema portion.

## 3. Seed importer

**`Infrastructure/Services/SeasonPlanImporter.cs`** — re-read `docs/game-model/Plan-de-Temporada.docx` (or the already-extracted text captured earlier in this conversation, covering the full calendar: Mesociclo 1.1–1.4 at 3 weeks each with Analítico/Situacional/Global, then Macrociclo 2's Mesociclo 2.1–2.4 at 6 weeks each with Analítico A/B, Situacional A/B, Global exposición/evaluación, then Cierre de temporada as a final unstructured note — decide whether "Cierre de temporada" becomes a trailing Macrociclo with one Mesociclo/Microciclo or is left out of the seed as out-of-model free time; prefer including it as `Macrociclo` #3 "Cierre de temporada" with a single `Mesociclo`/`Microciclo` pair carrying the repaso-global text, so the whole document is represented). Transcribe every zone (`GameZoneId` per Mesociclo, matching the catalog: `iniciacion`, `creacion-propia`, `creacion-rival`, `finalizacion` — confirm the exact catalog ids via `GetGameZones` query or `GameModelKeys.ZoneKeysById`) and every week's two objective texts (`ObjetivoSesionA` = Defensa organizada + Transición defensa-ataque paragraph, `ObjetivoSesionB` = Ataque organizado + Transición ataque-defensa paragraph — for "Semana 2 — Situacional"/"Semana 3 — Global" weeks that only state one combined `Objetivo:` sentence rather than split A/B text, put that same sentence in both `ObjetivoSesionA` and `ObjetivoSesionB`, prefixed to stay accurate, e.g. duplicate verbatim — do not invent a split that isn't in the source).

```csharp
public class SeasonPlanImporter
{
    private readonly AppDbContext _db;
    public SeasonPlanImporter(AppDbContext db) => _db = db;

    public async Task ImportAsync(string teamId, string seasonId, CancellationToken ct = default)
    {
        var plan = await _db.SeasonPlans
            .Include(sp => sp.Macrociclos).ThenInclude(m => m.Mesociclos).ThenInclude(m => m.Microciclos)
            .FirstOrDefaultAsync(sp => sp.TeamId == teamId && sp.SeasonId == seasonId, ct);

        if (plan is null)
        {
            plan = new SeasonPlan(teamId, seasonId);
            _db.SeasonPlans.Add(plan);
        }

        UpsertMacrociclo(plan, order: 1, name: "Macrociclo 1", /* dates from doc */ ...);
        // repeat per macrociclo/mesociclo/microciclo from the transcribed source data — use
        // (order) as the deterministic match key within each parent (mirrors GameModelKeys'
        // approach but scoped by position since SeasonPlan has no natural business key per
        // node beyond its place in the sequence): find-by-order-or-create, then update fields
        // in place so re-running the importer after editing the hardcoded data updates
        // existing rows instead of duplicating them.

        await _db.SaveChangesAsync(ct);
    }

    private static void UpsertMacrociclo(SeasonPlan plan, int order, string name, DateOnly start, DateOnly end)
    {
        var existing = plan.Macrociclos.FirstOrDefault(m => m.Order == order);
        if (existing is not null) { existing.UpdateName(name); existing.Reschedule(start, end); }
        else plan.Macrociclos.Add(new Macrociclo(plan.Id, order, name, start, end));
    }
    // same order-matched upsert pattern for Mesociclo (within a Macrociclo) and Microciclo (within a Mesociclo)
}
```

Before wiring this into a migration, run the DB lookup task (see `tasks.md` 3.2):
```sql
SELECT t."Id", t."Name", s."Id", s."Name"
FROM app."Teams" t JOIN app."Seasons" s ON s."Id" = t."SeasonId"
WHERE t."Name" ILIKE '%cadete%';
```
If exactly one confident match exists, hardcode that `TeamId`/`SeasonId` as constants at the top of the migration's data step and call `new SeasonPlanImporter(db).ImportAsync(teamId, seasonId)` from `migrationBuilder.Sql(...)` is not possible for C# service calls — instead follow the `ReplaceGameModelAdnHierarchy` migration's actual mechanism for invoking C# seed logic from a migration (read that migration's `Up()` in full to see whether it calls a service directly via `IServiceProvider` in `MigrateAsync` startup code, or via `migrationBuilder.Sql`-only raw inserts) and replicate exactly that mechanism, not a new one. If no confident single match exists, skip this migration step, leave `SeasonPlanImporter` as a plain injectable service (still built and tested), and say so explicitly when reporting completion — do not guess a `TeamId`.

## 4. Features — `Features/Coaches/SeasonPlans/`

Add `SeasonPlan = "/coach/season-plan"` to `Domain/Entities/CoachFeatureRoutes.cs` next to `GameModel`, and seed its `FeaturePermission` row the same way `GameModel`'s is seeded (find that seed — likely a migration or startup seeder — and add the twin row).

Mirror `CreateGameModel.cs`/`UpdateGameModel.cs`/`DeleteGameModel.cs`/`GetGameModel.cs` exactly, one file each under `Commands/`/`Queries/`:

- `CreateSeasonPlan.cs`: `POST /api/season-plans`. Command carries `TeamId, SeasonId, List<MacrocicloRequest> Macrociclos`. `MacrocicloRequest(int Order, string Name, DateOnly StartDate, DateOnly EndDate, List<MesocicloRequest> Mesociclos)`, `MesocicloRequest(int Order, string Name, DateOnly StartDate, DateOnly EndDate, int GameZoneId, List<MicrocicloRequest> Microciclos)`, `MicrocicloRequest(int Order, string WeekLabel, DateOnly StartDate, DateOnly EndDate, string ObjetivoSesionA, string ObjetivoSesionB)` — note these requests have **no `Id`** field (unlike `PrincipleRequest`) because `CreateSeasonPlan` only ever builds a brand-new tree; access check identical to `CreateGameModelHandler` (`UserClubs`/`Teams` join on `request.UserId`/`request.TeamId`); `409` via `DomainException` + a new `ErrorCodes.SeasonPlanAlreadyExists` if `_db.SeasonPlans.AnyAsync(sp => sp.TeamId == ... && sp.SeasonId == ...)`.
- `UpdateSeasonPlan.cs`: `PUT /api/season-plans/{id}`. Request records add `string? Id` per node (nullable — present for existing nodes, null for new ones added in this edit) mirroring `PrincipleRequest`/`SubprincipioRequest`. Match-by-`Id`-else-treat-as-new (SeasonPlan nodes have no deterministic business key like `GameModelKeys` provides, so **do not** try to match by content — always match by `Id` when present, always create when `Id` is null/empty; this is simpler than `UpdateGameModel`'s key-based matching precisely because there's no stable key to derive here). Re-derive `Order` server-side from each list's array index (per `design.md` Decision 2), ignoring any client-sent order value. Track matched ids per level and `RemoveRange` unmatched, same three-level nested loop shape as `UpdateGameModel`'s `UpsertSubprincipios`/`UpsertZonas`.
- `DeleteSeasonPlan.cs`: `DELETE /api/season-plans/{id}`. Before `_db.SeasonPlans.Remove(plan)`, run `await _db.TaskTrainingBases.Where(t => t.MicrocicloId != null && plan.Macrociclos.SelectMany(...).Contains(t.MicrocicloId)).ExecuteUpdateAsync(s => s.SetProperty(t => t.MicrocicloId, (string?)null))` (EF Core 9 bulk update) — or, if `ExecuteUpdateAsync` proves awkward with the nested `Contains`, first collect the flat list of `microcicloId`s into a `List<string>`, then `ExecuteUpdateAsync` against `_db.TaskTrainingBases.Where(t => microcicloIds.Contains(t.MicrocicloId))`.
- `GetSeasonPlan.cs`: `GET /api/season-plans?teamId=&seasonId=`, `IRequireFeaturePermission` with `RequiredPermission => "Read"`. Loads the full tree (`Include`/`ThenInclude`/`ThenInclude`, `AsSplitQuery`, `AsNoTracking`) plus a second query: `var exerciseCounts = await _db.TaskTrainingBases.Where(t => t.MicrocicloId != null).GroupBy(t => t.MicrocicloId).Select(g => new { MicrocicloId = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.MicrocicloId!, x => x.Count, ct)`, merged into each `MicrocicloDto.ExerciseCount` (default 0 if absent from the dictionary). Returns `Results.NoContent()` (204) if no plan exists for that team+season, matching `GetGameModel`'s not-found shape (read that file to confirm the exact 204-vs-404 convention before writing this).

Validators: `AbstractValidator<T>` per command, `RuleFor(x => x.Name/WeekLabel/ObjetivoSesionA/ObjetivoSesionB).NotEmpty().MaximumLength(...)` (200 for names/labels, 2000 for objective paragraphs — long enough for the source document's longest week objectives, several of which run 300+ characters), `RuleFor(x => x.EndDate).GreaterThanOrEqualTo(x => x.StartDate)`, `RuleForEach(...).SetValidator(...)` nested exactly like `CreateGameModelValidator`.

TDD: for each command/query, write the xUnit test file first under the mirrored test project location (find where `GameModel` command/query tests live — likely `Back/ExtractionApi/tests/.../Features/Coaches/GameModels/` — and create the equivalent `SeasonPlans` folder), covering at minimum: happy path, not-found, access-denied, and (for Create) duplicate-conflict / (for Update) child add+remove in one call.

## 5. Exercise linking (backend)

In `Features/Coaches/Trainings/Exercises/Commands/CreateExercise.cs` and `UpdateExercise.cs`: add `string? MicrocicloId` to the command record and set it on the entity. In `Queries/GetExercises.cs`: add optional `string? MicrocicloId` query param that, if present, filters `.Where(t => t.MicrocicloId == microcicloId)`; add `MicrocicloId` to the response DTO everywhere `Exercise`/`ExerciseDto` fields are projected (`GetExercises`, `GetExerciseById`). No FK-exists validation needed beyond the DB constraint itself (`SetNull` on delete means a stale id simply fails the FK at save time, which FluentValidation doesn't need to pre-check per existing convention — confirm by checking whether other optional FKs on `Exercise`, if any, are pre-validated; if none are, don't introduce a new precedent here).

## 6. Frontend types & service

**`Front/src/apps/coach/types/seasonPlan.ts`** — mirror `types/gameModel.ts`'s shape (`id`/`apiId` split for client-side temp keys):
```ts
export interface Microciclo {
  id: number; apiId?: string;
  order: number; weekLabel: string;
  startDate: string; endDate: string;
  objetivoSesionA: string; objetivoSesionB: string;
  exerciseCount: number;
}
export interface Mesociclo {
  id: number; apiId?: string;
  order: number; name: string;
  startDate: string; endDate: string;
  gameZoneId: number;
  microciclos: Microciclo[];
}
export interface Macrociclo {
  id: number; apiId?: string;
  order: number; name: string;
  startDate: string; endDate: string;
  mesociclos: Mesociclo[];
}
export interface SeasonPlan {
  id: string; teamId: string; seasonId: string;
  macrociclos: Macrociclo[];
}
```

**`Front/src/apps/coach/services/seasonPlanService.ts`** — mirror `gameModelService.ts`'s `Api*`-DTO/mapper/`nextKey()` pattern exactly (read that file fully before writing this one). Exports: `getByTeamIdAndSeason(teamId, seasonId): Promise<SeasonPlan | null>` (maps `204`→`null`), `create(teamId, seasonId, draft): Promise<SeasonPlan>` → `POST /api/season-plans`, `update(id, draft): Promise<SeasonPlan>` → `PUT /api/season-plans/{id}`, `remove(id): Promise<void>` → `DELETE /api/season-plans/{id}`.

**`types/training.ts`** — add `microcicloId?: string` to `Exercise`, `CreateExerciseRequest`, `UpdateExerciseRequest`. **`trainingService.ts`** — `getExercises(clubId, { methodology?, microcicloId? })` passes `microcicloId` as a query param if present; `createExercise`/`updateExercise` pass it through in the request body.

Verify: `npx tsc --noEmit` inside `Front/`.

## 7. Planificación tab

Write `pages/trainings/season-plan/__tests__/SeasonPlanView.test.tsx` first: mock `seasonPlanService.getByTeamIdAndSeason` to return `null` → assert "Crear planificación" CTA renders; mock it to return a small tree (1 macrociclo, 1 mesociclo, 2 microciclos, one with `exerciseCount: 0` one with `exerciseCount: 3`) → assert both a warning-styled chip for the 0-count week and a count chip ("3 ejercicios") for the other; assert clicking "Crear ejercicio" on a microciclo card calls `navigate` with that microciclo's id present in the URL/state.

`Trainings.tsx`: add `<Tab label="Planificación" />` after "Sesiones" (index 2); add `tab === 2` content block rendering `<SeasonPlanView teamId={...} seasonId={...} />`; extend the action-bar conditional (lines ~387-410 per prior exploration) with a third branch for tab 2 ("Nueva planificación" if `plan === null`, "Editar planificación" otherwise, opening `SeasonPlanEditor`).

`SeasonPlanView.tsx` — read-only tree render + coverage chips, "Crear ejercicio" button per Microciclo row navigating to `new-exercise?microcicloId={id}` (or via `NavState`, matching whichever `NewExercisePage.tsx` already prefers — it currently reads `clubId`/`teamId`/`exerciseId`/`duplicateFromId` from `URLSearchParams` and `returnTo` from `location.state`; add `microcicloId` to the **query string** for consistency with the other three id-like params, not to `NavState`).

`SeasonPlanEditor.tsx` — tree-editing form (add/remove/reorder at each of the 3 levels), `GameZoneId` selector fed by whatever query already backs `game-model`'s zone dropdown (`GetGameZones` — find its frontend caller in `gameModelService.ts`/`GameModelFormEditor.tsx` and reuse the same catalog-fetch call, don't duplicate it). On save, calls `seasonPlanService.create` or `.update` depending on whether a plan already existed, matching `GameModelFormEditor`'s create-vs-update branching.

Verify: `npm run test -- season-plan`, then `npm run build`.

## 8. Exercise creation from a Microciclo

`NewExercisePage.tsx`: read `microcicloId` from `URLSearchParams` alongside the existing four params; pass to `useExerciseForm`. `useExerciseForm.ts`: accept `microcicloId` in its params, seed `form.microcicloId` from it. Above the form fields, if `microcicloId` is present, fetch and display the Microciclo's `weekLabel` + parent Mesociclo's zone label read-only (small info banner, CSS Module, no new global style).

`ExerciseFormPanel.tsx`: add an optional Microciclo `<Select>` (MUI), populated by fetching the current team's `SeasonPlan` tree client-side and flattening it into `{ id, label }` options (`"{Mesociclo.name} — {Microciclo.weekLabel}"`); if `seasonPlanService.getByTeamIdAndSeason` returns `null`, hide the field entirely rather than showing an empty/disabled dropdown.

Verify: `npm run test` (full suite — watch specifically for regressions in existing `NewExercisePage`/`ExerciseFormPanel`/`useExerciseForm` tests, since this touches shared form state), `npm run build`.

## 9. End-to-end + final verification

Per `tasks.md` §9: run both dev servers, walk through the full flow manually, then run `dotnet test` (backend) and `npm run test && npm run build` (frontend) and confirm all green before reporting the change complete. Report explicitly whether the seed migration (step 3) actually ran against a matched team, or was skipped for lack of a confident match.
