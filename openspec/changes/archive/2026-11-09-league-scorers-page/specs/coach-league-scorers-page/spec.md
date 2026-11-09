## Purpose

Define la página «Goleadores» de la app Coach, que muestra por jornada los partidos con sus goles y la clasificación acumulada de máximos goleadores de la liga del equipo.

## ADDED Requirements

### Requirement: Scorers page reachable from the team
The Coach app SHALL provide a «Goleadores» page for the team being viewed, reachable from the team menu and loaded lazily. The page SHALL show the league scorers of that team's group.

#### Scenario: Open from the menu
- **WHEN** the coach selects «Goleadores» in the team menu
- **THEN** the page opens for the current team and shows the latest round with goals

### Requirement: Round selector
The page SHALL show a «Jornada» dropdown selector listing every round as «Jornada N», with the shown round selected. The page SHALL NOT use a horizontally scrolling row of round buttons. Selecting a round SHALL show that round's matches and the ranking accumulated up to it.

#### Scenario: Change round
- **WHEN** the coach selects «Jornada 6» in the selector
- **THEN** the matches of round 6 and the ranking up to round 6 are shown and the selector shows «Jornada 6»

#### Scenario: Default selection
- **WHEN** the page loads
- **THEN** the selector shows the latest round with closed matches

### Requirement: Match cards with goals
For the selected round the page SHALL show one card per match with both team names, the score, the date and the list of goals. Each goal row SHALL show the minute, the player name, the team and, when applicable, a tag «Penalti» or «En propia». The coach's own team's match SHALL carry a «Mi equipo» tag. Goal counts for the round SHALL be shown in the page header.

#### Scenario: Goal rows
- **WHEN** a match has a penalty goal at minute 44
- **THEN** its row shows «44'», the player, the team and the tag «Penalti»

#### Scenario: Season total in brackets
- **WHEN** a goal's player has 9 season goals
- **THEN** the goal row shows «(9)» right after the player name

#### Scenario: No total for own goals
- **WHEN** a goal is an own goal
- **THEN** its row shows no number in brackets

#### Scenario: Own team match
- **WHEN** the own team plays in the selected round
- **THEN** that card shows «Mi equipo»

### Requirement: Scorers ranking
The page SHALL show a «Máximos goleadores» ranking with position, player, team and goals, and the note «Clasificación acumulada hasta la jornada N». The first position SHALL be visually highlighted.

#### Scenario: Ranking visible
- **WHEN** the round 8 data is loaded
- **THEN** the ranking lists players ordered by goals with the leader highlighted

### Requirement: Pending, empty, loading and error states
A match flagged with pending acta SHALL show «Acta pendiente» instead of goals. A played match without goals SHALL show «Sin goles». With no rounds the page SHALL show an empty-state message. While loading it SHALL show a progress indicator, and on failure an error message with a «Reintentar» action.

#### Scenario: Pending acta
- **WHEN** a match arrives with the pending-acta flag
- **THEN** the card shows «Acta pendiente» and no goal rows

#### Scenario: 0–0 match
- **WHEN** a played match has no goals and no pending flag
- **THEN** the card shows «Sin goles»

#### Scenario: Request fails
- **WHEN** the request fails
- **THEN** an error message and «Reintentar» are shown and pressing it reloads

#### Scenario: Team without league
- **WHEN** the team has no league
- **THEN** a message explains that the team has no league associated

### Requirement: Download missing actas of the round
When the selected round has at least one match flagged with pending acta, the page SHALL show an «Actualizar actas» button next to the round selector, and SHALL NOT show it otherwise. Pressing it SHALL request the download of the missing actas of the selected round, disable the button while it runs, then reload the page data and report the result with a notification: success when all were stored, warning when some failed, error when the request failed. Opening the page or changing round SHALL NOT trigger any download.

#### Scenario: Button with pending actas
- **WHEN** the selected round has a match with pending acta
- **THEN** «Actualizar actas» is shown

#### Scenario: Nothing pending
- **WHEN** no match of the round has pending acta
- **THEN** «Actualizar actas» is not shown

#### Scenario: Successful download
- **WHEN** the coach presses «Actualizar actas» and 2 actas are stored
- **THEN** the data is reloaded and the notification «Se han guardado 2 actas.» is shown

#### Scenario: Partial failure
- **WHEN** 1 acta is stored and 2 fail
- **THEN** the warning «Se ha guardado 1 acta y 2 no han podido descargarse.» is shown

#### Scenario: Request fails
- **WHEN** the download request fails
- **THEN** the error «No se han podido descargar las actas.» is shown

### Requirement: Responsive layout without tables
The page SHALL use cards and lists, never tables, and SHALL be usable from 360 px wide to desktop. On wide screens the matches and the ranking are side by side, with the ranking at the side. On narrow screens the ranking «Máximos goleadores» SHALL come first, before the matches of the round.

#### Scenario: Narrow screen
- **WHEN** the viewport is 390 px wide
- **THEN** there is no horizontal page scroll and the ranking appears above the matches

#### Scenario: Wide screen
- **WHEN** the viewport is 1280 px wide
- **THEN** the matches are in the main column and the ranking is in the side column
