## ADDED Requirements

### Requirement: Club-scoped Coach can enter a specific team by team code
The system SHALL let a caller with an active `UserClub` row of `RoleId` `Coach` or `Directive`
resolve a team join code to the corresponding `Team`, but only when that team's `ClubId` matches
one of the caller's own `UserClub` rows with `RoleId` `Coach` or `Directive`. On success, the
system SHALL persist that team as the caller's `ConfigurationCoach.PreferredTeamId` (creating the
`ConfigurationCoach` row if none exists, updating it if one does) and return the team's id and
name. The system SHALL NOT create a `UserTeam` row as part of this flow — club-level `UserClub`
access already grants the caller edit rights on every team in that club.

#### Scenario: Coach enters a team code for a team in their own club
- **WHEN** a caller with a `UserClub` row (`RoleId = Coach`) for club C sends
  `POST /api/invitations/team/enter-as-coach` with the join code of team T, where T's `ClubId`
  is C
- **THEN** the request succeeds (`200 OK`) with body `{ teamId: T.Id, teamName: T.Name }`, and the
  caller's `ConfigurationCoach.PreferredTeamId` is set to `T.Id`

#### Scenario: Directive enters a team code for a team in their own club
- **WHEN** a caller with a `UserClub` row (`RoleId = Directive`) for club C sends the same request
  with the join code of team T, where T's `ClubId` is C
- **THEN** the request succeeds (`200 OK`) with the same response shape as above

#### Scenario: Coach enters a team code for a team belonging to a different club
- **WHEN** a caller with a `UserClub` row (`RoleId = Coach`) for club C sends the request with the
  join code of team T, where T's `ClubId` is a different club C2 the caller has no `UserClub` row
  for
- **THEN** the request fails with `403 Forbidden` and no `ConfigurationCoach` row is created or
  modified for the caller

#### Scenario: ClubMember (non-manager) role cannot use their club membership to enter a team
- **WHEN** a caller with a `UserClub` row (`RoleId = ClubMember`) for club C sends the request
  with the join code of a team T whose `ClubId` is C
- **THEN** the request fails with `403 Forbidden`, because `ClubMember` is neither `Coach` nor
  `Directive`

#### Scenario: Unknown team code
- **WHEN** any authenticated caller sends the request with a code that matches no `Team.JoinCode`
- **THEN** the request fails with `404 Not Found`

#### Scenario: Re-entering a different team code updates, not duplicates, the preference
- **WHEN** a caller who already has a `ConfigurationCoach` row (from a prior successful call to
  this endpoint, or from the existing `Settings` preferred-team picker) sends this request again
  with the join code of a different team T2 in a club they have `Coach`/`Directive` access to
- **THEN** the request succeeds (`200 OK`) and the caller's existing `ConfigurationCoach` row is
  updated to `PreferredTeamId = T2.Id`, without creating a second row for the same caller

### Requirement: "Mi equipo" prompts a club-scoped Coach for a team code instead of showing an empty dashboard
The system SHALL, when an authenticated Coach without a resolvable team preference
(`ConfigurationCoach.PreferredTeamId` unset) selects "Continuar" after choosing to keep their
Coach role from the `AppSelector`'s "Mi equipo" entry point, present a team-code input instead of
navigating directly to the coach dashboard. Entering a valid code (per the requirement above)
SHALL navigate the caller to the coach dashboard scoped to the resolved team.

#### Scenario: Coach with no preferred team is prompted for a team code
- **WHEN** an authenticated user with role `Coach` and no `ConfigurationCoach.PreferredTeamId`
  clicks "Mi equipo", then "Continuar" on the resulting role-confirmation dialog
- **THEN** a team-code input dialog is shown instead of navigating directly to
  `/coach/dashboard`

#### Scenario: Coach with an already-configured preferred team is not prompted
- **WHEN** an authenticated user with role `Coach` and an existing
  `ConfigurationCoach.PreferredTeamId` clicks "Mi equipo", then "Continuar"
- **THEN** the system navigates directly to `/coach/dashboard` without showing the team-code
  input (unchanged behavior)

#### Scenario: Entering a valid team code from the "Mi equipo" prompt lands on that team
- **WHEN** the team-code input dialog (triggered per the first scenario) is submitted with a valid
  code for a team in the caller's own club
- **THEN** the caller is navigated to the coach dashboard scoped to that team's id

#### Scenario: Entering an invalid team code from the "Mi equipo" prompt shows an inline error
- **WHEN** the team-code input dialog is submitted with a code that fails validation (unknown
  code, or a team belonging to a different club)
- **THEN** the dialog remains open and shows the error message from the backend response instead
  of navigating away
