## Step 1: Space type on Club with migration

- [x] Step 1: Space type on Club with migration

**Routing**: category=data · context=medium · difficulty=medium

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/SpaceType.cs
- M Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Club.cs
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/UserClubs/ClubEntityConfiguration.cs
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddSpaceTypeToClub.cs — generated count=1
- A Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/2026*_AddSpaceTypeToClub.Designer.cs — generated count=1
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/AppDbContextModelSnapshot.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/SpaceTypeTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubSpaceTypePersistenceTests.cs

**What Will Be Done**: Model the type as an int-backed SmartEnum following `NewsStatus` and its `ConfigureSmartEnum` mapping, add the property to `Club` with `Create` taking an optional type that defaults to Personal space, and map it required with a default value in the club configuration. Generate the migration with `manage-migrations.ps1` and check the generated column is NOT NULL with `defaultValue: 1`. The migration is part of this step because a model change without its migration would leave the PostgreSQL-backed tests red. Requirements: `specs/space-types/spec.md` (every club has a type, existing clubs become Personal spaces).

**Testing Strategy**: Unit tests for the default type, the explicit type and the Spanish label. A PostgreSQL integration test inserts a club row without the column through raw SQL and reads back Personal space, then creates a club through the context and reads it back. Reviewed existing tests: callers of `Club.Create` keep compiling because the new parameter is optional; the PostgreSQL fixture applies migrations, so it picks up the column without change.

**Existing Tests Broken**: None

## Step 2: Hide Personal spaces from non-members in the club list

- [x] Step 2: Hide Personal spaces from non-members in the club list

**Routing**: category=backend · context=small · difficulty=low

**Files Affected**:
- A Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/ClubVisibility.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Queries/GetClubs.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetClubsHandlerTests.cs

**What Will Be Done**: Add a `VisibleTo` extension beside `ClubInvitationCodeVisibility`, reusing its membership query pattern over `UserClubs`, and apply it in the `GetClubs` handler; add the type label to `ClubsResponse` as an additive field. Leave `ClubsQueryApp` without `ICacheRequest` (design D7) and leave `ClubInvitationValidation`, `GetClub` and `GetClubEmblem` untouched. Requirements: `specs/space-types/spec.md` (visibility of a Personal space, same name as another club).

**Testing Strategy**: Extend `GetClubsHandlerTests` on the PostgreSQL collection: a non-member does not see a Personal space, a member does, a `Club`-type space is visible to everyone, and a Personal space may share a name with another club. A test lists clubs as two users in sequence through the same handler. Reviewed `ClubsSeasonTests` and `FeaturePermissionBehaviorTests`: they do not assert list contents and remain compatible.

**Existing Tests Broken**:
- `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetClubsHandlerTests.cs` — runtime: seeded clubs are now Personal spaces, so the administrator and director cases need membership rows or `Club`-type clubs to keep asserting invitation-code visibility

## Step 3: Context wiring and shared filter helper, with probe and no-user guard tests

- [x] Step 3: Context wiring and shared filter helper, with probe and no-user guard tests

**Routing**: category=backend · context=medium · difficulty=high

**Files Affected**:
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/PostgresContainerFixture.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/FixedCurrentUserService.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterWiringTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterProbeTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterNoUserFlowsTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterTeamJoinFlowsTests.cs

