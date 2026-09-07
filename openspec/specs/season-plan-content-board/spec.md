# season-plan-content-board Specification

## Purpose
TBD - created by archiving change season-plan-content-board. Update Purpose after archive.
## Requirements
### Requirement: ADN coverage is a calculated view, never stored
A `Subprincipio` SHALL be considered "covered" when every one of its `SubSubPrincipio`s (via its
`Zona`s if any, or direct) is targeted by at least one `TrainingSession` (scheduled or
unscheduled). A `GamePrinciple` SHALL be considered "covered" when all of its `Subprincipio`s
are covered. Coverage SHALL be computed by querying live session-target data, never persisted as
a field on `Subprincipio`/`GamePrinciple`.

#### Scenario: Subprincipio becomes covered
- **WHEN** every `SubSubPrincipio` of a `Subprincipio` is targeted by at least one session
- **THEN** the coverage query reports that `Subprincipio` as covered, with no manual action taken

#### Scenario: Subprincipio loses coverage when a target is removed
- **WHEN** the only session targeting one of a covered `Subprincipio`'s `SubSubPrincipio`s is
  edited to remove that target, with no other session targeting it
- **THEN** the coverage query reports that `Subprincipio` as no longer covered

#### Scenario: Principio covered only when all its Subprincipios are covered
- **WHEN** a `GamePrinciple` has one covered and one uncovered `Subprincipio`
- **THEN** the coverage query reports that `GamePrinciple` as not covered

### Requirement: Sub-subprincipio usage is queryable per team/season
The backend SHALL expose an endpoint returning, for every `SubSubPrincipio` of a team's active
`GameModel`, whether it is used by at least one session and the list of sessions using it (each
with `SessionId`, `SessionName`, and `Date` — null when the referencing session is unscheduled).

#### Scenario: Unused Sub-subprincipio
- **WHEN** no `TrainingSession` targets a given `SubSubPrincipio`
- **THEN** the coverage endpoint reports it as unused with an empty session list

#### Scenario: Sub-subprincipio used by an unscheduled session
- **WHEN** a `SubSubPrincipio` is targeted only by a session with no `Date`
- **THEN** the coverage endpoint reports it as used, with that session's entry showing a null
  `Date`

