# Implement — Backend (structured-team-rules)

Backend-only script (tasks.md §1-5). Front/Mobile out of scope, owned by other specialists.
Executed directly by back-specialist, TDD (Red → Green → Refactor), xUnit + Moq.

**Confirmed before writing this script**: queried the real dev/Supabase DB directly (via a
throwaway console app referencing Npgsql, run from the scratchpad — no `psql`/PowerShell-loadable
Npgsql available) with
`SELECT "Id","Name" FROM app."Teams" WHERE "RulesDocumentUrl" = 'team-rules-documents/597fd359-01e1-4b29-b6e7-c56efd9fbd48.pdf'`.
Exactly one row: `Id = db380999-9dc8-47d9-8bc5-f90145543ca5`, `Name = "CADETE D"`. This is the
literal team id used in the migration's data step (task 2.2/2.3) — no placeholder needed.

## 1. Domain (`Domain/Aggregates/UserClubs/`)

- New `TeamRulesSet.cs`: `BaseEntity`, `IAggregateRoot`.
  - Properties: `TeamId`, `Title`, `Subtitle`, `IntroNote` (all `string`, required/trimmed),
    `ClosingNote`, `ApplicationNote` (`string?`), `UpdatedAt` (`DateTime`, UTC — DTO's
    `UpdatedAt`, since `BaseEntity` has no audit fields), `Rules` (`List<TeamRule>`, `private set`
    backing, exposed as `List<TeamRule>` like `GameModel.Principles`).
  - `private TeamRulesSet() { }` (EF).
  - `public static TeamRulesSet Create(string teamId, string title, string subtitle, string
    introNote, string? closingNote, string? applicationNote)` — validates `teamId`/`title`/
    `subtitle`/`introNote` non-empty (`ArgumentException`, mirrors `GameModel`/`GamePrinciple`
    style), trims, sets `UpdatedAt = DateTime.UtcNow`, returns new instance.
  - `public void UpdateMetadata(string title, string subtitle, string introNote, string?
    closingNote, string? applicationNote)` — same validation, touches `UpdatedAt`.
  - `public void ReplaceRules(IEnumerable<TeamRuleInput> rules)` — `rules` is a simple input
    record/tuple `(string? Id, string ShortTitle, string? Highlight, string ViolationSummary,
    string ConsequenceSummary, string? LongDescription, List<string>? BulletPoints, string?
    ConsequenceDetail)` defined in this same file. Throws `ArgumentException` if the materialized
    list is empty. Clears `Rules` and rebuilds it from the input list **in input order**, deriving
    `Order` as `1..N` from position (never trusts a client-sent `Order` — design.md Decision 2).
    Touches `UpdatedAt`.
  - `TeamRule` is constructed only from inside `ReplaceRules` (internal constructor or a
    `private`/`internal` factory called by `TeamRulesSet`) — no public factory on `TeamRule`
    itself, matching `GameScenario`'s ownership by `GamePrinciple`.
- New `TeamRule.cs`: `BaseEntity` (plain child, not an aggregate root).
  - Properties: `TeamRulesSetId`, `Order` (`int`), `ShortTitle` (required), `Highlight` (`string?`),
    `ViolationSummary` (required), `ConsequenceSummary` (required), `LongDescription` (`string?`),
    `BulletPoints` (`List<string>?`), `ConsequenceDetail` (`string?`). Navigation `TeamRulesSet`.
  - `private TeamRule() { }` (EF) + `internal TeamRule(string teamRulesSetId, int order, string
    shortTitle, string? highlight, string violationSummary, string consequenceSummary, string?
    longDescription, List<string>? bulletPoints, string? consequenceDetail)` — called only by
    `TeamRulesSet.ReplaceRules`.
- `Team.cs`: remove `public string? RulesDocumentUrl { get; set; }` and `UpdateRulesDocumentUrl`.
  Add `public TeamRulesSet? RulesSet { get; private set; }` (nullable 1:1 nav, no inverse setter
  needed — set via EF fixup / not mutated directly by `Team`).
- `dotnet build` after this step is expected to fail in the two old feature files — fixed in §3.

### Tests first (Red)