**What Will Be Done**: Keep the options-only constructor and add the second constructor taking `ICurrentUserService`; expose `CurrentUserId` and `ClubFilterActive` (true only for an authenticated user) as context members that filters will read at query time (design D2, D4). Make `OnModelCreating` overridable and add a protected generic helper that registers the shared membership filter of design D3 on an entity (club membership rows or team links, null `ClubId` never hidden, filter off without a user), reading `ClubId` through `EF.Property`. Register no filter in `AppDbContext` itself yet. Add a `CreateDbContext(string? userId)` overload to the fixture, built on a small fixed-user test double, so later steps can query as a given user. The probe test defines a test-only context deriving from `AppDbContext` that applies the helper to Team and Player and runs queries on PostgreSQL; it resolves the design's verify-first risk (a filter on Team that navigates `UserTeam.Team`) before Step 4 registers the real filters, and if translation fails the fallback keyless entity of the design risk is introduced here. Add guard tests now so they protect the flows through the next steps: a context with no user reads club-scoped rows across clubs, an authenticated non-member reads a club by invitation code and inserts its `UserClub` row, and an `AddDbContext` provider resolves the user-aware constructor. A second guard file runs the team join-code flows as an authenticated non-member: `ValidateTeamCode`, `ValidateTeamJoinCode`, `EnterClubTeamAsCoach`, `TeamInvitationValidation`, and the join-request create, approve and reject flows. These flows read `Team` (by `JoinCode`) before the user is a member; the tests pass now and must stay green after the Team filter lands in Step 4. Requirements: `specs/club-data-isolation/spec.md` (flows without a membership keep working, membership through a team link).

**Testing Strategy**: The wiring test builds a service provider with `AddDbContext` and a fake `ICurrentUserService` and asserts `ClubFilterActive` for an authenticated and an anonymous user, which proves the greediest-constructor selection. The probe test seeds two clubs with teams and players and users with a club membership row, with only a team link, and with neither, and asserts the visible Teams and Players for each. The no-user tests run on PostgreSQL. The team join-flow tests seed a club, a team with a join code and a user with no `UserClub` row, build the context with `CreateDbContext("nonMember")`, and exercise each named flow, asserting the same outcome as before the change. Reviewed `CreateUserTransactionRollbackTests` and `AppDbContextDesignTimeFactory`: both use the options-only constructor, which stays, so they remain compatible; the fixture overload is additive and the made-virtual `OnModelCreating` does not change the model.

**Existing Tests Broken**: None

## Step 4: Filter Team and Player with leak tests

- [x] Step 4: Filter Team and Player with leak tests

**Routing**: category=backend · context=large · difficulty=high

**Files Affected**:
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/UpdateTeamPlayer.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/ValidateTeamCode.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/Commands/ValidateTeamJoinCode.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/Commands/EnterClubTeamAsCoach.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/TeamInvitationValidation.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Commands/ApproveClubJoinRequest.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Commands/RejectClubJoinRequest.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationTeamPlayerTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamSanctionsEndpointTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamInjuriesEndpointTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/InjuryEndpointAuthorizationTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/FamilyMemberEndpointTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RatingOwnershipFilterTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/UpdateTeamPlayerSelfEditTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/SetPlayerSanctionTeamFundTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/LotteryEndpointTests.cs

