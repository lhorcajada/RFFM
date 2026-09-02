## Context

`TeamPlayerFamilyMember` (`Domain/Entities/TeamPlayers/TeamPlayerFamilyMember.cs`) is a
first-level entity/DbSet with `Name`, `LastName`, `Email`, etc. — no link to an `IdentityUser`
today. The only existing account-creation path for a family member is self-registration via
`PlayerLinkCode` (`Features/Coaches/Users/Commands/CreateUser.cs`, `POST api/register`,
`IsFamilyMember` branch) — untouched by this change.

The closest existing pattern for "create pending thing, coach approves/rejects it later" is
`ClubJoinRequest` (`Domain/Aggregates/UserClubs/ClubJoinRequest.cs`) +
`Features/Coaches/ClubJoinRequests/Commands/{Approve,Reject,Cancel}ClubJoinRequest.cs` +
`Domain/Services/ClubJoinRequestApprovalService.cs`. That entity is modeled around
`ApplicationUserId` + `ClubId` + `MembershipId` and is club-scoped; it has no notion of a
`TeamPlayerFamilyMember`/`TeamPlayer` relationship.

Authorization for team-scoped coach actions goes through `IScopeAuthorizationService`
(`Features/Scopes/ScopeAuthorizationService.cs`), which already supports `ScopeKinds.Team`
via `EnsureCreatorAsync`/`EnsureMemberAsync` (falls back to the parent club's creator/member).

Identity password policy (`RFFM.Host/Startup.cs`): `RequiredLength = 8`,
`RequireNonAlphanumeric = true`, `RequireUppercase = true`, `RequireLowercase = true`,
`RequireDigit = true`.

## Goals / Non-Goals

**Goals:**
- Let a coach register a pending Identity account for a `TeamPlayerFamilyMember` that has an
  email on file, generating alias + password server-side.
- Two-step approval: Pending (Identity user only) → Approved (role + `UserTeam` + `UserProfile`)
  or Rejected/Cancelled (no team access ever granted).
- Expose registration status (None/Pending/Approved) on the existing family-member DTO so the
  coach UI can render it without a new query endpoint.
- Never persist the generated password anywhere.

**Non-Goals:**
- No frontend/mobile work.
- No password-retrieval/resend query — once lost, the family member uses standard
  forgot-password (out of scope here) or the coach re-runs registration after a Rejected/expired
  request (also out of scope for now; only one active Pending/Approved request per family
  member is enforced).
- No change to `POST api/register` self-registration.
- No email notification to the family member (the coach relays the password out-of-band, e.g.
  WhatsApp) — matches the spec's "frontend keeps it in local UI state" trade-off.

## Decisions

### 1. New entity `FamilyMemberAccountRequest` instead of extending `ClubJoinRequest`
`ClubJoinRequest` is hard-wired to `ClubId` + `MembershipId` (club membership types) and has no
column for `TeamPlayerFamilyMemberId`/`TeamPlayerId`. Overloading it would mean nullable
club/team columns and conditional logic throughout `ClubJoinRequests/*`, `GetClubJoinRequests`,
`GetPendingClubJoinRequestsCount`, none of which know about family members. A new entity
mirrors `ClubJoinRequest`'s exact shape/state machine (`Pending/Approved/Rejected/Cancelled`,
`Create/Approve/Reject/Cancel`, `RequestedAt/DecidedAt/DecidedByUserId`) but with
`TeamPlayerFamilyMemberId` + `TeamPlayerId` + `ApplicationUserId` instead of `ClubId`/
`MembershipId`. Location: `Domain/Entities/TeamPlayers/FamilyMemberAccountRequest.cs` (same
folder as `TeamPlayerFamilyMember`), registered as `IAggregateRoot`, own `DbSet` in
`AppDbContext`.

### 2. `TeamPlayerFamilyMember.LinkedUserId` (nullable column) as the status source of truth
Rather than a denormalized status enum duplicated on both `TeamPlayerFamilyMember` and
`FamilyMemberAccountRequest`, `TeamPlayerFamilyMember` gets a single nullable
`LinkedUserId` column, set only when the request is **Approved** (mirrors `UserTeam
.LinkedTeamPlayerId` direction, but on the family-member side). Status is derived for the
coach UI as:
- `LinkedUserId != null` → **Approved**
- else latest `FamilyMemberAccountRequest` for this family member with `Status == Pending` →
  **Pending**
- else → **None**

This avoids two columns going out of sync and keeps `Approve()`'s effect (linking the account)
visible directly on `TeamPlayerFamilyMember` without a join, while `Pending` still needs one
cheap query (already required to know whether a *new* register call is allowed).

### 3. Generated alias: slugify `Name + LastName`, diacritics stripped, numeric-suffix on clash
Same duplicate-check loop shape as `CreateUser.cs`'s `_userManager.FindByNameAsync` (this
handler does its own loop instead, since it — not the caller — must produce a free alias):
normalize via `String.Normalize(NormalizationForm.FormD)` + strip combining marks (regex) +
lowercase + strip non `[a-z0-9]`; if `FindByNameAsync` finds a hit, append `2`, `3`, … until
free. If `Name`/`LastName` produce an empty slug (e.g. only symbols), fall back to
`"familiar"` as the base.