New `tests/RFFM.Api.Tests/UnitTests/TeamRulesSetTests.cs` (plain unit tests, no DB — mirrors
`GamePrincipleTests.cs`):
- `Create_WithValidData_SetsProperties`
- `Create_WithEmptyTitle_Throws` (`[Theory]` `""`, `"  "`, `null`) — same for `Subtitle`/`IntroNote`
- `Create_SetsUpdatedAtToUtcNow` (assert within a small delta of `DateTime.UtcNow`)
- `UpdateMetadata_WithValidData_UpdatesFieldsAndTouchesUpdatedAt`
- `UpdateMetadata_WithEmptyTitle_Throws`
- `ReplaceRules_WithOrderedInput_RebuildsContiguousOrderStartingAt1` (pass 3 inputs with no
  `Order` field at all — the input record intentionally has no `Order`; assert resulting
  `Rules[i].Order == i + 1` in input order)
- `ReplaceRules_ClearsPreviousRules` (call twice, assert old rule instances are gone from `Rules`)
- `ReplaceRules_WithEmptyList_Throws` (`ArgumentException`)
- `ReplaceRules_MapsAllFieldsIncludingBulletPointsAndNullableFields`

Write these first, confirm they fail to compile/run (no `TeamRulesSet` yet), then implement §1 to
turn them green.

## 2. EF configuration and migration

- New `Infrastructure/Persistence/Configuration/Aggregates/UserClubs/TeamRulesSetConfiguration.cs`
  (mirrors `GamePrincipleConfiguration.cs`): table `TeamRulesSets`, schema via the context default
  (`app`), `Id` maxlength 36, `TeamId` maxlength 36 + **unique index** (1:1), `Title` maxlength
  300, `Subtitle` maxlength 300, `IntroNote`/`ClosingNote`/`ApplicationNote` maxlength 2000
  (nullable for the latter two), `UpdatedAt` required, `HasOne(x => x.RulesSet)` on `Team`
  (inverse) with `HasForeignKey<TeamRulesSet>(x => x.TeamId)` + `IsRequired(false)` +
  `OnDelete(DeleteBehavior.Cascade)` (deleting a `Team` cascades its rules set — confirm this
  doesn't conflict with existing `Team` FK conventions; if `Team` deletion is already
  restrict-only elsewhere, mirror that instead), `HasMany(x => x.Rules).WithOne(r =>
  r.TeamRulesSet).HasForeignKey(r => r.TeamRulesSetId).OnDelete(DeleteBehavior.Cascade)`.
- New `TeamRuleConfiguration.cs`: table `TeamRules`, `Id` maxlength 36, `TeamRulesSetId` maxlength
  36, `Order` required, `ShortTitle` maxlength 300, `Highlight` maxlength 300 nullable,
  `ViolationSummary`/`ConsequenceSummary` maxlength 1000, `LongDescription` maxlength 4000
  nullable, `ConsequenceDetail` maxlength 1000 nullable. `BulletPoints` (`List<string>?`) mapped
  via `HasConversion` to/from `System.Text.Json.JsonSerializer.Serialize`/`Deserialize`,
  `.HasColumnType("jsonb")`, and `.Metadata.SetValueComparer(...)` with a proper
  `ValueComparer<List<string>>` (element-wise equality + `.ToList()` snapshot) — the repo's
  closest real precedent (`MatchParticipation.CardsJson`) stores pre-serialized JSON as a plain
  `text` column on the domain entity instead of converting a typed list at the EF layer; this
  slice deliberately follows design.md's Decision 1 (`List<string>` + `HasConversion`/
  `SetValueComparer`) since it is a cleaner fit for a `List<string>?` domain property — call this
  out explicitly as the one place this implementation is more precise than the nearest existing
  example, not a deviation from `design.md`.
- Add `DbSet<TeamRulesSet> TeamRulesSets` and `DbSet<TeamRule> TeamRules` to `AppDbContext.cs`
  next to the other Team-adjacent sets.
- **Task 2.2 already done above** (see the confirmation note at the top) — team id
  `db380999-9dc8-47d9-8bc5-f90145543ca5`.
