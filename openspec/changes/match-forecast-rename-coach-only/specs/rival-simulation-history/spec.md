## MODIFIED Requirements

### Requirement: Round synchronization endpoint
The system SHALL expose `PUT /api/teams/{teamId}/match-forecast/simulation/rounds`, available to authenticated members of the team with `Read` permission on the convocations feature, that synchronizes the saved round simulations of the team's league and returns `204`. Calling it repeatedly SHALL be safe.

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
The system SHALL expose `GET /api/teams/{teamId}/match-forecast/simulation/rounds`, with the same access rules, returning the saved round simulations ordered by round. Each round SHALL include its status (`Upcoming`, `InProgress` or `Played`), whether it is frozen, its date, and, for each predicted match, the predicted 1X2 outcome (the most likely of home win, draw and away win), the real score and outcome when the match has a result, and whether the prediction was a hit (predicted outcome equals real outcome). Each round SHALL include its number of hits and evaluated matches, and the response SHALL include the totals across rounds. Each round SHALL also include its saved projected standings with every team's current real position and points.

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