### 4. Generated password: `{CapitalizedPlayerFirstName}{4 random digits}!`
Player first name = first whitespace-token of the **linked `TeamPlayer`'s** name (not the
family member's), title-cased (`ToUpperInvariant` first char + `ToLowerInvariant` rest) so it
always contains upper+lower. Edge cases:
- Player first name has no letters / is empty → fall back to `"Familia"`.
- Resulting token shorter than needed for policy → irrelevant, policy is about
  category-presence not length; `RequiredLength = 8` is satisfied because
  `"Familia" + 4 digits + "!"` = 12 chars minimum, and any real name is ≥ this.
Random digits via `System.Security.Cryptography.RandomNumberGenerator` (not `Random`) — this
is a credential.

### 5. No cross-DbContext atomicity (same accepted trade-off as `CreateUser.cs`)
Register command: `IdentityUser` created via `UserManager` first (own connection), then
`FamilyMemberAccountRequest` insert into `AppDbContext` wrapped in
`CreateExecutionStrategy()/BeginTransactionAsync` exactly like `CreateUser.cs`. No Identity
role assigned at this stage (Pending). Approve command: reuses the
`ClubJoinRequestApprovalService`-style pattern — AppDbContext transaction for
`FamilyMemberAccountRequest.Approve()` + `UserTeam` insert + `TeamPlayerFamilyMember
.LinkedUserId` set, then best-effort `EnsureIdentityRoleAsync`-equivalent role assignment and
`UserProfile` upsert outside the transaction.

### 6. Authorization: team scope via `IScopeAuthorizationService`
Register/Approve/Reject all resolve the `TeamPlayer.TeamId` for the target family member and
call `_scopeAuth.EnsureCreatorAsync(callerUserId, ScopeKinds.Team, teamId, ct)` — same
ownership bar as `ApproveClubJoinRequest` uses for `ScopeKinds.Club`, appropriate since
enabling/approving account access is a sensitive, creator-level action (not "any coach").
Commands implement `IRequireFeaturePermission` with
`FeatureRoute = CoachFeatureRoutes.Squad` (family members live under the player/squad area;
no dedicated route constant exists and none of the proposal's scope justifies adding a new
`CoachFeatureRoutes` entry) and `RequiredPermission = "ReadWrite"`.

### 7. Response shape / password never persisted
`RegisterFamilyMemberAccountCommand` response carries `Alias`, `Password` (plaintext, one-time),
`FamilyMemberName`, `PlayerName`, `RequestId`, `Status = "Pending"`. No column, cache, or log
ever stores the plaintext password — `IdentityUser.PasswordHash` is the only server-side
artifact, one-way per Identity/BCrypt. If the coach loses the value from the response, there is
no backend query to retrieve it again; documented for the frontend team to persist client-side
(e.g. component state / localStorage scoped to that player's card) if they want to re-display
it, and otherwise the family member must use the (separate, pre-existing) forgot-password flow
once one exists for this account, or the coach cancels the pending request and re-registers.

### 8. Reject/Cancel: single minimal command
One command, `RejectFamilyMemberAccountRequest` (mirrors `RejectClubJoinRequest`), covers both
"coach changed their mind before approval" and "coach declines" — no separate Cancel command
(unlike `ClubJoinRequest`, which distinguishes requester-initiated Cancel vs approver-initiated
Reject because two different parties can act; here only the coach ever acts on this request).
Calls `FamilyMemberAccountRequest.Reject(decidedByUserId)`, deletes the orphaned `IdentityUser`
best-effort (nothing else references it while Pending) so the alias/email become reusable for a
future registration attempt.

## Risks / Trade-offs

- [Coach loses the one-time password] → Documented trade-off (Decision 7); acceptable per
  confirmed spec.
- [Orphaned `IdentityUser` if reject-cleanup fails] → best-effort `try/catch` + log, consistent
  with every other best-effort step in `CreateUser.cs`/`ClubJoinRequestApprovalService`; a
  stray unlinked Identity user with no role is harmless (cannot log in to anything scoped).
- [Two outstanding registration attempts for the same family member] → Register command checks
  for an existing non-decided (`Pending`) `FamilyMemberAccountRequest` for the same
  `TeamPlayerFamilyMemberId` and returns `409 Conflict` (`FamilyMemberAccountRequestAlreadyPending`)
  instead of creating a second Identity user.
- [Family member already approved, coach re-registers] → Register command checks
  `TeamPlayerFamilyMember.LinkedUserId != null` first and returns `409 Conflict`
  (`FamilyMemberAccountAlreadyLinked`).

## Migration Plan

1. Add `FamilyMemberAccountRequest` entity + EF configuration (reflection-discovered
   `IEntityTypeConfiguration<FamilyMemberAccountRequest>`), add `LinkedUserId` nullable column
   to `TeamPlayerFamilyMember`, add both to `AppDbContext`.
2. Generate migration via `.\manage-migrations.ps1` (descriptive name, e.g.
   `AddFamilyMemberAccountRequest`).
3. No data backfill needed for the column/table addition itself (new nullable column, new
   table). A backfill *was* needed afterwards, though: family members who self-registered
   through the older, pre-existing `CreateUser.Handler` `IsFamilyMember` flow (PlayerLinkCode)
   already had a working account but no `LinkedUserId`, since that flow predates this column.
   See tasks.md §9 (`20260902112811_BackfillFamilyMemberLinkedUserId.cs`) for the guarded,
   idempotent cross-schema `UPDATE` that fixes their `RegistrationStatus` retroactively.
4. No rollback complexity beyond the standard `dotnet ef database update <previous>` — nothing
   downstream depends on the new column/table yet (frontend work is a separate, later change).
