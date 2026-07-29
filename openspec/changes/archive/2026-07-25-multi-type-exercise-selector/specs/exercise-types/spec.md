## ADDED Requirements

### Requirement: An exercise SHALL support multiple simultaneous types
A coach creating or editing an exercise SHALL be able to select one or more of the 6 available exercise types (Physical, Technical, Tactical, Game, Cognitive, Psychological). At least one type is required; all 6 may be selected at once.

#### Scenario: Selecting multiple types when creating an exercise
- **WHEN** a coach creates a new exercise and selects both Physical and Tactical as types
- **THEN** the exercise is saved with both types associated to it

#### Scenario: Selecting all six types
- **WHEN** a coach selects all 6 available types for an exercise
- **THEN** the exercise is saved with all 6 types associated to it

#### Scenario: At least one type is required
- **WHEN** a coach attempts to save an exercise with zero types selected
- **THEN** the save is rejected and the exercise is not created or updated

#### Scenario: Editing an exercise's type selection
- **WHEN** a coach edits an existing exercise, removes one of its types, and adds a different one
- **THEN** the exercise's stored types reflect exactly the new selection (the removed type is no longer associated, the added type is)

### Requirement: Type-specific fields SHALL be shown for every selected type
When an exercise has multiple types selected, the fields specific to each of those types SHALL all be shown and editable at once, without one type's fields hiding another's.

#### Scenario: Physical and Technical fields shown together
- **WHEN** a coach selects both Physical and Technical as types for an exercise
- **THEN** the Series/Duration/Rest fields (Physical) and the Touches/Wildcards fields (Technical) are all visible in the form at the same time

### Requirement: Exercise cards SHALL display one chip per assigned type
Wherever an exercise is shown as a card (exercise library, game-model principle sections), it SHALL display one chip/badge per type currently assigned to it.

#### Scenario: Card shows a chip for each of the exercise's types
- **WHEN** an exercise has 3 types assigned (e.g. Physical, Game, Psychological)
- **THEN** its card renders exactly 3 type chips, one per assigned type

### Requirement: Exercise types SHALL be seeded on startup
The 6 exercise types (Physical, Technical, Tactical, Game, Cognitive, Psychological) SHALL exist in the database without manual setup, seeded automatically when the application starts against an empty exercise-types table.

#### Scenario: Fresh database gets all 6 exercise types seeded
- **WHEN** the API starts against a database with no exercise types yet
- **THEN** all 6 exercise types (Physical, Technical, Tactical, Game, Cognitive, Psychological) exist afterward

#### Scenario: Seeding is idempotent
- **WHEN** the API starts against a database that already has the 6 exercise types
- **THEN** no duplicate exercise types are created
