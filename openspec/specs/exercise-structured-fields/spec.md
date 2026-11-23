# exercise-structured-fields Specification

## Purpose
TBD - created by archiving change exercise-a4-sheet-print. Update Purpose after archive.
## Requirements
### Requirement: Exercise stores structured sheet fields

The exercise (`TaskTrainingBase`) SHALL store `Espacio` (optional text), `TurnoMinutos` (optional integer), `NivelDibujo` (optional integer), and the text lists `Reglas`, `Puntos`, `Rotaciones` and `Montaje`. The lists SHALL persist as `jsonb` columns that default to an empty array. The «Qué se hace» text of the sheet SHALL be the existing `Descripcion` field, with no separate column.

#### Scenario: Structured fields round-trip through persistence

- **WHEN** an exercise is saved with a space, a turn duration, a drawing level, and rules, points, rotation and setup lines
- **THEN** reading the exercise back returns the same values in the same order

### Requirement: Create, update and read endpoints expose the structured sheet fields

`CreateExercise` and `UpdateExercise` SHALL accept `espacio`, `turnoMinutos`, `nivelDibujo`, `reglas`, `puntos`, `rotaciones` and `montaje` and SHALL store them on the exercise. They SHALL ignore `jugadores`, `secuencia`, `queSeVe` and `porteros` when a request carries them. `GetExercises` and `GetExerciseById` SHALL return `espacio`, `turnoMinutos`, `nivelDibujo`, `reglas`, `puntos`, `rotaciones` and `montaje`, and SHALL NOT return `jugadores`, `secuencia`, `queSeVe` or `porteros`. `descripcion` SHALL keep its name and contract. `UpdateExercise` SHALL keep the stored `BoardStateJson` when the request sends it as null.

#### Scenario: Update stores the sheet fields and keeps the board

- **WHEN** an exercise with a stored board is updated with new rotation lines and `boardStateJson` null
- **THEN** the exercise returns the new rotation lines and its previous board state

#### Scenario: Read returns the sheet fields

- **WHEN** a coach lists exercises or reads one exercise by id
- **THEN** each exercise includes `espacio`, `turnoMinutos`, `nivelDibujo`, `reglas`, `puntos`, `rotaciones` and `montaje`, and none of `jugadores`, `secuencia`, `queSeVe` or `porteros`

### Requirement: Backend applies finite caps to the structured sheet fields

The create and update validators SHALL reject a request with more than 30 lines in any of the `Reglas`, `Puntos`, `Rotaciones` or `Montaje` lists, a line longer than 1000 characters, a space longer than 2000 characters, or a turn duration outside 1..240 minutes. These caps SHALL NOT decide whether the content fits one printed sheet.

#### Scenario: Too many lines are rejected

- **WHEN** a create or update request carries 31 Puntos lines
- **THEN** the request fails validation with a validation problem response

### Requirement: Drawing level must be an existing level row

When `NivelDibujo` is present, the create and update validators SHALL require it to be between 1 and the number of `Niveles` rows of the same request.

#### Scenario: Drawing level beyond the rows is rejected

- **WHEN** a request with three level rows carries `nivelDibujo` 4
- **THEN** the request fails validation with the message that `NivelDibujo` must be one of the `Niveles` rows

#### Scenario: Missing drawing level is accepted

- **WHEN** a request carries no `nivelDibujo`
- **THEN** the drawing-level rule does not reject it

### Requirement: Legacy free-text fields are optional

The create and update validators SHALL NOT require `Logistica` or `Descripcion`.

#### Scenario: Exercise without legacy text is accepted

- **WHEN** a create request carries an empty `logistica` and an empty `descripcion` and valid other fields
- **THEN** the exercise is created

### Requirement: Removed sheet fields stay stored and unread

The exercise (`TaskTrainingBase`) SHALL keep its `Jugadores`, `Secuencia`, `QueSeVe` and `Porteros` properties, column configuration and columns, and no exercise endpoint SHALL accept, return or overwrite them. Saving an exercise through `CreateExercise` or `UpdateExercise` SHALL leave the stored values of those four columns unchanged. The `AddExerciseSheetSections` migration SHALL only add the `Puntos`, `Rotaciones` and `Montaje` `jsonb` columns with default `'[]'`, and SHALL NOT drop or rewrite any other column.

#### Scenario: Update keeps the hidden stored values

- **WHEN** an exercise whose stored `Secuencia`, `QueSeVe`, `Jugadores` and `Porteros` hold values is updated with new Puntos lines
- **THEN** the exercise returns the new Puntos lines and the four hidden columns still hold their previous values in the database

#### Scenario: Existing exercise has empty new sections

- **WHEN** an exercise stored before the `AddExerciseSheetSections` migration is read after it
- **THEN** its `puntos`, `rotaciones` and `montaje` are empty lists and its `descripcion` is unchanged

### Requirement: Example session seed fills the new sheet sections

The example session seed SHALL set `Descripcion` and the `Puntos`, `Rotaciones` and `Montaje` lists of its seeded exercises from the example content, and SHALL NOT set `Porteros` or the other removed sheet fields.

#### Scenario: Seeded exercise carries the new sections

- **WHEN** the example session is seeded
- **THEN** its rondo exercise has non-empty `Puntos`, `Rotaciones` and `Montaje` lines and no `Porteros` value

