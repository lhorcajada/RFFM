## REMOVED Requirements

### Requirement: An exercise SHALL support multiple simultaneous types
**Reason**: Superseded by this change — the reduced content template (`docs/game-model/Plantilla-Ejercicio.md`) uses a single `Tipo` axis (`Analitico | Situacional | Global`), not a multi-select of 6 independent type axes. See `specs/exercises/spec.md`'s "Exercise follows the reduced content template" requirement.
**Migration**: No data migration — development exercises are wiped as part of this change (see `design.md` §2, migration 1). The `TaskTrainingType`/`ExerciseType` catalog tables are dropped.

A coach creating or editing an exercise SHALL be able to select one or more of the 6 available exercise types (Physical, Technical, Tactical, Game, Cognitive, Psychological). At least one type is required; all 6 may be selected at once.

#### Scenario: Selecting multiple types when creating an exercise
- **WHEN** a coach creates a new exercise and selects both Physical and Tactical as types
- **THEN** the exercise is saved with both types associated to it

### Requirement: Type-specific fields SHALL be shown for every selected type
**Reason**: Superseded — the reduced template folds all logistics (players/material/time) into a single free-text `Logistica` field rather than per-type structured fields.
**Migration**: None — fields dropped, see `specs/exercises/spec.md`.

When an exercise has multiple types selected, the fields specific to each of those types SHALL all be shown and editable at once, without one type's fields hiding another's.

#### Scenario: Physical and Technical fields shown together
- **WHEN** a coach selects both Physical and Technical as types for an exercise
- **THEN** the Series/Duration/Rest fields (Physical) and the Touches/Wildcards fields (Technical) are all visible in the form at the same time

### Requirement: Exercise cards SHALL display one chip per assigned type
**Reason**: Superseded — a single `Tipo` value now renders as one badge, per `specs/exercises/spec.md`.
**Migration**: None.

Wherever an exercise is shown as a card (exercise library, game-model principle sections), it SHALL display one chip/badge per type currently assigned to it.

#### Scenario: Card shows a chip for each of the exercise's types
- **WHEN** an exercise has 3 types assigned (e.g. Physical, Game, Psychological)
- **THEN** its card renders exactly 3 type chips, one per assigned type

### Requirement: Exercise types SHALL be seeded on startup
**Reason**: Superseded — `Tipo` is now a fixed 3-value enum (`Analitico | Situacional | Global`), not a seeded catalog table.
**Migration**: None — the `ExerciseTypes` table is dropped (see `design.md` §2, migration 2).

The 6 exercise types (Physical, Technical, Tactical, Game, Cognitive, Psychological) SHALL exist in the database without manual setup, seeded automatically when the application starts against an empty exercise-types table.

#### Scenario: Fresh database gets all 6 exercise types seeded
- **WHEN** the API starts against a database with no exercise types yet
- **THEN** all 6 exercise types (Physical, Technical, Tactical, Game, Cognitive, Psychological) exist afterward
