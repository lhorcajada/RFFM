# app-selector-redesign Specification

## Purpose
TBD - created by archiving change app-selector-redesign. Update Purpose after archive.
## Requirements
### Requirement: Selector header guidance
The app selector SHALL show a brand label, the title «Selecciona tu aplicación» and a help line.

#### Scenario: Header
- **WHEN** the selector is shown
- **THEN** it displays «FutbolBase», the title and the text «Elige desde dónde quieres trabajar»

### Requirement: Access line and enter action on app cards
Each app card SHALL show who can access it and a visible «Entrar» action without changing the card's navigation behaviour.

#### Scenario: Access line
- **WHEN** the selector is shown
- **THEN** the Federación card shows «Acceso: administración y federación» and the Mi equipo card shows «Entrenadores, jugadores y familias»

#### Scenario: Enter action
- **WHEN** the selector is shown
- **THEN** each card shows the text «Entrar»

#### Scenario: Navigation preserved
- **WHEN** a user without Federation permissions clicks the Federación card
- **THEN** the existing permission warning is shown instead of navigating

### Requirement: No header indicators on the selector
The app selector SHALL NOT show the team fund indicator or the notifications bell in the page header.

#### Scenario: Indicators hidden
- **WHEN** the selector is shown to a user with a team fund and notifications
- **THEN** the header shows neither the fund balance nor the notifications bell

