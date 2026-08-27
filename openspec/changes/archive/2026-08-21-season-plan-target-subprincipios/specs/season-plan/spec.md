## MODIFIED Requirements

### Requirement: Team has one season plan per season
A `Team` SHALL have at most one `SeasonPlan` per `Season`, composed of an ordered, non-empty list of `Macrociclo`s. Each `Macrociclo` SHALL have an `Order`, `Name`, `StartDate`, `EndDate`, and an ordered list of `Mesociclo`s. Each `Mesociclo` SHALL have an `Order`, `Name`, `StartDate`, `EndDate`, a `GameZoneId` (referencing the existing field-zone catalog), and an ordered list of `Microciclo`s. Each `Microciclo` SHALL have an `Order`, `WeekLabel`, `StartDate`, `EndDate`, and an optional, unordered list of target `Subprincipio` references (`SubprincipiosObjetivo`) — reference-only, carrying no FOCO/INTEGRADO tag and no Habilidad selection (those remain exclusively on `ExerciseModelRelation`, at the exercise level).

#### Scenario: Team with no season plan yet
- **WHEN** a `Team` has never had a `SeasonPlan` saved for a given `Season`
- **THEN** reads of the team's season plan for that season return no data, distinct from an error

#### Scenario: Tree is read in order
- **WHEN** a `SeasonPlan`'s tree is read
- **THEN** Macrociclos, their Mesociclos, and their Microciclos are each returned ordered by `Order`, ascending, starting at 1

#### Scenario: Microciclo with no target Subprincipios
- **WHEN** a `Microciclo` has never had a `SubprincipiosObjetivo` reference saved
- **THEN** it is read back with an empty `SubprincipiosObjetivo` list, not an error

### Requirement: Season plan backend endpoints
The backend SHALL expose `GET /api/season-plans?teamId=&seasonId=`, `POST /api/season-plans`, `PUT /api/season-plans/{id}`, and `DELETE /api/season-plans/{id}`, requiring Coach/Admin feature permission for write operations. `POST`/`PUT` accept, per `Microciclo`, an optional list of target `Subprincipio` ids (`SubprincipioObjetivoIds`); `GET` returns, per `Microciclo`, the resolved `SubprincipiosObjetivo` (`Id`, `Numero`, `Titulo`, `GameMomentName`) alongside its linked-session summary.

#### Scenario: GET returns no content when no plan exists
- **WHEN** `GET /api/season-plans?teamId=&seasonId=` is called for a team/season with no `SeasonPlan`
- **THEN** the response is `204 No Content`

#### Scenario: GET includes session coverage per Microciclo
- **WHEN** `GET /api/season-plans?teamId=&seasonId=` is called for a team/season with a `SeasonPlan`
- **THEN** each `Microciclo` in the response includes a `Sessions` list of `TrainingSession` summaries (`Id`, `Name`, `ObjetivoGeneral`, `Date`, `ExerciseCount`) linked to it, empty if none

#### Scenario: GET includes target Subprincipios per Microciclo
- **WHEN** `GET /api/season-plans?teamId=&seasonId=` is called for a team/season with a `SeasonPlan`
- **THEN** each `Microciclo` in the response includes its `SubprincipiosObjetivo`, resolved with display fields (`Numero`, `Titulo`, `GameMomentName`), empty if none

#### Scenario: POST rejects a duplicate plan
- **WHEN** `POST /api/season-plans` is called for a Team+Season that already has a `SeasonPlan`
- **THEN** the backend responds `409 Conflict` and no change is persisted

#### Scenario: Saving a Microciclo with target Subprincipio ids persists them
- **WHEN** a Coach saves a Microciclo with one or more `SubprincipioObjetivoIds`
- **THEN** those references are persisted and returned on the next read as `SubprincipiosObjetivo`

#### Scenario: Re-saving a Microciclo with a different set of target Subprincipio ids replaces the previous set
- **WHEN** a Coach edits a Microciclo that already has `SubprincipiosObjetivo` and saves a different set of `SubprincipioObjetivoIds`
- **THEN** the previous references not present in the new set are removed, and the new ones are added — the same "replace wholesale" behavior already used for the rest of the season plan tree

#### Scenario: Target Subprincipio later removed from the GameModel
- **WHEN** a `Subprincipio` referenced by a Microciclo's `SubprincipiosObjetivo` is removed from the team's `GameModel`
- **THEN** the corresponding reference is silently removed from the Microciclo, without affecting the rest of the Microciclo's content

