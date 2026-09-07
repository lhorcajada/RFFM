## ADDED Requirements

### Requirement: Unscheduled training sessions
A `TrainingSession` SHALL be creatable and editable with `Date` and `StartTime` both null,
representing a session that has content but no assigned date/time yet ("unscheduled"). All
other session content (`Blocks`, target Sub-subprincipios) SHALL remain fully editable while
unscheduled.

#### Scenario: Creating an unscheduled session
- **WHEN** a Coach creates a session with no `Date`/`StartTime`
- **THEN** the session is saved successfully with `Date` and `StartTime` both null, and appears
  in the session list without a date

#### Scenario: Assigning a date to a previously unscheduled session
- **WHEN** a Coach edits an unscheduled session and sets `Date`/`StartTime`
- **THEN** the session is updated with the given date/time and all previously assigned targets
  and blocks are preserved unchanged

### Requirement: A training session targets Sub-subprincipios
A `TrainingSession` SHALL optionally carry a list of target `SubSubPrincipio` ids
(`TargetSubSubPrincipioIds`), each belonging to the team's active `GameModel`. The same
`SubSubPrincipio` id MAY appear as a target of more than one session — no uniqueness constraint
across sessions.

#### Scenario: Adding a Sub-subprincipio target to a session
- **WHEN** a Coach saves a session with one or more `TargetSubSubPrincipioIds`
- **THEN** the session is saved with those targets, each returned with its full breadcrumb
  (Fase, Principio, Subprincipio, Zona if any, Rol) on read

#### Scenario: The same Sub-subprincipio targeted by multiple sessions
- **WHEN** a Coach adds the same `SubSubPrincipio` id as a target to two different sessions
- **THEN** both saves succeed and both sessions list that target

#### Scenario: Targeting a Sub-subprincipio from another team's GameModel is rejected
- **WHEN** a Coach attempts to save a session with a `TargetSubSubPrincipioIds` entry that
  belongs to a different team's `GameModel`
- **THEN** the save is rejected with a validation error and no change is persisted

### Requirement: Session date assignment auto-resolves its Microciclo
The backend SHALL automatically resolve a session's `MicrocicloId` when it is saved with a
non-null `Date` and no explicit `MicrocicloId`, picking the `Microciclo` of the session's team
whose `StartDate`..`EndDate` range contains that `Date`, if one exists. The Coach SHALL NOT be
required to pick a `Microciclo` manually for this to happen. An explicitly provided
`MicrocicloId` SHALL still be honored and validated as before (must belong to a `SeasonPlan` for
the same team).

#### Scenario: Date falls inside an existing Microciclo's range
- **WHEN** a Coach assigns a `Date` to a session, with no `MicrocicloId` given, and the team has
  a `SeasonPlan` with a `Microciclo` whose date range contains that `Date`
- **THEN** the session is saved with that `Microciclo`'s id automatically set

#### Scenario: No Microciclo covers the assigned date
- **WHEN** a Coach assigns a `Date` to a session, with no `MicrocicloId` given, and no
  `Microciclo` of the team's `SeasonPlan` covers that date
- **THEN** the session is saved with `MicrocicloId` null, not rejected

#### Scenario: Explicit MicrocicloId still takes precedence
- **WHEN** a Coach saves a session with both a `Date` and an explicit `MicrocicloId`
- **THEN** the given `MicrocicloId` is used and validated, and no automatic resolution occurs
