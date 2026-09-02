# implement.md — family-member-coach-registration (BACKEND ONLY)

You are the `openspec-implementer` subagent. Execute this script precisely. It covers the
**entire** `openspec/changes/family-member-coach-registration/tasks.md` (all 8 sections) under
`Back/ExtractionApi/` only. Do **not** touch `Front/` or `Mobile/`. Do **not** modify
`Features/Coaches/Users/Commands/CreateUser.cs` (self-registration, `POST api/register`) — it
is a read-only reference pattern for this work, not something to change.

Follow strict TDD (Red → Green → Refactor) per `.claude/rules/testing.md` and
`.claude/rules/dotnet.md` (note: those two rule files describe a *different* project's
conventions — CVL.SmartLocks — mixed into this repo's `.claude/rules/`; for **this** repo,
ignore their project-specific names/paths and instead follow the ACTUAL patterns reproduced
below verbatim from this codebase, which is FutbolBase / RFFM.Api, vertical-slice Minimal API +
Mediator, not the layered/controller architecture those two files describe).

Repo root: `C:\Proyects\MisProyectos\FutbolBase`
Backend root: `Back\ExtractionApi` (all paths below relative to this unless stated otherwise).

## Context you need (already researched — do not re-derive)

### Files you will read in full before writing anything (mirror these exactly)
- `src\RFFM.Api\Features\Coaches\Users\Commands\CreateUser.cs` — alias/email duplicate-check
  pattern, `CreateExecutionStrategy()/BeginTransactionAsync` pattern, `EnsureIdentityRoleAsync`,
  `SaveUserProfileAsync`, the `IsFamilyMember` branch (lines ~256-267, ~280-283).
- `src\RFFM.Api\Domain\Aggregates\UserClubs\ClubJoinRequest.cs` — state machine shape to mirror
  (`Create/Approve/Reject`, `EnsurePending`, private setters, `BaseEntity`/`IAggregateRoot`).
- `src\RFFM.Api\Features\Coaches\ClubJoinRequests\Commands\ApproveClubJoinRequest.cs` and
  `RejectClubJoinRequest.cs` — exact `IFeatureModule`/command/handler shape, claim extraction
  (`ClaimTypes.NameIdentifier` / `"sub"`), `IRequireFeaturePermission`, `IScopeAuthorizationService
  .EnsureCreatorAsync` usage, `Results.Problem(statusCode:..., title:..., detail:...)` for auth
  failures, `Results.Conflict`/`Results.NotFound` with `ProblemDetails.Extensions["code"]`.
- `src\RFFM.Api\Domain\Services\ClubJoinRequestApprovalService.cs` +
  `IClubJoinRequestApprovalService.cs` — the "approve = transaction for AppDbContext rows, then
  best-effort role assignment outside it" pattern; `_db.ChangeTracker.Clear()` +
  `_db.ClubJoinRequests.Attach(joinRequest)` before mutating an entity loaded earlier.
- `src\RFFM.Api\Domain\Entities\TeamPlayers\TeamPlayerFamilyMember.cs` — entity to extend.
- `src\RFFM.Api\Features\Coaches\Players\Commands\CreateFamilyMember.cs` — vertical-slice shape
  for a coach-only sub-resource command using `ICommand<T>`/Mediator (alternative shape to the
  raw-`IRequest<IResult>` shape used by ClubJoinRequests commands — **use the ClubJoinRequests
  shape** for the three commands below, since they need custom status codes 403/404/409, not
  the ICommand<T> exception-to-ProblemDetails-middleware shape).
- `src\RFFM.Api\Features\Coaches\Players\Queries\GetTeamPlayer.cs` — `FamilyResponse` record and
  its mapping (lines 42, 127-129) — the one place to extend for task 6.1.
- `src\RFFM.Api\Domain\Aggregates\UserClubs\UserTeam.cs` — constructor + `LinkPlayer`.
- `src\RFFM.Api\Domain\Aggregates\UserClubs\Membership.cs` — `Membership.FamilyPlayer` (Id 5).
- `src\RFFM.Api\Domain\Entities\AppRoles.cs` — `AppRoles.FamilyMember.Name` == `"FamilyMember"`.
- `src\RFFM.Api\Domain\Entities\UserProfile.cs` — upsert pattern (see `CreateUser.cs
  .SaveUserProfileAsync`).
