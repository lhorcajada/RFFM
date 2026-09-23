## 0. Test conventions (verified by inspection, not assumption)

- Tests use plain xUnit `Assert`, not FluentAssertions (`UpdateConvocationStatusHandlerTests.cs`).
- Handler tests that touch `AppDbContext` use the real Postgres testcontainer fixture —
  `[Collection(PostgresCollection.Name)]` + constructor-injected `PostgresContainerFixture fixture`
  (`Back/ExtractionApi/tests/RFFM.Api.Tests/Fixtures/`) — **not** EF InMemory and **not** a mocked
  `AppDbContext`. Only `ICurrentUserService`/`IHttpContextAccessor`/`IAuditLogger` are mocked with
  Moq. Every task below that says "in-memory `AppDbContext`" means "seed real rows into the
  Postgres testcontainer via the fixture", following `UpdateConvocationStatusHandlerTests.cs`'s
  `SeedConvocationAsync` pattern.
- Domain entity tests (no DB) are plain xUnit, no fixture, no Moq — construct the entity directly.

## 1. Domain model (TDD: Red -> Green -> Refactor)

- [x] 1.1 Confirm table-naming convention by inspecting the most recent migration under `Back/ExtractionApi/src/RFFM.Api/Migrations/` before naming `UserActivityLogs` columns.
- [x] 1.2 Write failing domain tests first (`Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/UserActivityLogTests.cs`, plain xUnit, no fixture): `Create` succeeds with all required fields; `Create` throws/guards when `EventType == ConvocationRejected` and `reason` is null or empty; `Create` allows `null` `Reason` for `PageAccess`/`PlayerEdited`/`ConvocationAccepted`; `Create` allows `ClubId`/`TeamId`/`IpAddress`/`SubjectId` all null.
- [x] 1.3 Create `AuditEventType` (`Domain/Entities/Audit/AuditEventType.cs`) — `PageAccess`(1), `ConvocationAccepted`(2), `ConvocationRejected`(3), `PlayerEdited`(4), mirroring `AppRoles.cs`'s `FromName`/`FromId`/`List()` shape.
- [x] 1.4 Create `UserActivityLog` (`Domain/Entities/Audit/UserActivityLog.cs`), `BaseEntity`, `IAggregateRoot`, private constructor + `Create(...)` factory enforcing the reason-required-on-rejection invariant from 1.2.
- [x] 1.5 Run the tests from 1.2 — confirm Green. Refactor if needed (e.g. extract the invariant check to a private static helper) while keeping tests green.

## 2. Persistence

