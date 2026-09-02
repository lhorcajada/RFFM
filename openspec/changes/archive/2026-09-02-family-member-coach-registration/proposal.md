## Why

Family members of a `TeamPlayer` currently have no way to get an app account unless they
self-register with the `PlayerLinkCode` printed/shared by the coach. Many parents never do
this. Coaches want to create the account for them directly from the player's card (using the
family member's own name/email already on file) and hand them a temporary password, subject to
the coach's own approval step — mirroring how club-join requests already work.

## What Changes

- New backend-only capability: a coach can register an Identity account on behalf of a
  `TeamPlayerFamilyMember` that has an email on file but no linked account yet.
- The account is created in a **Pending** state (Identity user exists, no role, no `UserTeam`)
  until the coach explicitly **approves** it — at which point the `FamilyMember` role,
  `UserTeam` (Membership.FamilyPlayer), and `UserProfile` are created, matching the existing
  `CreateUser.cs` family-member branch.
- A **reject/cancel** command closes a pending request without creating team access.
- `TeamPlayerFamilyMember` gains a nullable `LinkedUserId` column (migration) so registration
  status (None/Pending/Approved) can be derived and exposed to the coach UI.
- The existing family-member DTO returned by `GetTeamPlayer` (`Features/Coaches/Players/Queries/GetTeamPlayer.cs`)
  is extended with the derived registration status.
- The generated one-time password is **never persisted**; it is returned once in the register
  command's response only.
- The pre-existing self-registration path (`POST api/register`, `CreateUser.cs`) is entirely
  untouched.

## Capabilities

### New Capabilities
- `family-member-coach-registration`: coach-initiated registration, approval, and
  rejection/cancellation of a `TeamPlayerFamilyMember`'s user account, plus exposing the
  resulting registration status to the coach UI query.

### Modified Capabilities
(none — no existing `openspec/specs/` capability covers this flow)

## Impact

- **Affected code**: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/FamilyMemberAccounts/**`
  (new), `Domain/Entities/TeamPlayers/TeamPlayerFamilyMember.cs` (new column),
  `Domain/Entities/TeamPlayers/FamilyMemberAccountRequest.cs` (new entity),
  `Infrastructure/Persistence/AppDbContext.cs` (new `DbSet`), a new EF Core migration,
  `Features/Coaches/Players/Queries/GetTeamPlayer.cs` (DTO extension), `Domain/ErrorCodes.cs`
  (new codes).
- **Not affected**: `Front/`, `Mobile/`, `Features/Coaches/Users/Commands/CreateUser.cs`
  (self-registration, read-only reference).
- **Tests**: new xUnit + Moq tests under `tests/RFFM.Api.Tests/UnitTests/` and
  `tests/RFFM.Api.Tests/IntegrationTests/` mirroring `CreateUserHandlerTests.cs` /
  `ClubJoinRequestApprovalServiceTests.cs`.