- `src\RFFM.Api\Features\Scopes\ScopeAuthorizationService.cs` /
  `IScopeAuthorizationService.cs` — `EnsureCreatorAsync(userId, ScopeKinds.Team, teamId, ct)`
  already resolves a Team scope, checking both direct team-creator and parent-club-creator.
- `src\RFFM.Api\Domain\Entities\CoachFeatureRoutes.cs` — use `CoachFeatureRoutes.Squad` (no new
  route constant; family members live in the player/squad area).
- `src\RFFM.Api\Domain\ErrorCodes.cs` — add new constants here, do not hardcode string literals
  in handlers.
- `src\RFFM.Api\Infrastructure\Persistence\Configuration\Entities\TeamPlayerFamilyMemberEntityConfiguration.cs`
  — `IEntityTypeConfiguration<T>` shape to mirror for the new entity's configuration.
- `src\RFFM.Api\Infrastructure\Persistence\AppDbContext.cs` — `DbSet<ClubJoinRequest>` (line 30),
  `DbSet<TeamPlayerFamilyMember>` (line 49) — add the new `DbSet` near these.
- `tests\RFFM.Api.Tests\UnitTests\CreateUserHandlerTests.cs` — test setup shape: `[Collection(PostgresCollection.Name)]`,
  constructor takes `PostgresContainerFixture fixture`, `_fixture.CreateDbContext()` gives a
  real `AppDbContext` against a Testcontainers Postgres instance (NOT an in-memory provider —
  do not substitute `UseInMemoryDatabase`), `MockUserManager()`/`MockRoleManager()` helper
  methods already exist somewhere in this test project (grep for them — likely a shared test
  helper file; if not found as a shared helper, they are private static methods at the bottom
  of `CreateUserHandlerTests.cs` itself — read the full file to find them and reuse the same
  mocking approach for `UserManager<IdentityUser>`/`RoleManager<IdentityRole>`).
- `tests\RFFM.Api.Tests\Fixtures\PostgresContainerFixture.cs` — read this to understand
  `CreateDbContext()` and the `PostgresCollection` xUnit collection fixture wiring.
