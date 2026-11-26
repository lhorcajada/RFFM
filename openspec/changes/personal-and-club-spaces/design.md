## Target State

After the last step, every club has a space type, club-scoped data is filtered in `AppDbContext` by the clubs the authenticated user belongs to (club membership rows plus team links), and club listings hide Personal spaces from non-members.

Finished shape of the central artifacts:

```csharp
// Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/SpaceType.cs
public sealed class SpaceType : SmartEnum<SpaceType>
{
    public static readonly SpaceType PersonalSpace = new(nameof(PersonalSpace), 1, "Espacio personal");
    public static readonly SpaceType Club          = new(nameof(Club), 2, "Club");
    public string Label { get; }
}

// Club.cs: new property, default PersonalSpace
public SpaceType SpaceType { get; private set; } = SpaceType.PersonalSpace;
public static Club Create(/* existing args */, SpaceType? spaceType = null);

// AppDbContext.cs: second constructor + one filter per entity (Team, Player,
// TaskTrainingBase, Season, UserActivityLog)
public AppDbContext(DbContextOptions<AppDbContext> options);                        // no user: filter off
public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUserService u); // DI: filter on for authenticated users
// filter: !ClubFilterActive || e.ClubId == null
//      || UserClubs.Any(uc => uc.ApplicationUserId == CurrentUserId && uc.ClubId == e.ClubId)
//      || UserTeams.Any(ut => ut.ApplicationUserId == CurrentUserId && ut.Team.ClubId == e.ClubId)
```

```sql
-- migration AddSpaceTypeToClub
ALTER TABLE app."Clubs" ADD "SpaceType" integer NOT NULL DEFAULT 1;  -- every existing club = Personal space
```

Club listing contract: `GetClubs` returns a club only when it is a `Club`-type space or the caller is a member of it, and each item carries `spaceTypeLabel` ("Espacio personal" or "Club").

### Architecture Snapshot

#### External Surfaces

- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Queries/GetClubs.cs` - `ClubsResponse` gains `spaceTypeLabel` (additive field); the list no longer contains Personal spaces of other users. Flow: request -> membership ids of caller -> `ClubVisibility.VisibleTo` -> response.
- PostgreSQL schema `app."Clubs"` - new `SpaceType` int column, NOT NULL, default 1 (migration `AddSpaceTypeToClub`).
- Every existing endpoint that reads or modifies Team, Player, TaskTrainingBase, Season, or UserActivityLog - behavior contract: a record of a club the caller does not belong to (no club membership row and no team link in that club) is not found (404 ProblemDetails through each handler's existing not-found branch). Players and family members, who hold only team links, keep access to the club of their team.

#### Internal Public Surfaces

- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/SpaceType.cs` - new SmartEnum (`PersonalSpace`, `Club`, `Label`).
- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Club.cs` - `SpaceType` property; `Club.Create(..., SpaceType? spaceType = null)`.
- `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs` - second constructor taking `ICurrentUserService`; `ClubFilterActive`, `CurrentUserId`; five `HasQueryFilter` registrations.
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/ClubVisibility.cs` - new extension `IQueryable<Club> VisibleTo(this IQueryable<Club> clubs, AppDbContext db, string? userId)`, sibling of `ClubInvitationCodeVisibility`.
- `Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/PostgresContainerFixture.cs` - `CreateDbContext(string? userId)` overload for leak tests.

### File Manifest

