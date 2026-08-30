# coach-team-user-management Specification

## Purpose
TBD - created by archiving change coach-team-user-management. Update Purpose after archive.
## Requirements
### Requirement: List team user accounts
The system SHALL allow any authenticated caller with `UserTeam`/`UserClub` access to a team
(any `Membership` kind, per `IScopeAuthorizationService.EnsureMemberAsync`) to list every user
linked to that team — both `UserTeam` rows for the team itself and club-level `UserClub` rows
for the team's parent club that have no matching `UserTeam` (e.g. a coach who joined via club
invitation code) — via `GET /api/coaches/team-users?teamId={teamId}`, returning each account's
membership id, user id, alias, email, membership kind, join date (`null` for club-level-only
members), whether it is the scope creator, whether it is the caller's own account, whether the
account is admin-approved (`IdentityUser.EmailConfirmed`), and the full name of the linked
player when the account is a `Player`/`FamilyPlayer` with a `LinkedTeamPlayerId`; plus the
team's name and a `callerIsCreator` flag. The returned list is ordered by role (Coach, Directive,
ClubMember, Player, FamilyPlayer, Follower) and, within `FamilyPlayer`, alphabetically by the
linked player's full name.

#### Scenario: Coach with team access lists team users
- **WHEN** an authenticated coach who holds a `UserTeam` (or a `UserClub` on the team's club)
  calls `GET /api/coaches/team-users?teamId={teamId}` for that team
- **THEN** the system returns `200 OK` with every `UserTeam` row for that team, including
  family members, players, and other coaches/directors

#### Scenario: Club-level coach without a team-specific membership still appears
- **WHEN** a coach has only a `UserClub` row on the team's parent club (no `UserTeam` for this
  specific team) — e.g. a coach who joined via club invitation code
- **THEN** that coach appears in the response for every team of that club, for any caller
  (including the team's own creator), with `membershipId` set to the `UserClub`'s id

#### Scenario: Results are grouped by role and, within family members, by linked player
- **WHEN** the response is built
- **THEN** users appear ordered by `membershipKind` (Coach, Directive, ClubMember, Player,
  FamilyPlayer, Follower) and, among `FamilyPlayer` entries, alphabetically by
  `linkedPlayerFullName`

#### Scenario: Caller has no access to the team
- **WHEN** an authenticated caller with no `UserTeam`/`UserClub` row for the given team calls
  `GET /api/coaches/team-users?teamId={teamId}`
- **THEN** the system returns `403 Forbidden`

#### Scenario: Team does not exist
- **WHEN** the caller supplies a `teamId` for which no `Team` exists
- **THEN** the system returns `404 Not Found`

#### Scenario: Subscription inactive
- **WHEN** the scope's creator has no active `Subscription`
- **THEN** the system returns `402 Payment Required` and evicts non-creator members as an
  existing, unchanged side effect of `EnsureSubscriptionActiveOrEvictAsync`

### Requirement: Delete a team user's account
The system SHALL allow deleting a team member's user **account** (the `IdentityUser`, plus
every `UserTeam`/`UserClub` row it holds anywhere, plus its `UserProfile`/`PushToken` rows) via
`DELETE /api/coaches/team-users/{membershipId}`, without modifying `Player`, `TeamPlayer`,
rating, convocation, or attendance data.

#### Scenario: Any team member can delete a Family/Player/ClubMember/Follower account
- **WHEN** an authenticated caller with `UserTeam`/`UserClub` access to the target's team calls
  `DELETE /api/coaches/team-users/{membershipId}` for a target whose `membershipKind` is
  `FamilyPlayer`, `Player`, `ClubMember`, or `Follower`
- **THEN** the system deletes the target's `IdentityUser` account and all its
  `UserTeam`/`UserClub` rows, and returns `204 No Content`

#### Scenario: Only the scope creator can delete another coach or director
- **WHEN** a non-creator caller with team access calls
  `DELETE /api/coaches/team-users/{membershipId}` for a target whose `membershipKind` is
  `Coach` or `Directive`
- **THEN** the system returns `403 Forbidden` and does not delete the account

#### Scenario: Scope creator deletes another coach or director
- **WHEN** the scope's creator (`IsCreator == true`) calls
  `DELETE /api/coaches/team-users/{membershipId}` for a target whose `membershipKind` is
  `Coach` or `Directive`
- **THEN** the system deletes the target's account and returns `204 No Content`

#### Scenario: Caller cannot delete themselves
- **WHEN** the caller's own `userId` matches the target membership's `userId`
- **THEN** the system returns `400 Bad Request` and does not delete the account

#### Scenario: Scope creator's own account cannot be deleted through this endpoint
- **WHEN** the target membership has `isCreator == true`
- **THEN** the system returns `400 Bad Request` and does not delete the account

#### Scenario: Deleting an account preserves the linked player's domain data
- **WHEN** a `Player`/`FamilyPlayer` account with a `LinkedTeamPlayerId` is deleted
- **THEN** the corresponding `TeamPlayer` record, its ratings, convocations, and attendance
  records remain unchanged and queryable exactly as before the deletion

#### Scenario: Membership id not found
- **WHEN** `membershipId` does not match any existing `UserTeam` or `UserClub` row
- **THEN** the system returns `404 Not Found`

#### Scenario: Subscription inactive
- **WHEN** the scope's creator has no active `Subscription`
- **THEN** the system returns `402 Payment Required` and does not delete the account

#### Scenario: A club-level-only target can also be deleted
- **WHEN** `membershipId` matches a `UserClub` row with no corresponding `UserTeam` (a
  club-level-only member)
- **THEN** the system applies the same self/creator/coach-tier rules against the club scope and,
  if authorized, deletes the account exactly as it would for a team-level target

### Requirement: Approve or revoke approval of a team user's account at any time
The system SHALL allow toggling a team member's admin-approval status
(`IdentityUser.EmailConfirmed`) at any time via `PUT /api/coaches/team-users/{membershipId}/approval`
with body `{ approved: bool }`, using the same target-resolution (`UserTeam` or `UserClub`) and
authorization rules as account deletion (creator-only for `Coach`/`Directive` targets, any member
for other roles), except that the scope creator restriction does not apply to the target's
`IsCreator` flag (only self-targeting is blocked).

#### Scenario: Any team member can approve or revoke a Family/Player/ClubMember/Follower account
- **WHEN** an authenticated caller with team access calls the approval endpoint for a target
  whose `membershipKind` is not `Coach`/`Directive`
- **THEN** the system updates `EmailConfirmed` to the requested value and returns `204 No Content`

#### Scenario: Only the scope creator can approve or revoke another coach or director
- **WHEN** a non-creator caller calls the approval endpoint for a target whose `membershipKind`
  is `Coach` or `Directive`
- **THEN** the system returns `403 Forbidden` and does not change `EmailConfirmed`

#### Scenario: Caller cannot change their own approval status
- **WHEN** the caller's own `userId` matches the target membership's `userId`
- **THEN** the system returns `400 Bad Request`

#### Scenario: Frontend shows only the action matching the current state
- **WHEN** the "Gestión de usuarios" page renders a user card
- **THEN** it shows a "Desaprobar" action when the account is approved, or an "Aprobar" action
  when it is pending — never both — and no action at all on the caller's own card

