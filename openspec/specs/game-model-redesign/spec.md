# game-model-redesign Specification

## Purpose
TBD - created by archiving change game-model-redesign. Update Purpose after archive.
## Requirements
### Requirement: The game model is navigated by phase
The read view SHALL list one button per phase that has principles, in ascending `gameMomentId` order, plus «Balón parado» when the model has set piece rules. Each button SHALL show a counter (principles of the phase, or number of set piece rules) and be at least 44 px tall. Only the content of the selected phase SHALL be shown, and the first phase SHALL be selected by default.

#### Scenario: Default phase
- **WHEN** a model with two phases is loaded
- **THEN** the first phase is pressed and only its principles are shown

#### Scenario: Change phase
- **WHEN** the coach selects another phase
- **THEN** only that phase's principles are shown and its button is pressed

#### Scenario: Set pieces entry
- **WHEN** the model has set piece rules
- **THEN** a «Balón parado» button is listed and selecting it shows each rule with its subtype label

### Requirement: Principles are shown as nested cards
Each principle SHALL be a card with its number, title and text. Its subprincipios SHALL be cards with number, title and text, containing zones (with their heading), sub-subprincipios (number, role and text), skills as chips and notes. Skills that reference another skill SHALL show «misma que» followed by the reference. The view SHALL NOT use tables.

#### Scenario: Principle and subprincipio
- **WHEN** the selected phase has a principle with a subprincipio
- **THEN** both are shown as cards with their number and title

#### Scenario: Zones and sub-subprincipios
- **WHEN** a subprincipio has a zone with a sub-subprincipio
- **THEN** the zone heading and the sub-subprincipio role and text are shown inside the subprincipio card

#### Scenario: Skill chips
- **WHEN** a sub-subprincipio has skills
- **THEN** each skill name is shown as a chip

### Requirement: Notes are shown by type
Notes SHALL be shown as callouts labelled with the note type («Riesgo aceptado», «Objetivo de temporada», «Nota», «Excepción») followed by its text.

#### Scenario: Risk note
- **WHEN** a subprincipio has a note of type riesgo-aceptado
- **THEN** a callout labelled «Riesgo aceptado» with its text is shown

### Requirement: Open issues are always visible
When the model has open issues, the view SHALL show a panel with their count and each issue's topic, description and status regardless of the selected phase.

#### Scenario: Pending panel
- **WHEN** the model has an open issue and a phase is selected
- **THEN** the issue topic and description are shown

### Requirement: Responsive without horizontal scroll
The view SHALL stack the phase navigation above the content on narrow screens and wrap its buttons, without horizontal scrolling. A model without principles, set piece rules or open issues SHALL show a message instead.

#### Scenario: Empty model
- **WHEN** the model has no principles, set piece rules or open issues
- **THEN** the message «Este modelo de juego todavía no tiene contenido.» is shown

