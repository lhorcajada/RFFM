## ADDED Requirements

### Requirement: Round simulations are saved per league
The system SHALL keep, for each round of a team's RFFM league, at most one saved simulation shared by every team of that league. The simulation of round N SHALL be computed using only the results of rounds before N, treating every match of round N and later as pending, and SHALL store the predictions of round N's matches and the projected standings at that moment. Rounds from the first one up to the first round that has not started (included) SHALL have a saved simulation after the rounds are synchronized.

#### Scenario: Simulation of an upcoming round saved
- **WHEN** rounds 1 and 2 have been played, round 3 has not started and the rounds are synchronized
- **THEN** there is a saved simulation for rounds 1, 2 and 3, and round 3's simulation contains the predictions of round 3's matches

#### Scenario: Results of later rounds are ignored
- **WHEN** the simulation of round 2 is computed after round 2 has been played
- **THEN** it is computed with the results of round 1 only, and its predictions are the same as if round 2 and later had no results

#### Scenario: One simulation per round and league
- **WHEN** two teams of the same league synchronize the rounds
- **THEN** each round has a single saved simulation

### Requirement: Round simulations freeze when the round starts
A saved simulation of a round that has not started SHALL be recomputed on every synchronization. A round SHALL be considered started when any of its matches has a result or the earliest date of its matches is today or earlier. When a round has started, its saved simulation SHALL become frozen and SHALL NOT change afterwards. When a started round has no saved simulation, the system SHALL compute it with only the results of earlier rounds and without the players' current-season involvement, and SHALL save it frozen.

#### Scenario: Upcoming round recomputed
- **WHEN** round 3 has not started and a result of round 2 changes before a new synchronization
- **THEN** round 3's saved simulation is recomputed with the new result

#### Scenario: Frozen at round start
- **WHEN** round 3 had a saved simulation and one of its matches gets a result
- **THEN** the next synchronization freezes round 3's simulation without recomputing it

#### Scenario: Frozen simulations never change
- **WHEN** the rounds are synchronized again after round 3 was frozen
- **THEN** round 3's saved simulation is unchanged

#### Scenario: Past round filled in afterwards
- **WHEN** rounds 1 and 2 were played before any simulation existed and the rounds are synchronized
- **THEN** rounds 1 and 2 get frozen simulations computed without the players' current-season involvement

### Requirement: Round synchronization endpoint
The system SHALL expose `PUT /api/teams/{teamId}/rival-stats/simulation/rounds`, available to authenticated members of the team with `Read` permission on the convocations feature, that synchronizes the saved round simulations of the team's league and returns `204`. Calling it repeatedly SHALL be safe.

#### Scenario: Synchronization succeeds
- **WHEN** a member of the team calls the endpoint
- **THEN** the system returns `204` and the round simulations are up to date

#### Scenario: Team without RFFM competition
- **WHEN** the team has no RFFM competition or group configured
- **THEN** the system returns `409` ProblemDetails

#### Scenario: League without calendar
- **WHEN** no rounds are stored for the team's group
- **THEN** the system returns `204` and saves nothing

### Requirement: Simulation history with real results
The system SHALL expose `GET /api/teams/{teamId}/rival-stats/simulation/rounds`, with the same access rules, returning the saved round simulations ordered by round. Each round SHALL include its status (`Upcoming`, `InProgress` or `Played`), whether it is frozen, its date, and, for each predicted match, the predicted 1X2 outcome (the most likely of home win, draw and away win), the real score and outcome when the match has a result, and whether the prediction was a hit (predicted outcome equals real outcome). Each round SHALL include its number of hits and evaluated matches, and the response SHALL include the totals across rounds. Each round SHALL also include its saved projected standings with every team's current real position and points.

#### Scenario: Hit when the 1X2 outcome matches
- **WHEN** a saved prediction gave the home win as the most likely outcome and the match ended 2-1
- **THEN** the match is returned with predicted outcome `Home`, real score 2-1, real outcome `Home` and hit `true`

#### Scenario: Miss when the outcome differs
- **WHEN** a saved prediction gave the home win as the most likely outcome and the match ended 1-1
- **THEN** the match is returned with real outcome `Draw` and hit `false`

#### Scenario: Pending match not evaluated
- **WHEN** a predicted match has no result yet
- **THEN** its real score, real outcome and hit are null and it is not counted as evaluated

#### Scenario: Totals across rounds
- **WHEN** round 1 has 3 hits out of 4 evaluated matches and round 2 has 1 out of 4
- **THEN** the response totals are 4 hits out of 8 evaluated matches

#### Scenario: Projected standings with real position
- **WHEN** the history is requested
- **THEN** each round's projected standings include each team's current real position and points

### Requirement: Simulation page shows predictions against results
The simulation page SHALL let the user choose, in «Partidos», between «Próximos partidos» (the current simulation) and each saved round, and, in «Clasificación», between the current projection and the projection saved before each round. In a saved round, each match card with a result SHALL show the real score and SHALL be marked green with «Acertado» when the prediction was a hit or red with «Fallado» when it was not; the round's hits SHALL be summarized, and the total hits across rounds SHALL be shown when any match has been evaluated. In a saved projection, each team card SHALL show the team's current real position. When the history cannot be loaded, the page SHALL keep showing the current simulation.

#### Scenario: Hit card in green
- **WHEN** the user selects round 1 and a match of that round was a hit
- **THEN** its card shows the real score and is marked «Acertado» in green

#### Scenario: Miss card in red
- **WHEN** the user selects round 1 and a match of that round was a miss
- **THEN** its card is marked «Fallado» in red

#### Scenario: Round and total hits
- **WHEN** the user selects a round with 3 hits out of 4 and the totals are 5 out of 8
- **THEN** the page shows «Aciertos en la jornada: 3 de 4» and «Aciertos totales: 5 de 8 (63 %)»

#### Scenario: Saved projection with real position
- **WHEN** the user selects «Antes de la jornada 2» in «Clasificación»
- **THEN** the team cards follow that saved projection and show each team's current real position

#### Scenario: History unavailable
- **WHEN** the history request fails
- **THEN** the page shows the current simulation without the round selector options for saved rounds
