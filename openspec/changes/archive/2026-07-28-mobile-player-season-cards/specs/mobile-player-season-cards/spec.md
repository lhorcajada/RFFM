## ADDED Requirements

### Requirement: Season player cards endpoint
The backend SHALL expose a read-only endpoint returning, for every `TeamPlayer` on a team, an aggregated season card combining identity, match participation, discipline, and training attendance data.

#### Scenario: Full roster returned
- **WHEN** a caller with Read permission on `PlayerSeasonCards` requests `GET /api/mobile/teams/{teamId}/season-player-cards`
- **THEN** the response contains one card per `TeamPlayer` on that team, each with `TeamPlayerId, Alias, UrlPhoto, Dorsal, CurrentMatchday, MatchesPlayed, MatchesStarted, MatchesSinceLastDeconvocation, YellowCards, RedCards, Goals, TrainingsAttended, TrainingsAbsent, TrainingsPossible`

#### Scenario: Unauthorized caller is rejected
- **WHEN** a caller without Read permission on the `PlayerSeasonCards` feature route requests the endpoint
- **THEN** the request is rejected (forbidden), independent of team membership

### Requirement: Match definition used consistently
All match-derived fields on the season card (`CurrentMatchday`, `MatchesPlayed`, `MatchesStarted`, `MatchesSinceLastDeconvocation`, `Goals`) SHALL be computed only from finished `SportEvent`s of type "Partido" (`SportEventType.Match`), excluding friendlies and other event types.

#### Scenario: Friendly match excluded
- **WHEN** a team has saved `MatchParticipation` data for a friendly match (`SportEventType.FriendlyMatch`)
- **THEN** that match is not counted in `CurrentMatchday`, `MatchesPlayed`, `MatchesStarted`, `MatchesSinceLastDeconvocation`, or `Goals`

### Requirement: Current matchday computed from finished matches
`CurrentMatchday` SHALL equal one plus the count of the team's distinct finished, match-type `SportEvent`s.

#### Scenario: No matches played yet
- **WHEN** a team has zero finished match-type events
- **THEN** `CurrentMatchday` is `1` for every player on the team

#### Scenario: Matches already played
- **WHEN** a team has 5 distinct finished match-type events
- **THEN** `CurrentMatchday` is `6` for every player on the team

### Requirement: Matches since last deconvocation
`MatchesSinceLastDeconvocation` SHALL count the team's finished match-type `SportEvent`s that occurred strictly after the player's most recent `Convocation` with status `Deconvoke` on a match-type event. If the player was never deconvoked on a match, the value SHALL equal `MatchesPlayed`.

#### Scenario: Player never deconvoked
- **WHEN** a player has no `Convocation` with `Deconvoke` status on any match-type event
- **THEN** `MatchesSinceLastDeconvocation` equals that player's `MatchesPlayed`

#### Scenario: Player deconvoked mid-season
- **WHEN** a player was deconvoked for a match, and the team has since played 3 further finished match-type events
- **THEN** `MatchesSinceLastDeconvocation` is `3` for that player

#### Scenario: Training deconvocation does not count
- **WHEN** a player was deconvoked for a training session but never for a match
- **THEN** the training deconvocation is ignored and `MatchesSinceLastDeconvocation` equals `MatchesPlayed`

### Requirement: Cards persisted per match participation
`MatchParticipation` SHALL support storing an optional serialized list of card events (`CardsJson`), following the same pattern as the existing `GoalsJson` field.

#### Scenario: Match saved with cards
- **WHEN** `SaveMatchParticipation` is called with a `CardsJson` payload for a match
- **THEN** the saved `MatchParticipation` rows for that match persist the supplied `CardsJson`

#### Scenario: Match saved without cards
- **WHEN** `SaveMatchParticipation` is called with no `CardsJson`
- **THEN** the saved `MatchParticipation` rows have a `null` `CardsJson`, and that match contributes zero cards to any player's season card

### Requirement: Card counts aggregated per player
`YellowCards` and `RedCards` SHALL each equal the count of card events attributed to that player across all finished match-type events for the team, parsed from `CardsJson`.

#### Scenario: Malformed or missing card data
- **WHEN** a `MatchParticipation` row has a `null` or malformed `CardsJson`
- **THEN** it contributes zero yellow and zero red cards to any player's totals

### Requirement: Training attendance fields match existing summary semantics
`TrainingsAttended`, `TrainingsAbsent`, and `TrainingsPossible` SHALL reflect the same per-player attendance semantics as `GetTrainingAttendanceSummary` (attended, absent, and total training events for the team).

#### Scenario: Attendance totals are internally consistent
- **WHEN** a player's season card is returned
- **THEN** `TrainingsAttended + TrainingsAbsent` is less than or equal to `TrainingsPossible`

### Requirement: Mobile season cards screen
The Mobile app SHALL provide a read-only screen listing every team player as a card showing photo, alias, dorsal, and the season stats returned by the season-player-cards endpoint.

#### Scenario: Screen accessible from a dedicated tab
- **WHEN** an authenticated Coach, Player, or FamilyMember opens the app
- **THEN** a "Cromos" tab is available alongside the existing Calendar and News tabs, leading to the season cards screen

#### Scenario: Card content
- **WHEN** the season cards screen loads successfully
- **THEN** each player's card shows their photo (or a placeholder when absent), alias, dorsal, current matchday, matches played, matches started, matches since last deconvocation, yellow cards, red cards, goals, trainings attended, trainings absent, and trainings possible

#### Scenario: Read-only, no edit affordances
- **WHEN** a user of any role (Coach, Player, FamilyMember) views the screen
- **THEN** no controls are shown to edit any player's data — the screen only displays data

### Requirement: Season card exposes player demarcation
The season-player-cards endpoint response SHALL include each player's active demarcation (position) and their list of possible demarcations, sourced from the existing `TeamPlayer.Demarcation` value object and `DemarcationMaster` catalog.

#### Scenario: Player with an assigned demarcation
- **WHEN** a `TeamPlayer` has an `ActivePositionId` set on their `Demarcation`
- **THEN** their season card's `ActiveDemarcation` contains that demarcation's `Id`, `Name`, and `Code`, and `PossibleDemarcations` lists every demarcation in their `PossibleDemarcationIds`

#### Scenario: Player without a demarcation
- **WHEN** a `TeamPlayer` has no `Demarcation` set (or `ActivePositionId` is `0`)
- **THEN** their season card's `ActiveDemarcation` is `null` and `PossibleDemarcations` is an empty list

### Requirement: Mobile season cards screen displays demarcation
Each card on the Mobile season cards screen SHALL show the player's active demarcation and, when present, their possible demarcations.

#### Scenario: Active demarcation shown
- **WHEN** a player's `ActiveDemarcation` is not `null`
- **THEN** the card displays that demarcation's name and code (e.g. "Portero (POR)")

#### Scenario: No active demarcation
- **WHEN** a player's `ActiveDemarcation` is `null`
- **THEN** the card shows a discreet placeholder ("-") instead of a demarcation, and renders no possible-demarcation chips

#### Scenario: Possible demarcations shown as chips
- **WHEN** a player's `PossibleDemarcations` list is non-empty
- **THEN** the card renders one chip per possible demarcation showing its code

#### Scenario: No possible demarcations
- **WHEN** a player's `PossibleDemarcations` list is empty
- **THEN** no possible-demarcations row is rendered for that card
