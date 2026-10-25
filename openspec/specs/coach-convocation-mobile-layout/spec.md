# coach-convocation-mobile-layout Specification

## Purpose
TBD - created by archiving change coach-convocation-mobile-layout. Update Purpose after archive.
## Requirements
### Requirement: The own player is shown first, outside the groups
When a Player or FamilyMember (without the Coach or Administrator role) opens the «Convocatoria» tab of an event and their associated player is in any list of the tab (waiting list, «Pendientes de respuesta», «Disponibles», «Pendientes de aceptar», «Aceptados», «Convocados» or «Desconvocados»), the tab SHALL show that player in a «Tu jugador» card above every group, with their photo, dorsal, name, position and status, and SHALL NOT show them inside any group. Group counters SHALL exclude that player. A Coach or Administrator SHALL NOT see the «Tu jugador» card.

#### Scenario: Pending convocation of the own player
- **WHEN** a family member opens a training whose associated player has a pending convocation
- **THEN** the «Tu jugador» card shows the player with status «Pendiente» and the actions «Aceptar» and «Rechazar»
- **AND** the player is not listed under «Pendientes de aceptar», whose counter excludes them

#### Scenario: Accepted own player
- **WHEN** a player opens an event where their convocation is accepted
- **THEN** the «Tu jugador» card shows status «Va» and the player is not listed under «Aceptados»

#### Scenario: Deconvoked own player
- **WHEN** a player opens an event where their convocation is deconvoked with a reason
- **THEN** the «Tu jugador» card shows status «No va» and the reason

#### Scenario: Coach does not see the card
- **WHEN** a coach opens the «Convocatoria» tab
- **THEN** no «Tu jugador» card is shown and every player is listed in their group

#### Scenario: Associated player not in the event
- **WHEN** a family member opens an event where the associated player appears in no list
- **THEN** no «Tu jugador» card is shown

### Requirement: The convocation tab shows a summary
The «Convocatoria» tab SHALL show, above the groups, four counters: «Convocados», «Van», «Pendientes» and «Bajas». «Convocados» SHALL count the convocations with a player plus the injured players without convocation; «Van» the accepted convocations (for league matches, pending and accepted convocations); «Pendientes» the pending convocations (for league matches, the players in «Pendientes de respuesta»); «Bajas» the deconvoked convocations plus the injured players without convocation. The counters SHALL include the own player.

#### Scenario: Summary for a training
- **WHEN** a training has 8 accepted, 2 pending and 2 deconvoked convocations
- **THEN** the summary shows Convocados 12, Van 8, Pendientes 2 and Bajas 2

### Requirement: Players are listed as compact rows
Every player list of the «Convocatoria» tab SHALL show each player as a compact row with a circular photo (or the default avatar), the dorsal, the name, the position tag, a status chip and the available actions, instead of a card with a large photo. Every action SHALL keep its current accessible name. For a coach, the actions «Desconvocar» and «Lista de espera» of an accepted convocation SHALL be inside a menu opened from a «⋮» button.

#### Scenario: Accepted convocation for a coach
- **WHEN** a coach opens the actions menu of an accepted player
- **THEN** the menu offers «Desconvocar» and «Lista de espera»

#### Scenario: Pending convocation for a coach
- **WHEN** a coach sees a player in «Pendientes de aceptar»
- **THEN** the row shows the buttons «Aceptar» and «Rechazar»

#### Scenario: Injured player
- **WHEN** a player without convocation is injured
- **THEN** their row in «Desconvocados» shows «Lesionado»

### Requirement: Player or family member groups default
For a Player or FamilyMember, the «Aceptados» group SHALL start expanded and every other collapsible group of the «Convocatoria» tab SHALL start collapsed. Empty groups SHALL start collapsed.

#### Scenario: Default expanded group
- **WHEN** a family member opens a training with accepted and pending convocations
- **THEN** «Aceptados» is expanded and «Pendientes de aceptar» is collapsed

### Requirement: Event information is shown as a compact card
The event detail screen SHALL show the event information as a compact card with: the event type chip and name; the date and the start–end time (or «Por confirmar» when there is no date and no start time) followed by the arrival time when set; the location, linked to its map when a map URL exists; the rival for matches and friendlies; and the description. A description longer than 140 characters SHALL be shown clamped with a «Ver más» button that expands it and turns into «Ver menos».

#### Scenario: Schedule on one line
- **WHEN** an event starts at 10:30, ends at 12:00 and the arrival is at 10:00
- **THEN** the card shows «10:30–12:00» and «Llegada 10:00»

#### Scenario: Unscheduled event
- **WHEN** an event has neither date nor start time
- **THEN** the card shows «Por confirmar» and no arrival time

#### Scenario: Long description
- **WHEN** the description is longer than 140 characters and the user clicks «Ver más»
- **THEN** the full description is shown and the button reads «Ver menos»

#### Scenario: Short description
- **WHEN** the description is 140 characters or shorter
- **THEN** it is shown in full without a «Ver más» button