- [x] 2.1 Add `Infrastructure/Persistence/Configuration/Entities/UserActivityLogEntityConfiguration.cs`: `ToTable("UserActivityLogs")`, required/optional columns per `design.md` Decision 1, composite indexes `(ClubId, Timestamp)` and `(TeamId, Timestamp)`, single index on `UserId`. No FK navigation properties (design.md Decision 8).
- [x] 2.2 Add `DbSet<UserActivityLog> UserActivityLogs` to `AppDbContext` (`Infrastructure/Persistence/AppDbContext.cs`).
- [x] 2.3 Generate EF migration `AddUserActivityAuditLog` via `.\manage-migrations.ps1` from `Back/ExtractionApi` (or `dotnet ef migrations add AddUserActivityAuditLog --startup-project ../RFFM.Host` per the script's convention).
- [x] 2.4 Verify the migration applies cleanly against a local dev DB (`dotnet ef database update` or via `manage-migrations.ps1`).

## 3. `IAuditLogger` infrastructure service (TDD)

- [x] 3.1 Write failing tests (`UnitTests/AuditLoggerTests.cs`, `[Collection(PostgresCollection.Name)]` + `PostgresContainerFixture`, Moq for `ICurrentUserService`/`IHttpContextAccessor` only): `LogAsync` adds a `UserActivityLog` to the context with `UserId`/`RoleName` from `ICurrentUserService`, `Timestamp` set (UTC, non-default), does **not** call `SaveChangesAsync` (caller's responsibility — assert via a spy/mock that `SaveChangesAsync` was never invoked by the logger itself); IP resolution: `X-Forwarded-For` header present -> first value used; header absent -> falls back to `HttpContext.Connection.RemoteIpAddress`; no `HttpContext` at all -> `IpAddress` is `null`, no exception.
- [x] 3.2 Create `Infrastructure/Services/IAuditLogger.cs` + `AuditLogger.cs` implementing the contract from `design.md` Decision 3/4.
- [x] 3.3 Register `services.AddScoped<IAuditLogger, AuditLogger>()` in `ServiceCollectionExtensions.cs` alongside the existing `ICurrentUserService` registration.
- [x] 3.4 Run tests from 3.1 — confirm Green.

## 4. `Domain/ErrorCodes.cs` check

- [x] 4.1 Confirm whether existing FluentValidation validators in this repo set custom `.WithErrorCode(...)` (check `UpdatePlayerValidator` and 2-3 siblings) or rely solely on `ValidationBehavior`'s generic `ValidationFailed` code. If validators in this repo don't set custom codes today, the new `RecordPageAccess` validator should not invent one either — follow the real convention found, not the assumption in `design.md` Decision 9.

## 5. Page-access recording feature (TDD)

- [x] 5.1 Write failing handler test (`UnitTests/RecordPageAccessHandlerTests.cs`, Postgres fixture + Moq `IAuditLogger`): valid `PageIdentifier` -> calls `IAuditLogger.LogAsync(AuditEventType.PageAccess, ...)` once with the right args, then `SaveChangesAsync` is called.
- [x] 5.2 Write failing validator test: empty/whitespace `PageIdentifier` fails; `PageIdentifier` over max length fails.
- [x] 5.3 Create `Features/Audit/RecordPageAccess.cs` — `IFeatureModule` + `ICommand`, `POST /api/audit-log/page-access`, `RequireAuthorization()` (any authenticated role), `RecordPageAccessRequest { PageIdentifier, ClubId?, TeamId? }`, handler + FluentValidation validator per `design.md`.
- [x] 5.4 Run tests from 5.1/5.2 — confirm Green.

## 6. Convocation accept/reject instrumentation (TDD)

- [x] 6.1 Read `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/Team.cs` (or wherever `Team` lives) to resolve `design.md` Open Question 1 — does `Team` expose `ClubId` directly from `SportEvent.Include`? Record the answer as a one-line note in this task before proceeding.
- [x] 6.2 Extend `UpdateConvocationStatusHandlerTests.cs` (existing file, `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/`) with new failing cases: accepting a convocation (`NewStatusId = Accepted`) calls `IAuditLogger.LogAsync(AuditEventType.ConvocationAccepted, ..., reason: null, ...)`; deconvoking with an explicit `ExcuseTypeId` calls it with `AuditEventType.ConvocationRejected` and `reason` = that excuse type's `Name`; deconvoking with `ExcuseTypeId = null` still resolves a non-null `reason` (the existing `?? 7` fallback, "Decisión técnica"); a thrown `ForbiddenAccessException`/`UnauthorizedAccessException` (existing ownership-check paths) results in **no** `IAuditLogger.LogAsync` call (per `design.md` Decision 10 — out of scope for v1).
- [x] 6.3 Inject `IAuditLogger` into `UpdateConvocationStatus.Handler`'s constructor; add the `LogAsync` call per `design.md` Decision 10, placed after the status-transition branch resolves and before `SaveChangesAsync`.
- [x] 6.4 Run 6.2 — confirm Green. Confirm no existing test in `UpdateConvocationStatusHandlerTests.cs`/`UpdateConvocationStatusSanctionCouplingTests.cs` regressed (they'll need a mock `IAuditLogger` added to their existing handler construction — update those constructors, don't skip/break them).

## 7. Player-edit instrumentation (TDD)

- [x] 7.1 Write a new test file `UnitTests/UpdatePlayerHandlerTests.cs` if one doesn't already exist covering `UpdateDeletePlayerHandler` (confirm via search first — don't duplicate an existing file under a different name). Failing case: a valid `UpdatePlayerCommand` calls `IAuditLogger.LogAsync(AuditEventType.PlayerEdited, ..., subjectId: player.Id, clubId: request.ClubId, teamId: null, ...)` once, before/around `SaveChangesAsync`.
- [x] 7.2 Inject `IAuditLogger` into `UpdateDeletePlayerHandler`'s constructor; add the call per `design.md` Decision 11.
- [x] 7.3 Run 7.1 — confirm Green.

## 8. Query endpoint (TDD)

- [x] 8.1 Write failing handler tests (`UnitTests/SearchAuditLogHandlerTests.cs`, Postgres fixture seeded with `UserActivityLog` rows across multiple clubs/teams, Moq `ICurrentUserService`):
  - Federation/Administrator role -> sees all rows, unfiltered by club/team.
  - ClubDirector role -> sees only rows whose `ClubId` is one of the caller's `UserClub.ClubId` values (seed 2+ clubs, confirm the other club's rows are excluded).
  - Coach role -> sees only rows whose `TeamId` is one of the caller's `UserTeam.TeamId` values.
  - Extra filter params (`eventType`, `from`/`to`, `userId`) narrow further within scope; an out-of-scope `clubId`/`teamId` filter param yields zero rows, not an error.
  - Pagination: `pageNumber`/`pageSize` slice correctly; total count reflects the *scoped* (not global) row count.
