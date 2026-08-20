## ADDED Requirements

### Requirement: Team has one season plan per season
A `Team` SHALL have at most one `SeasonPlan` per `Season`, composed of an ordered, non-empty list of `Macrociclo`s. Each `Macrociclo` SHALL have an `Order`, `Name`, `StartDate`, `EndDate`, and an ordered list of `Mesociclo`s. Each `Mesociclo` SHALL have an `Order`, `Name`, `StartDate`, `EndDate`, a `GameZoneId` (referencing the existing field-zone catalog), and an ordered list of `Microciclo`s. Each `Microciclo` SHALL have an `Order`, `WeekLabel`, `StartDate`, `EndDate`, `ObjetivoSesionA`, and `ObjetivoSesionB`.

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
- **THEN** the `SeasonPlan` and its full tree are removed, any `Exercise` previously linked to one of its `Microciclo`s has that link cleared (not deleted), and the team returns to "no season plan" state for that season

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

#### Scenario: GET includes exercise coverage per Microciclo
- **WHEN** `GET /api/season-plans?teamId=&seasonId=` is called for a team/season with a `SeasonPlan`
- **THEN** each `Microciclo` in the response includes an `ExerciseCount` reflecting how many `Exercise`s currently link to it (0 if none)

#### Scenario: POST rejects a duplicate plan
- **WHEN** `POST /api/season-plans` is called for a Team+Season that already has a `SeasonPlan`
- **THEN** the backend responds `409 Conflict` and no change is persisted

### Requirement: Microciclo sessions link to concrete ADN targets
Each `Microciclo` SHALL have two sessions (A: Defensa organizada + Transición defensa-ataque; B: Ataque organizado + Transición ataque-defensa), each optionally linked to specific `Subprincipio`s and `SubSubPrincipio`s from the team's current `GameModel`, plus a set of `Habilidad` names drawn from the closed 15-value vocabulary. Free-text objectives (`ObjetivoSesionA`/`ObjetivoSesionB`) remain and are not replaced by these links.

#### Scenario: Coach links a Subprincipio to a session
- **WHEN** a Coach editing a Microciclo selects a `Subprincipio` from the team's `GameModel` for Sesión A
- **THEN** that link is saved and shown alongside Sesión A's other content

#### Scenario: Habilidad selection restricted to the closed vocabulary
- **WHEN** a Coach selects Habilidades imprescindibles for a session
- **THEN** only the 15-value closed vocabulary is offered, and any value outside it is rejected by the backend

#### Scenario: Team with no GameModel yet
- **WHEN** a Coach edits a Microciclo for a team with no `GameModel` for that season
- **THEN** the Subprincipio/SubSubPrincipio pickers show an empty state directing the coach to build the ADN first, while the free-text objectives and Habilidad selection remain editable

#### Scenario: Linked Subprincipio later removed from the GameModel
- **WHEN** a `Subprincipio` referenced by a Microciclo session is removed from the team's `GameModel` (via a `GameModel` edit)
- **THEN** the corresponding link is silently removed from the Microciclo, without affecting the rest of the Microciclo's content

#### Scenario: Exercise creation shows the session's concrete targets
- **WHEN** a Coach creates an exercise from a Microciclo's session
- **THEN** the exercise form displays that session's linked Subprincipios, SubSubPrincipios, and Habilidades as read-only context

### Requirement: Season plan visibility in Coach app
The Coach web app SHALL provide a "Planificación" tab (alongside "Ejercicios" and "Sesiones") showing the season plan tree with, per `Microciclo`, a visible indicator of whether it has any linked exercises.

#### Scenario: Microciclo with no linked exercises
- **WHEN** the Planificación tab renders a `Microciclo` with `ExerciseCount = 0`
- **THEN** it is shown with a distinct "sin ejercicios" indicator, visually distinguishable from covered weeks

#### Scenario: Microciclo with linked exercises
- **WHEN** the Planificación tab renders a `Microciclo` with `ExerciseCount > 0`
- **THEN** it shows the count of linked exercises
