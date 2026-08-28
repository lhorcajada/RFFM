## Why

A Coach who registers with a **club invitation code** (not a team invitation code) ends up, once
the club approves the request, with a `UserClub` row only (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/ClubJoinRequests/Commands/ApproveClubJoinRequest.cs:130-133`
adds `new UserClub(joinRequest.ApplicationUserId, joinRequest.ClubId, joinRequest.MembershipId)`
and nothing else) — never a `UserTeam`. This grants club-wide management rights
(`TeamEditAuthorization.CanEditAsync` already treats any `UserClub` with `RoleId ==
Membership.Coach.Id` as able to edit every team in that club), but leaves no *specific* team
selected for that coach to land on.

When this coach logs in and clicks "Mi equipo" on the `AppSelector`
(`Front/src/shared/pages/AppSelector/AppSelector.tsx:113-119`), the flow checks
`coachAuthService.hasRole("Coach")`, finds it true, and opens `ChangeRoleDialog`. Choosing
"Continuar" (`useTeamAppEntry.ts:37-40`, `handleKeepRole`) navigates straight to
`/coach/dashboard` with no `teamId` and no assumption checked. `CoachDashboard`
(`Front/src/apps/coach/pages/Dashboard/Dashboard.tsx`) does try to resolve a team via
`configurationCoachService` (`preferredTeamId`), but nothing ever wrote that preference for this
coach — the approval flow above never touches `ConfigurationCoach`. The coach lands on a
dashboard with no team context and no way, from this entry point, to say "let me use the team
whose code my club gave me." `useTeamAppEntry.ts`'s only code-entry branches
(`selectedUserType === "ClubMember"` for a club code, or `"Player"/"FamilyMember"/"Fan"` for a
team code reached via `UserTypeDialog`) are for *first-time* onboarding, not for a coach who
already has a role and club access and just needs to pick a team inside it — that case falls
through to the generic "¿Cómo vas a utilizar la aplicación?" role picker or the dead-end
dashboard, never a team-code prompt.

## What Changes

- Add a new, explicit "enter a team by code" step for an already-authenticated Coach who has
  club-level access (`UserClub` with `RoleId == Coach`) but no team context yet: when
  `ChangeRoleDialog`'s "Continuar" is chosen and the coach has no `preferredTeamId` configured,
  show `CodeInputDialog` (reused, new `"CoachClubTeam"` variant) asking for the **team code**
  instead of silently navigating to an empty dashboard.
- Add a new backend endpoint that, given a team join code and the caller's identity, validates
  the team belongs to a club the caller already has Coach/Directive-level `UserClub` access to,
  and — on success — persists that team as the coach's `ConfigurationCoach.PreferredTeamId` (no
  new `UserTeam` row; club-level access already grants edit rights per
  `TeamEditAuthorization.CanEditAsync`, see design.md Decision 2). Returns `{ teamId, teamName }`
  so the frontend can navigate straight to `/coach/team-dashboard?teamId=...` / `/coach/dashboard?teamId=...`.
- Reject codes for teams outside the caller's club(s) with `403 Forbidden`, and unknown codes
  with `404 Not Found` — mirroring the existing `ValidateTeamCode`/`ValidateTeamJoinCode`
  response shapes/status codes already used by sibling flows.
- No change to Player/FamilyMember/ClubMember onboarding, no change to `TeamEditAuthorization`,
  no change to how a coach who registers *without* a club code (the free-trial, self-service
  path) behaves — that coach already creates their own club/team and is unaffected.

## Capabilities

### New Capabilities
- `coach-club-team-entry` — lets a Coach who already has club-level (`UserClub`) access enter a
  specific team of that club by team code, from both the registration-approval aftermath and any
  later re-entry where no team is currently preferred.

### Modified Capabilities
- None. No existing `openspec/specs/<name>/spec.md` documents this entry flow today.

## Impact

- **Affected code (frontend)**:
  `Front/src/shared/pages/AppSelector/hooks/useTeamAppEntry.ts` (new dialog-config branch, new
  handler wired to the new endpoint), `Front/src/shared/pages/AppSelector/AppSelector.tsx` (no
  structural change expected — `ChangeRoleDialog`'s existing `onKeep`/`handleKeepRole` wiring is
  what changes), `Front/src/apps/coach/services/teamService.ts` (new
  `enterClubTeamByCode(code)` function + response type).
- **Affected code (backend)**: new feature file under
  `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Invitation/Commands/` (e.g.
  `EnterClubTeamAsCoach.cs`), following the existing `ValidateTeamJoinCode.cs` vertical-slice
  pattern in the same folder. Reads `AppDbContext.Teams`/`UserClubs`, writes
  `AppDbContext.Set<ConfigurationCoach>()` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Settings/ConfigurationCoach.cs`
  already owns that entity's CRUD; this change adds a second, narrower write path to the same
  table from a different feature — see design.md Decision 3 for why that's acceptable here).
- **Backend needed**: **Yes.** This proposal requires a new backend endpoint (see above) — flag
  for coordination with back-specialist before implementation starts. The frontend cannot safely
  self-serve club/team ownership validation; it must be enforced server-side.
- **API contract**: new endpoint, additive only. No existing endpoint's request/response shape
  changes.
- **Tests**: new xUnit tests for the backend handler (club match / club mismatch / unknown code /
  success path), new Vitest tests for the new `useTeamAppEntry` branch and `CodeInputDialog`
  reuse (loading/error/success), and a regression test asserting the existing
  Player/FamilyMember/ClubMember code-entry branches are unaffected.
- **No database migration required** — `ConfigurationCoach` already exists and already allows an
  unvalidated `PreferredTeamId` write via its own CRUD endpoints; this change only adds a second,
  *validated* way to set it.
