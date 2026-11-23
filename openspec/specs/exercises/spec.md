# exercises Specification

## Purpose
TBD - created by archiving change 2026-08-11-add-coach-season-planning. Updated by archiving
2026-08-21-session-exercise-plan-redesign.
## Requirements
### Requirement: Exercise follows the reduced content template

An `Exercise` (`TaskTrainingBase`) SHALL carry: `Name` (Título, required), `Tipo` (`Analitico | Situacional | Global`, required), `Objetivo` (required), `ObjetivoPorRol` (optional), `Logistica` (optional legacy free text), `Dibujo` (optional legacy free text, no longer printed), `Descripcion` (optional free multi-line text, shown and printed as «Qué se hace»), and `Niveles` (see "Exercise levels use free-named palanca columns" below). `DurationMinutes` (optional integer) is a structured addition beyond the source template, kept so a session's total duration can be computed. The exercise SHALL also carry the structured sheet fields `Espacio`, `TurnoMinutos`, `NivelDibujo`, `Reglas`, `Puntos`, `Rotaciones` and `Montaje` (see the `exercise-structured-fields` capability). The exercise contract SHALL NOT carry `Porteros`, `Secuencia`, `QueSeVe` or `Jugadores`; their stored values stay in the database unread.

#### Scenario: Saving an exercise with only the required fields

- **WHEN** a Coach saves an exercise with `Name`, `Tipo`, `Objetivo` and a valid `Niveles` table, and leaves `Logistica`, `Descripcion`, `ObjetivoPorRol`, `Dibujo`, `DurationMinutes` and every structured sheet field empty
- **THEN** the exercise is created successfully with those optional fields null or empty

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

### Requirement: Deleting an exercise in use by a session is blocked
An `Exercise` referenced by at least one `SessionBlockExercise` SHALL NOT be hard-deleted; the delete request SHALL be rejected with a specific error distinguishable from a generic failure.

#### Scenario: Deleting an exercise placed in a session block
- **WHEN** a Coach attempts to delete an exercise that is currently placed in at least one session's block
- **THEN** the delete is rejected and the Coach app shows a specific "en uso en una sesión" message, not a generic error

### Requirement: Exercise carries no game-model relations
The exercise API SHALL NOT expose nor edit game-model relations: `POST` and `PUT` of an exercise SHALL ignore any `modelRelations` field in the request, and the exercise list and exercise detail responses SHALL NOT return `modelRelations` nor `isAssociatedToGameModel`. Saving an exercise SHALL leave any relation rows already stored for it in the database unchanged, and no exercise feature SHALL read them. The game model of a training belongs to its session's objectives.

#### Scenario: Create ignores model relations
- **WHEN** a Coach creates an exercise with a request that carries a `modelRelations` list
- **THEN** the exercise is created and no game-model relation is stored for it

#### Scenario: Update keeps stored relations untouched
- **WHEN** a Coach updates an exercise that has game-model relation rows stored in the database
- **THEN** the exercise is updated and those relation rows remain in the database as they were

#### Scenario: Read endpoints return no relations
- **WHEN** a Coach reads the exercise list or one exercise by id
- **THEN** the response carries neither `modelRelations` nor `isAssociatedToGameModel`

#### Scenario: Exercise list shows no game-model chips
- **WHEN** the Coach app renders the exercise list
- **THEN** no exercise card shows an «Asociado al modelo» chip nor a game-model relation chip