- Grep the tests project for any existing `ClubJoinRequestApprovalServiceTests.cs` and
  `IScopeAuthorizationService` mocking pattern used elsewhere (e.g. in
  `ApproveClubJoinRequestHandler`-adjacent tests, or `Mock<IScopeAuthorizationService>` usage
  anywhere in `tests\`) and reuse that exact mocking shape rather than inventing a new one.

### Password policy (from `src\RFFM.Host\Startup.cs` ~line 53)
`RequiredLength = 8`, `RequireNonAlphanumeric = true`, `RequireUppercase = true`,
`RequireLowercase = true`, `RequireDigit = true`.

## 1-2. Domain + Infrastructure

### 1.1 `src\RFFM.Api\Domain\Entities\TeamPlayers\FamilyMemberAccountRequest.cs`
New file. Mirror `ClubJoinRequest.cs` structurally:
```csharp
namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public enum FamilyMemberAccountRequestStatus { Pending = 0, Approved = 1, Rejected = 2 }

    public class FamilyMemberAccountRequest : BaseEntity, IAggregateRoot
    {
        public string ApplicationUserId { get; private set; } = string.Empty;
        public string TeamPlayerFamilyMemberId { get; private set; } = string.Empty;
        public string TeamPlayerId { get; private set; } = string.Empty;
        public FamilyMemberAccountRequestStatus Status { get; private set; }
        public DateTime RequestedAt { get; private set; }
        public DateTime? DecidedAt { get; private set; }
        public string? DecidedByUserId { get; private set; }

        public TeamPlayerFamilyMember TeamPlayerFamilyMember { get; set; } = null!;
        public TeamPlayer TeamPlayer { get; set; } = null!;

        private FamilyMemberAccountRequest() { }

        public static FamilyMemberAccountRequest Create(
            string applicationUserId, string teamPlayerFamilyMemberId, string teamPlayerId)
        {
            if (string.IsNullOrWhiteSpace(applicationUserId)
                || string.IsNullOrWhiteSpace(teamPlayerFamilyMemberId)
                || string.IsNullOrWhiteSpace(teamPlayerId))
                throw new DomainException("FamilyMemberAccountRequest",
                    "El usuario y el familiar son obligatorios.", ErrorCodes.FamilyMemberEmailRequired);

            return new FamilyMemberAccountRequest
            {
                ApplicationUserId = applicationUserId,
                TeamPlayerFamilyMemberId = teamPlayerFamilyMemberId,
                TeamPlayerId = teamPlayerId,
                Status = FamilyMemberAccountRequestStatus.Pending,
                RequestedAt = DateTime.UtcNow
            };
        }

        public void Approve(string decidedByUserId)
        {
            EnsurePending();
            Status = FamilyMemberAccountRequestStatus.Approved;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = decidedByUserId;
        }

        public void Reject(string decidedByUserId)
        {
            EnsurePending();
            Status = FamilyMemberAccountRequestStatus.Rejected;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = decidedByUserId;
        }

        private void EnsurePending()
        {
            if (Status != FamilyMemberAccountRequestStatus.Pending)
                throw new DomainException("FamilyMemberAccountRequest",
                    "La solicitud ya ha sido decidida.", ErrorCodes.FamilyMemberAccountRequestAlreadyDecided);
        }
    }
}
```
(Reconcile the `ErrorCodes.FamilyMemberEmailRequired` use in `Create`'s guard above — that
guard is really "invalid arguments", not literally the email-required business rule; if you
judge a more precise error code name reads better for a `DomainException` thrown from a
programmer-error guard that should realistically never fire from the handler's call site
(handler always passes non-empty values), that's a fine adjustment — keep it minimal.)

### 1.2 `TeamPlayerFamilyMember.cs` — add `LinkedUserId`
Add:
```csharp
public string? LinkedUserId { get; private set; }
```
and a method:
```csharp
public void LinkAccount(string userId)
{
    if (string.IsNullOrWhiteSpace(userId))
        throw new ArgumentException("El identificador de usuario es obligatorio.");
    LinkedUserId = userId;
}
```
Do not add it to the `Create`/`UpdateDetails` signatures — it is set later, independently, by
the Approve command.

### 1.3 `ErrorCodes.cs` — add under a new `// Family member accounts (Features/Coaches/FamilyMemberAccounts)` comment block:
```csharp
public const string FamilyMemberEmailRequired = "FamilyMemberEmailRequired";
public const string FamilyMemberAccountAlreadyLinked = "FamilyMemberAccountAlreadyLinked";
public const string FamilyMemberAccountRequestAlreadyPending = "FamilyMemberAccountRequestAlreadyPending";
public const string FamilyMemberAccountRequestNotFound = "FamilyMemberAccountRequestNotFound";
public const string FamilyMemberAccountRequestAlreadyDecided = "FamilyMemberAccountRequestAlreadyDecided";
```

### 2.1-2.2 `AppDbContext` + EF configuration
Add `public DbSet<FamilyMemberAccountRequest> FamilyMemberAccountRequests { get; set; }` next
to the existing `DbSet<ClubJoinRequest>`/`DbSet<TeamPlayerFamilyMember>` lines (adjust the
`using` for `RFFM.Api.Domain.Entities.TeamPlayers` if not already present in that file).

New file
`src\RFFM.Api\Infrastructure\Persistence\Configuration\Entities\FamilyMemberAccountRequestEntityConfiguration.cs`,
mirroring `TeamPlayerFamilyMemberEntityConfiguration.cs`'s style (new table
`"FamilyMemberAccountRequests"`, `HasKey(r => r.Id)`, required string columns with sane
`HasMaxLength`, `HasIndex(r => r.TeamPlayerFamilyMemberId)`, no cascade-delete FK needed to
`TeamPlayerFamilyMember`/`TeamPlayer` unless you find EF demands one to satisfy the navigation
properties — if so, use `DeleteBehavior.Restrict` since a `FamilyMemberAccountRequest` should
outlive the family member being deleted for audit purposes, not cascade-delete with it. Also
add `builder.Property(r => r.Status).HasConversion<int>();` for the enum, matching how
`ClubJoinRequestStatus` is stored (check `ClubJoinRequest`'s own EF configuration file — grep
for it — and mirror its enum-storage approach exactly rather than guessing).

