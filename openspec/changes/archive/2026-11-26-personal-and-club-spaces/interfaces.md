## Step 1: Space type on Club with migration

**Interfaces**:
- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/SpaceType.cs`
  - `public sealed class SpaceType : SmartEnum<SpaceType>`
  - `public static readonly SpaceType PersonalSpace` (value 1, label "Espacio personal")
  - `public static readonly SpaceType Club` (value 2, label "Club")
  - `public string Label { get; }`
- `Club.cs`
  - `public SpaceType SpaceType { get; private set; }` (default `SpaceType.PersonalSpace`)
  - `public static Club Create(<existing parameters>, SpaceType? spaceType = null)` (a null `spaceType` yields `SpaceType.PersonalSpace`)
- `ClubEntityConfiguration`: `SpaceType` mapped required, `HasDefaultValue(SpaceType.PersonalSpace)`.
- Migration `AddSpaceTypeToClub`: `AddColumn<int>(name: "SpaceType", table: "Clubs", nullable: false, defaultValue: 1)`; `Down` drops the column.

**Test assertions**:
- Club created with no explicit type: `club.SpaceType == SpaceType.PersonalSpace` (`openspec/changes/personal-and-club-spaces/specs/space-types/spec.md`, Requirement "Every club has a space type", Scenario "New club without an explicit type").
- `SpaceType.PersonalSpace.Label == "Espacio personal"` and `SpaceType.Club.Label == "Club"`; no label equals "PersonalSpace" (`.../space-types/spec.md`, Scenario "Type shown to the user").
- Club created with `SpaceType.Club`: `club.SpaceType == SpaceType.Club` and it persists as 2 when read back.
- PostgreSQL: a row inserted into `Clubs` with raw SQL that omits `SpaceType` reads back as `SpaceType.PersonalSpace`; its `UserClubs` rows and its Teams are unchanged (`.../space-types/spec.md`, Requirement "Existing clubs become Personal spaces", Scenario "Migration of existing clubs").

## Step 2: Hide Personal spaces from non-members in the club list

**Interfaces**:
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/ClubVisibility.cs`
  - `public static class ClubVisibility`
  - `public static IQueryable<Club> VisibleTo(this IQueryable<Club> clubs, AppDbContext db, string? userId)` (keeps a club when `SpaceType == SpaceType.Club` or `db.UserClubs` has a row with `ApplicationUserId == userId` and `ClubId == club.Id`; a null `userId` keeps only `Club`-type spaces)
- `GetClubs.cs`: `ClubsResponse` gains `string SpaceTypeLabel` (additive, last field); `ClubsQueryApp` still implements only `IQueryApp<...>`, never `ICacheRequest`.

**Test assertions**:
- Personal space P owned by user A; user B (not a member) lists clubs: result does not contain P (`.../space-types/spec.md`, Scenario "Non-member lists clubs").
- User A lists clubs: result contains P with `SpaceTypeLabel == "Espacio personal"` (`.../space-types/spec.md`, Scenario "Member lists clubs").
- A `Club`-type space lists for any user with `SpaceTypeLabel == "Club"` (`.../space-types/spec.md`, Requirement "A Personal space is visible only to its members").
- A Personal space created with the same name as an existing club: creation succeeds and the existing club's row is unchanged (`.../space-types/spec.md`, Scenario "Same name as another club").
- User A then user B list clubs in sequence through the same handler instance: B's result never contains A's Personal space (`.../space-types/spec.md`, Scenario "Non-member lists clubs").
- Existing administrator and director invitation-code assertions hold when their clubs are `Club`-type or the user is a member.

## Step 3: Context wiring and shared filter helper, with probe and no-user guard tests

**Interfaces**:
- `AppDbContext.cs`
  - `public AppDbContext(DbContextOptions<AppDbContext> options)` (unchanged; filter off)
  - `public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUserService currentUser)`
  - `public string? CurrentUserId { get; }` (null when no user)
  - `public bool ClubFilterActive { get; }` (true only when constructed with a user service whose `IsAuthenticated` is true)
  - `protected void ApplyClubScopeFilter<TEntity>(ModelBuilder modelBuilder) where TEntity : class` (registers `HasQueryFilter` with `!ClubFilterActive || EF.Property<string?>(e, "ClubId") == null || UserClubs.Any(uc => uc.ApplicationUserId == CurrentUserId && uc.ClubId == EF.Property<string?>(e, "ClubId")) || UserTeams.Any(ut => ut.ApplicationUserId == CurrentUserId && ut.Team.ClubId == EF.Property<string?>(e, "ClubId"))`)
  - `OnModelCreating(ModelBuilder)` stays `protected override`, overridable by a derived test context; no filter is registered by `AppDbContext` in this step.
