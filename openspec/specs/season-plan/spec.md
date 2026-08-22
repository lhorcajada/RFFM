# season-plan Specification

## Purpose
TBD - created by archiving change 2026-08-11-add-coach-season-planning. Updated by archiving
2026-08-21-session-exercise-plan-redesign.

## Requirements

### Requirement: Team has one season plan per season
A `Team` SHALL have at most one `SeasonPlan` per `Season`, composed of an ordered, non-empty list of `Macrociclo`s. Each `Macrociclo` SHALL have an `Order`, `Name`, `StartDate`, `EndDate`, and an ordered list of `Mesociclo`s. Each `Mesociclo` SHALL have an `Order`, `Name`, `StartDate`, `EndDate`, a `GameZoneId` (referencing the existing field-zone catalog), and an ordered list of `Microciclo`s. Each `Microciclo` SHALL have an `Order`, `WeekLabel`, `StartDate`, and `EndDate`.

#### Scenario: Team with no season plan yet
- **WHEN** a `Team` has never had a `SeasonPlan` saved for a given `Season`
- **THEN** reads of the team's season plan for that season return no data, distinct from an error

#### Scenario: Tree is read in order
- **WHEN** a `SeasonPlan`'s tree is read
- **THEN** Macrociclos, their Mesociclos, and their Microciclos are each returned ordered by `Order`, ascending, starting at 1

### Requirement: Season plan CRUD by Coach/Admin (Front)
Coach and Admin roles SHALL be able to create, edit (metadata and full tree, including add/remove/reorder at any level), and delete a team's season plan for a season, from the Coach web app. Other roles SHALL NOT see any create/edit/delete control and SHALL NOT be able to call the write endpoints.

#### Scenario: Coach creates the first season plan
- **WHEN** a Coach on a team with no season plan for the current season fills in at least one Macrociclo (with at least one Mesociclo, with at least one Microciclo) and saves
- **THEN** a `SeasonPlan` is created for that team and season with the given tree

#### Scenario: Coach edits the tree
- **WHEN** a Coach on a team with an existing season plan adds, edits, removes, or reorders Macrociclos, Mesociclos, or Microciclos, then saves
- **THEN** the season plan is replaced with the new tree in a single save, and `Order` values are contiguous starting at 1 at every level, re-derived server-side regardless of client-sent order

#### Scenario: Coach deletes the season plan
- **WHEN** a Coach or Admin confirms deletion of a team's season plan
- **THEN** the `SeasonPlan` and its full tree are removed, and any `TrainingSession` previously linked to one of its `Microciclo`s has that link cleared (not deleted)

#### Scenario: Non-coach/admin cannot create, edit, or delete
- **WHEN** a Player or FamilyMember accesses the Coach app's season plan area
- **THEN** no create/edit/delete control is shown, and any direct attempt to call the write endpoints is rejected by the backend with an authorization error

#### Scenario: Save requires at least one Macrociclo/Mesociclo/Microciclo
- **WHEN** a Coach attempts to save a season plan with an empty tree at any required level
- **THEN** the backend rejects the request with a validation error and no change is persisted

### Requirement: Season plan seed from the reference document
The backend SHALL provide a rerunnable importer that loads the season plan described in `docs/game-model/Plan-de-Temporada.docx` into a specific Team+Season, upserting by each node's position (`Order`) within its parent so re-running it after a data correction updates existing rows instead of duplicating them.

#### Scenario: Importer run against a team with no season plan yet
- **WHEN** the importer runs for a `TeamId`/`SeasonId` pair that has no `SeasonPlan`
- **THEN** the full Macrociclo/Mesociclo/Microciclo tree described in the source document is created

#### Scenario: Importer re-run after a data correction
- **WHEN** the importer's hardcoded source data changes and it is run again for the same `TeamId`/`SeasonId`
- **THEN** existing nodes are updated in place rather than duplicated

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

### Requirement: Season plan associates sessions, not exercises
A `Microciclo`'s coverage is determined by its linked `TrainingSession`s (via `TrainingSession.MicrocicloId`), not by any direct exercise link. Creating a session from a Microciclo card SHALL pre-fill that session's plan association.

#### Scenario: Creating a session from a Microciclo card
- **WHEN** a Coach uses the "Crear sesión" action on a Microciclo card in the Planificación tab
- **THEN** the created session is linked to that Microciclo (`MicrocicloId` set)

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