### 2.3 Migration
From `Back\ExtractionApi`, run `.\manage-migrations.ps1`, name it
`AddFamilyMemberAccountRequest`. If the script prompts interactively, read it first to find the
non-interactive invocation (e.g. a script parameter for add + name); do not leave a half-applied
migration. Verify the generated migration only adds the new table + the new nullable
`LinkedUserId` column on `TeamPlayerFamilies` — no unrelated model drift. If unrelated drift
appears (pre-existing pending model changes unrelated to this task), stop and report it instead
of silently including it.

## 3. Register command (TDD)

### 3.1 Red
`tests\RFFM.Api.Tests\UnitTests\RegisterFamilyMemberAccountHandlerTests.cs`, `[Collection(PostgresCollection.Name)]`,
constructor takes `PostgresContainerFixture`. For each test, seed real rows via
`_fixture.CreateDbContext()` (a `Club`/`Team`/`TeamPlayer`/`TeamPlayerFamilyMember`, plus a
`UserTeam`/`UserClub` with `IsCreator = true` for the authorized-caller tests) — mirror how
`CreateUserHandlerTests.cs` seeds through the fixture's real Postgres context rather than
mocking `AppDbContext` itself (EF Core `DbContext` is not meaningfully mockable here — this
project's existing tests always use the real Testcontainers Postgres for `AppDbContext`
interactions, only `UserManager`/`RoleManager` are `Mock<T>`).

Cases:
1. Family member `Email` is null → `400`, code `FamilyMemberEmailRequired`, no `IdentityUser`
   created (`userManagerMock.Verify(... CreateAsync ..., Times.Never)`), no
   `FamilyMemberAccountRequest` row inserted.
2. Family member already has `LinkedUserId` set → `409`, code
   `FamilyMemberAccountAlreadyLinked`.
3. A `Pending` `FamilyMemberAccountRequest` already exists for this family member → `409`, code
   `FamilyMemberAccountRequestAlreadyPending`.
4. Caller is not the team's/club's creator → `403` (use a real `ScopeAuthorizationService`
   against the seeded DB rather than mocking `IScopeAuthorizationService`, matching how
   `ApproveClubJoinRequestHandler`'s own tests do it — grep tests for
   `ScopeAuthorizationService` usage first to confirm this is indeed how it's tested elsewhere;
   if you instead find `IScopeAuthorizationService` is always mocked in this test project, mock
   it here too for consistency — check before deciding).
5. Happy path: `200`, response has non-empty `Alias`/`Password`, `userManagerMock` was called
   with `CreateAsync(user, password)` where `user.Email` equals the family member's email and
   `user.UserName` is the generated alias; a `FamilyMemberAccountRequest` row exists afterward
   with `Status == Pending`; `roleManagerMock`/`AddToRoleAsync` was NEVER called (no role at
   this stage); no `UserTeam` row was created.
6. Alias collision: seed an existing `IdentityUser` whose `UserName` equals the base slug
   (mock `FindByNameAsync` to return non-null for the base slug and null for `<slug>2`) —
   assert the generated alias has a numeric suffix.

Run `dotnet test --filter RegisterFamilyMemberAccountHandlerTests` — confirm all fail (class
doesn't exist).

### 3.2 Green
New file
`src\RFFM.Api\Features\Coaches\FamilyMemberAccounts\Commands\RegisterFamilyMemberAccount.cs`.
Mirror `ApproveClubJoinRequest.cs`'s file shape (IFeatureModule + raw `IRequest<IResult>`
command, not `ICommand<T>`, so you control exact status codes/ProblemDetails per case):

```
POST api/family-members/{familyMemberId}/register
```
- Extract caller id from `ClaimTypes.NameIdentifier`/`"sub"` claim exactly like
  `ApproveClubJoinRequest.cs`.
- `RequireAuthorization()`.
- Command: `FamilyMemberId`, `CallerUserId`; `IRequireFeaturePermission` with
  `FeatureRoute => CoachFeatureRoutes.Squad`, `RequiredPermission => "ReadWrite"`.
