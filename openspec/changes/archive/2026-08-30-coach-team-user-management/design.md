## Context

**How team/club membership is modeled today.** `UserTeam`
(`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/UserTeam.cs:6-18`) links an
`ApplicationUserId` to a `TeamId` with a `RoleId` (`Membership` SmartEnum:
`Directive=1, Coach=2, ClubMember=3, Player=4, FamilyPlayer=5, Follower=6`,
`Domain/Aggregates/UserClubs/Membership.cs:37-42`), an `IsCreator` flag, `JoinedAt`, and an
optional `LinkedTeamPlayerId` (set only for `Player`/`FamilyPlayer` rows via `LinkPlayer`,
`UserTeam.cs:67-78`). `UserClub` is the club-level equivalent. **`IsCreator` is literally "the
subscription owner"**: `ScopeAuthorizationService.EnsureSubscriptionActiveOrEvictAsync`
(`Features/Scopes/ScopeAuthorizationService.cs:237-277`) resolves the scope's billing owner via
`ResolveCreatorUserIdAsync` (`:279-316`), which walks `UserTeams`/`UserClubs` for the row with
`IsCreator == true` and joins that user id against `AppDbContext.Subscriptions`. There is no
separate "owner"/"billing contact" concept anywhere else in the codebase — `IsCreator` **is** the
answer to "who has the subscription."

