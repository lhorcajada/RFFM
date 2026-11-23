## ADDED Requirements

### Requirement: Exercise stores structured sheet fields

The exercise (`TaskTrainingBase`) SHALL store `Espacio` (optional text), `TurnoMinutos` (optional integer), `NivelDibujo` (optional integer), the text lists `Secuencia`, `Reglas` and `QueSeVe`, and `Jugadores`, a list of teams. Each team SHALL carry an optional color, a name, an optional player count, optional roles text and a list of objective lines. The lists SHALL persist as `jsonb` columns that default to an empty array.

#### Scenario: Structured fields round-trip through persistence

- **WHEN** an exercise is saved with a space, a turn duration, a drawing level, sequence, rules and what-is-seen lines, and two teams with objective lines
- **THEN** reading the exercise back returns the same values in the same order

### Requirement: Create, update and read endpoints expose the structured sheet fields

`CreateExercise` and `UpdateExercise` SHALL accept `espacio`, `turnoMinutos`, `nivelDibujo`, `secuencia`, `reglas`, `queSeVe` and `jugadores` and SHALL store them on the exercise. `GetExercises` and `GetExerciseById` SHALL return the same fields. `UpdateExercise` SHALL keep the stored `BoardStateJson` when the request sends it as null.

#### Scenario: Update stores the sheet fields and keeps the board

- **WHEN** an exercise with a stored board is updated with new sequence lines and `boardStateJson` null
- **THEN** the exercise returns the new sequence lines and its previous board state

#### Scenario: Read returns the sheet fields

- **WHEN** a coach lists exercises or reads one exercise by id
- **THEN** each exercise includes `espacio`, `turnoMinutos`, `nivelDibujo`, `secuencia`, `reglas`, `queSeVe` and `jugadores`

### Requirement: Backend applies finite caps to the structured sheet fields

The create and update validators SHALL reject a request with more than 6 teams, more than 30 lines in any list (sequence, rules, what-is-seen, or a team's objectives), a line longer than 1000 characters, a team name longer than 100 characters, roles longer than 500 characters, a player count outside 0..50, a space longer than 2000 characters, or a turn duration outside 1..240 minutes. A team color SHALL be empty or one of `blue`, `yellow`, `gray`. These caps SHALL NOT decide whether the content fits one printed sheet.

#### Scenario: Too many lines are rejected

- **WHEN** a create or update request carries 31 sequence lines
- **THEN** the request fails validation with a validation problem response

#### Scenario: Unknown team color is rejected

- **WHEN** a request carries a team whose color is `red`
- **THEN** the request fails validation

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