- Handler steps:
  1. Load `TeamPlayerFamilyMember` `Include(f => f.TeamPlayer)` — 404 (`ProblemDetails`, code
     `FamilyMemberNotFound` — already exists in `ErrorCodes.cs`) if missing.
  2. `EnsureCreatorAsync(callerId, ScopeKinds.Team, familyMember.TeamPlayer.TeamId, ct)` — on
     failure `Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail)`.
  3. `string.IsNullOrWhiteSpace(familyMember.Email)` → 400, `FamilyMemberEmailRequired`.
  4. `familyMember.LinkedUserId is not null` → 409, `FamilyMemberAccountAlreadyLinked`.
  5. Any `FamilyMemberAccountRequest` for this `TeamPlayerFamilyMemberId` with
     `Status == Pending` → 409, `FamilyMemberAccountRequestAlreadyPending`.
  6. Generate alias: normalize `Name + LastName` (strip diacritics via
     `text.Normalize(NormalizationForm.FormD)` + regex-strip `Mn` unicode category chars +
     lowercase + strip non `[a-z0-9]`); fallback base `"familiar"` if empty. Loop
     `_userManager.FindByNameAsync(candidate)`, appending `2, 3, ...` until free (same idea as
     `CreateUser.cs`'s duplicate check, done in a loop here since this handler must itself
     produce a free alias rather than receive one from the caller).
  7. Generate password: player's `TeamPlayer.Player.Name` first whitespace-token (query
     `.Include(f => f.TeamPlayer).ThenInclude(tp => tp.Player)`), title-cased, fallback
     `"Familia"` if empty/no letters, + 4 digits from
     `System.Security.Cryptography.RandomNumberGenerator.GetInt32(0, 10000)` zero-padded to 4
     digits + `"!"`.
  8. `_userManager.CreateAsync(new IdentityUser { Email = familyMember.Email, UserName = alias
     }, password)` — on failure, 400 `UserCreationFailed` (reuse existing error code), joining
     `createResult.Errors`.
  9. `CreateExecutionStrategy()/BeginTransactionAsync` (mirror `CreateUser.cs` exactly,
     including the `_db.ChangeTracker.Clear()` at the top of the retry delegate): insert
     `FamilyMemberAccountRequest.Create(user.Id, familyMember.Id, familyMember.TeamPlayerId)`,
     `SaveChangesAsync`, commit.
  10. Return `200 Results.Ok(new RegisterFamilyMemberAccountResponse(...))` with `RequestId`,
      `Alias`, `Password`, `FamilyMemberName` (`$"{familyMember.Name} {familyMember.LastName}"`.Trim()),
      `PlayerName`, `Status = "Pending"`. Do NOT log the password anywhere (not even at Debug
      level) and do not put it in any entity/column.
- Validator: `AbstractValidator<RegisterFamilyMemberAccountCommand>` — `RuleFor(x =>
  x.FamilyMemberId).NotEmpty()`, `RuleFor(x => x.CallerUserId).NotEmpty()`.

### 3.3
`dotnet test --filter RegisterFamilyMemberAccountHandlerTests` — green.

## 4. Approve command (TDD)

### 4.1 Red
`tests\RFFM.Api.Tests\UnitTests\ApproveFamilyMemberAccountHandlerTests.cs`, same fixture shape.
Cases: request not found → 404 `FamilyMemberAccountRequestNotFound`; unauthorized caller → 403;
request already decided (seed one `Approved`) → 409
`FamilyMemberAccountRequestAlreadyDecided`; happy path → `roleManagerMock`/`userManagerMock
.AddToRoleAsync` called with `AppRoles.FamilyMember.Name`, a `UserTeam` row exists with
`RoleId == Membership.FamilyPlayer.Id` and `LinkedTeamPlayerId == familyMember.TeamPlayerId`, a
`UserProfile` row exists for the user, `TeamPlayerFamilyMember.LinkedUserId` equals the user
id, and the request's `Status == Approved`.

