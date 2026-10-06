## ADDED Requirements

### Requirement: Coach squad comparison resolves the coach's own team
The system SHALL expose `GET /teams/{teamCode}/coach-squad-comparison?season&competition&group` for authenticated users. It SHALL look for the user's teams — teams of a club where the user is `Directive` or `Coach`, or teams where the user has the `Coach` team membership — whose RFFM competition and RFFM group equal `competition` and `group`, and whose season starts in the first year of the RFFM season label (e.g. `2026-2027` → 2026). The requested `teamCode` SHALL also be one of the RFFM teams saved in the user's federation settings; otherwise the response SHALL be `isCoachTeam = false`. When exactly one team matches, the response SHALL have `isCoachTeam = true` with that team's id and name; otherwise it SHALL return `200` with `isCoachTeam = false` and an empty player list, without querying the RFFM.

#### Scenario: Team belongs to the coach
- **WHEN** a coach of a team associated with competition 100 / group 200 in season 2026-2027 requests the comparison for season 22, competition 100, group 200
- **THEN** the system returns `200` with `isCoachTeam = true` and that team's id and name

#### Scenario: Club coach without team membership
- **WHEN** the user is `Coach` of the club that owns the matching team but has no team membership
- **THEN** the system returns `200` with `isCoachTeam = true`

#### Scenario: Team is not the coach's
- **WHEN** the user has no coached team in that competition, group and season
- **THEN** the system returns `200` with `isCoachTeam = false` and no players

#### Scenario: Another team of the same group is selected
- **WHEN** the coach selects a rival RFFM team of the same competition and group, which is not saved in their federation settings
- **THEN** the system returns `200` with `isCoachTeam = false` and does not query the RFFM squad

#### Scenario: Two coached teams in the same group
- **WHEN** the user coaches two teams in the same competition, group and season
- **THEN** the system returns `200` with `isCoachTeam = false`

#### Scenario: Anonymous request
- **WHEN** the request has no valid token
- **THEN** the system returns `401`

### Requirement: Coach squad comparison marks federative licence status
When the team is the coach's, the response SHALL list every active player of the team (no leave date) with name, photo URL and jersey number taken from our database (falling back to the RFFM values when missing), and status `Licensed` if the player appears in the RFFM squad or `Unlicensed` if not. Players appearing only in the RFFM squad SHALL be listed with status `NotInTeam` and the RFFM photo and jersey number. Players SHALL be matched by accent- and case-insensitive name tokens (one name's tokens contained in the other's) and, when both birth years are known, equal birth year; each RFFM player SHALL match at most one database player.

#### Scenario: Player with licence
- **WHEN** «José Pérez» (2012) is in our squad and «PEREZ GARCIA, JOSE» (2012) is in the RFFM squad
- **THEN** the player is returned once with status `Licensed` and our photo and dorsal

#### Scenario: Player without licence
- **WHEN** a player of our squad does not appear in the RFFM squad
- **THEN** the player is returned with status `Unlicensed`

#### Scenario: Same name, different birth year
- **WHEN** the names match but the birth years differ
- **THEN** the database player is `Unlicensed` and the RFFM player is `NotInTeam`

#### Scenario: RFFM-only player
- **WHEN** a player appears in the RFFM squad but not in our squad
- **THEN** the player is returned with status `NotInTeam`

### Requirement: Squad page shows the comparison for the coach's team
The federation Squad page SHALL request the comparison when a team, competition and group are selected. When `isCoachTeam` is true it SHALL render one responsive card per player with photo (or initials), jersey number, name and a tag «Con ficha», «Sin ficha» or «No está en el equipo»; otherwise, or if the comparison request fails, it SHALL render the RFFM list as before.

#### Scenario: Coach views their own team
- **WHEN** the comparison returns `isCoachTeam = true`
- **THEN** the page shows the comparison cards with their tags instead of the RFFM rows

#### Scenario: Comparison unavailable
- **WHEN** the comparison returns `isCoachTeam = false` or fails
- **THEN** the page shows the RFFM player list

### Requirement: Participation summary includes the previous season
`GET /teams/{teamId}/participation-summary?season` SHALL aggregate each player's participations for the requested season and for the previous selectable RFFM season (the highest configured season id lower than the requested one), excluding the selected team in both, and each item SHALL include `seasonId` and `seasonName`. Items SHALL be ordered by season descending. When no previous season is configured, only the requested season SHALL be used. The participation modal SHALL group items by season.

#### Scenario: Participations from both seasons
- **WHEN** a player participated in team X in season 21 and in team Y in season 22, and the summary is requested for season 22
- **THEN** the response contains an item for team Y with `seasonId = 22` and an item for team X with `seasonId = 21`

#### Scenario: Oldest selectable season
- **WHEN** the summary is requested for the lowest configured season
- **THEN** only that season's participations are returned

### Requirement: Compared players keep their season statistics
For players with an RFFM sheet (`Licensed` and `NotInTeam`), each compared player SHALL include the requested season's RFFM statistics: call-ups, starts, matches played, goals, yellow cards, red cards and double yellow cards. `Unlicensed` players SHALL have no statistics. The comparison card SHALL show goals, yellow cards and red cards, like the RFFM list row.

#### Scenario: Licensed player shows season statistics
- **WHEN** a `Licensed` player has 3 goals and 1 yellow card in the RFFM sheet of the requested season
- **THEN** the compared player includes those statistics and the card shows them

#### Scenario: Unlicensed player has no statistics
- **WHEN** a player is `Unlicensed`
- **THEN** the compared player has no statistics and the card offers no detail

### Requirement: Player detail groups current and previous season
The system SHALL expose `GET /players/{id}/season-summary?season` (authenticated) returning, for the requested season and the previous selectable RFFM season, ordered by season descending: `seasonId`, `seasonName`, the statistics (call-ups, starts, substitute appearances, matches played, goals, yellow, red and double yellow cards) and the teams the player played for (competition name as category, group, team name, team points and position). Seasons without a sheet, or whose sheet has no teams and no call-ups, SHALL be omitted. Errors fetching one season SHALL NOT fail the other. Both the RFFM list row and the comparison card SHALL show this detail grouped by season when expanded.

#### Scenario: Two seasons
- **WHEN** the player has sheets in seasons 22 and 21
- **THEN** the response has season 22 first and season 21 second, each with its statistics and teams

#### Scenario: No previous-season sheet
- **WHEN** the previous season sheet does not exist or fails
- **THEN** only the requested season is returned
