## Why

A Coach has no way to see or remove the user accounts attached to their team. Family members,
players, and other coaches accumulate `UserTeam` rows over a season with no admin surface to
audit or clean them up — the only existing viewer,
`Back/ExtractionApi/src/RFFM.Api/Features/Scopes/Queries/GetScopeMembers.cs:101`, is gated by
`EnsureCreatorAsync` (subscription-owner only) and its sibling deletion endpoint,
`RemoveScopeMember.cs`, only unlinks a `UserTeam`/`UserClub` row — it never touches the
`IdentityUser` account itself, so a removed member can still log in and (if re-invited) reappear.
The Coach dashboard needs a "Gestión de usuarios" page any coach on the team can open, and a real
account-deletion endpoint the frontend can call with confidence that a player's domain data
(the `Player`/`TeamPlayer` record, attendances, convocations) is untouched.

## What Changes

- New backend capability: list every user account linked to a team (family, players, other
  coaches) and let an authorized caller delete one **account** — not just its team link.
- New `GET` endpoint scoped to `EnsureMemberAsync`-level access (any coach/director with a
  `UserClub`/`UserTeam` on the team) — broader than `GetScopeMembers`'s creator-only gate, because
  this is routine roster management, not seat/billing administration.
- New `DELETE` endpoint that removes the target's **`IdentityUser` account** plus every
  `UserClub`/`UserTeam` row it holds anywhere (not just this team), and best-effort cleans up
  `UserProfile`/`PushToken` rows for that user id — while leaving `Player`, `TeamPlayer`,
  ratings, convocations, and attendance records completely intact (see design.md Decision 2).
- Permission split: any team member (coach/director) can delete a Family/Player/ClubMember
  account; only the scope's **creator** (`IsCreator == true`, the subscription owner per
  `ScopeAuthorizationService.EnsureSubscriptionActiveOrEvictAsync`) can delete **another coach or
  director**. The creator's own account can never be deleted through this endpoint (mirrors
  `RemoveScopeMember.cs:106-113`'s existing "cannot unlink a creator" guard). No self-deletion.
- No change to `GetScopeMembers`/`RemoveScopeMember` (the creator-only seat/billing viewer stays
  as-is) and no change to `Player`/`TeamPlayer` domain entities.

## Capabilities

### New Capabilities
- `coach-team-user-management`: lets any coach/director on a team list the team's linked user
  accounts (family, players, other coaches) and delete an account outright, subject to the
  creator-only restriction for deleting another coach/director, without affecting the underlying
  player domain data.

### Modified Capabilities
- None. `GetScopeMembers`/`RemoveScopeMember` behavior is unchanged; this is an additive, parallel
  feature under a different route.

## Impact

- **Affected code (backend)**: new files under
  `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Users/` (e.g. `Queries/GetTeamUsers.cs`,
  `Commands/DeleteTeamUserAccount.cs`), reusing `IScopeAuthorizationService`
  (`Features/Scopes/ScopeAuthorizationService.cs`) for `EnsureMemberAsync`/`EnsureCreatorAsync`
  checks, `AppDbContext` (`UserTeams`, `UserClubs`, `UserProfiles`, `PushTokens`), and
  `UserManager<IdentityUser>`/`IdentityDbContext` for the actual account delete.
- **Affected code (frontend)**: new files under `Front/src/apps/coach/` — a "Gestión de
  usuarios" page (`pages/team-users/TeamUsers.tsx`), a `services/teamUsersService.ts` consuming
  the contract below, and one new `DashboardCard` entry point on the per-team dashboard
  (`pages/team-dashboard/TeamDashboardCards.tsx`), plus a new route in
  `apps/coach/routes.tsx`. See design.md Decisions 5-7 for the frontend-specific choices
  (routing, entry point, permission gating).
- **Backend needed**: Yes — backend was implemented and verified first; this change now also
  covers the frontend consumer of that contract (added in this revision, same change).
- **API contract**: two new, additive endpoints (see design.md). No existing endpoint's
  request/response shape changes.
- **Tests**: new xUnit handler tests (list authorization, delete authorization split
  coach-vs-non-coach target, self-delete block, creator-target block, full account teardown
  including cross-team `UserClub`/`UserTeam` rows, `Player`/`TeamPlayer` untouched) per
  `.claude/rules/dotnet.md`/`.claude/rules/testing.md` TDD conventions.
- **No database migration required** — reuses existing `UserTeam`, `UserClub`, `UserProfile`,
  `PushToken`, and Identity tables as-is.
