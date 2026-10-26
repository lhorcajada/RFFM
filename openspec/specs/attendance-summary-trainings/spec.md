# attendance-summary-trainings Specification

## Purpose
TBD - created by archiving change attendance-summary-redesign. Update Purpose after archive.
## Requirements
### Requirement: Player search and order
The «Entrenamientos» tab SHALL let the user filter players by name and order them by lowest attendance or by name.

#### Scenario: Search
- **WHEN** the user types «hug»
- **THEN** only players whose name contains «hug» remain

### Requirement: Player card
Each player card SHALL show avatar, dorsal, attended of possible sessions, the rate as text and a progress bar, and an expandable list of absences with date, reason and event.

#### Scenario: Player without absences
- **WHEN** a player has no absences and the card is expanded
- **THEN** it shows «Sin ausencias registradas»

### Requirement: Excel export kept
The «Exportar Excel» action SHALL remain available to non-player roles only.

#### Scenario: Player role
- **WHEN** the user has the player role
- **THEN** the export button is not shown

