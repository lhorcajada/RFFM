## ADDED Requirements

### Requirement: Rival simulation endpoint
The system SHALL expose `GET /api/teams/{teamId}/rival-stats/simulation`, available to authenticated members of the team with `Read` permission on the convocations feature. It SHALL return the number of played and pending matches of the team's RFFM league, whether the squad strength was used, the team's own RFFM code, the number of iterations, a prediction for every pending match and a projected standing for every team. The response SHALL be deterministic: the same stored data SHALL produce the same response.

#### Scenario: Simulation returned for a league with results
- **WHEN** a member of the team requests the simulation and the league has played and pending matches
- **THEN** the system returns `200` with one prediction per pending match and one projected standing per team

#### Scenario: Same data, same response
- **WHEN** the simulation is requested twice without changes in the stored data
- **THEN** both responses are identical

#### Scenario: Team without RFFM competition
- **WHEN** the team has no RFFM competition or group configured
- **THEN** the system returns `409` ProblemDetails

#### Scenario: Unknown team
- **WHEN** `teamId` does not exist
- **THEN** the system returns `404` ProblemDetails

#### Scenario: Calendar not available
- **WHEN** no rounds have been stored for the team's group
- **THEN** the system returns `404` ProblemDetails with title «Calendario no disponible»

#### Scenario: User outside the team rejected
- **WHEN** a user who is not a member of the team requests the simulation
- **THEN** the system returns `403`

### Requirement: Pending match predictions
For each pending match (a match without both scores) the system SHALL return the probabilities of a home win, a draw and an away win that add up to 1, the expected goals of each team and the most likely score. Predictions SHALL be ordered by round. Matches that already have a result SHALL NOT be predicted.

#### Scenario: Probabilities add up to one
- **WHEN** a pending match is predicted
- **THEN** its home win, draw and away win probabilities add up to 1 (±0.001)

#### Scenario: Stronger team is favourite
- **WHEN** a team that has won all its matches by large margins hosts a team that has lost all its matches
- **THEN** the home win probability is greater than the away win probability

#### Scenario: Played matches excluded
- **WHEN** a match of the calendar already has both scores
- **THEN** it does not appear among the predictions

### Requirement: Projected standings
The system SHALL simulate the pending matches of the league 10,000 times starting from the current standings (points minus sanction points, goals for and against) and return, for each team, its current position and points, its expected points, its most likely final position, its probability of finishing first and its probability of finishing in each position. Position probabilities of a team SHALL add up to 1, and the probabilities of every position across teams SHALL add up to 1. Standings SHALL be ordered by expected points.

#### Scenario: Position probabilities are consistent
- **WHEN** the projected standings are returned
- **THEN** each team's position probabilities add up to 1 and each position's probabilities across teams add up to 1 (±0.001)

#### Scenario: Expected points never below current points
- **WHEN** the projected standings are returned
- **THEN** every team's expected points are greater than or equal to its current points

#### Scenario: Season already finished
- **WHEN** the league has no pending matches
- **THEN** each team finishes in its current position with probability 1 and its expected points equal its current points

#### Scenario: Sanction points subtracted
- **WHEN** the official standings record 3 sanction points for a team
- **THEN** that team's current points are its earned points minus 3

### Requirement: Team strength blends squad and results
The system SHALL estimate each team's attack and defense by blending a squad strength prior with the team's current-season results, giving the results a weight that grows with the number of matches played (`n / (n + 6)`). The squad strength SHALL be computed from the previous season of the players in the league squad report: the final position of their team, their starter rate over call-ups and their goals per match played, weighted by each player's current-season involvement. Players without a previous season SHALL count as slightly below the league average. When no completed squad report exists for the league, the system SHALL use only the results and report `usesSquadStrength = false`.

#### Scenario: Squad decides before any match
- **WHEN** no match has been played and team A's players finished higher with their teams last season than team B's players
- **THEN** team A's squad strength and attack are greater than team B's

#### Scenario: Results dominate later in the season
- **WHEN** a team with a weak squad strength has won its first 20 matches
- **THEN** its attack is above the league average

#### Scenario: New players count as league average
- **WHEN** every player of a team lacks a previous season
- **THEN** that team's squad strength is slightly below 1 (the league average)

#### Scenario: No squad report
- **WHEN** the league has no completed squad statistics report
- **THEN** every team's squad strength is 1 and the response reports `usesSquadStrength = false`

### Requirement: Simulation page
The Coach app SHALL provide a page at `/coach/rival-stats/simulation`, opened from a «Simulación» button in «Estadísticas de rivales», with two tabs: «Partidos» and «Clasificación». «Partidos» SHALL show the pending matches grouped by round as cards with both teams, the home/draw/away percentages, the most likely score and the expected goals, with a «Solo mi equipo» filter enabled by default when the team's RFFM code is known. «Clasificación» SHALL show one card per team in order of expected points with its projected position, current and expected points, most likely position with its probability, and probability of finishing first, highlighting the user's own team. The page SHALL state that the probabilities are indicative, SHALL warn when the squad strength was not used, SHALL be usable from 360px wide and SHALL NOT use tables.

#### Scenario: Match card shows probabilities
- **WHEN** the simulation returns a pending match with 0.5 / 0.3 / 0.2 probabilities
- **THEN** its card shows 50 %, 30 % and 20 % and the most likely score

#### Scenario: Own team filter
- **WHEN** the page opens and the team's RFFM code is known
- **THEN** only the pending matches of the user's team are listed until «Solo mi equipo» is turned off

#### Scenario: Projected standings tab
- **WHEN** the user opens «Clasificación»
- **THEN** one card per team is shown in order of expected points and the user's team is highlighted

#### Scenario: Warning without squad strength
- **WHEN** the simulation reports `usesSquadStrength = false`
- **THEN** the page shows a notice suggesting to generate the rival statistics

#### Scenario: No pending matches
- **WHEN** the simulation has no pending matches
- **THEN** «Partidos» shows «No quedan partidos por disputar»

#### Scenario: Error loading
- **WHEN** the simulation request fails
- **THEN** the page shows an error message instead of the tabs
