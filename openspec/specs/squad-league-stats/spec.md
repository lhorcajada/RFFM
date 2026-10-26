# squad-league-stats Specification

## Purpose
TBD - created by archiving change squad-league-stats. Update Purpose after archive.
## Requirements
### Requirement: League statistics endpoint
The API SHALL expose `GET /api/catalog/team/{teamId}/league-stats` returning, for every player of the team, goals, call-ups, starts, yellow cards, red cards and minutes played, computed only from finished league matches. Friendlies and tournaments SHALL NOT be counted. Players without data SHALL be returned with zeros.

#### Scenario: Friendly goals are excluded
- **WHEN** a player scored one goal in a league match and two in friendlies
- **THEN** the endpoint reports one goal for that player

#### Scenario: Cards and minutes
- **WHEN** a player has a yellow card and 70 minutes in a finished league match
- **THEN** the endpoint reports one yellow card and 70 minutes

#### Scenario: Starts
- **WHEN** a player started two finished league matches and came on in a third
- **THEN** the endpoint reports two starts

#### Scenario: Player with no league data
- **WHEN** a player has no finished league participation
- **THEN** the endpoint returns that player with all values at zero

### Requirement: League statistics on the squad cards
Each player card in the «Plantilla» tab SHALL show a block labelled «Solo liga» with Goles, Convocatorias, Titular, Amarillas, Rojas and Minutos, replacing the previous all-matches season row. The tab SHALL show a notice stating that these figures count league matches only and exclude friendlies and tournaments.

#### Scenario: Coach sees league figures
- **WHEN** a coach opens the «Plantilla» tab and league data has loaded
- **THEN** every card shows the «Solo liga» label with its six figures and the notice is visible

#### Scenario: Player or family member
- **WHEN** a player or family member opens the tab
- **THEN** only the card of their own player shows the figures

#### Scenario: Fan
- **WHEN** a fan opens the tab
- **THEN** no card shows the figures and the notice is not shown

#### Scenario: League data fails to load
- **WHEN** the league statistics request fails
- **THEN** the cards render without the block and the page remains usable