### Requirement: Season plan seed from the reference document
The backend SHALL provide a rerunnable importer that loads the season plan described in `docs/game-model/Plan-de-Temporada.docx` into a specific Team+Season, upserting by each node's position (`Order`) within its parent so re-running it after a data correction updates existing rows instead of duplicating them. For each `Microciclo`, the importer SHALL also resolve and persist that week's target `SubprincipiosObjetivo` (skipping any that don't yet resolve against the team's `GameModel`, rather than failing), and SHALL upsert exactly two placeholder `TrainingSession`s linked to it (`MicrocicloId` set): one principal session with no fixed day, and one session fixed to the Thursday of that week, labeled as Acciones a Balón Parado (ABP) — both created with zero `SessionBlock`s, ready for a Coach to fill in.

#### Scenario: Importer run against a team with no season plan yet
- **WHEN** the importer runs for a `TeamId`/`SeasonId` pair that has no `SeasonPlan`
- **THEN** the full Macrociclo/Mesociclo/Microciclo tree described in the source document is created

#### Scenario: Importer re-run after a data correction
- **WHEN** the importer's hardcoded source data changes and it is run again for the same `TeamId`/`SeasonId`
- **THEN** existing nodes are updated in place rather than duplicated

#### Scenario: Importer creates two placeholder sessions per Microciclo
- **WHEN** the importer runs for a `Microciclo`
- **THEN** exactly two `TrainingSession`s are created linked to it (`MicrocicloId` set): one principal session with no fixed day and one session dated on that week's Thursday, labeled as ABP, both with zero `SessionBlock`s

#### Scenario: Importer re-run does not duplicate placeholder sessions
- **WHEN** the importer is re-run for a `Microciclo` that already has its two placeholder sessions
- **THEN** the existing sessions are matched and updated in place, not duplicated — even if any Coach edits made to their content in the meantime are preserved beyond what the importer itself sets

#### Scenario: Importer resolves target Subprincipios when the GameModel exists
- **WHEN** the importer runs for a team that already has the relevant `Subprincipio` imported into its `GameModel`
- **THEN** the corresponding `Microciclo.SubprincipiosObjetivo` reference is created

#### Scenario: Importer skips unresolved target Subprincipios
- **WHEN** the importer runs for a team whose `GameModel` doesn't yet contain a given week's target `Subprincipio`
- **THEN** that one reference is skipped without failing the rest of the import

### Requirement: Season plan visibility in Coach app
The Coach web app SHALL provide a "Planificación" tab as the **first** tab (before "Ejercicios" and "Sesiones"), showing the season plan tree with, per `Microciclo`, its linked sessions and a visible indicator of session coverage, alongside a visible list of that week's target Subprincipios (if any).

#### Scenario: Microciclo with no linked sessions
- **WHEN** the Planificación tab renders a `Microciclo` with an empty `Sessions` list
- **THEN** it is shown with a distinct "sin sesiones" indicator, visually distinguishable from covered weeks

#### Scenario: Microciclo with linked sessions
- **WHEN** the Planificación tab renders a `Microciclo` with one or more linked sessions
- **THEN** it shows the list of sessions (name, date, exercise count) and a count of linked sessions

#### Scenario: Microciclo with target Subprincipios
- **WHEN** the Planificación tab renders a `Microciclo` with a non-empty `SubprincipiosObjetivo`
- **THEN** each target Subprincipio is shown as a chip (its `Numero`/`Titulo`), distinct from the session-linked chips

#### Scenario: Planificación is the default landing tab
- **WHEN** a Coach opens the Entrenamientos/Trainings area
- **THEN** the Planificación tab is shown first and selected by default

## ADDED Requirements

### Requirement: Coach can set a Microciclo's target Subprincipios independent of any session or exercise
A Coach SHALL be able to select and save a `Microciclo`'s `SubprincipiosObjetivo` from the team's current `GameModel`, whether or not that `Microciclo` has any linked `TrainingSession` or exercise yet.

#### Scenario: Setting target Subprincipios before any session exists
- **WHEN** a Coach edits a `Microciclo` with no linked sessions and selects one or more `Subprincipio`s as targets
- **THEN** the selection is saved and shown on the Microciclo, independent of any session/exercise content

#### Scenario: Team with no GameModel yet
- **WHEN** a Coach edits a `Microciclo` for a team with no `GameModel` for that season
- **THEN** the Subprincipio picker shows an empty state directing the coach to build the ADN first, while the rest of the Microciclo's content remains editable
