## ADDED Requirements

### Requirement: The club dashboard header identifies the club
The club dashboard SHALL show the club's emblem and name and a "Volver" icon button that navigates to the coach home (`/coach/dashboard`).

#### Scenario: Club identity shown
- **WHEN** the club dashboard is opened for a club
- **THEN** the club header (emblem and name) is shown

#### Scenario: Back to the coach home
- **WHEN** the user presses the "Volver" button
- **THEN** the app navigates to `/coach/dashboard`

### Requirement: The club dashboard offers quick actions
The club dashboard SHALL show an "Acciones rápidas" section with links to: Equipos (`/coach/clubs/{id}/teams`), Jugadores (`/coach/clubs/{id}/players`), Personal (`/scope/members?scope=club&id={id}`), Inscripciones (`/coach/clubs/{id}/registrations`), Solicitudes de acceso (`/club-join-requests?clubId={id}`) and Nuevo equipo (`/coach/clubs/{id}/teams/new`). The links to the teams, players and registrations pages SHALL keep the `seasonId` query parameter when the dashboard has one. The Equipos and Nuevo equipo actions SHALL be shown only to users with access to the club teams feature.

#### Scenario: Actions with their destinations
- **WHEN** the club dashboard is opened for club C
- **THEN** each quick action links to its destination for club C

#### Scenario: Season preserved
- **WHEN** the dashboard is opened with `seasonId=S`
- **THEN** the Equipos, Jugadores and Inscripciones links include `seasonId=S`

#### Scenario: No access to club teams
- **WHEN** the user does not have access to the club teams feature
- **THEN** the Equipos and Nuevo equipo actions are not shown

### Requirement: The club dashboard lists the club teams
The club dashboard SHALL show a "Equipos del club" widget listing the club's teams of the selected season, each row showing the team name and its category and linking to the team dashboard (`/coach/team-dashboard?teamId={teamId}`). It SHALL show a "Ver todos" link to the club teams page, a loading indicator while loading and an empty message when the club has no teams.

#### Scenario: Teams listed
- **WHEN** the club has teams
- **THEN** each team is listed with its name and category and links to its dashboard

#### Scenario: No teams
- **WHEN** the club has no teams
- **THEN** the message "El club no tiene equipos" is shown

#### Scenario: Teams fail to load
- **WHEN** loading the teams fails
- **THEN** the widget shows an error message and the rest of the dashboard keeps working

### Requirement: The club dashboard shows pending access requests
The club dashboard SHALL show a "Pendiente de revisar" section with the number of pending access requests of the club, linking to the club join requests page. When there are none, the section SHALL show "Nada pendiente".

#### Scenario: Pending requests
- **WHEN** the club has 3 pending access requests
- **THEN** the section shows the count 3 and links to the club join requests page

#### Scenario: Nothing pending
- **WHEN** the club has no pending access requests
- **THEN** the section shows "Nada pendiente"

### Requirement: The club dashboard is responsive
The club dashboard SHALL arrange its widgets in two columns from 769px wide and stacked in a single column below that width, without tables or fixed-width columns.

#### Scenario: Narrow screen
- **WHEN** the viewport is narrower than 769px
- **THEN** the teams widget, the quick actions and the pending section are stacked in one column
