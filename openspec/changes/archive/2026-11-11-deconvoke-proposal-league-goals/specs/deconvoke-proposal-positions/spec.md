## ADDED Requirements

### Requirement: Season stats expose league goals
The season player statistics endpoint SHALL return, for each player, `leagueGoals`: the goals the player scored in finished participations of league matches (`SportEventsConstants.MatchEventTypeId`). `totalGoals` SHALL keep counting goals from all finished participations, including friendlies and tournaments.

#### Scenario: Goals in a league match and a friendly
- **WHEN** a player scored 2 goals in a finished league match and 3 goals in a finished friendly
- **THEN** the response for that player has `leagueGoals` 2 and `totalGoals` 5

#### Scenario: Player with only friendly goals
- **WHEN** a player scored goals only in friendlies
- **THEN** the response for that player has `leagueGoals` 0

### Requirement: Proposal goals use league goals only
The deconvocation proposal goals rule SHALL score each player with `leagueGoals` and SHALL label its factor «Goles (liga)». When federation top-scorer data is available, it SHALL replace `leagueGoals` for the players it matches; a player not matched in that data SHALL keep the backend `leagueGoals`, never `totalGoals`.

#### Scenario: Friendly goals do not protect a player
- **WHEN** a called player has `totalGoals` 3 and `leagueGoals` 0
- **THEN** the goals factor of that player has value 0 and impact 0

#### Scenario: League goals add points
- **WHEN** a called player has `leagueGoals` 2
- **THEN** the goals factor has value 2 and its impact is 4

#### Scenario: Player missing from federation scorers
- **WHEN** federation top-scorer data is available but does not include a player whose backend `leagueGoals` is 1
- **THEN** the goals factor of that player has value 1

#### Scenario: Factor label
- **WHEN** the proposal shows the goals factor
- **THEN** its label is «Goles (liga)»
