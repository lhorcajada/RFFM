# coach-settings-redesign Specification

## Purpose
TBD - created by archiving change coach-settings-redesign. Update Purpose after archive.
## Requirements
### Requirement: Section navigation without horizontal scroll
The coach settings page SHALL let the user switch section on narrow screens through a selector that hides the section list until opened.

#### Scenario: Mobile selector closed
- **WHEN** the viewport is 600px wide or less
- **THEN** only the selector showing the current section is visible, not the list

#### Scenario: Mobile selector open
- **WHEN** the user opens the selector and chooses «Mis equipos»
- **THEN** the list closes and the «Mis equipos» section is shown

#### Scenario: Desktop list
- **WHEN** the viewport is wider than 600px
- **THEN** all sections are listed and the active one is marked as current

### Requirement: Role-based sections preserved
Players and family members SHALL only see the «Notificaciones» section.

#### Scenario: Player role
- **WHEN** the user is a player and not a coach
- **THEN** only «Notificaciones» is available

### Requirement: Lists as cards
Seasons, clubs and teams SHALL be listed as cards at every screen size, never as tables.

#### Scenario: Desktop list
- **WHEN** the user opens Temporadas, Mis clubes or Mis equipos on a wide screen
- **THEN** each item is a card and no table is rendered

#### Scenario: Active season highlighted
- **WHEN** a club has an active season and previous ones
- **THEN** the active one is shown under «Temporada activa» and the rest under «Anteriores»

### Requirement: Forms in a side panel
Creating or editing a season and creating a club SHALL open in a titled side panel with a close button.

#### Scenario: Edit season
- **WHEN** the user presses «Editar temporada»
- **THEN** a panel titled «Editar temporada» opens with the season fields

#### Scenario: Create club
- **WHEN** the user presses «Crear club»
- **THEN** a panel titled «Crear club» opens with name, country and emblem

### Requirement: Theme-aware colors
The settings screens SHALL take their colors from the theme variables so they match both the development and production themes.

#### Scenario: Theme change
- **WHEN** the app runs with the development or the production theme
- **THEN** accents, surfaces and text follow `--rffm-dash-*` without fixed colors

### Requirement: Team form in sections
Creating and editing a team SHALL present the fields in titled sections with a bottom action bar.

#### Scenario: Edit team sections
- **WHEN** the user opens the edit team page
- **THEN** it shows «Datos del equipo» and «Competición RFFM» sections

#### Scenario: Cancel
- **WHEN** the user presses «Cancelar»
- **THEN** the page leaves without saving

