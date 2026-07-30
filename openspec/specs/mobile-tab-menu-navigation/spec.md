# mobile-tab-menu-navigation Specification

## Purpose
TBD - created by archiving change mobile-regroup-tab-navigation. Update Purpose after archive.
## Requirements
### Requirement: Regrouped bottom tab bar
The Mobile app SHALL present exactly 4 tabs in the bottom tab bar of `CalendarTabs`: Noticias,
Eventos, Equipo, Competición.

#### Scenario: User sees 4 tabs
- **WHEN** an authenticated user opens the calendar/tabs screen for a team
- **THEN** the bottom tab bar shows exactly "Noticias", "Eventos", "Equipo", "Competición", in that
  order, and no other tabs

### Requirement: "Equipo" tab opens an intermediate menu
Tapping the "Equipo" tab SHALL show an intermediate list/card menu offering "Plantilla",
"Lesiones", "Sanciones", each navigating to its existing screen when tapped.

#### Scenario: Navigating from the Equipo menu to Plantilla
- **WHEN** the user taps the "Equipo" tab and then taps "Plantilla"
- **THEN** the app navigates to the existing player-roster screen (route `PlayersTab`) with the
  current `teamId`

#### Scenario: Navigating from the Equipo menu to Lesiones
- **WHEN** the user taps the "Equipo" tab and then taps "Lesiones"
- **THEN** the app navigates to the existing injuries screen (route `InjuriesTab`) with the current
  `teamId`

#### Scenario: Navigating from the Equipo menu to Sanciones
- **WHEN** the user taps the "Equipo" tab and then taps "Sanciones"
- **THEN** the app navigates to the existing sanctions screen (route `SanctionsTab`) with the
  current `teamId`

### Requirement: "Competición" tab opens an intermediate menu
Tapping the "Competición" tab SHALL show an intermediate list/card menu offering "Liga",
"Amistosos", each navigating to its existing screen when tapped.

#### Scenario: Navigating from the Competición menu to Liga
- **WHEN** the user taps the "Competición" tab and then taps "Liga"
- **THEN** the app navigates to the existing league screen (route `LeagueTab`) with the current
  `teamId`

#### Scenario: Navigating from the Competición menu to Amistosos
- **WHEN** the user taps the "Competición" tab and then taps "Amistosos"
- **THEN** the app navigates to the existing friendlies screen (route `FriendliesTab`) with the
  current `teamId` and `teamPlayerId`

### Requirement: Native back returns to the intermediate menu
The native back action (Android hardware back button / iOS back gesture) SHALL return the user to
the group's intermediate menu screen when triggered from any of the 5 grouped leaf screens reached
through "Equipo" or "Competición", instead of returning directly to the tab bar.

#### Scenario: Back from a leaf screen returns to its group menu
- **WHEN** the user is on "Plantilla" (reached via the "Equipo" menu) and triggers the native back
  action
- **THEN** the app shows the "Equipo" intermediate menu again, still within the "Equipo" tab

