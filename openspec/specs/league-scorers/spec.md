# league-scorers Specification

## Purpose
TBD - created by archiving change league-scorers-page. Update Purpose after archive.
## Requirements
### Requirement: Scorers come only from stored actas
The system SHALL build the goals of a league from the `PayloadJson` of the stored `RffmMatchRecords` of the team's group. It SHALL NOT call the RFFM to obtain or complete an acta while answering the request.

#### Scenario: Acta already stored
- **WHEN** a closed match of the group has its acta stored
- **THEN** its goals appear in the response

#### Scenario: No call to the federation
- **WHEN** the scorers of a group are requested
- **THEN** no HTTP request to the RFFM is made

### Requirement: Goals of a round grouped by match
The system SHALL return, for a given round of the team's group, every match of that round with its teams, score, date and time, and the goals of its stored acta in minute order. Each goal SHALL carry the minute, the player name, the scoring team, the goal type (normal, penalty or own goal) and the season total of goals of that player in the stored actas of the group up to and including the requested round (absent for own goals). The system SHALL default to the latest round with a closed match when no round is requested.

#### Scenario: Match with goals
- **WHEN** round 8 is requested and a match ended 2–2 with its acta stored
- **THEN** the match lists four goals ordered by minute, each with minute, player and team

#### Scenario: Default round
- **WHEN** no round is requested and round 8 is the latest with a closed match
- **THEN** the response is for round 8

#### Scenario: Own goal credited to the benefited team
- **WHEN** an acta lists an own goal in the home team's goal list
- **THEN** the goal is returned with type own goal and is not credited to a player's scoring total

#### Scenario: Season total on each goal
- **WHEN** a player scored 2 goals before round 8 and 1 in round 8 and round 8 is requested
- **THEN** their goal in round 8 carries a season total of 3

#### Scenario: Season total limited to the requested round
- **WHEN** round 5 is requested and the player scores again in round 8
- **THEN** their goals of round 5 carry a season total that does not include round 8

#### Scenario: Same total for every goal of a player in a match
- **WHEN** a player scores two goals in the same match
- **THEN** both goals carry the same season total

#### Scenario: Total for players outside the ranking
- **WHEN** a player scored once and is not in the top 20 of the ranking
- **THEN** their goal still carries a season total of 1

#### Scenario: Own goal without total
- **WHEN** a goal is an own goal
- **THEN** it carries no season total and does not add to the player's total

#### Scenario: Minute not numeric
- **WHEN** a goal has minute «90+2'» or an empty minute
- **THEN** the goal is returned with the minute as the acta gives it, and empty minutes are placed last

### Requirement: Closed matches without stored acta are marked pending
A match that is closed in the round but has no stored acta SHALL be returned with a pending-acta flag and no goals. The response SHALL NOT present such a match as having zero goals.

#### Scenario: Pending acta
- **WHEN** a closed match has no row in `RffmMatchRecords`
- **THEN** the match is returned with the pending-acta flag set and an empty goal list

#### Scenario: Match not yet played
- **WHEN** a match of the round is not closed
- **THEN** it is returned without goals and without the pending-acta flag

### Requirement: Accumulated scorers ranking
The system SHALL return a ranking of players by goals scored, accumulated over every stored acta of the group up to and including the requested round. Own goals SHALL NOT count for the player. Players SHALL be identified by player code and, when the code is empty, by name plus team. The ranking SHALL be ordered by goals descending, then by name, and SHALL be limited to the top 20.

#### Scenario: Accumulation
- **WHEN** a player scored 2 goals in round 5 and 1 in round 8 and round 8 is requested
- **THEN** the ranking shows 3 goals for that player

#### Scenario: Up to the requested round
- **WHEN** round 6 is requested and the player scores again in round 8
- **THEN** the goal of round 8 is not counted

#### Scenario: Own goals excluded
- **WHEN** a player only has own goals
- **THEN** the player does not appear in the ranking

#### Scenario: Player without code
- **WHEN** two goals have an empty player code, the same name and the same team
- **THEN** they are counted as one player with 2 goals

### Requirement: Scope is the league of the team being viewed
The system SHALL resolve the group from the team being viewed and SHALL only return data of that group. Access SHALL require authentication and membership in that team.

#### Scenario: Team with league
- **WHEN** a member of a team associated with a league group requests the scorers
- **THEN** only goals of that group are returned

#### Scenario: Team without league
- **WHEN** the team has no competition group associated
- **THEN** the response is a ProblemDetails error indicating the team has no league

#### Scenario: Not a member
- **WHEN** a user who is not a member of the team requests its scorers
- **THEN** the request is rejected as forbidden

#### Scenario: Group not yet synchronised
- **WHEN** the group has no rounds stored
- **THEN** the response has no rounds, no matches and an empty ranking

### Requirement: Missing actas can be downloaded on demand for a round
The system SHALL provide an explicit action, for the team's league and a given round, that downloads from the RFFM and stores the actas of the closed matches of that round that are not yet stored. It SHALL NOT download actas of other rounds, of matches not closed, or already stored. It SHALL process at most 30 actas per request, SHALL continue when one acta fails, and SHALL answer how many were requested, stored and failed. An acta that the RFFM returns still open SHALL count as failed. The action SHALL require authentication and membership in the team, and SHALL answer a ProblemDetails conflict when the team has no league.

#### Scenario: Only missing closed actas of the round
- **WHEN** round 5 has one closed match without acta, one with stored acta and one not closed, and round 6 has another closed match without acta
- **THEN** only the first match's acta is requested from the RFFM and the answer is 1 requested, 1 stored, 0 failed

#### Scenario: One acta fails
- **WHEN** the RFFM does not return one acta or raises an error while two others succeed
- **THEN** the other actas are still processed and the answer counts the failures

#### Scenario: Nothing pending
- **WHEN** every closed match of the round already has its acta stored
- **THEN** no request to the RFFM is made and the answer is 0 requested

#### Scenario: Team without league
- **WHEN** the team has no competition group
- **THEN** the answer is a ProblemDetails conflict