- Generate the migration: from `Back/ExtractionApi`,
  `.\manage-migrations.ps1 -Action create -MigrationName AddTeamRulesStructuredData` (Context
  defaults to `AppDbContext`, ConnectionStringKey defaults to `FutbolBaseConnection` — this
  project has a single `FutbolBaseConnection`, not three separate identity/app/federation
  connection strings; ignore any generic three-DbContext guidance that doesn't match this repo).
- Hand-edit the generated migration's `Up()` to insert a `migrationBuilder.Sql(...)` data step
  **between** `CreateTable` and the final structure, following the exact style of
  `20260804103613_RestructureGameModelPrinciples.cs`'s data step:
  - One `INSERT INTO app."TeamRulesSets" (...)` with `gen_random_uuid()::text`, `TeamId =
    'db380999-9dc8-47d9-8bc5-f90145543ca5'`, and the metadata from `design.md` Appendix A
    (`Title`, `Subtitle`, `IntroNote`, `ClosingNote`, `ApplicationNote`), `UpdatedAt = now() at
    time zone 'utc'`. Guard with `WHERE EXISTS (SELECT 1 FROM app."Teams" WHERE "Id" =
    'db380999-9dc8-47d9-8bc5-f90145543ca5')` so it's a safe no-op if that team doesn't exist in
    whatever DB the migration runs against (CI, a fresh local DB, etc.) — use a `WITH` CTE or a
    single `INSERT ... SELECT ... WHERE EXISTS (...)` rather than a bare `INSERT ... VALUES`.
  - Ten `INSERT INTO app."TeamRules" (...)` rows (Order 1-10, all fields per Appendix A,
    `BulletPoints` as a `jsonb` array literal via `'[...]'::jsonb` or `NULL`), each referencing the
    `TeamRulesSets` row via a `SELECT "Id" FROM app."TeamRulesSets" WHERE "TeamId" =
    'db380999-9dc8-47d9-8bc5-f90145543ca5'` subquery (keeps the whole data step working even
    though the `TeamRulesSets.Id` isn't known ahead of time in this static SQL file) — again
    guarded so it's a no-op if the parent row wasn't inserted.
  - Then `migrationBuilder.DropColumn(name: "RulesDocumentUrl", schema: "app", table: "Teams")`
    (drop this **after** the data step — it's unrelated data, ordering doesn't matter functionally
    but keep it last for readability, matching the "create → seed → drop" order in design.md
    Decision 4).
  - `Down()`: drop `TeamRules`/`TeamRulesSets` tables (EF-generated), re-add the nullable
    `RulesDocumentUrl` column (data not restored — same accepted trade-off as the game-model
    migration's `Down()`).
- Apply the migration: `.\manage-migrations.ps1 -Action apply` (or `dotnet ef database update`
  from the Infrastructure project) against the real dev DB (the only DB this repo has —
  `FutbolBaseConnection`, Supabase-hosted). Verify with a scratch query afterward that team
  `db380999-9dc8-47d9-8bc5-f90145543ca5` now has one `TeamRulesSets` row and ten ordered
  `TeamRules` rows, and that `app."Teams"."RulesDocumentUrl"` no longer exists.
- `dotnet build` passes.

## 3. Mobile namespace: shared command/query (`Features/Mobile/Teams/`)

- Delete `Commands/UploadTeamRulesDocument.cs`, `Queries/GetTeamRulesDocument.cs`, and their three
  old test files (`GetTeamRulesDocumentHandlerTests.cs`, `UploadTeamRulesDocumentHandlerTests.cs`,
  `UploadTeamRulesDocumentValidatorTests.cs`) under `tests/RFFM.Api.Tests/UnitTests/`.
- New `Queries/GetTeamRules.cs`:
  - `MapGet("api/mobile/teams/{teamId}/rules", ...)`. `200` with `TeamRulesDto` when present,
    `204` (`Results.NoContent()`) when the query returns `null`, `404` bubbles from
    `NotFoundException` via the existing global exception→`ProblemDetails` mapping (same as the
    old `GetTeamRulesDocument`).
  - `GetTeamRulesQuery : IQueryApp<TeamRulesDto?>, IRequireTeamMembership { string TeamId }` — no
    `IRequireFeaturePermission` (every team member reads, per design.md Decision 2).
  - `TeamRulesDto` (record, in this same file since it's the shared read model both namespaces'
    handlers/DTOs reuse): `TeamId`, `Title`, `Subtitle`, `IntroNote`, `ClosingNote`,
    `ApplicationNote`, `Rules: List<TeamRuleDto>`, `UpdatedAt`. `TeamRuleDto`: `Id`, `Order`,
    `ShortTitle`, `Highlight`, `ViolationSummary`, `ConsequenceSummary`, `LongDescription`,
    `BulletPoints`, `ConsequenceDetail`.
  - Handler: loads `Team` by `TeamId` with `.Include(t => t.RulesSet).ThenInclude(rs =>
    rs.Rules)`, throws `NotFoundException("Equipo no encontrado", "TeamNotFound")` if the team
    itself doesn't exist (mirrors the old handler exactly), returns `null` if `team.RulesSet` is
    null, otherwise maps to `TeamRulesDto` with `Rules` ordered by `Order`.
- New `Commands/SaveTeamRules.cs`:
  - `MapPut("api/mobile/teams/{teamId}/rules", ...)`, `200` with the resulting `TeamRulesDto`.
  - `SaveTeamRulesCommand : IRequest<TeamRulesDto>, IRequireFeaturePermission,
    IRequireTeamMembership` — `TeamId` (route-bound), `Title`, `Subtitle`, `IntroNote`,
    `ClosingNote`, `ApplicationNote`, `Rules: List<SaveTeamRuleRequest>` (body). `SaveTeamRuleRequest`:
    `Id` (`string?` — present when editing an existing rule, `null`/empty for a new one; **not**
    used for ordering, only informational since `ReplaceRules` rebuilds from scratch each time —
    keep it simple and not attempt partial-identity preservation the way `UpdateGameModel` does
    for its deeper tree, since `TeamRule` has no dependents referencing its id, unlike
    `SubSubPrinciple`/`EssentialSkill`), `ShortTitle`, `Highlight`, `ViolationSummary`,
    `ConsequenceSummary`, `LongDescription`, `BulletPoints`, `ConsequenceDetail`.
    `FeatureRoute => CoachFeatureRoutes.TeamRulesDocument` (constant kept as-is per design.md
    Decision 3), `RequiredPermission => "ReadWrite"`.
  - Handler: loads `Team` with `.Include(t => t.RulesSet).ThenInclude(rs => rs.Rules)`, 404 if team
    missing. If `team.RulesSet` is null, creates one via `TeamRulesSet.Create(...)` and assigns it
    (`team` has no public setter for `RulesSet` — either add an internal
    `AttachRulesSet(TeamRulesSet)` method on `Team`, or add the new `TeamRulesSet` directly to
    `db.TeamRulesSets` with its `TeamId` set and let EF's FK/nav resolve it; prefer the explicit
    `db.TeamRulesSets.Add(...)` + reload approach if `Team` shouldn't gain a new intention method
    just for this). Otherwise calls `existing.UpdateMetadata(...)` then
    `existing.ReplaceRules(...)` (mapping each `SaveTeamRuleRequest` to the `TeamRuleInput` from
    §1). `await db.SaveChangesAsync(cancellationToken)`. Returns the mapped `TeamRulesDto`.
  - `SaveTeamRulesValidator : AbstractValidator<SaveTeamRulesCommand>`: `Title`/`Subtitle`/
    `IntroNote` `NotEmpty().MaximumLength(...)` (300/300/2000, matching the EF config sizes),
    `Rules` `NotEmpty()`, `RuleForEach(x => x.Rules)` with a child validator enforcing
    `ShortTitle`/`ViolationSummary`/`ConsequenceSummary` `NotEmpty()` + max lengths matching §2's
    column sizes.
- New `Commands/DeleteTeamRules.cs`:
  - `MapDelete("api/mobile/teams/{teamId}/rules", ...)`, always `204`.
  - `DeleteTeamRulesCommand : IRequest, IRequireFeaturePermission, IRequireTeamMembership` — same
    `FeatureRoute`/`RequiredPermission` as `SaveTeamRulesCommand`.
  - Handler: loads `Team` with `.Include(t => t.RulesSet)`, 404 if team missing, if `RulesSet` is
    present removes it (`db.TeamRulesSets.Remove(...)`, cascade deletes `TeamRule`s via the FK
    configured in §2) and saves; no-op (still returns `Unit.Value`) if `RulesSet` is already null.

### Tests first (Red), per task file, all under `PostgresCollection`/`PostgresContainerFixture`
mirroring `GetTeamRulesDocumentHandlerTests.cs`'s seeding style (`Club.Create` → `Season.Create` →
`new Team(...)`):

- `GetTeamRulesHandlerTests.cs`: returns ordered `TeamRulesDto` when a `RulesSet` with rules
  exists; returns `null` when the team has no `RulesSet`; throws `NotFoundException` when the team
  doesn't exist.
- `SaveTeamRulesHandlerTests.cs`: creates a new `RulesSet` + rules when none exists; replaces
  metadata and fully rebuilds the rule list (add/remove/reorder) when one exists; re-derives
  contiguous `Order` from array position even if the request sends gaps/out-of-order values;
  throws `NotFoundException` when the team doesn't exist.
- `SaveTeamRulesValidatorTests.cs`: empty `Title`/`Subtitle`/`IntroNote` rejected; empty `Rules`
  rejected; a rule missing `ShortTitle`/`ViolationSummary`/`ConsequenceSummary` rejected; a fully
  valid command passes.
- `DeleteTeamRulesHandlerTests.cs`: removes an existing `RulesSet` (and confirms its `TeamRule`s
  are gone via a follow-up query); no-op when none exists; throws `NotFoundException` when the
  team doesn't exist.

Feature-permission/team-membership enforcement itself is not re-tested per-feature (covered
generically by `FeaturePermissionBehaviorTests.cs`), consistent with the old feature's test scope.

Run the full `Features/Mobile/` related test set green before moving to §4.

## 4. Coach namespace (`Features/Coaches/Teams/`)

- New `Commands/TeamRulesCoachEndpoints.cs` (one file covering all three coach-namespace routes —
  "one feature = one file" fits better here than three near-empty files, since there is zero
  business logic to split, only route registration): a single `IFeatureModule` implementation
  (name the class `TeamRulesForCoaches` or similar) whose `AddRoutes` registers:
  - `MapGet("api/coaches/teams/{teamId}/rules", ...)` → builds a
    `GetTeamRulesQuery { TeamId = teamId }` (from `RFFM.Api.Features.Mobile.Teams.Queries`) and
    sends it through the same `IMediator`, same 200/204 mapping as §3.
  - `MapPut("api/coaches/teams/{teamId}/rules", ...)` → binds the same request body shape (reuse
    `SaveTeamRulesCommand` directly as the minimal API parameter type, setting `TeamId` from the
    route, exactly like `UpdateGameModel`'s `command with { Id = id, ... }` pattern), sends it,
    returns `Results.Ok(dto)`.
  - `MapDelete("api/coaches/teams/{teamId}/rules", ...)` → `DeleteTeamRulesCommand { TeamId =
    teamId }`, `Results.NoContent()`.
  - All three tagged `"Coaches"` (or the existing `TeamConstants.TeamFeature` tag, matching
    sibling Coach team endpoints), `RequireAuthorization()`.
  - **No new Mediator request types, no new handlers** — this file only maps routes to the
    existing Mobile-namespace commands/query, per design.md Decision 2.

### Tests first (Red)

- `TeamRulesCoachEndpointsTests.cs` (or integrate into a lightweight route-registration test if
  the project has a pattern for asserting `IFeatureModule` route registration without a full
  `WebApplicationFactory` — check `tests/RFFM.Api.Tests/` for an existing example of testing route
  wiring; if none exists, a minimal `WebApplicationFactory`-based test hitting
  `api/coaches/teams/{teamId}/rules` GET/PUT/DELETE and asserting the response shape matches what
  `GetTeamRulesHandlerTests`/`SaveTeamRulesHandlerTests` already prove for the underlying handler
  is acceptable — do not duplicate the handler's business-logic test cases here, only prove the
  route delegates correctly).

Run `Features/Coaches/Teams/` tests green.

## 5. Cleanup and full verification

- Repo-wide search (backend only) for `RulesDocumentUrl`, `UploadTeamRulesDocument`,
  `GetTeamRulesDocument`, `team-rules-documents` — confirm zero remaining references outside the
  migration history (old migrations must NOT be edited) and this change's new files.
- `dotnet build` — must pass, zero warnings introduced.
- `dotnet test` — full suite green, no skipped tests.
- Mark `tasks.md` §1-5 checkboxes `[x]`. Leave §6-11 for Front/Mobile specialists.

## Report back

- Final endpoint routes (Mobile + Coach namespaces).
- `TeamRulesDto`/`SaveTeamRulesCommand` (request) field names — the exact contract Front/Mobile
  specialists implement against.
- Migration data-step status: applied against the real dev DB with the confirmed team id
  `db380999-9dc8-47d9-8bc5-f90145543ca5`, not a placeholder.
- Any deviation from `design.md` (e.g., the `BulletPoints` JSON-conversion precedent note in §2).
