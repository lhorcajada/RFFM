## REMOVED Requirements

### Requirement: Exercise can optionally link to a Microciclo
**Reason**: Superseded by this change — an `Exercise` no longer links to a `Microciclo` directly. It only reaches the season plan transitively, by being placed inside a `SessionBlock` of a `TrainingSession` that itself optionally links to a `Microciclo` (see `specs/sessions/spec.md`).
**Migration**: No data migration — development exercises are wiped as part of this change (see `design.md` §2, migration 1).

An `Exercise` (`TaskTrainingBase`) SHALL optionally reference one `Microciclo` from the team's season plan.

#### Scenario: Creating an exercise from a Microciclo
- **WHEN** a Coach creates a new exercise from the "Crear ejercicio" action on a Microciclo card in the Planificación tab
- **THEN** the created exercise is linked to that Microciclo

## MODIFIED Requirements

### Requirement: Exercise can reference the game model
An `Exercise` (`TaskTrainingBase`) SHALL optionally carry a repeatable list of `ExerciseModelRelation`s, each anchored to exactly one `Subprincipio` from the team's `GameModel`, tagged FOCO or INTEGRADO, and owning its own set of `Habilidad` names (drawn from the closed 15-value vocabulary). Each relation MAY additionally list `ExerciseModelRelationItem`s, each anchored to one `SubSubPrincipio` under that same `Subprincipio`, independently tagged FOCO or INTEGRADO. The whole `ModelRelations` list MAY be empty (a physical-only exercise with no game-model connection).

#### Scenario: Linking an exercise to a Subprincipio
- **WHEN** a Coach editing an exercise adds a model relation, selects a `Subprincipio` from the team's `GameModel`, and tags it FOCO
- **THEN** the relation is saved and shown on the exercise as FOCO for that `Subprincipio`

#### Scenario: Adding a SubSubPrincipio item under a relation
- **WHEN** a Coach adds an item to an existing relation and selects a `SubSubPrincipio` that belongs to that relation's `Subprincipio`
- **THEN** the item is saved anchored to that `SubSubPrincipio`, with its own independent FOCO/INTEGRADO tag

#### Scenario: A relation cannot be created without a Subprincipio
- **WHEN** a Coach attempts to save an exercise with a model relation that has no `Subprincipio` selected
- **THEN** the save is rejected (client-side and server-side) and no relation is persisted

#### Scenario: Habilidad selection restricted to the closed vocabulary, per relation
- **WHEN** a Coach selects Habilidades imprescindibles for a model relation
- **THEN** only the 15-value closed vocabulary is offered, and any value outside it is rejected by the backend

#### Scenario: Team with no GameModel yet
- **WHEN** a Coach edits an exercise for a team with no `GameModel` for that season
- **THEN** the Subprincipio/SubSubPrincipio pickers show an empty state directing the coach to build the ADN first, while the rest of the exercise form remains editable

#### Scenario: Linked Subprincipio or SubSubPrincipio later removed from the GameModel
- **WHEN** a `Subprincipio` referenced by a relation, or a `SubSubPrincipio` referenced by one of its items, is removed from the team's `GameModel`
- **THEN** the corresponding relation or item is silently removed from the exercise, without affecting the rest of the exercise's content

## ADDED Requirements

### Requirement: Exercise follows the reduced content template
An `Exercise` (`TaskTrainingBase`) SHALL carry: `Name` (Título, required), `Tipo` (`Analitico | Situacional | Global`, required), `Objetivo` (required), `ObjetivoPorRol` (optional), `Logistica` (required free text), `Porteros` (optional free text), `Dibujo` (optional free text/placeholder), `Descripcion` (required, single free-text execution narrative), and `Niveles` (see "Exercise levels use free-named palanca columns" below). `DurationMinutes` (optional integer) is a structured addition beyond the source template, kept so a session's total duration can be computed without parsing `Logistica` prose.

#### Scenario: Saving an exercise with only the required fields
- **WHEN** a Coach saves an exercise with `Name`, `Tipo`, `Objetivo`, `Logistica`, `Descripcion`, and a valid `Niveles` table, and leaves `ObjetivoPorRol`, `Porteros`, `Dibujo`, and `DurationMinutes` empty
- **THEN** the exercise is created successfully with those optional fields null

### Requirement: Exercise levels use free-named palanca columns
An `Exercise`'s `Niveles` SHALL be a table of between 2 and 5 rows (numbered `1..N` contiguously, no gaps or duplicates), where each row holds a value per column from a coach-defined, free-named, ordered list of `NivelesColumnas` ("palancas"). Every row's values SHALL be keyed only by columns present in `NivelesColumnas` (no orphan cells).

#### Scenario: Fewer than 2 levels is rejected
- **WHEN** a Coach attempts to save an exercise with only 1 level row
- **THEN** the save is rejected with a validation error

#### Scenario: More than 5 levels is rejected
- **WHEN** a Coach attempts to save an exercise with 6 level rows
- **THEN** the save is rejected with a validation error

#### Scenario: Removing a palanca column strips it from every row
- **WHEN** a Coach removes a palanca column that has values set on some rows
- **THEN** those rows' values for that column are removed, and no orphan cell referencing the deleted column remains

### Requirement: Exercise can exist independent of any session or plan
An `Exercise` SHALL be creatable and fully usable without being linked to any `TrainingSession`, `SessionBlock`, or `SeasonPlan` node.

#### Scenario: Creating a standalone exercise
- **WHEN** a Coach creates an exercise directly from the Ejercicios tab, without going through any session or plan flow
- **THEN** the exercise is created and usable (listable, editable, linkable to a session block later) with no session or plan association

### Requirement: Exercise list distinguishes model-linked from independent exercises
The exercise list SHALL expose, per exercise, whether it carries at least one `ModelRelation` (`IsAssociatedToGameModel`), and the Coach app SHALL render this as a visible, distinct indicator in the exercise list/cards.

#### Scenario: Exercise with no model relations
- **WHEN** the exercise list renders an exercise with an empty `ModelRelations` list
- **THEN** `IsAssociatedToGameModel` is `false` and no "asociado al modelo" indicator is shown

#### Scenario: Exercise with at least one model relation
- **WHEN** the exercise list renders an exercise with one or more `ModelRelations`
- **THEN** `IsAssociatedToGameModel` is `true` and the "asociado al modelo" indicator is shown

### Requirement: Deleting an exercise in use by a session is blocked
An `Exercise` referenced by at least one `SessionBlockExercise` SHALL NOT be hard-deleted; the delete request SHALL be rejected with a specific error distinguishable from a generic failure.

#### Scenario: Deleting an exercise placed in a session block
- **WHEN** a Coach attempts to delete an exercise that is currently placed in at least one session's block
- **THEN** the delete is rejected and the Coach app shows a specific "en uso en una sesión" message, not a generic error