### 4.2 Green
New file
`src\RFFM.Api\Features\Coaches\FamilyMemberAccounts\Commands\ApproveFamilyMemberAccount.cs`.
```
POST api/family-members/account-requests/{requestId}/approve
```
Same `IFeatureModule`/claim-extraction/`IRequireFeaturePermission` shape as
`ApproveClubJoinRequest.cs` (`FeatureRoute => CoachFeatureRoutes.Squad`,
`RequiredPermission => "ReadWrite"`). Handler:
1. Load `FamilyMemberAccountRequest` `Include` its `TeamPlayerFamilyMember` — 404 if missing.
2. `EnsureCreatorAsync(callerId, ScopeKinds.Team, request.TeamPlayerId, ct)` — 403/Problem on
   failure.
3. `Status != Pending` → 409 `FamilyMemberAccountRequestAlreadyDecided`.
4. `CreateExecutionStrategy()` transaction (mirror `ClubJoinRequestApprovalService.ApproveAsync`
   exactly: `_db.ChangeTracker.Clear()`, re-`Attach` both the request and the
   `TeamPlayerFamilyMember` before mutating): call `request.Approve(callerId)`, create
   `new UserTeam(request.ApplicationUserId, request.TeamPlayerId's team id, Membership.FamilyPlayer.Id)`
   — **note**: `UserTeam`'s constructor takes a `teamId`, not a `teamPlayerId`; resolve the
   team id from the already-loaded `TeamPlayerFamilyMember.TeamPlayer.TeamId` (Include it) —
   then `userTeam.LinkPlayer(request.TeamPlayerId)`; call
   `familyMember.LinkAccount(request.ApplicationUserId)`; `SaveChangesAsync`; commit.
   Given the complexity of mirroring `ClubJoinRequestApprovalService`'s exact
   attach/transaction dance, you MAY choose to keep this logic inline in the handler (simpler,
   one call site) rather than extracting a new `IFamilyMemberAccountApprovalService` — that
   service pattern in `ClubJoinRequestApprovalService` exists because it is shared between two
   different call sites (manual approval + self-approval-by-code); this feature has only one
   approval call site, so extracting a service purely to mirror the pattern is unnecessary
   ceremony. Document this choice in your final report.
5. Outside the transaction, best-effort (`try/catch` + `ILogger.LogWarning`, matching
   `EnsureIdentityRoleAsync`): ensure `AppRoles.FamilyMember.Name` role exists, add user to it;
   upsert `UserProfile` (mirror `CreateUser.cs.SaveUserProfileAsync` exactly — same
   find-or-create-then-Update shape).
6. Return `200 Results.Ok()`.

### 4.3
`dotnet test --filter ApproveFamilyMemberAccountHandlerTests` — green.

## 5. Reject command (TDD)

### 5.1 Red
`tests\RFFM.Api.Tests\UnitTests\RejectFamilyMemberAccountHandlerTests.cs`. Cases: not found →
404; already decided → 409; unauthorized → 403; happy path → `Status == Rejected`, no
`UserTeam` created, `roleManagerMock.AddToRoleAsync` never called,
`userManagerMock.DeleteAsync` called once with the linked `IdentityUser`.

