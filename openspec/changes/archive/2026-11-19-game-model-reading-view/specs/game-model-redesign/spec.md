## MODIFIED Requirements

### Requirement: Principles are shown as nested cards
Each principle SHALL be a collapsible section with its number, title and text. Its subprincipios SHALL be cards with number, title and text, containing zones (with their heading), sub-subprincipios (number, role and text), skills and notes. Each skill SHALL show its name and, unless it references another skill, its description and trainable text. Skills that reference another skill SHALL show «misma que» followed by the reference. The view SHALL NOT use tables.

#### Scenario: Principle and subprincipio
- **WHEN** a phase has a principle with a subprincipio
- **THEN** both are shown with their number and title

#### Scenario: Zones and sub-subprincipios
- **WHEN** a subprincipio has a zone with a sub-subprincipio and the zone level is expanded
- **THEN** the zone heading and the sub-subprincipio role and text are shown inside the subprincipio card

#### Scenario: Skill chips
- **WHEN** a sub-subprincipio with skills is expanded
- **THEN** each skill name is listed under it

### Requirement: Open issues are always visible
When the model has open issues, the view SHALL show a panel with their count and the topic, description and status of each issue regardless of the search, depth level or collapse state.

#### Scenario: Pending panel
- **WHEN** the model has an open issue and a search is active or every node is collapsed
- **THEN** the issue topic and description are shown

### Requirement: Responsive without horizontal scroll
The view SHALL adapt to narrow screens without horizontal scrolling: below the medium breakpoint the index SHALL open from an «Ir a…» button instead of a fixed side panel, and the open issues SHALL stay visible above the content. A model without principles, set piece rules or open issues SHALL show a message instead.

#### Scenario: Empty model
- **WHEN** the model has no principles, set piece rules or open issues
- **THEN** the message «Este modelo de juego todavía no tiene contenido.» is shown

#### Scenario: Narrow screen layout
- **WHEN** the view is shown on a narrow screen
- **THEN** no fixed index panel is shown, an «Ir a…» button is offered and the open issues stay visible

## REMOVED Requirements

### Requirement: The game model is navigated by phase
**Reason**: The read view no longer shows one phase at a time; it shows every phase in one searchable, collapsible outline.
**Migration**: Use search, the index or a direct link to reach a phase; the «Balón parado» section is now part of the outline (see `game-model-reading-view`).
