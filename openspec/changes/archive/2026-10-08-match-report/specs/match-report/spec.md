## ADDED Requirements

### Requirement: Match report availability is computed by the backend
The system SHALL expose `GET /api/teams/{teamId}/match-reports` returning, for every sport event of the team that has a match report available, an item with `eventId`, `codActa`, `hasLiveReport` and `hasFederationReport`. `hasLiveReport` SHALL be true only when the event has saved match participation with `matchPhase` `finished`. `hasFederationReport` SHALL be true only when the event is a league match (`matchCategory` `League`), has a non-empty `codActa` and has a final score (`localGoals` and `visitorGoals` not empty). Events where both flags are false SHALL NOT be returned. The endpoint SHALL be readable by Coach, Administrator, Player and FamilyMember roles, and Player/FamilyMember SHALL only access teams they belong to.

#### Scenario: League match with finished live match
- **WHEN** a league event has an acta code, a final score and a saved finished live match
- **THEN** the item has `hasLiveReport` true and `hasFederationReport` true

#### Scenario: League match without live match
- **WHEN** a finished league event with acta code has no saved live match
- **THEN** the item has `hasLiveReport` false and `hasFederationReport` true

#### Scenario: Friendly with finished live match
- **WHEN** a friendly event has a saved finished live match
- **THEN** the item has `hasLiveReport` true and `hasFederationReport` false

#### Scenario: Friendly without live match
- **WHEN** a friendly event has a score but no saved live match
- **THEN** the event is not returned

#### Scenario: Live match not finished
- **WHEN** the event's saved match participation has a phase other than `finished`
- **THEN** `hasLiveReport` is false

#### Scenario: Family member of another team
- **WHEN** a FamilyMember requests the match reports of a team they do not belong to
- **THEN** the system returns `403`

### Requirement: Live match report returns resolved match data
The system SHALL expose `GET /api/events/{eventId}/match-report` returning the match header (team and rival names and shields, date, home/away, final score, match category, `hasLiveReport`, `hasFederationReport`) and, when `hasLiveReport` is true, a `live` section; otherwise `live` SHALL be null. The `live` section SHALL contain:
- the starting formation name and the starters, each with `slotIndex`, name, dorsal, photo and minutes played;
- the bench: convocated players who were not starters, each with minutes played (0 when they did not play);
- goals ordered by minute ascending, each with minute, scorer name (null when unknown), whether it is our team's goal and the score after it;
- cards ordered by minute ascending, each with minute, half, type (`yellow`/`red`), player name or rival dorsal and whether it is a rival card;
- substitution windows ordered by minute, each with whether it is the half-time window, its index, minute, half and the swaps (player in, player out);
- the real match duration in minutes.
When the event does not exist the system SHALL return `404`. Access rules SHALL be the same as the availability endpoint for the event's team.

#### Scenario: Goals in chronological order
- **WHEN** the saved goals are at minutes 52, 10 and 31
- **THEN** the report lists them at minutes 10, 31 and 52

#### Scenario: Bench player who did not play
- **WHEN** a convocated player was neither starter nor entered the match
- **THEN** the player appears in the bench with 0 minutes

#### Scenario: Starting lineup stored with the live match
- **WHEN** the live match was saved with a starting lineup
- **THEN** the starters' `slotIndex` and the formation come from that stored lineup

#### Scenario: Legacy live match without stored lineup
- **WHEN** the live match was saved before the starting lineup was stored
- **THEN** the starters' positions come from the event's saved lineup, and starters not found in it are returned without `slotIndex`

#### Scenario: Player sees the report of their team
- **WHEN** a Player of the team requests the report of a finished match
- **THEN** the system returns `200` with the `live` section

### Requirement: Federation acta is resolved from the event
The system SHALL expose `GET /api/events/{eventId}/federation-acta` returning the RFFM acta of the event, requested with the event's `codActa`, the team's RFFM competition and group and the configured current RFFM season. When the event has no federation report the system SHALL return `404`. Access rules SHALL be the same as the availability endpoint for the event's team.

#### Scenario: League match acta
- **WHEN** a Player requests the federation acta of a finished league event of their team
- **THEN** the acta is requested with the event's acta code and the team's competition and group

#### Scenario: Friendly match
- **WHEN** the event is a friendly
- **THEN** the system returns `404`

### Requirement: Live match save stores the starting lineup
`POST /api/events/{eventId}/match-participation` SHALL accept an optional `startingLineupJson` (formation id, formation name and slot → teamPlayerId map) and persist it with the participation. When it is omitted on an update, the previously stored value SHALL be kept. The web live match screen SHALL send the starting lineup captured when the match was initialised.

#### Scenario: Save with lineup
- **WHEN** the coach saves a finished live match
- **THEN** the starting formation and slots are stored

#### Scenario: Update without lineup
- **WHEN** a participation is re-saved without `startingLineupJson`
- **THEN** the stored starting lineup is not cleared

### Requirement: «Ver acta» button on finished match cards
Finished match cards SHALL show a «Ver acta» button only when the match appears in the team's match reports index. In the web coach app this applies to the calendar cards (desktop card and mobile agenda) and to the team's own match in «Resultados»; other teams' matches in «Resultados» SHALL NOT show it. In Mobile this applies to the calendar, friendlies and tournaments event cards and to the team's own match in «Liga». Pressing the button SHALL open the match report screen for that event without triggering the card's own navigation.

#### Scenario: Finished friendly with live match
- **WHEN** the calendar shows a finished friendly whose event has `hasLiveReport`
- **THEN** the card shows «Ver acta»

#### Scenario: Finished friendly without live match
- **WHEN** the calendar shows a finished friendly not present in the index
- **THEN** the card does not show «Ver acta»

#### Scenario: Results page
- **WHEN** «Resultados» shows a round with the team's match (present in the index by acta code) and other matches
- **THEN** only the team's match shows «Ver acta»

### Requirement: Match report screen shows available tabs only
The match report screen SHALL show the tab «Federación» only when `hasFederationReport` is true and the tab «Partido en directo» only when `hasLiveReport` is true. When both are available, «Federación» SHALL be selected by default. When only one is available, its content SHALL be shown without a tab bar. The «Partido en directo» tab SHALL show the pitch with the starters in their positions, the bench, minutes per player, goals in chronological order with their minute, cards and substitution windows. The screen SHALL be accessible to Coach, Administrator, Player and FamilyMember roles and SHALL be usable at ~360px width without tables.

#### Scenario: League match with both reports
- **WHEN** the report has both flags true
- **THEN** both tabs are shown and «Federación» is selected

#### Scenario: Friendly with live match
- **WHEN** the report has only `hasLiveReport`
- **THEN** the live match content is shown and there is no «Federación» tab

#### Scenario: Goal list
- **WHEN** the live section has goals at 10' and 31'
- **THEN** they are listed in that order showing «10'» and «31'»

#### Scenario: Federation acta fails to load
- **WHEN** the federation acta request fails
- **THEN** the «Federación» tab shows an error message in Spanish and the live tab keeps working
