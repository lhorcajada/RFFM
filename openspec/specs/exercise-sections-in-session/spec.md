# exercise-sections-in-session Specification

## Purpose
TBD - created by archiving change exercise-sheet-content-rework. Update Purpose after archive.
## Requirements
### Requirement: Session views label the exercise description as Qué se hace

The session block editor's exercise card and the player's session exercise card SHALL label the exercise `descripcion` as «Qué se hace» instead of «Descripción». Both SHALL keep hiding the section when `descripcion` is empty.

#### Scenario: Session block editor shows Qué se hace

- **WHEN** a session block lists an exercise whose `descripcion` is not blank
- **THEN** its exercise card shows the text under the label «Qué se hace» and no «Descripción» label

#### Scenario: Player card shows Qué se hace

- **WHEN** the player session exercise card is expanded for an exercise whose `descripcion` is not blank
- **THEN** it shows the text under the title «Qué se hace» and no «Descripción» title

### Requirement: Player session exercise card shows no Porteros line

The player's session exercise card SHALL NOT show a «Porteros» section, whatever value is stored for the exercise.

#### Scenario: Porteros is not shown

- **WHEN** the player session exercise card is expanded for an exercise
- **THEN** it shows no «Porteros» section

