# deconvocation-proposal-ui Specification

## Purpose
TBD - created by archiving change redesign-deconvocation-proposal-ui. Update Purpose after archive.
## Requirements
### Requirement: Proposal block keeps its content and order in the new design
The new design of the deconvocation proposal block SHALL show the same content as before, in the same order: the players proposed for deconvocation first, ordered by score, followed by the already-deconvoked players. Each already-deconvoked player SHALL carry the mark «Ya desconvocado». The new design SHALL NOT add, remove or reorder players or the data each row shows.

#### Scenario: Proposed players come before already-deconvoked players
- **WHEN** the panel is shown with 2 proposed players and 1 already-deconvoked player
- **THEN** the block shows the 2 proposed players first, by score, and the already-deconvoked player after them

#### Scenario: Already-deconvoked players keep their mark
- **WHEN** the panel is shown with 2 already-deconvoked players
- **THEN** each of them appears with the mark «Ya desconvocado»

#### Scenario: Already-deconvoked players are distinguishable from proposed players
- **WHEN** the block contains a proposed player and an already-deconvoked player
- **THEN** the two rows look different, and only the already-deconvoked row carries the mark «Ya desconvocado»

#### Scenario: Row data is preserved
- **WHEN** a proposed player is shown
- **THEN** the row still shows the player's name, score, position role, mandatory mark when it applies, metadata and factors, exactly as the proposal provides them

#### Scenario: No already-deconvoked players
- **WHEN** no player is already deconvoked
- **THEN** the block shows only the proposed players and no «Ya desconvocado» mark

### Requirement: Redesign does not change proposal behavior or data
The redesign SHALL be limited to the visual presentation of the proposal block. The selection of proposed players, their scores, the target count, the position warnings, the empty-list notices and the result of applying the proposal SHALL stay as they are, and no backend, API or data-model change SHALL be needed.

#### Scenario: Notices are kept
- **WHEN** no player is selected for deconvocation and the proposal has evaluated players
- **THEN** the panel still shows the notice «No hace falta desconvocar jugadores con las reglas actuales.»

#### Scenario: Only already-deconvoked players
- **WHEN** every deconvokable player is already deconvoked and there are no new proposals
- **THEN** the block shows only the already-deconvoked players with the mark «Ya desconvocado» and no empty-list notice

#### Scenario: Position warnings are kept
- **WHEN** the proposal reports that only 2 of 3 centre-backs remain
- **THEN** the panel still shows «Centrales: quedan 2 de 3»

#### Scenario: Applying the proposal is unchanged
- **WHEN** the coach applies the proposal
- **THEN** the same players are deconvoked as before the redesign, and already-deconvoked players are not deconvoked again

### Requirement: Proposal block is responsive and uses cards, not tables
The proposal block and its player rows SHALL be responsive and usable from 360px wide up to desktop, without unintended horizontal scroll. They SHALL be laid out as cards or a list that adapts to the available width, and SHALL NOT use a table or a fixed-column grid.

#### Scenario: Narrow screen
- **WHEN** the panel is shown at 360px wide
- **THEN** every row is fully readable and the panel does not scroll horizontally

#### Scenario: Wide screen
- **WHEN** the panel is shown on a desktop viewport
- **THEN** the rows use the available width as cards or a list

#### Scenario: No table markup
- **WHEN** the proposal block is rendered
- **THEN** it contains no table element and no fixed-column grid

### Requirement: Redesign follows the project's styling rules
The new design SHALL be styled with CSS Modules co-located with the component and with the theme tokens and CSS custom properties of the Coach app. It SHALL NOT use inline styles or Emotion `styled()` for the new design, nor hardcode new colors or spacings that the user has not approved.

#### Scenario: Styles live in CSS Modules
- **WHEN** the redesigned block is implemented
- **THEN** its styles are in the CSS Module of the component and the new design adds no inline style and no `styled()` call

#### Scenario: No new hardcoded design values
- **WHEN** the redesigned block needs a color or spacing
- **THEN** it takes the value from the Coach theme or an existing CSS custom property

### Requirement: Visual design is produced with the design flow before implementation
The new visual design of the proposal block SHALL be produced with the `/design` flow, with its files kept inside the project under `.design/<name>/`, and SHALL be made on the final content of the list, which includes the already-deconvoked players.

#### Scenario: Design files location
- **WHEN** the visual design is produced
- **THEN** its files are under `.design/<name>/` inside the project and not in a temporary directory

#### Scenario: Design covers the final list content
- **WHEN** the visual design is reviewed
- **THEN** it shows proposed players and already-deconvoked players with the mark «Ya desconvocado» in the same block

