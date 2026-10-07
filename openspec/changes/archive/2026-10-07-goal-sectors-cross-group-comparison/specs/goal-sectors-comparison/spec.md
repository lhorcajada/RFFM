## ADDED Requirements

### Requirement: Goal sectors comparison accepts a competition and group per team
The system SHALL expose `GET /teams/{teamCode}/goal-sectors?competitionId&groupId&teamCode1&teamCode2&competitionId2&groupId2`. `competitionId`, `groupId`, `teamCode1` and `teamCode2` SHALL be required; when any is missing the system SHALL return `400`. Team 1 SHALL be evaluated with `competitionId`/`groupId`. Team 2 SHALL be evaluated with `competitionId2`/`groupId2`, falling back to `competitionId`/`groupId` when they are omitted. Each team's matches SHALL be taken from the calendar of its own competition and group, and their actas SHALL be requested with the configured `RffmOptions.CurrentSeasonId`.

#### Scenario: Teams of different groups
- **WHEN** the client requests team 1 with competition 100 / group 200 and team 2 with competition2 300 / group2 400
- **THEN** team 1 is evaluated with the calendar of 100/200 and team 2 with the calendar of 300/400

#### Scenario: Team 2 without its own competition and group
- **WHEN** the client omits `competitionId2` and `groupId2`
- **THEN** team 2 is evaluated with `competitionId` / `groupId`

#### Scenario: Missing required parameter
- **WHEN** the client omits `teamCode2`
- **THEN** the system returns `400`

#### Scenario: Actas use the current season by default
- **WHEN** `season` is omitted, `RffmOptions.CurrentSeasonId` is 22 and both competitions belong to season 22
- **THEN** every acta is requested with season 22

### Requirement: Goal sectors are built from each team's match duration
The endpoint SHALL accept an optional `season` (RFFM season id). Each team's competition SHALL be looked up in `season` (or `RffmOptions.CurrentSeasonId` when omitted) and then in the remaining `RffmOptions.SelectableSeasons`, in order. Each team's response SHALL contain `matchTime` equal to the `MatchTime` of its own competition and exactly six sectors (three per half) built from that duration, ordered by start minute. The team's actas SHALL be requested with the season where its competition was found. When the competition is not found in any of those seasons the system SHALL return `404` with code `CompetitionNotFound` instead of assuming a default duration.

#### Scenario: Competitions with different match duration
- **WHEN** team 1 plays a competition of 80 minutes and team 2 one of 90 minutes
- **THEN** team 1 has `matchTime` 80 and its last sector ends at minute 80, and team 2 has `matchTime` 90 and its last sector ends at minute 90

#### Scenario: Competition of the selected season
- **WHEN** the client requests `season=21` for an infantil competition of season 21 whose match lasts 70 minutes
- **THEN** the team has `matchTime` 70 and its actas are requested with season 21

#### Scenario: Competition of another selectable season without season parameter
- **WHEN** the client omits `season` and the competition only exists in a previous selectable season
- **THEN** the team's `matchTime` is that competition's duration

#### Scenario: Unknown competition
- **WHEN** the competition is not found in any selectable season
- **THEN** the system returns `404` with code `CompetitionNotFound`

### Requirement: Comparison filter selects competition, group and team per side
The comparison page SHALL show the RFFM season selector and, below it, two panels labelled «Equipo 1» and «Equipo 2», each with its own competition, group and team selectors. On wide screens the panels SHALL be side by side; on narrow screens they SHALL stack. Both panels SHALL be pre-filled with the user's primary federation combination (competition and group). Changing a panel's competition SHALL clear that panel's group and team; changing its group SHALL clear its team; the other panel SHALL NOT change. The «Comparar» button SHALL be enabled only when both panels have competition, group and team.

#### Scenario: Pre-filled panels
- **WHEN** the user's primary combination is competition 100 / group 200
- **THEN** both panels show competition 100 and group 200

#### Scenario: Teams from different groups
- **WHEN** the user picks a team of group 200 in «Equipo 1» and changes «Equipo 2» to group 400 and picks one of its teams
- **THEN** «Comparar» requests team 1 with 100/200 and team 2 with its own competition and group 400

#### Scenario: Changing one side does not reset the other
- **WHEN** the user changes the competition of «Equipo 2»
- **THEN** the group and team of «Equipo 2» are cleared and «Equipo 1» keeps its selection

#### Scenario: Incomplete selection
- **WHEN** «Equipo 2» has no team selected
- **THEN** «Comparar» is disabled

### Requirement: Sectors are compared by position
The comparison chart and sector cards SHALL pair sectors by position (1st to 6th). Each chart label SHALL show the minute range once when both teams share it (`1-15'`), or both ranges separated by « / » when they differ (`1-14' / 1-15'`); each team's sector card SHALL show that team's own range. Rows where both teams have zero goals for and against SHALL be hidden. The goals-against detail of a team SHALL use that team's competition, group, match duration and sector range.

#### Scenario: Same duration
- **WHEN** both teams have `matchTime` 90
- **THEN** the first row is labelled `1-15'`

#### Scenario: Different duration
- **WHEN** team 1 has `matchTime` 80 and team 2 has `matchTime` 90
- **THEN** the first row is labelled `1-14' / 1-15'` and contains team 1's first sector and team 2's first sector

#### Scenario: Goals-against detail of team 2 in another group
- **WHEN** the user opens the goals-against detail of team 2, compared from competition 300 / group 400 in RFFM season 21
- **THEN** its matches and actas are requested with season 21, competition 300 and group 400

#### Scenario: Comparison sends the selected season
- **WHEN** the user compares with RFFM season 21 selected
- **THEN** the request includes `season=21`