### 5.2 Green
New file
`src\RFFM.Api\Features\Coaches\FamilyMemberAccounts\Commands\RejectFamilyMemberAccountRequest.cs`.
```
POST api/family-members/account-requests/{requestId}/reject
```
Same shape as `RejectClubJoinRequest.cs`. Handler: load request (404 if missing), authorize via
team scope (403), `Status != Pending` → 409, else `request.Reject(callerId)`,
`SaveChangesAsync` (single call is already atomic — no explicit transaction needed, matching
`RejectClubJoinRequest.cs`'s own comment about this), then best-effort
`_userManager.FindByIdAsync(request.ApplicationUserId)` →
`_userManager.DeleteAsync(user)` in a `try/catch` + `LogWarning`, so the alias/email become
reusable for a future registration attempt. Return `200 Results.Ok()`.

### 5.3
`dotnet test --filter RejectFamilyMemberAccountHandlerTests` — green.

## 6. Query surface

### 6.1
In `GetTeamPlayer.cs`:
- Extend `FamilyResponse` with a `string RegistrationStatus` field (values: `"None"`,
  `"Pending"`, `"Approved"` — plain strings, matching this file's existing style of returning
  plain string fields like `Demarcation.ActivePositionName`, not a `SmartEnum`/typed enum over
  the wire).
- In the handler, after loading `item.FamilyMembers`, also load pending request ids in one
  query: `var pendingFamilyMemberIds = await _db.FamilyMemberAccountRequests.AsNoTracking()
  .Where(r => r.TeamPlayerId == item.Id && r.Status == FamilyMemberAccountRequestStatus.Pending)
  .Select(r => r.TeamPlayerFamilyMemberId).ToListAsync(cancellationToken);` (add the necessary
  `using RFFM.Api.Domain.Entities.TeamPlayers;` if not already present — check first, this file
  likely already has a `using` for that namespace via `TeamPlayerFamilyMember` references).
- Map each family member's status: `f.LinkedUserId is not null ? "Approved" : pendingFamilyMemberIds.Contains(f.Id) ? "Pending" : "None"`.

### 6.2
Grep `tests\` for any existing test file touching `GetTeamPlayer` (`TeamPlayerQuery` /
`RequestHandler`). If one exists, extend it with a case seeding a `FamilyMemberAccountRequest`
(Pending and Approved variants) and asserting the returned `RegistrationStatus`. If none
exists, add a small new focused integration test
(`tests\RFFM.Api.Tests\IntegrationTests\GetTeamPlayerFamilyMemberStatusTests.cs` or similar,
matching this project's existing integration-test naming) covering the three states
(None/Pending/Approved) against the real Postgres fixture.

## 7. Integration test

`tests\RFFM.Api.Tests\IntegrationTests\RegisterFamilyMemberAccountTransactionTests.cs` (name
per tasks.md — adjust if a more fitting existing fixture/base class is found, e.g. mirror
`CreateUserTransactionRollbackTests.cs`'s base class/setup exactly). Cover the full
Register → Approve happy path end-to-end against the real Testcontainers Postgres +
mocked `UserManager`/`RoleManager` (or real Identity if `CreateUserTransactionRollbackTests.cs`
uses a real `IdentityDbContext` fixture too — check and mirror whichever it does), asserting
after Approve: exactly one `UserTeam` row (`RoleId == Membership.FamilyPlayer.Id`,
`LinkedTeamPlayerId` set), exactly one `UserProfile` row, `TeamPlayerFamilyMember.LinkedUserId`
set, `FamilyMemberAccountRequest.Status == Approved`.

## 8. Verification

1. `dotnet build` from `Back\ExtractionApi` — must be clean (no new warnings-as-errors if any
   are configured; check `Directory.Build.props`/`.csproj` for `TreatWarningsAsErrors` first).
2. `dotnet test` from `Back\ExtractionApi` — full suite, 100% pass, zero skipped
   (`[Fact(Skip = ...)]` is not acceptable — if genuinely blocked on something, stop and report
   rather than skip).
3. From repo root: `openspec validate family-member-coach-registration --strict` — must pass.
4. Open `openspec/changes/family-member-coach-registration/tasks.md` and mark every checkbox
   `[x]` as each is genuinely completed (do not mass-check at the end without having done the
   work in order).

## Do not do

- Do not touch `Front/` or `Mobile/`.
- Do not modify `POST api/register` / `CreateUser.cs` behavior.
- Do not persist the generated password anywhere (no column, no log, no cache).
- Do not use `System.Random` for the password digits — use
  `System.Security.Cryptography.RandomNumberGenerator`.
- Do not add a new `CoachFeatureRoutes` constant — reuse `CoachFeatureRoutes.Squad`.
- Do not run `git commit` or `git push`.
- Do not archive the change.

## Final report format

List: files created/modified (absolute paths, one-line reason each); the three new
endpoints with exact routes and request/response shapes; the migration name generated; full
`dotnet test` pass/fail summary line; `dotnet build` result; `openspec validate` result; any
judgment call you made that wasn't fully pinned down above (e.g. whether
`IScopeAuthorizationService` ended up mocked vs. real-DB-tested in the new unit tests, whether
you extracted an approval service or kept it inline, exact migration diff shape).
