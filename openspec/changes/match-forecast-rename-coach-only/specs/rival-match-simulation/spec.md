## MODIFIED Requirements

### Requirement: Rival simulation endpoint
The system SHALL expose `GET /api/teams/{teamId}/match-forecast/simulation`, available to authenticated members of the team with `Read` permission on the convocations feature. It SHALL return the number of played and pending matches of the team's RFFM league, whether the squad strength was used, the team's own RFFM code, the number of iterations, a prediction for every pending match and a projected standing for every team. The response SHALL be deterministic: the same stored data SHALL produce the same response.

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

### Requirement: Simulation page
The Coach app SHALL provide a page at `/coach/match-forecast/simulation`, opened from a «Crear pronóstico» button in «Pronóstico de partidos» that only the Coach role sees, with two tabs: «Partidos» and «Clasificación». «Partidos» SHALL show the pending matches grouped by round as cards with both teams, the home/draw/away percentages, the most likely score and the expected goals, with a «Solo mi equipo» filter enabled by default when the team's RFFM code is known. «Clasificación» SHALL show one card per team in order of expected points with its projected position, current and expected points, most likely position with its probability, and probability of finishing first, highlighting the user's own team. The page SHALL state that the probabilities are indicative, SHALL warn when the squad strength was not used, SHALL be usable from 360px wide and SHALL NOT use tables.

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