**Existing member-management surface (and why it doesn't cover this ask).**
`Features/Scopes/Queries/GetScopeMembers.cs` and `Commands/RemoveScopeMember.cs` already list and
unlink `UserClub`/`UserTeam` rows for a scope, but:
1. `GetScopeMembers.Handle` (`:101`) calls `_scopeAuth.EnsureCreatorAsync` — **only the creator
   can view the list at all.** This backs the existing `Front/src/shared/pages/ScopeMembers`
   page, which is a seat/billing administration surface for the subscription owner, not a
   day-to-day roster tool for any coach.
2. `RemoveScopeMember.Handle` (`:94-130` / `:132-168`) only does `_db.UserClubs.Remove(link)` /
   `_db.UserTeams.Remove(link)` — it **unlinks one scope's row**, it does not touch the
   `IdentityUser` account, `UserProfile`, `PushToken` rows, or any other `UserClub`/`UserTeam`
   the same account holds elsewhere. A member removed this way keeps a working login and every
   other membership they had.

Neither fits "any coach can manage the team's user accounts, and deleting means the account is
actually gone." Both existing files are left untouched by this change (see proposal.md).

**Where account creation happens, for the reverse operation's shape.**
`Features/Coaches/Users/Commands/CreateUser.cs` creates the `IdentityUser`
(`UserManager<IdentityUser>.CreateAsync`, `:210-220`) and the `UserTeam`/`UserClub` row inside an
EF Core execution-strategy transaction on `AppDbContext` (`:225-265`), with Identity-only side
effects (role assignment, email) deliberately kept **outside** that transaction — the code
comment there (`:190-209`) explains why: `IdentityDbContext` and `AppDbContext` are separate
connections/DbContexts, so no real cross-context atomicity is achievable, and Npgsql's
retry-on-failure execution strategy is incompatible with an ambient `TransactionScope` spanning
both anyway. This change's delete path follows the same shape in reverse: an `AppDbContext`
transaction removes every `AppDbContext`-owned row for the target user, then the `IdentityUser`
delete happens as a best-effort step against `IdentityDbContext` afterward.

**What must stay untouched.** `TeamPlayer`
(`Domain/Entities/TeamPlayers/TeamPlayer.cs`) is a plain domain entity with no `ApplicationUserId`
foreign key — `UserTeam.LinkedTeamPlayerId` is the *only* link, and it lives on the row being
deleted, not on `TeamPlayer`. Ratings, convocations
(`Features/Coaches/Convocations/*`), and attendance
(`Domain/Entities/EventAttendanceConfirmation.cs`) key off `TeamPlayerId`, never
`ApplicationUserId`. Deleting the `UserTeam` row and the `IdentityUser` account therefore cannot
cascade into any of that data — there is nothing to explicitly guard, only things to *not touch*.

## Goals / Non-Goals

**Goals:**
- Let any coach/director with team access (`EnsureMemberAsync`-level, per
  `ScopeAuthorizationService.cs:131-207`) list every user account linked to their team — family,
  players, other coaches/directors.
- Let that same caller delete a Family/Player/ClubMember/Follower account outright.
- Restrict deleting a **Coach or Directive** account to the scope's creator
  (`EnsureCreatorAsync`, `:46-129`) — the subscription owner.
- Deleting an account removes the `IdentityUser` and **all** `UserTeam`/`UserClub` rows it holds
  (any team/club, not just the one the caller is viewing), plus best-effort `UserProfile`/
  `PushToken` cleanup, while leaving `Player`, `TeamPlayer`, ratings, convocations, and attendance
  records completely intact.
- Block deleting the scope's own creator and block self-deletion, mirroring
  `RemoveScopeMember.cs`'s existing guards.

**Non-Goals:**
- Not changing `GetScopeMembers`/`RemoveScopeMember` or the `Front/src/shared/pages/ScopeMembers`
  billing/seat-administration surface — that stays creator-only and stays a soft unlink.
- Not adding a new "owner" concept — `IsCreator`/`EnsureCreatorAsync` already is that concept and
  is reused as-is.
- Not soft-deleting or archiving the account (`ApplicationUser` has no `IsDeleted`/logic-delete
  column anywhere in the codebase today) — this is a hard delete of the Identity row, matching
  the proposal's explicit ask for an unambiguous "the account is gone" action.
- Not touching `ClubJoinRequest`/`TeamPlayerLinkRequest` rows raised *by* the deleted user other
  than leaving them as harmless orphaned history (no FK constraint references
  `ApplicationUserId` there with cascade delete) — out of scope, flagged in Risks.

## Decisions

### 1. Two new files under `Features/Coaches/Users/`, not a modification of `Features/Scopes/`
**Decision**: Add `Features/Coaches/Users/Queries/GetTeamUsers.cs` (list) and
`Features/Coaches/Users/Commands/DeleteTeamUserAccount.cs` (delete), both new `IFeatureModule`s,
reusing `IScopeAuthorizationService` (already registered for DI, `Features/Scopes/`) rather than
duplicating its `EnsureMemberAsync`/`EnsureCreatorAsync`/`EnsureSubscriptionActiveOrEvictAsync`
logic.
**Why**: `GetScopeMembers`/`RemoveScopeMember` are intentionally creator-gated for billing/seat
management (see Context) — loosening their authorization would silently widen who can see the
existing `ScopeMembers` billing page, which front-specialist has not asked for and which is a
different capability with different stakes. A parallel, purpose-built pair of endpoints keeps
each feature's authorization exactly as tight as its actual purpose requires, matching the
one-feature-one-file vertical-slice convention and the precedent set by
`EnterClubTeamAsCoach.cs` choosing not to reuse `ValidateTeamJoinCode.cs` for the same reason
(see `openspec/changes/archive/2026-08-28-coach-club-code-team-entry/design.md` Decision 1).
**Alternative considered**: Add an `EnsureMemberAsync` branch to `GetScopeMembers` gated by a new
query flag. Rejected — would mean two authorization tiers live in one handler for two genuinely
different UI surfaces (billing/seat admin vs. day-to-day roster management), harder to reason
about and easy to regress later.

### 2. Delete = remove every `UserTeam`/`UserClub` row for the account, then delete the `IdentityUser`
**Decision**: `DeleteTeamUserAccountHandler`:
1. Loads the target `UserTeam` by `membershipId` (the route parameter, same shape as
   `RemoveScopeMember`'s `{membershipId}`).
2. Guards: `404` if not found; `400` if `callerUserId == target.ApplicationUserId` (no
   self-delete); `400` if `target.IsCreator` (cannot delete the scope's creator this way).
3. Authorization: if `target.RoleId` is `Membership.Coach.Id` or `Membership.Directive.Id`, call
   `EnsureCreatorAsync(callerUserId, ScopeKinds.Team, target.TeamId, ...)`; otherwise call
   `EnsureMemberAsync(callerUserId, ScopeKinds.Team, target.TeamId, ...)`. Both return `403` on
   failure, `404` if the team itself vanished mid-request.
4. `EnsureSubscriptionActiveOrEvictAsync(auth.Scope!, ...)` — same eviction check
   `RemoveScopeMember`/`GetScopeMembers` already run; `402` if inactive (and, per its existing
   behavior, this call itself evicts all non-creator members as a side effect **before** this
   handler's own delete logic runs — acceptable, matches existing semantics exactly).
5. In one `AppDbContext` execution-strategy transaction (`CreateExecutionStrategy` +
   `BeginTransactionAsync`, mirroring `CreateUser.cs:225-265`): remove **all**
   `_db.UserTeams.Where(ut => ut.ApplicationUserId == target.ApplicationUserId)` and
   `_db.UserClubs.Where(uc => uc.ApplicationUserId == target.ApplicationUserId)` rows (not just
   the one team being viewed — the account is being deleted everywhere), remove the matching
   `UserProfile` row if present, remove matching `PushToken` rows if present, `SaveChangesAsync`,
   commit.
6. Outside that transaction, best-effort: `UserManager<IdentityUser>.FindByIdAsync` +
   `DeleteAsync`. Log a warning (do not fail the request) if this step errors — the account's
   team/club access is already fully revoked by step 5 regardless, which is the security-relevant
   outcome; a stray `IdentityUser` row with no memberships left is a cleanup nit, not a breach.
7. Returns `204 No Content`.
**Why**: "Delete the account" (proposal.md) means the whole account, not just this one team's
link — a Family/Player account is not expected to hold multiple team memberships in practice, but
a Coach/Directive plausibly could (multiple clubs), and leaving orphaned `UserTeam`/`UserClub`
rows elsewhere after "deleting" someone would be a confusing half-measure. Cross-`DbContext`
ordering (App rows first, Identity row second, Identity best-effort) mirrors the already-reviewed
rationale in `CreateUser.cs` for why a real distributed transaction isn't achievable here.
**Alternative considered**: Only remove the one `UserTeam` row being viewed (like
`RemoveScopeMember`), leave the `IdentityUser` and other memberships alone. Rejected — this is
exactly the existing `RemoveScopeMember` behavior the proposal explicitly says is insufficient
("a removed member can still log in").

### 3. `GetTeamUsers` reuses `GetScopeMembers`'s response shape, scoped to `EnsureMemberAsync`
**Decision**: `GetTeamUsersHandler` takes `teamId` (query param), authorizes via
`EnsureMemberAsync(callerUserId, ScopeKinds.Team, teamId, ...)`, then
`EnsureSubscriptionActiveOrEvictAsync`, then queries `_db.UserTeams.Where(ut => ut.TeamId ==
teamId).Include(ut => ut.Membership)` and builds the same `{ MembershipId, UserId, Alias, Email,
MembershipKind, JoinedAt, IsCreator }` shape `GetScopeMembers` already uses (via the same
`UserManager.FindByIdAsync` alias/email lookup pattern,
`GetScopeMembers.cs:149-160`/`162-181`), plus one new top-level field: `CallerIsCreator: bool` —
computed once via the same `auth.Scope` the `EnsureMemberAsync` call already resolved, by an
additional `EnsureCreatorAsync` probe. This tells the frontend, without a second round trip,
whether to offer "delete" on Coach/Directive rows for *this* caller.
**Why**: Reusing the field names/shape `GetScopeMembers` already established means front-specialist
does not need to learn a second DTO convention, while still keeping this a fully separate,
club-vs-team-scoped, member-vs-creator-gated endpoint per Decision 1.
**Alternative considered**: Have the frontend infer `callerIsCreator` itself from a separate "am I
creator" endpoint. Rejected as an unnecessary extra round trip for a boolean the backend already
computes as part of authorization.

### 4. Membership kinds counted as "another coach" for the creator-only restriction
**Decision**: `Membership.Coach.Id` and `Membership.Directive.Id` both require
`EnsureCreatorAsync`; `ClubMember`, `Player`, `FamilyPlayer`, `Follower` only require
`EnsureMemberAsync`.
**Why**: Every existing "is this a coach-tier user" check in the codebase
(`TeamEditAuthorization.CanEditAsync:18`, `ClubInvitationCodeVisibility.cs:24`,
`EnterClubTeamAsCoach.cs:88`, `GetTeams.cs:75`) treats `Coach` and `Directive` as the same
management tier (`RoleId == Coach.Id || RoleId == Directive.Id`). Matching that existing
convention rather than inventing a narrower "only literal Coach rows are protected" rule avoids a
surprising asymmetry with how the rest of the app already reasons about "who can manage a team."

### 5. New page + route: `/coach/team-users`, not a tab on an existing page
**Decision**: Add `Front/src/apps/coach/pages/team-users/TeamUsers.tsx` as its own lazy-loaded
route (`GET`-backed list + `DELETE`-backed removal in one page, no tabs), registered in
`apps/coach/routes.tsx` as `<Route path="team-users" element={<TeamUsers />} />`, reading
`teamId` from the query string the same way `TeamDashboard`/`Squad`/`Attendance` already do
(`?teamId=...`, resolved via the existing `useTeamAndClub()` hook pattern already used by
`TeamDashboard.tsx`).
**Why**: The user explicitly asked for "una página independiente, no una tab dentro de otra
página existente" (see task framing). Every other team-scoped Coach page (`Squad`, `Attendance`,
`Trainings`, `Injured`, `GameModel`, `TeamRules`, `Sanctions`) already follows exactly this
"own route + `?teamId=` query param" shape — `TeamUsers` matches that convention rather than
inventing a nested-route or tab pattern nothing else in `apps/coach/pages/` uses.
**Alternative considered**: A tab inside `Settings.tsx`. Rejected per the explicit "independent
page" requirement, and because `Settings` is gated by `COACH_FEATURE_ROUTES.Settings`
(role/permission-scoped) while this page must be open to *any* team member per Decision 6 below —
folding it into `Settings` would incorrectly inherit `Settings`'s narrower gate.

### 6. Entry point: new `DashboardCard` on `TeamDashboardCards.tsx`, gated by `!isPlayer` (not a new `COACH_FEATURE_ROUTES` entry)
**Decision**: Add one more `DashboardCard` (title "Gestión de usuarios", icon
`PeopleAltIcon` or `ManageAccountsIcon` from `@mui/icons-material`) to
`Front/src/apps/coach/pages/team-dashboard/TeamDashboardCards.tsx`, linking to
`` `/coach/team-users?teamId=${team.id}` `` when `team?.id` is set. Visibility is gated by the
`isPlayer` prop the component already receives (currently unused — see
`TeamDashboardCardsProps.isPlayer` at `TeamDashboardCards.tsx:21`), i.e. `{!isPlayer && (...)}`,
the exact same guard `DashboardCards.tsx` already uses for its "Configuración" card
(`!isPlayer && hasFeatureAccess(COACH_FEATURE_ROUTES.Settings) && (...)`) — minus the
`hasFeatureAccess` check.
**Why not `hasFeatureAccess(COACH_FEATURE_ROUTES.X)`**: every other card on this page is gated by
`usePermissions().hasFeatureAccess(COACH_FEATURE_ROUTES.<Route>)`, which requires the backend to
have seeded a matching `FeaturePermission` row keyed to a `featureRoute` string defined in
`Back/ExtractionApi/.../Domain/Entities/CoachFeatureRoutes.cs` (see
`Front/src/shared/hooks/usePermissions.ts:14-18`). This backend change's authorization is
`IScopeAuthorizationService.EnsureMemberAsync`/`EnsureCreatorAsync` — a completely different,
already-implemented and already-shipped authorization path that has **no** corresponding
`CoachFeatureRoutes` entry or seeded `FeaturePermission` rows, and adding one is out of scope for
a frontend-only revision of an already-verified backend change. Gating the card behind a
non-existent feature route would silently hide it for every user (including Administrators would
still see it via the `roles.includes("Administrator")` bypass, but no real coach would). `isPlayer`
already means "not a Player/FamilyPlayer/FamilyMember role, i.e. some coach/director/staff tier"
(`usePlayerAutoLoad.ts:16-22`) and every user who reaches `TeamDashboard` at all already holds a
`UserTeam`/`UserClub` on that team (`EnsureMemberAsync`'s own precondition) — so `!isPlayer` is a
correct, already-available proxy for "this caller can at least call `GET`"; the backend remains
the actual authority (`403`/`400` on `DELETE` for creator/coach-tier targets is enforced
server-side regardless of what the frontend shows).
**Alternative considered**: Add a new `COACH_FEATURE_ROUTES.TeamUserManagement` entry now and ask
back-specialist to seed a matching `FeaturePermission`/`CoachFeatureRoutes` row in a follow-up.
Rejected for this revision — it would reopen and extend an already-verified, already-archived-
adjacent backend change's authorization model for a UI-only concern; flagged as a documented
follow-up in Open Questions instead, not blocking this page from shipping with the coarser
`!isPlayer` gate (which is materially correct today: only coach/director/staff-tier users see the
card, and the backend enforces the real per-row rules regardless).

### 7. `teamUsersService.ts` reuses the shared `MembershipKind` type, follows the plain-function-export pattern
**Decision**: `Front/src/apps/coach/services/teamUsersService.ts` exports two async functions,
`getTeamUsers(teamId: string): Promise<GetTeamUsersResponse>` (`GET /api/coaches/team-users`)
and `deleteTeamUserAccount(membershipId: string): Promise<void>`
(`DELETE /api/coaches/team-users/{membershipId}`), calling the single shared Axios instance
(`../../../core/api/client`) — same shape as `apps/coach/services/teamService.ts`,
`membershipService.ts` (plain exported functions + a default object export, not a class
instance like `shared/services/scopes/scopesApi.ts`). The response types (`TeamUserDto`,
`GetTeamUsersResponse`) are declared in the service file itself, reusing the existing
`MembershipKind` string-union type already exported from `Front/src/shared/types/scope.ts`
(`"Coach" | "Directive" | "ClubMember" | "Player" | "FamilyPlayer" | "Follower"`) rather than
`apps/coach/types/MembershipRole.ts`'s numeric enum, since the API's `membershipKind` field is
the string `Membership.Key`, not the numeric id.
**Why**: `apps/coach/services/*.ts` consistently uses plain function exports (`teamService.ts`,
`membershipService.ts`) — `scopesApi`'s class-instance pattern is specific to
`shared/services/scopes/` and not the Coach-app convention. `MembershipKind` is already the
correct shared shape for a string-keyed membership kind (`ScopeMembers.tsx` already renders it
via `KIND_COLORS: Record<MembershipKind, ...>`); redefining an equivalent type locally would
duplicate it for no reason since it is a genuinely cross-cutting domain concept (not an
app-specific one), unlike the page/service files themselves which stay Coach-only per
`.claude/rules/frontend-architecture.md` §2 ("no shared package without the user asking" — this
is a single type import from `shared/types/`, already an accepted exception, not a new package).

## Risks / Trade-offs

- **[Risk]** A deleted user's pending `ClubJoinRequest`/`TeamPlayerLinkRequest` rows (if any) are
  left as orphaned history referencing a now-nonexistent `ApplicationUserId`. → **Accepted**: no
  code path reads those rows by joining back to a live `IdentityUser` in a way that would break
  (`ApproveClubJoinRequest.cs` etc. already tolerate a missing user via `UserManager.FindByIdAsync`
  returning `null`); cleaning them up is a nice-to-have, not flagged as required by the proposal.
- **[Risk]** Step 6 (Identity delete) can fail independently of step 5 (App rows removed), leaving
  a `IdentityUser` with zero memberships that can still log in but reach an empty dashboard. →
  **Mitigation**: logged as a warning (matches `CreateUser.cs`'s existing best-effort pattern for
  cross-context Identity operations); the security-relevant effect (no more team/club access) is
  already guaranteed by step 5 succeeding inside its own transaction.
- **[Trade-off]** `EnsureSubscriptionActiveOrEvictAsync` can evict *other* non-creator members as
  a side effect of an inactive subscription before this handler's own delete runs (existing,
  unmodified behavior inherited from `RemoveScopeMember`/`GetScopeMembers`). → **Accepted**:
  identical to today's behavior for the existing endpoints; not a new risk introduced by this
  change.

## API Contract (for front-specialist)

```
GET /api/coaches/team-users?teamId={teamId}
Authorization: Bearer <jwt>

200 OK
{
  "teamId": "...",
  "callerIsCreator": true,
  "users": [
    {
      "membershipId": "...",       // UserTeam.Id — pass to DELETE below
      "userId": "...",
      "alias": "...",
      "email": "...",
      "membershipKind": "Coach",   // Membership.Key: Directive | Coach | ClubMember | Player | FamilyPlayer | Follower
      "joinedAt": "2026-01-15T10:00:00Z",
      "isCreator": false,
      "isSelf": false              // true when userId == caller's id
    }
  ]
}

400 Bad Request   — teamId missing/malformed.
402 Payment Required — ProblemDetails, scope's subscription inactive (members evicted as a side effect).
403 Forbidden     — ProblemDetails, caller has no UserTeam/UserClub access to this team.
404 Not Found     — ProblemDetails, team does not exist.
401 Unauthorized  — not authenticated (standard pipeline behavior).
```

```
DELETE /api/coaches/team-users/{membershipId}
Authorization: Bearer <jwt>

204 No Content
  — target's IdentityUser account deleted, along with every UserTeam/UserClub row it held,
    its UserProfile and PushToken rows. Player/TeamPlayer domain data untouched.

400 Bad Request
  ProblemDetails — membershipId missing/malformed, OR caller attempted to delete themselves,
  OR target is the scope's creator ("No es posible eliminar al creador del espacio.").

402 Payment Required — ProblemDetails, scope's subscription inactive.

403 Forbidden
  ProblemDetails — caller lacks the required tier: not a team/club member at all, OR target's
  membershipKind is Coach/Directive and caller is not the scope's creator
  ("Solo el creador del espacio puede eliminar a otro entrenador.").

404 Not Found — ProblemDetails, no UserTeam with that membershipId.
401 Unauthorized — not authenticated.
```

The frontend "Gestión de usuarios" page (`TeamUsers.tsx`, Decision 5) calls `GET` to render the list (using
`callerIsCreator` + each row's `membershipKind`/`isCreator`/`isSelf` to decide whether to show a
delete button per row — self and creator rows never get one; Coach/Directive rows only get one
when `callerIsCreator === true`), then `DELETE` with a confirmation dialog before calling it
(confirmation itself is a frontend concern per the proposal — the backend endpoint executes
immediately on a valid, authorized call, no server-side confirmation step).

## Migration Plan

No database schema change — reuses `UserTeam`, `UserClub`, `UserProfile`, `PushToken`, and
Identity tables as they exist today.
1. **Backend** (implemented and verified first, this change, back-specialist):
   `Features/Coaches/Users/Queries/GetTeamUsers.cs` and
   `Features/Coaches/Users/Commands/DeleteTeamUserAccount.cs` per the contract above, with xUnit
   tests per tasks.md §1-3.
2. **Frontend** (this change, front-specialist, tasks.md §4): `TeamUsers.tsx` page,
   `teamUsersService.ts`, the `TeamDashboardCards.tsx` entry point, and the `routes.tsx`
   registration, built against the contract above — TDD per `.claude/rules/frontend-testing.md`
   (Vitest + Testing Library, Red → Green → Refactor).
3. Backend ships independent of frontend readiness — both endpoints are inert (unused) until the
   frontend calls them, no risk of a broken intermediate state; frontend work in §4 can start only
   once backend tasks (§1-3) are green, since the page is built directly against the live
   contract, not a mock.
4. Run `dotnet test`/`dotnet build` for backend and `npm run test`/`npm run build` for frontend
   before marking tasks complete.

## Open Questions

- Should `Follower`/`ClubMember` rows even appear on a **team**-scoped user-management page (they
  are typically club-level memberships, not team-level)? This design lists whatever `UserTeam`
  rows exist for the team regardless of kind, since `UserTeam.RoleId` can technically be any
  `Membership` value and the proposal says "family, players, and other coaches" without excluding
  other kinds that happen to hold a team-level row. The frontend (Decision 5-7, tasks.md §4)
  renders whatever kinds the `GET` response contains, unfiltered — confirm with the user post-ship
  if `Follower`/`ClubMember` rows on a team page turn out to be noise in practice.
- Decision 6 gates the new dashboard card with the coarser `!isPlayer` check instead of a new
  `COACH_FEATURE_ROUTES` entry, because no backend `CoachFeatureRoutes`/`FeaturePermission` seed
  exists for this capability. If finer-grained, per-role visibility of the card itself (as opposed
  to the already-enforced per-row `DELETE` rules) is wanted later, that requires a follow-up
  backend change to seed a matching feature route — flagged here, not blocking this revision.
