## 1. Domain

- [x] 1.1 Add `FamilyMemberAccountRequest` entity (`Domain/Entities/TeamPlayers/FamilyMemberAccountRequest.cs`) mirroring `ClubJoinRequest`'s state machine (`Pending/Approved/Rejected`, `Create/Approve/Reject`), with `ApplicationUserId`, `TeamPlayerFamilyMemberId`, `TeamPlayerId`, `RequestedAt`, `DecidedAt`, `DecidedByUserId`
- [x] 1.2 Add nullable `LinkedUserId` column + `LinkAccount(userId)` method to `TeamPlayerFamilyMember`
- [x] 1.3 Add new `ErrorCodes` constants: `FamilyMemberEmailRequired`, `FamilyMemberAccountAlreadyLinked`, `FamilyMemberAccountRequestAlreadyPending`, `FamilyMemberAccountRequestNotFound`, `FamilyMemberAccountRequestAlreadyDecided`

## 2. Infrastructure

- [x] 2.1 Add `DbSet<FamilyMemberAccountRequest>` to `AppDbContext`
- [x] 2.2 Add `IEntityTypeConfiguration<FamilyMemberAccountRequest>` (reflection-discovered, mirror `TeamPlayerFamilyMember`'s configuration file)
- [x] 2.3 Generate EF Core migration via `.\manage-migrations.ps1` (name: `AddFamilyMemberAccountRequest`)

## 3. Register command (TDD)

- [x] 3.1 Write failing xUnit tests in `tests/RFFM.Api.Tests/UnitTests/RegisterFamilyMemberAccountHandlerTests.cs` (missing email → 400, already linked → 409, already pending → 409, unauthorized → 403, happy path → alias/password generated, Identity user created with no role, `FamilyMemberAccountRequest` Pending created)
- [x] 3.2 Implement `Features/Coaches/FamilyMemberAccounts/Commands/RegisterFamilyMemberAccount.cs` (`IFeatureModule` + command/handler/validator, alias slugify + uniqueness loop, cryptographically random password generator, `IScopeAuthorizationService.EnsureCreatorAsync(ScopeKinds.Team, ...)`, `CreateExecutionStrategy` transaction pattern from `CreateUser.cs`)
- [x] 3.3 Run tests, confirm green

## 4. Approve command (TDD)

- [x] 4.1 Write failing xUnit tests in `tests/RFFM.Api.Tests/UnitTests/ApproveFamilyMemberAccountHandlerTests.cs` (not found → 404, already decided → 409, unauthorized → 403, happy path → role assigned, `UserTeam` + `UserProfile` created, `LinkedUserId` set)
- [x] 4.2 Implement `Features/Coaches/FamilyMemberAccounts/Commands/ApproveFamilyMemberAccount.cs` (kept approval logic inline in the handler rather than extracting a domain service — this feature has only one approval call site, unlike `ClubJoinRequestApprovalService` which serves two)
- [x] 4.3 Run tests, confirm green

## 5. Reject command (TDD)

- [x] 5.1 Write failing xUnit tests in `tests/RFFM.Api.Tests/UnitTests/RejectFamilyMemberAccountHandlerTests.cs` (not found → 404, already decided → 409, unauthorized → 403, happy path → Rejected, no `UserTeam`/role, best-effort Identity user deletion)
- [x] 5.2 Implement `Features/Coaches/FamilyMemberAccounts/Commands/RejectFamilyMemberAccountRequest.cs`
- [x] 5.3 Run tests, confirm green

## 6. Query surface

- [x] 6.1 Extend `Features/Coaches/Players/Queries/GetTeamPlayer.cs` family member DTO with derived registration status (None/Pending/Approved)
- [x] 6.2 Extended `tests/RFFM.Api.Tests/UnitTests/GetTeamPlayerHandlerTests.cs` (pre-existing file) with cases covering None/Pending/Approved

## 7. Integration tests

- [x] 7.1 Wrote `tests/RFFM.Api.Tests/IntegrationTests/RegisterFamilyMemberAccountTransactionTests.cs` covering the full Register → Approve happy path against the real Postgres test container, asserting `UserTeam`, `UserProfile`, Identity role, and `TeamPlayerFamilyMember.LinkedUserId` all end up correct

## 8. Verification

- [x] 8.1 `dotnet build` green (0 warnings, 0 errors)
- [x] 8.2 `dotnet test` green for all new/modified tests; full suite passes except 2 pre-existing failures unrelated to this change (`AdnLegibleImporterFullDocumentSpotCheckTests`, `GameModelSeederRealDocumentTests` — both fail on an unrelated game-model-import document parsing issue, not touched by this change)
- [x] 8.3 `openspec validate family-member-coach-registration --strict` passes

## 9. Data backfill (follow-up fix)

Family members who self-registered through the pre-existing, older generic self-register
flow (`Features/Coaches/Users/Commands/CreateUser.cs`, `IsFamilyMember` branch, using
`PlayerLinkCode`) already had a working Identity account + `UserTeam` (RoleId =
`Membership.FamilyPlayer.Id`) before this change existed, but that flow never set
`TeamPlayerFamilyMember.LinkedUserId` (it only calls `AddFamilyMemberEmailIfMissing`).
`GetTeamPlayer`'s `RegistrationStatus` mapping (task 6.1) reads `LinkedUserId == null` as
`"None"`, so those already-registered family members incorrectly showed the "Registrar en la
app" button.

- [x] 9.1 Added data-only migration `20260902112811_BackfillFamilyMemberLinkedUserId.cs`
      (no schema change) with a guarded, idempotent cross-schema `UPDATE` that sets
      `LinkedUserId` on `app."TeamPlayerFamilies"` rows by matching `Email` (case-insensitive)
      against an `identity."AspNetUsers"` row already linked, via `app."UserTeams"`, as a
      `FamilyPlayer` to that same `TeamPlayer`. Implemented as raw SQL (not a C# seeder) because
      `AppDbContext`/`IdentityDbContext`/`FederationDbContext` all share the single
      `FutbolBaseConnection` connection string (same physical Postgres database, different
      schemas only), matching the existing raw-SQL migration precedent
      (`20260709120000_AddUserTeam.cs`). Wrapped in a `DO $$ ... IF to_regclass(...) IS NOT NULL
      ... $$` guard because `Program.cs` migrates `AppDbContext` before `IdentityDbContext` on a
      first-ever deploy, so `identity."AspNetUsers"` (and `app."UserTeams"`) may not exist yet
      when this migration runs — a fresh environment has nothing to backfill anyway, so skipping
      is correct there, not just crash-avoidance. The `UPDATE`'s own `WHERE "LinkedUserId" IS
      NULL` makes it naturally idempotent on repeat runs.
- [x] 9.2 Added `tests/RFFM.Api.Tests/IntegrationTests/BackfillFamilyMemberLinkedUserIdTests.cs`
      (real Testcontainers Postgres, 5 cases: sets `LinkedUserId` for the old-flow scenario,
      idempotent on a second run, leaves an unmatched family member untouched, does not
      overwrite an already-linked family member, does not match an email belonging to a
      different `TeamPlayer`) — all green.
- [x] 9.3 `dotnet build` green; `dotnet test` green except the same 2 pre-existing, unrelated
      failures noted in 8.2.