**What Will Be Done**: Register the shared filter helper from Step 3 on Team and Player in `AppDbContext` (design D2, D3). Opt the administrator branch of `UpdateTeamPlayer` out with `IgnoreQueryFilters()` on that one query. Run the Step 3 team join-flow guard tests after registering the Team filter: for each handler they show failing, add `IgnoreQueryFilters()` to the single query that reads the `Team` (by `JoinCode` or id) before the user is a member, and leave the others untouched; the six join-flow files listed above are the candidates, and a file the tests show needs no change stays unmodified. Run the leak tests first and watch them fail; then adapt existing tests that authenticate as a test user by seeding a `UserClub` row (or a `UserTeam` row for Player-role principals) for that user in the same setup. Any load that uses `Find`/`FindAsync` on these entities and bypasses the filter is changed to a filtered query (design risk). Requirements: `specs/club-data-isolation/spec.md` (filter by ClubId, membership through a team link, another club's data not found, leak test per entity).

**Testing Strategy**: For Team and Player, one read and one modify leak test each on PostgreSQL: a user of club B cannot read club A's record, cannot load it for modification, and a bulk `ExecuteUpdate` changes zero rows with the record unchanged when read through an unfiltered context; a member of two clubs sees both clubs' rows and no third club's. Further tests cover a user with only a team link, who reads the Team and Players of that team's club and nothing of another club. Reviewed existing principal-based tests: `GetTeamSanctionsEndpointTests` is confirmed to read Teams and Players with no `UserClub` row; the other listed tests were found by search for authenticated principals without membership seeding and are adapted only if the RED run shows they fail, otherwise they remain compatible.

**Existing Tests Broken**:
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamSanctionsEndpointTests.cs` — runtime: the test user has no `UserClub` row, so its Teams and Players are now hidden
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/GetTeamInjuriesEndpointTests.cs` — runtime: candidate, same missing membership for the test user
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/InjuryEndpointAuthorizationTests.cs` — runtime: candidate, same missing membership
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/FamilyMemberEndpointTests.cs` — runtime: candidate, same missing membership
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RatingOwnershipFilterTests.cs` — runtime: candidate, same missing membership
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/UpdateTeamPlayerSelfEditTests.cs` — runtime: candidate, same missing membership
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/SetPlayerSanctionTeamFundTests.cs` — runtime: candidate, same missing membership
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/LotteryEndpointTests.cs` — runtime: candidate, same missing membership

## Step 5: Filter Season and UserActivityLog with audit opt-outs

- [ ] Step 5: Filter Season and UserActivityLog with audit opt-outs

**Routing**: category=backend · context=medium · difficulty=high

**Files Affected**:
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Audit/SearchAuditLog.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationSeasonActivityLogTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/DeleteAuditLogEntriesEndpointTests.cs

**What Will Be Done**: Register the shared filter on Season and UserActivityLog; the filter already lets a null `ClubId` through. Add `IgnoreQueryFilters()` to the Federation and Administrator branches of the audit-log search, which reads entries of every club by design; the club director and coach branches keep their existing narrowing. The audit-log delete only runs a bulk delete by id for those two roles and `AuditLogger` only adds rows, so neither needs a change; the delete test decides whether the bulk delete still reaches entries of other clubs. Requirements: `specs/club-data-isolation/spec.md` (records without a ClubId are not hidden, leak test per entity).

**Testing Strategy**: Leak read and modify tests for both entities, including a season and an audit entry with a null `ClubId` that stay visible and modifiable, plus a test that `CreateSeason` now deactivates only active seasons of the caller's clubs and club-less seasons. Audit tests confirm a Federation or Administrator caller still sees entries of every club and still deletes entries of every club, and a club director still sees only own clubs. Reviewed `DeleteAuditLogEntriesEndpointTests`: it uses a Federation or Administrator principal; if the RED run shows the bulk delete no longer reaches other clubs' entries, add `IgnoreQueryFilters()` to that delete query in `DeleteAuditLogEntries.cs` inside this step and add the file to the step's files.

**Existing Tests Broken**:
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/DeleteAuditLogEntriesEndpointTests.cs` — runtime: candidate, fails only if its principal or its seeded entries fall outside the opted-out path; adapt by role or membership seeding

## Step 6: Filter TaskTrainingBase

- [ ] Step 6: Filter TaskTrainingBase

**Routing**: category=backend · context=small · difficulty=medium

**Files Affected**:
- M Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationTaskTrainingTests.cs

**What Will Be Done**: Register the shared filter on `TaskTrainingBase`, a concrete root entity with its own `ClubId` and no derived types in the source. `PlayerModelBase` is not an entity and gets no filter (design D2). Requirements: `specs/club-data-isolation/spec.md`.

**Testing Strategy**: One read and one modify leak test for `TaskTrainingBase` on PostgreSQL. Reviewed existing tests: the research found no principal-based test that touches this entity, so none is expected to break; any failure shown by running the affected test area is fixed inside this step.

**Existing Tests Broken**: None

## Step 7: Coverage guard and not-found response check

- [ ] Step 7: Coverage guard and not-found response check

**Routing**: category=backend · context=medium · difficulty=medium

**Files Affected**:
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubFilterCoverageTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubDataIsolationEndpointTests.cs

**What Will Be Done**: Add a model-reflection test that fails for any entity type with a `ClubId` property that has no query filter and is not on an explicit allow-list (club, user-club, join-request and similar membership types), and one handler-level test through the existing test host that shows a read and a modification of another club's record return not found in the existing ProblemDetails shape, plus a Player-role principal with only a team link reading its own team through an existing mobile read handler. This step adds tests only; if the endpoint test shows a handler that does not map a missing record to not found, fix that handler in this step and add it to the step's files. Requirements: `specs/club-data-isolation/spec.md` (another club's data returns not found, membership through a team link, leak tests use a real database).

**Testing Strategy**: The coverage test is the check; it passes once steps 4 to 6 are in place and fails when a new club-scoped entity is added without a filter. The endpoint test follows the principal pattern of `ClubsSeasonTests` with seeded `UserClub` and `UserTeam` rows.

**Existing Tests Broken**: None

## Required Documentation

### Spec files

- openspec/changes/personal-and-club-spaces/specs/space-types/spec.md
- openspec/changes/personal-and-club-spaces/specs/club-data-isolation/spec.md

### Local files

- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Club.cs — entity gaining the type property; `Create` signature to extend with an optional parameter.
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/UserClub.cs — membership rows (user id, club id string, creator flag) that the filter subquery reads.
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/UserTeam.cs — team link rows (user id, team id, role id, Team navigation, no ClubId) read by the team-link branch of the filter.
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Membership.cs — role values; Player and FamilyPlayer exist only as team links, never as club membership rows.
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Team.cs — filtered entity carrying `ClubId`; navigated from `UserTeam` inside the filter.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Players/Player.cs — filtered entity with its own `ClubId`; `Create` consumes the unmapped `PlayerModelBase`.
- Back/ExtractionApi/src/RFFM.Api/Domain/Models/PlayerModelBase.cs — unmapped input model, not an entity; context only, receives no filter.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Seasons/Season.cs — filtered entity with nullable `ClubId`; snapshot says required.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Audit/UserActivityLog.cs — filtered entity with nullable `ClubId`.
- Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/Training/TasksTraining/TaskTrainingBase.cs — concrete filtered entity with `ClubId`; no derived types in the source.
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/UserClubs/ClubEntityConfiguration.cs — club mapping to extend; no unique index on name, so shared names already work.
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/News/NewsStatus.cs — SmartEnum pattern to imitate for the space type.
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Entities/NewsItemEntityConfiguration.cs — shows a required SmartEnum property mapped without a per-property converter.
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs — constructor, `ConfigureSmartEnum`, reflection-based configuration discovery; home of the filters.
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContextDesignTimeFactory.cs — builds the context with options only; must keep compiling.
- Back/ExtractionApi/src/RFFM.Api/Domain/Services/ICurrentUserService.cs — exposes user id and `IsAuthenticated`; the filter's user source.
- Back/ExtractionApi/src/RFFM.Api/Infrastructure/Services/CurrentUserService.cs — reads the user from the HTTP context; returns none in hosted jobs.
- Back/ExtractionApi/src/RFFM.Api/Domain/Services/ClubJoinRequestApprovalService.cs — creates or updates the club membership row on approval; reads none of the filtered sets.
- Back/ExtractionApi/src/RFFM.Api/Common/Behaviors/TeamMembershipBehavior.cs — checks team membership for Player and FamilyMember roles through `UserTeam`; shows why team links matter.
- Back/ExtractionApi/src/RFFM.Api/Features/Mobile/Competitions/Queries/GetTeamCalendar.cs — mobile read of Teams guarded by team membership, not `UserClubs`; target of the Player-role endpoint test.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/ClubInvitationCodeVisibility.cs — nearest sibling and membership query pattern for `ClubVisibility`.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Queries/GetClubs.cs — club list to filter; not cached and must stay uncached.
- Back/ExtractionApi/src/RFFM.Api/Common/Behaviors/CachingBehavior.cs — caches only `ICacheRequest` messages; explains why the list is not cached.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/ClubInvitationValidation.cs — anonymous invitation lookup that must stay unfiltered.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Users/Commands/CreateUser.cs — anonymous join path; context only, runs with the filter off.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Commands/CreateClub.cs — creates Personal spaces by default; no name-uniqueness check.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Seasons/Commands/CreateSeason.cs — deactivates active seasons of every club today; behavior narrows under the filter.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/UpdateTeamPlayer.cs — administrator branch that needs an `IgnoreQueryFilters` opt-out.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/ValidateTeamCode.cs — reads Team by join code for any authenticated user; join-flow opt-out candidate.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/Commands/ValidateTeamJoinCode.cs — reads Team by join code before membership; join-flow opt-out candidate.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/Commands/EnterClubTeamAsCoach.cs — reads Team by join code before the membership check; join-flow opt-out candidate.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/TeamInvitationValidation.cs — finds Team by join code across all teams; join-flow opt-out candidate.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Commands/ApproveClubJoinRequest.cs — creator-only approval; join-flow opt-out candidate.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Commands/RejectClubJoinRequest.cs — creator-only rejection; join-flow opt-out candidate.
- Back/ExtractionApi/src/RFFM.Api/Features/Audit/SearchAuditLog.cs — Federation and Administrator read all audit entries; opt-out site.
- Back/ExtractionApi/src/RFFM.Api/Features/Audit/DeleteAuditLogEntries.cs — bulk delete by id for Federation and Administrator; checked by its test, opt-out only if needed.
- Back/ExtractionApi/src/RFFM.Api/Features/Scopes/ScopeAuthorizationService.cs — existing per-handler membership checks over `UserClubs`; context only.
- Back/ExtractionApi/src/RFFM.Api/Features/Federation/LeagueSquadStats/Services/LeagueSquadStatsScheduler.cs — hosted job reading Teams with no user; must stay unfiltered.
- Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/PostgresContainerFixture.cs — real PostgreSQL fixture with migrations; two direct context constructions; gets the user overload.
- Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetClubsHandlerTests.cs — nearest PostgreSQL-collection test; seeds `UserClub` rows; assertions to adapt.
- Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/ClubsSeasonTests.cs — shows the test host with an always-authenticated test principal.
- Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/CreateUserTransactionRollbackTests.cs — builds the context with options only; must keep compiling.
- Back/ExtractionApi/manage-migrations.ps1 — script that generates the migration.
- GLOSSARY.md — terms Personal space and Club.

### External URLs

None

## Implementation Context

**Stack**: .NET 9, ASP.NET Core Minimal API, EF Core 9.0.6 with PostgreSQL (Npgsql 9.0.4), Ardalis SmartEnum, xUnit 2.5.3 with Moq 4.20.72 and Testcontainers.PostgreSql 4.13.0.

**Conventions**:
- Typed values are int-backed `SmartEnum` types stored through `ConfigureSmartEnum` in `AppDbContext`, with no per-property converter (see `NewsStatus`).
- EF configurations are discovered by reflection from `IEntityTypeConfiguration<T>` classes whose type is a `DbSet` of the context, under `Infrastructure/Persistence/Configuration`; migrations live in `Infrastructure/Migrations` and are generated with `manage-migrations.ps1`.
- `BaseEntity.Id` and all `ClubId` columns are strings (GUID text), not `Guid`.
- Database-backed tests use `PostgresContainerFixture` through the `PostgresCollection` and seed `UserClub` rows for membership; HTTP-level tests authenticate with a test auth handler that sets a `NameIdentifier` claim.
- Coach, ClubMember and Directive users hold `UserClubs` rows; Player and FamilyPlayer users hold only `UserTeams` rows, and each feature is one `.cs` file with its endpoint, request, handler and validator.

**Avoid**:
- Adding a required constructor parameter to `AppDbContext` (four direct `new AppDbContext(options)` call sites).
- Putting a global query filter on `Club`, `UserClub` or `UserTeam`, which would break the invitation-code join and membership checks.
- Caching the club list, or adding `ICacheRequest` to `ClubsQueryApp`.
- Mocking the database in the leak tests; they must run on real PostgreSQL.
- Filtering by `UserClubs` alone, which hides the club of every Player and family member.

**Test Command**: `dotnet test Back/ExtractionApi/tests/RFFM.Api.Tests --filter "FullyQualifiedName~<TestName>"` (run from the project root; the database tests need a container runtime, and with Podman `DOCKER_HOST` must point at its TCP endpoint for that command only)
