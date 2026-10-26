# squad-roster-tab Specification

## Purpose
TBD - created by archiving change squad-tabs-redesign. Update Purpose after archive.
## Requirements
### Requirement: Squad summary
The «Plantilla» tab SHALL show a compact summary, on a single line where space allows, with the total number of players and the number of injured players, computed from the loaded roster. The number of players per position SHALL be shown inside the position filter chips instead of in the summary.

#### Scenario: Summary figures
- **WHEN** the roster has 10 players, 2 of them goalkeepers and 1 injured
- **THEN** the summary shows 10 players and 1 injured, and the goalkeepers chip shows 2

### Requirement: Position filter and search
The tab SHALL offer a chip «Todos» plus one chip per position present (each showing its player count), and a search box matching name or alias. Filters SHALL apply on the client and SHALL be combinable. With no match the tab SHALL show an empty state with a «Quitar filtros» action.

#### Scenario: Filter by position
- **WHEN** the coach presses the chip of a position
- **THEN** only the players of that position are listed and that chip is marked as pressed

#### Scenario: Search
- **WHEN** the coach types part of a name or alias
- **THEN** only matching players are listed

#### Scenario: No results
- **WHEN** no player matches the filters
- **THEN** the empty state is shown and «Quitar filtros» restores the full roster

### Requirement: Player card
Each player SHALL be shown as a card with avatar, jersey number, name (the alias when there is one), position, an «Lesionado» chip when injured (with the existing action to discharge the injury for users who may), the form bars (Ef/R/C) and the «Solo liga» block. The whole card SHALL link to the player's page whenever the user is allowed to open it.

#### Scenario: Injured player
- **WHEN** a player is injured
- **THEN** the card shows the «Lesionado» chip

#### Scenario: Card link
- **WHEN** a coach selects a card
- **THEN** the player's page opens