- M Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Club.cs (Step 1)
- A Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/SpaceType.cs (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Features/Audit/SearchAuditLog.cs (Step 5)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Commands/ApproveClubJoinRequest.cs (Step 4)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Commands/RejectClubJoinRequest.cs (Step 4)
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/ClubVisibility.cs (Step 2)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Queries/GetClubs.cs (Step 2)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/Commands/EnterClubTeamAsCoach.cs (Step 4)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/Commands/ValidateTeamJoinCode.cs (Step 4)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/TeamInvitationValidation.cs (Step 4)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/UpdateTeamPlayer.cs (Step 4)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/ValidateTeamCode.cs (Step 4)
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddSpaceTypeToClub.Designer.cs — generated count=1 (Step 1)
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddSpaceTypeToClub.cs — generated count=1 (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/AppDbContextModelSnapshot.cs (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs (Step 3, Step 4, Step 5, Step 6)
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/UserClubs/ClubEntityConfiguration.cs (Step 1)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/FixedCurrentUserService.cs (Step 3)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/PostgresContainerFixture.cs (Step 3)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationEndpointTests.cs (Step 7)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationSeasonActivityLogTests.cs (Step 5)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationTaskTrainingTests.cs (Step 6)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationTeamPlayerTests.cs (Step 4)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterCoverageTests.cs (Step 7)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterNoUserFlowsTests.cs (Step 3)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterProbeTests.cs (Step 3)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterTeamJoinFlowsTests.cs (Step 3)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterWiringTests.cs (Step 3)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubSpaceTypePersistenceTests.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/DeleteAuditLogEntriesEndpointTests.cs (Step 5)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/FamilyMemberEndpointTests.cs (Step 4)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamInjuriesEndpointTests.cs (Step 4)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamSanctionsEndpointTests.cs (Step 4)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/InjuryEndpointAuthorizationTests.cs (Step 4)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/LotteryEndpointTests.cs (Step 4)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RatingOwnershipFilterTests.cs (Step 4)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/SetPlayerSanctionTeamFundTests.cs (Step 4)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/UpdateTeamPlayerSelfEditTests.cs (Step 4)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetClubsHandlerTests.cs (Step 2)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SpaceTypeTests.cs (Step 1)

## Context

- The backend has no `HasQueryFilter` today. `AppDbContext` has one constructor, taking `DbContextOptions<AppDbContext>` (`AppDbContext.cs:192`), and is registered with `AddDbContext` (scoped, not pooled, no factory) at `ServiceCollectionExtensions.cs:121`. `ICurrentUserService` is scoped (`ServiceCollectionExtensions.cs:62`) and exposes `UserId`, `Role`, `Roles`, `IsAuthenticated`; it reads the user from `IHttpContextAccessor` and returns no user in hosted services.
- Isolation relies on per-handler checks (`ScopeAuthorizationService.EnsureMemberAsync`, `EnsureCreatorAsync`, both over `UserClubs`). A missed check leaks data between clubs.
- `Club` has no type field and no declared index (`ClubEntityConfiguration.cs` maps only relationships and the table name); `CreateClub` has no name-uniqueness check, so a Personal space can already share a club name. `BaseEntity.Id` is a string GUID.
- `GetClubs` lists every club (`GetClubs.cs:63-65`). `ClubInvitationValidation` finds a club by invitation code over all clubs without a user (`:40-43`).
- Five persisted entities carry `ClubId`: Team, Player, TaskTrainingBase (all `string`), Season and UserActivityLog (`string?`). `PlayerModelBase` is not one of them: it is an unmapped input model (no `DbSet`, no configuration, no snapshot entry; `AppDbContext.ApplyAllEntityConfigurations` applies only configurations of `DbSet` types) consumed by `Player.Create`, and `Player` holds the persisted `ClubId`. The model snapshot lists `Seasons.ClubId` as required while `Season.cs` declares it `string?`.
- Membership has two shapes. Coach, ClubMember and Directive users get a `UserClubs` row (`CreateClub.cs:111-113`, `ValidateInvitationCode.cs:158-161`, `ClubJoinRequestApprovalService.cs:56-62`, `CreateUser.cs:243`). Player and FamilyPlayer users joining by a team code get only a `UserTeams` row (`ValidateTeamJoinCode.cs:160-163`, `CreateUser.cs:247-249`, `ApproveFamilyMemberAccount.cs:129-131`), and `UserTeam` has no `ClubId` (it reaches the club through `Team.ClubId`). Mobile handlers such as `GetTeamCalendar`, `GetTeamRules` and `GetPlayerSeasonCards` read `Teams` and `Players` for those users, gated by permission and team-membership behaviors (`TeamMembershipBehavior.cs:28-40`) and not by `UserClubs`.
- SmartEnum precedent: `NewsStatus` (int-backed, `IsRequired`, no per-property converter, picked up by `ConfigureSmartEnum` at `AppDbContext.cs:203`).
- Callers that build the context by hand: `PostgresContainerFixture` (`:64`, `:119`), `CreateUserTransactionRollbackTests` (`:94`), `AppDbContextDesignTimeFactory` (`:17`).
- Callers that legitimately read club-scoped data without being a member: `SearchAuditLog` (Federation and Administrator read `UserActivityLogs` unfiltered, `:107-111`), `UpdateTeamPlayer` (administrator bypass, `:38-40`), `LeagueSquadStatsScheduler` (hosted job reading `Teams` at `:79-84`, no user), `ClubKitsSeeder` (startup scope reading `Teams`, no user), and the invitation join flow (`ClubInvitationValidation`, `CreateUser`, `ValidateTeamJoinCode`, `EnterClubTeamAsCoach`, `TeamInvitationValidation`, `ValidateTeamCode`, join-request approve and reject). `DeleteAuditLogEntries` only runs `ExecuteDelete` on `UserActivityLogs` and `AuditLogger` only adds rows, so filters do not change them. `GetCoachSquadComparison` reads `Teams` scoped to the caller's own clubs and teams. `GetTeamRules` has no `RequireAuthorization`, so anonymous callers have no user and run with the filter off.

## Goals / Non-Goals

**Goals**

- Give every club a space type (default Personal space) and migrate existing clubs to it without touching ownership, membership or data.
- Filter the five club-scoped entities by `ClubId` in the data layer, using the user's club membership rows and team links, so another club's data is not found.
- Hide Personal spaces from non-members in club listings and searches; allow a Personal space to share a club name.
- Prove isolation with real-database leak tests, one read and one modify test per filtered entity.

**Non-Goals**

- Payment gateway integration, club creation by a directive, plan limits, seat charges, team copy (later slices, from the proposal).
- Ownership transfer or claim of a Personal space; physical isolation (stays logical, one database).
- Any frontend change; the labels "Espacio personal" and "Club" travel only in the API field `spaceTypeLabel`.
- Out of scope: hiding a Personal space from direct lookup by id (`GetClub`, public `GetClubEmblem`) - revisit when a requirement asks for non-member detail or emblem privacy.
- Out of scope: a flow that creates a club of type `Club` - revisit when club creation by a directive is specified; until then `CreateClub` always yields a Personal space.
- Out of scope: an index on `UserClubs(ApplicationUserId, ClubId)` and on `UserTeams(ApplicationUserId, TeamId)` - revisit if query plans show the membership subqueries as a hotspot.
- Out of scope: closing the anonymous `GetTeamRules` read - revisit when a requirement asks for authentication on mobile team rules; the filter applies to authenticated users only, as the specs state.

## Decisions

### D1. Space type is an int-backed SmartEnum on `Club`, defaulting to Personal space

`SpaceType : SmartEnum<SpaceType>` with `PersonalSpace = 1` and `Club = 2`, stored as a NOT NULL integer with `HasDefaultValue(SpaceType.PersonalSpace)`, so the migration backfills every existing row with 1. `Club.Create` takes an optional type that defaults to Personal space. The `Label` property holds the Spanish label so the internal value is never shown.

- **Provenance**: codebase-forced
- Alternatives: a plain `bool IsPersonal` (rejected: the project models typed values as SmartEnum and the spec names two labelled types); string column (rejected: `NewsStatus` precedent is int).

### D2. A global query filter on the five entities, driven by membership subqueries

`AppDbContext` registers one `HasQueryFilter` per entity (Team, Player, TaskTrainingBase, Season, UserActivityLog) with the predicate of D3. `ClubFilterActive` is true only when the context was built with an `ICurrentUserService` whose `IsAuthenticated` is true. The membership check is a correlated `EXISTS` evaluated in each query, not a list cached when the context starts, so a membership created during the request (join by invitation code, approval) applies at once. `UserClub`, `UserTeam` and `Club` are not filtered. A null `ClubId` is never hidden. `PlayerModelBase` is not filtered: it is not an entity.

- **Provenance**: user (data-layer filtering by the user's memberships, not a single active club, is stated in the specs)
- **Record family**: adr
- Alternatives considered: (a) membership id list loaded once per context - rejected: goes stale within a request and needs a query before every first use; (b) PostgreSQL row-level security - rejected: needs per-connection session variables and a different migration story, out of the stack's current patterns; (c) keep per-handler checks and add a lint - rejected: that is the failure mode the change removes. Rationale: one declaration per entity that cannot be skipped by a handler, correct after membership changes, translated to `EXISTS` subqueries by EF Core.

### D3. A user belongs to a club through a club membership row or a team link

The filter predicate is `!ClubFilterActive || e.ClubId == null || UserClubs.Any(uc => uc.ApplicationUserId == CurrentUserId && uc.ClubId == e.ClubId) || UserTeams.Any(ut => ut.ApplicationUserId == CurrentUserId && ut.Team.ClubId == e.ClubId)`. The second branch covers Player, FamilyPlayer and any other role that only has a `UserTeams` row, so they keep reading the club of their team. This matches the amended `club-data-isolation` spec ("a user linked to a team belongs to the club of that team").

- **Provenance**: user (the user approved the in-place spec amendment that adds team links)
- **Record family**: ddr
- Alternatives: club membership rows only (rejected: hides the whole mobile app from players and family members, who never get a `UserClubs` row); creating a `UserClubs` row for every team join (rejected: changes ownership and the creator quota semantics, and touches existing data); a per-role bypass in the filter (rejected: hides which roles are unscoped).

### D4. Two constructors, so the filter is opt-in by wiring

`AppDbContext(DbContextOptions<AppDbContext>)` stays and builds a context with the filter off. A second constructor adds `ICurrentUserService`; `AddDbContext` resolves the greediest constructor it can satisfy, so every request-scoped context gets the filter. Design-time factory, hosted jobs that build the context without a user, existing tests and the migration tooling keep working unchanged. Hosted services and startup seeders that resolve the scoped context from DI have no `HttpContext`, so `IsAuthenticated` is false and the filter is off.

- **Provenance**: codebase-forced (four direct `new AppDbContext(options)` call sites and the no-user flows of the specs leave no required-parameter option)
- Alternative: a single constructor with a required `ICurrentUserService` (rejected: breaks the design-time factory and the fixtures, and cannot express "no user").

### D5. Legitimate non-member reads opt out explicitly with `IgnoreQueryFilters()`

A call site that must read club-scoped data without a membership keeps working by calling `IgnoreQueryFilters()` on that query. The known sites are the audit-log search for Federation and Administrator, the administrator branch of `UpdateTeamPlayer`, and the join flows that read Team by its join code or id before the user is a member: `ValidateTeamCode`, `ValidateTeamJoinCode`, `EnterClubTeamAsCoach`, `TeamInvitationValidation`, `ApproveClubJoinRequest` and `RejectClubJoinRequest`. The join-flow opt-outs are conditional: guard tests written before the filter exists run each flow as an authenticated non-member, and only the handlers those tests show failing get `IgnoreQueryFilters()` on their single Team query. The list is closed by tests: the existing suite plus targeted tests for invitation-code join, join request, background work, and a Player with a team link reading its team through the mobile handlers. Each opt-out is a single query and carries a short comment naming the flow.

- **Provenance**: derived
- Alternatives: a role-based bypass inside the filter (rejected: hides which flows are unscoped and adds behavior the specs do not ask for); a context method that disables the filter for a scope (rejected: broader than one query).

### D6. Personal-space visibility is an explicit predicate on club listings, not a filter on `Club`

`ClubVisibility.VisibleTo` keeps a club when its type is `Club` or the caller has a `UserClubs` row for it. `GetClubs` applies it. `Club` stays unfiltered because the invitation-code lookup, join requests and public emblem route read clubs without membership. A club listing or search that exists elsewhere must apply the same extension.

- **Provenance**: derived
- Alternative: a global filter on `Club` (rejected: breaks `ClubInvitationValidation` and `CreateUser`, which the specs require to keep working).

### D7. The club list stays uncached

`GetClubs` results now depend on the caller. `ClubsQueryApp` implements `IQueryApp` without `ICacheRequest`, and the Caching behavior caches only messages that implement `ICacheRequest` (`CachingBehavior.cs:36-41`), so the list is not cached today. It must stay that way: no `ICacheRequest` is added to `ClubsQueryApp`. `GetClub` (cached by club id) is unchanged because the specs do not ask to hide a Personal space from direct lookup by id.

- **Provenance**: codebase-forced (the Caching behavior keys only on `ICacheRequest.CacheKey`, which carries no user id)

### D8. Leak tests run at the data layer against PostgreSQL, plus one handler-level not-found check

Per entity (Team, Player, TaskTrainingBase, Season, UserActivityLog), two tests in the `PostgresContainerFixture` collection: a context for user B (member of club B only) cannot read club A's record, and cannot modify it (a load-then-modify finds nothing; a bulk `ExecuteUpdate` changes zero rows; the record is unchanged when read back through an unfiltered context). A fixture overload builds the context with a fixed test `ICurrentUserService`. Extra tests cover a user with only a team link (reads the Team and Players of its club, not another club's) and a model-reflection test that fails for any entity with a `ClubId` property, other than the five, that has no query filter and is not on an explicit allow-list. One handler-level test through the existing test host confirms the 404 shape for a read and a modification.

- **Provenance**: user (real database, no mock, one test per entity, read and modify)

## Risks / Trade-offs

- [The team-link branch navigates `ut.Team` inside the filter of `Team` itself, and EF Core might not translate or might recurse on a filter that references its own entity type] (**Verify-first**: Step 4) → Mitigation: a probe test in Step 3 builds a test-only context that registers the filter on Team and Player through the shared helper and runs queries against PostgreSQL, so the translation is proven before Step 4 registers the filters in `AppDbContext`; if it fails, replace the navigation with a keyless entity `UserTeamClub` mapped with `ToSqlQuery` over `UserTeams` joined to `Teams` (no schema change) and use it in the predicate.
- [Handlers that load with `Find`/`FindAsync` may not apply the query filter] → Mitigation: a search found no EF `Find`/`FindAsync` on the filtered DbSets in `src/RFFM.Api`; the per-entity modify tests still go through the normal load path, and any path that leaks is changed to a filtered `FirstOrDefaultAsync` as part of that entity's step.
- [An authenticated administrator or federation user with no membership loses read access to club-scoped data] → Mitigation: D5 opt-outs on the known handlers, found by running the existing suite and by a repository search of `Teams`, `Players`, `Seasons`, `TaskTrainingBases` and `UserActivityLogs` consumers; Federation code reads these only in `LeagueSquadStatsScheduler` (hosted, filter off) and `GetCoachSquadComparison` (own clubs).
- [A flow reads Team or Player of a club before the user joins it] → Mitigation: targeted tests for invitation-code join, join request create, approve and reject; opt out only the failing query.
- [Mobile handlers for Player and FamilyPlayer users read Teams and Players with no `UserClubs` row] → Mitigation: D3 includes team links; a test runs a Player-role user through the mobile read path.
- [A user with a team link in a club sees the other teams of that club through the filter, because the filter works at club level] → Mitigation: accept: it is what the amended spec states; per-team scoping stays with the existing handler checks.
- [Dependents of a filtered entity (convocations, team players) disappear or raise EF's required-navigation warning when the principal is hidden] → Mitigation: accept the hiding (it is the intended isolation); review EF warnings from the test run and silence or fix only a real mismatch.
- [`Seasons.ClubId` is nullable in the entity and migration history but required in the snapshot and configuration] → Mitigation: the filter tolerates a null value either way; no schema change here; the Season leak test seeds a season with and without a club.
- [Someone later makes `GetClubs` cacheable and leaks a user's list to another user] → Mitigation: D7 records the constraint; a test lists clubs as two users in sequence through the same handler.
- [Existing integration tests that authenticate as a test user with no `UserClub` or `UserTeam` row stop finding their Teams, Players or UserActivityLogs] → Mitigation: each such test seeds a `UserClub` row for its test user in the same step that adds the filter (listed under that step's existing-tests field).
- [`CreateSeason` deactivates active Seasons of every club (`CreateSeason.cs:56-63`); under the filter it affects only the caller's clubs and club-less seasons] → Mitigation: accept: it removes a cross-club write, which is the isolation goal; a test pins the new behavior.
- [The membership `EXISTS` subqueries add cost to every filtered query] → Mitigation: acceptable at current volume; the indexes are a recorded non-goal.
- [A future club-scoped entity is added without a filter] → Mitigation: the reflection test of D8.

## Migration Plan

- One schema migration `AddSpaceTypeToClub`, generated from the infrastructure project with `manage-migrations.ps1` (in `Back/ExtractionApi`): `AddColumn<int> SpaceType` NOT NULL with `defaultValue: 1` on `Clubs`. Check the generated file carries the default so existing rows become Personal space.
- Deploy order: apply the migration first, then the new application version (the entity and the filter expect the column). The old application version keeps working against the new column because of the default.
- Rollback: the `Down` method drops the column; the filter and visibility changes are code-only and revert with the application version.
- The migration is committed separately from the application code.

## Open Questions

None - `GetClubs` is not cached (D7); the non-member readers found are the audit-log search for Federation and Administrator, the administrator branch of `UpdateTeamPlayer`, hosted jobs and startup seeders, and the anonymous or pre-membership join flows, all handled by D4 and D5; `PlayerService` and `CreateSeason` fetch a club only by known id and need no visibility predicate; players and family members are covered by the team-link branch of D3.

## Manual Verification

- **Generated-artifact drift**: after generating `AddSpaceTypeToClub`, confirm the migration and `AppDbContextModelSnapshot.cs` agree (no pending model changes when the migrations tool is run again) and the column has `defaultValue: 1`.
- **End-to-end smoke across real runtimes**: apply the migration to a development database that already holds clubs, then run `SELECT "SpaceType", count(*) FROM app."Clubs" GROUP BY 1` and confirm a single row with `SpaceType = 1` and the same count as before; sign in as a coach with one Personal space and call the club list to see only own spaces plus Club-type spaces; sign in as a player or family member of an existing team in the mobile app and confirm the team calendar and rules still load.