- [x] 8.2 Create `Features/Audit/SearchAuditLog.cs` — `IFeatureModule` + `IQueryApp<...>`, `GET /api/audit-log`, `[Authorize(Roles = "Federation,Administrator,ClubDirector,Coach")]`, implementing the scope-at-the-query logic from `design.md` Decision 6. Confirm and set the `pageSize` default/max (`design.md` Open Question 2 — default 25, max 100, unless the user specifies otherwise before this task starts).
- [x] 8.3 Response sets `X-Total-Count` header (mirroring `GetNews.cs`), body is `UserActivityLogResponse[]`.
- [x] 8.4 Run tests from 8.1 — confirm Green.
- [x] 8.5 Add a route-level test/manual check confirming `Player`/`FamilyMember` get `403` on `GET /api/audit-log` (via the `[Authorize(Roles=...)]` attribute alone — no handler-level check needed, but verify it actually behaves that way, e.g. with a `FunctionalTests`-style check if the project has one, or manual `curl`/Swagger check documented in 9.5).

## 9. Verification

- [x] 9.1 `dotnet build` from `Back/ExtractionApi` — must be clean.
- [x] 9.2 `dotnet test` — full pass, no skipped tests. Coverage target per repo convention: >=85% on new domain logic (`UserActivityLog.Create`), >=80% on new/modified handlers (`RecordPageAccess`, `SearchAuditLog`, the two instrumented handlers).
- [x] 9.3 Confirm no regression in the full `UpdateConvocationStatus*Tests.cs` and any pre-existing `UpdatePlayer`-related tests after adding the `IAuditLogger` constructor dependency.
- [x] 9.4 Manual smoke test via `dotnet run --project src/RFFM.Host`: call `POST /api/audit-log/page-access`, accept a convocation, reject a convocation (with and without an explicit `ExcuseTypeId`), edit a player via `PUT api/catalog/player`, then `GET /api/audit-log` as Federation (see all 4 rows), as a Coach scoped to the convocation's team (see the convocation rows, not the player-edit row unless it happens to share `ClubId`... confirm actual behavior matches `design.md` Decision 11's stated scope boundary), and as Player/FamilyMember (`403`).
- [x] 9.5 Document the actual answers to `design.md`'s two Open Questions (Team.ClubId availability, pageSize default) in a short note appended to `design.md` once resolved during implementation, so the design doc reflects what was actually built.

## 10. OpenSpec closeout

- [x] 10.1 `openspec validate user-activity-audit-log --strict` passes with no errors.
- [x] 10.2 Confirm both Open Questions in `design.md` are resolved (or explicitly deferred with the user's sign-off) before this change is archived.