- `Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/FixedCurrentUserService.cs`: `public sealed class FixedCurrentUserService(string? userId) : ICurrentUserService` (`IsAuthenticated == (userId != null)`).
- `PostgresContainerFixture`: `public AppDbContext CreateDbContext(string? userId)` (additive overload; the existing parameterless method is unchanged).
- `ClubFilterProbeTests.cs`: nested test-only `class ClubFilterProbeDbContext : AppDbContext` whose `OnModelCreating` calls `ApplyClubScopeFilter<Team>` and `ApplyClubScopeFilter<Player>`.

**Test assertions**:
- `AddDbContext<AppDbContext>` resolved from a provider with a fake authenticated `ICurrentUserService("u1")`: `ClubFilterActive == true` and `CurrentUserId == "u1"`; with an unauthenticated fake: `ClubFilterActive == false` (`openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md`, Requirement "Flows without a membership keep working").
- Probe context on PostgreSQL with clubs A and B, each with a Team and a Player: a user with a `UserClub` row for A sees only A's Team and Player; a user with only a `UserTeam` row on A's Team sees A's Team and A's Player and none of B's; a user with neither sees none; a Team or Player row with a null `ClubId` is visible to all three; the queries translate and run without error (`.../club-data-isolation/spec.md`, Requirement "Club-scoped data is filtered by ClubId in the data layer", Scenario "Member through a team link", Requirement "Records without a ClubId are not hidden by the filter").
- Options-only context: `ClubFilterActive == false`; it reads Teams of two different clubs (`.../club-data-isolation/spec.md`, Scenario "Background work without an authenticated user").
- Authenticated non-member: finds the club by invitation code, inserts its `UserClub` row, and the insert succeeds (`.../club-data-isolation/spec.md`, Scenario "Join by invitation code").
- Authenticated non-member (context from `CreateDbContext("nonMember")`, no `UserClub` row for that club) runs `ValidateTeamCode`, `ValidateTeamJoinCode`, `EnterClubTeamAsCoach`, `TeamInvitationValidation`, and the join-request create, approve and reject flows with a valid team join code: each returns the same success outcome it returned before the change, and these tests stay green after Step 4 (`.../club-data-isolation/spec.md`, Requirement "Flows without a membership keep working", Scenario "Join by invitation code").

## Step 4: Filter Team and Player with leak tests

**Interfaces**:
- `AppDbContext.cs`: `OnModelCreating` calls `ApplyClubScopeFilter<Team>(modelBuilder)` and `ApplyClubScopeFilter<Player>(modelBuilder)`.
- `UpdateTeamPlayer.cs`: the administrator branch query calls `IgnoreQueryFilters()`; no signature change.
- `ValidateTeamCode.cs`, `ValidateTeamJoinCode.cs`, `EnterClubTeamAsCoach.cs`, `TeamInvitationValidation.cs`, `ApproveClubJoinRequest.cs`, `RejectClubJoinRequest.cs`: conditionally, the single query that reads `Team` before membership calls `IgnoreQueryFilters()`, only where the Step 3 guard tests fail; no signature change.

**Test assertions**:
- User of club B reads club A's Team through `CreateDbContext("userB")`: `FirstOrDefaultAsync` returns null; same for Player (`openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md`, Scenario "Read of another club's data", and Requirement "Isolation is proven by leak tests per filtered entity").
- User of club B loads club A's Team for modification: result is null; a bulk `ExecuteUpdateAsync` on club A's Team through B's context returns 0 and the row read back through an unfiltered context is unchanged; same for Player (`.../club-data-isolation/spec.md`, Scenario "Modification of another club's data").
- Member of clubs A and B lists Players: the result holds the Players of A and B and none of club C (`.../club-data-isolation/spec.md`, Scenario "Member of several clubs").
- Member of club A reads club A's Team: returned (`.../club-data-isolation/spec.md`, Scenario "Member reads data of their club").
- User with only a `UserTeam` row on a Team of club A (no `UserClub` row) reads A's Team and A's Players: returned; the Team and Players of club B: not returned (`.../club-data-isolation/spec.md`, Scenario "Member through a team link").
- Authenticated administrator on `UpdateTeamPlayer` for a team of a club they do not belong to: still succeeds as before the change.
- The adapted existing tests pass with a `UserClub` row (or a `UserTeam` row for Player-role principals) seeded for their test user.

