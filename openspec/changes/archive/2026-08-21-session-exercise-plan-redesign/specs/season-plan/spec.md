## REMOVED Requirements

### Requirement: Microciclo sessions link to concrete ADN targets
**Reason**: Superseded by this change — a `Microciclo` no longer hard-codes an "exactly two sessions (A/B)" shape with its own Subprincipio/SubSubPrincipio/Habilidad links. It now optionally has any number of linked `TrainingSession`s, each fully self-describing (own name, objective, model relations via its exercises' blocks). See `specs/sessions/spec.md`.
**Migration**: No data migration — the `Microciclo.ObjetivoSesionA/B`, `GameZoneIdSesionA/B`, `SesionA/BHabilidades` columns and the `MicrocicloSubprincipioLink`/`MicrocicloSubSubPrincipioLink` tables are dropped (see `design.md` §2, migration 4). Development season-plan data is not preserved for these fields.

Each `Microciclo` SHALL have two sessions (A: Defensa organizada + Transición defensa-ataque; B: Ataque organizado + Transición ataque-defensa), each optionally linked to specific `Subprincipio`s and `SubSubPrincipio`s from the team's current `GameModel`, plus a set of `Habilidad` names drawn from the closed 15-value vocabulary.

#### Scenario: Coach links a Subprincipio to a session
- **WHEN** a Coach editing a Microciclo selects a `Subprincipio` from the team's `GameModel` for Sesión A
- **THEN** that link is saved and shown alongside Sesión A's other content

#### Scenario: Exercise creation shows the session's concrete targets
- **WHEN** a Coach creates an exercise from a Microciclo's session
- **THEN** the exercise form displays that session's linked Subprincipios, SubSubPrincipios, and Habilidades as read-only context

## MODIFIED Requirements

### Requirement: Team has one season plan per season
A `Team` SHALL have at most one `SeasonPlan` per `Season`, composed of an ordered, non-empty list of `Macrociclo`s. Each `Macrociclo` SHALL have an `Order`, `Name`, `StartDate`, `EndDate`, and an ordered list of `Mesociclo`s. Each `Mesociclo` SHALL have an `Order`, `Name`, `StartDate`, `EndDate`, a `GameZoneId` (referencing the existing field-zone catalog), and an ordered list of `Microciclo`s. Each `Microciclo` SHALL have an `Order`, `WeekLabel`, `StartDate`, and `EndDate`.

#### Scenario: Team with no season plan yet
- **WHEN** a `Team` has never had a `SeasonPlan` saved for a given `Season`
- **THEN** reads of the team's season plan for that season return no data, distinct from an error

#### Scenario: Tree is read in order
- **WHEN** a `SeasonPlan`'s tree is read
- **THEN** Macrociclos, their Mesociclos, and their Microciclos are each returned ordered by `Order`, ascending, starting at 1

### Requirement: Season plan backend endpoints
The backend SHALL expose `GET /api/season-plans?teamId=&seasonId=`, `POST /api/season-plans`, `PUT /api/season-plans/{id}`, and `DELETE /api/season-plans/{id}`, requiring Coach/Admin feature permission for write operations.

#### Scenario: GET returns no content when no plan exists
- **WHEN** `GET /api/season-plans?teamId=&seasonId=` is called for a team/season with no `SeasonPlan`
- **THEN** the response is `204 No Content`

#### Scenario: GET includes session coverage per Microciclo
- **WHEN** `GET /api/season-plans?teamId=&seasonId=` is called for a team/season with a `SeasonPlan`
- **THEN** each `Microciclo` in the response includes a `Sessions` list of `TrainingSession` summaries (`Id`, `Name`, `ObjetivoGeneral`, `Date`, `ExerciseCount`) linked to it, empty if none

#### Scenario: POST rejects a duplicate plan
- **WHEN** `POST /api/season-plans` is called for a Team+Season that already has a `SeasonPlan`
- **THEN** the backend responds `409 Conflict` and no change is persisted

### Requirement: Season plan visibility in Coach app
The Coach web app SHALL provide a "Planificación" tab as the **first** tab (before "Ejercicios" and "Sesiones"), showing the season plan tree with, per `Microciclo`, its linked sessions and a visible indicator of session coverage.

#### Scenario: Microciclo with no linked sessions
- **WHEN** the Planificación tab renders a `Microciclo` with an empty `Sessions` list
- **THEN** it is shown with a distinct "sin sesiones" indicator, visually distinguishable from covered weeks

#### Scenario: Microciclo with linked sessions
- **WHEN** the Planificación tab renders a `Microciclo` with one or more linked sessions
- **THEN** it shows the list of sessions (name, date, exercise count) and a count of linked sessions

#### Scenario: Planificación is the default landing tab
- **WHEN** a Coach opens the Entrenamientos/Trainings area
- **THEN** the Planificación tab is shown first and selected by default

## ADDED Requirements

### Requirement: Season plan associates sessions, not exercises
A `Microciclo`'s coverage is determined by its linked `TrainingSession`s (via `TrainingSession.MicrocicloId`), not by any direct exercise link. Creating a session from a Microciclo card SHALL pre-fill that session's plan association.

#### Scenario: Creating a session from a Microciclo card
- **WHEN** a Coach uses the "Crear sesión" action on a Microciclo card in the Planificación tab
- **THEN** the created session is linked to that Microciclo (`MicrocicloId` set)
