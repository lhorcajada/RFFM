# player-tracking-session-recap Specification

## Purpose
TBD - created by archiving change player-tracking-session-recap. Update Purpose after archive.
## Requirements
### Requirement: Coaches choose a recent session to evaluate a player
The «Seguimiento» tab SHALL offer a «Sesión» selector with «Sin sesión» (default) and the team's training sessions dated within the last 30 days up to today, most recent first, labelled `dd/MM · {name}`. With «Sin sesión» the standalone observation form (date and Subprincipio) SHALL be shown. When the team has no recent sessions or they cannot be loaded, the selector SHALL not be shown.

#### Scenario: Only recent dated sessions
- **WHEN** the team has a session 10 days ago, one 40 days ago, one tomorrow and one without date
- **THEN** only the session of 10 days ago is offered

#### Scenario: Without session keeps the standalone form
- **WHEN** «Sin sesión» is selected
- **THEN** the form with date and Subprincipio selector is shown

### Requirement: Evaluating a session uses its date and Subprincipios
When a session is selected, the form SHALL NOT show a date field nor a Subprincipio selector. It SHALL show one block per Subprincipio targeted by the session (grouping its Sub-subprincipios, with their roles and zones), each with the assessments «Lo hace», «A veces», «No lo hace» and an optional comment. «Guardar» SHALL be enabled when at least one block is assessed and SHALL create one observation per assessed block with the session date; unassessed blocks SHALL not be saved. Saved blocks SHALL be cleared and failed ones SHALL keep their values. A session without targets SHALL show that it has no associated Subprincipios.

#### Scenario: One observation per assessed Subprincipio
- **WHEN** the session of 14/10/2026 targets «Circular para desordenar» and «Asegurar tras robo» and the coach marks only «Circular para desordenar» as «No lo hace» with a comment and saves
- **THEN** exactly one observation is created with date `2026-10-14`, that Subprincipio, `NotAchieved` and the comment

#### Scenario: No date nor Subprincipio selector
- **WHEN** a session is selected
- **THEN** neither a date field nor a Subprincipio selector is shown

#### Scenario: Save disabled without assessments
- **WHEN** no block is assessed
- **THEN** «Guardar» is disabled

#### Scenario: Partial failure keeps failed blocks
- **WHEN** two blocks are assessed and saving the second fails
- **THEN** the first block is cleared, the second keeps its assessment and comment, and an error snackbar is shown

#### Scenario: Session without Subprincipios
- **WHEN** the selected session has no targets
- **THEN** a message says it has no Subprincipios of the game model associated and no assessment blocks are shown

### Requirement: The session form shows what was done
When a session is selected, the form SHALL show the session's general objective and its exercises grouped by block, expanded, each with name, objective and duration.

#### Scenario: Exercises visible
- **WHEN** the session has block «Parte principal» with exercise «Rondo 4x4+3» (objective «Circular con paciencia», 15 minutes)
- **THEN** «Parte principal», «Rondo 4x4+3» and «Circular con paciencia · 15'» are visible without expanding anything

### Requirement: The coach is warned when the player did not attend
When a session is selected, the form SHALL show the player's attendance to the session's calendar event: a warning when the player did not attend (with or without excuse) that makes the comment mandatory in every assessed block; an informative notice when the player arrived late; an informative notice when no attendance is recorded for the player; and an informative notice when the session is not linked to a calendar event. No notice SHALL be shown when the player attended.

#### Scenario: Absent player
- **WHEN** the player has «No asiste sin excusa» for the session's event
- **THEN** a warning says the player did not attend (without excuse) and asks to explain it in the comment

#### Scenario: Comment mandatory when absent
- **WHEN** the player did not attend and the coach assesses a block without comment
- **THEN** «Guardar» is disabled and the comment shows «Indica por qué: no asistió al entrenamiento»

#### Scenario: Late player
- **WHEN** the player has «Llega tarde»
- **THEN** an informative notice says the player arrived late and comments stay optional

#### Scenario: Attendance not recorded
- **WHEN** the player has no attendance for the event
- **THEN** a notice says no attendance is recorded for the player in this session

#### Scenario: Session not linked to an event
- **WHEN** the session has no calendar event
- **THEN** a notice says attendance cannot be checked