**Added during implementation (onboarding by team code)**:
- `GetTeamPlayersForSelection`: `GET /api/catalog/team/{teamId}/players-for-selection?joinCode={code}`; `GetTeamPlayersQuery(string TeamId, string? JoinCode = null)`.
- `VerifyPlayerIdentity`: `VerifyPlayerRequest(string? Name, string? LastName, DateOnly? BirthDate, string? TeamPlayerId, string? JoinCode = null)`; `VerifyPlayerQuery(string TeamId, string? Name, string? LastName, DateOnly? BirthDate, string? TeamPlayerId, string? UserId, string? JoinCode = null)`. A successful verification with a valid code and an authenticated user adds a `UserTeam` row with the Player membership when the user has no link to that team.
- Front `teamService.getTeamPlayersForSelection(teamId, joinCode)` and `teamService.verifyPlayerIdentity(teamId, teamPlayerId, joinCode)`; `useTeamAppEntry` keeps the code validated by `validateTeamCode` and passes it to both calls.

**Test assertions (onboarding)**:
- Non-member with the join code of that team: player list returned; identity verification succeeds, a `UserTeam` row exists afterwards, and the user's context then reads that Team and its Players.
- Non-member without a code, with a wrong code, or with another team's code: both calls return not found; no `UserTeam` or `UserProfile` row is written.
- Member of the club without a code: both calls behave as before.

## Step 5: Filter Season and UserActivityLog with audit opt-outs

**Interfaces**:
- `AppDbContext.cs`: `OnModelCreating` calls `ApplyClubScopeFilter<Season>(modelBuilder)` and `ApplyClubScopeFilter<UserActivityLog>(modelBuilder)` (both `ClubId` are `string?`).
- `SearchAuditLog.cs`: the Federation and Administrator query on `UserActivityLogs` calls `IgnoreQueryFilters()`; no signature change.
- `DeleteAuditLogEntries.cs`: changed only if the bulk-delete test shows it no longer reaches other clubs' entries, then its `UserActivityLogs` delete query calls `IgnoreQueryFilters()`; no signature change.

**Test assertions**:
- User of club B cannot read or modify club A's Season or UserActivityLog entry; a bulk update changes 0 rows and the row is unchanged (`openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md`, Scenarios "Read of another club's data" and "Modification of another club's data").
- A Season with null `ClubId` and an audit entry with null `ClubId` are returned and modifiable for any authenticated user; a record of a club the user does not belong to is still not returned (`.../club-data-isolation/spec.md`, Requirement "Records without a ClubId are not hidden by the filter", Scenario "Record with a null ClubId").
- Federation or Administrator caller of the audit-log search sees entries of every club; the same callers delete entries of any club; a club director sees only entries of their own clubs (`.../club-data-isolation/spec.md`, Requirement "Flows without a membership keep working").
- `CreateSeason` by a coach of club A leaves active seasons of club B active and deactivates active seasons of club A (`.../club-data-isolation/spec.md`, Requirement "Club-scoped data is filtered by ClubId in the data layer").

## Step 6: Filter TaskTrainingBase

**Interfaces**:
- `AppDbContext.cs`: `OnModelCreating` calls `ApplyClubScopeFilter<TaskTrainingBase>(modelBuilder)`.

**Test assertions**:
- User of club B cannot read or modify club A's TaskTrainingBase; a bulk update changes 0 rows and the row read through an unfiltered context is unchanged (`openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md`, Requirement "Isolation is proven by leak tests per filtered entity", Scenario "Leak test per entity").
- A member of club A reads club A's TaskTrainingBase (`.../club-data-isolation/spec.md`, Scenario "Member reads data of their club").

## Step 7: Coverage guard and not-found response check

**Interfaces**:
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterCoverageTests.cs`: test class asserting over `AppDbContext.Model.GetEntityTypes()` that every entity type with a `ClubId` property has a query filter, except the allow-list `Club`, `UserClub` and the join-request entity types.
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationEndpointTests.cs`: HTTP-level tests through the test host.

**Test assertions**:
- Every entity type with `ClubId` outside the allow-list has a non-null query filter; Team, Player, TaskTrainingBase, Season and UserActivityLog are among them (`openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md`, Requirement "Club-scoped data is filtered by ClubId in the data layer", Scenario "Filtered entities").
- Authenticated user without membership requests a Team of another club: response status 404 with a ProblemDetails body (`.../club-data-isolation/spec.md`, Requirement "Another club's data returns not found", Scenario "Read of another club's data").
- The same user sends a modification of that Team: status 404 and the Team row is unchanged when read through an unfiltered context (`.../club-data-isolation/spec.md`, Scenario "Modification of another club's data").
- A Player-role principal with only a `UserTeam` row reads its own team through an existing mobile read handler: status 200 with the team data (`.../club-data-isolation/spec.md`, Scenario "Member through a team link").
- The tests run against a real PostgreSQL instance through `PostgresContainerFixture`, never a mock data layer (`.../club-data-isolation/spec.md`, Scenario "Leak tests use a real database").
