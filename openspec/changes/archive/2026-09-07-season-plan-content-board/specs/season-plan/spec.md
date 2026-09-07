## MODIFIED Requirements

### Requirement: Season plan associates sessions, not exercises
A `Microciclo`'s weekly objective SHALL be derived exclusively from its linked
`TrainingSession`s — never an independently editable or stored field. Its coverage is
determined by its linked `TrainingSession`s (via `TrainingSession.MicrocicloId`), not by any
direct exercise link. Creating a session from a Microciclo card SHALL pre-fill that session's
plan association. The weekly objective (the set of target `SubSubPrincipio`s worked that week)
is the union of `TargetSubSubPrincipioIds` of `TrainingSession`s whose `Date` falls inside that
`Microciclo`'s `StartDate`..`EndDate` range.

#### Scenario: Creating a session from a Microciclo card
- **WHEN** a Coach uses the "Crear sesión" action on a Microciclo card in the Planificación tab
- **THEN** the created session is linked to that Microciclo (`MicrocicloId` set)

#### Scenario: Weekly objective reflects dated sessions' targets
- **WHEN** two sessions dated inside a Microciclo's range target three distinct
  `SubSubPrincipio`s between them
- **THEN** that Microciclo's weekly objective view shows the union of those three targets, with
  no manual entry required

#### Scenario: Unscheduled session targets do not appear in any weekly objective
- **WHEN** a session has targets but no `Date`
- **THEN** those targets do not appear in any Microciclo's weekly objective view until the
  session is assigned a `Date` that falls inside that Microciclo's range
