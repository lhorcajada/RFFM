## ADDED Requirements

### Requirement: "Mis equipos" lists and manages the active season's teams
In Coach Settings, "Mis equipos" (`TeamManager.tsx`) SHALL list the teams of the club's active
season and SHALL provide an entry point to edit a team's data (name, category, league, shield),
visible only to users allowed to edit that specific team.

#### Scenario: Editable team shows an edit entry point
- **GIVEN** the current user is `Coach` of a listed team, or `Directive` of that team's club
- **WHEN** the user opens Settings → "Mis equipos"
- **THEN** an "Editar" button/icon is visible for that team, and activating it navigates to the
  existing team edit form (`/coach/clubs/{clubId}/teams/{teamId}/edit`) pre-filled with that
  team's current data

#### Scenario: Non-editable team hides the edit entry point
- **GIVEN** the current user is neither `Coach` of a listed team nor `Directive` of that team's
  club
- **WHEN** the user opens Settings → "Mis equipos"
- **THEN** no "Editar" button/icon is shown for that team

#### Scenario: Successful edit reflects in the list
- **GIVEN** the user has permission to edit a team and submits valid changes in the edit form
- **WHEN** the save succeeds
- **THEN** the updated team data is reflected next time "Mis equipos" loads that team
