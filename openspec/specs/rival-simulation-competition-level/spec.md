# rival-simulation-competition-level Specification

## Purpose
TBD - created by archiving change rival-simulation-competition-level. Update Purpose after archive.
## Requirements
### Requirement: Competition level from the competition name
The system SHALL derive the level of a previous-season participation from its competition name as the sum of a division rank (Tercera 0, Segunda 1, Primera 2, Preferente 3, Primera División Autonómica 4, División de Honor 5, Superliga 6) and an age category rank (Prebenjamín 0, Benjamín 1, Alevín 2, Infantil 3, Cadete 4, Juvenil 5, Aficionado 6), ignoring case and accents. A participation whose division cannot be recognized SHALL NOT be used.

#### Scenario: Primera beats Segunda in the same age category
- **WHEN** the levels of «PRIMERA INFANTIL» and «SEGUNDA INFANTIL» are compared
- **THEN** «PRIMERA INFANTIL» is one level higher

#### Scenario: One age category up equals one division up
- **WHEN** the levels of «SEGUNDA CADETE» and «PRIMERA INFANTIL» are compared
- **THEN** they are equal

#### Scenario: Long division names recognized before short ones
- **WHEN** the competition is «PRIMERA DIVISIÓN AUTONÓMICA CADETE»
- **THEN** its division rank is 4, not 2

#### Scenario: Unknown division ignored
- **WHEN** the competition is «COPA PRIMAVERA»
- **THEN** it has no level and the participation is not used

### Requirement: Squad strength by competition level
The squad strength of a team SHALL be computed from its players' previous-season participations valued as competition level plus position within the group (groups of at least 16 teams), with starter rate and goals per match only as small tie-breakers. A player with several valid participations SHALL be valued mostly by the best one. A player without a valid participation SHALL count slightly below the league average. The team strength SHALL grow exponentially with the difference between the team's weighted player value and the league average.

#### Scenario: Primera players beat Segunda players
- **WHEN** team A's players finished 8th in Primera Infantil and team B's players finished 4th in Segunda Infantil
- **THEN** team A's squad strength is greater than team B's

#### Scenario: Higher age category counts
- **WHEN** team A's players finished 9th in Segunda Cadete and team B's players finished 9th in Segunda Infantil
- **THEN** team A's squad strength is greater than team B's

#### Scenario: Real case of round 1
- **WHEN** most of team A's players finished 3rd in Primera Infantil and team B's players are split between 4th in Segunda Infantil and 8th in Primera Infantil
- **THEN** team A's squad strength is clearly greater than team B's and team A is the favourite even playing away

#### Scenario: Being a starter in a weak team does not compensate the level
- **WHEN** team A's players were starters in every match in Segunda Infantil and team B's players were substitutes in Primera Infantil, both finishing in the same position
- **THEN** team B's squad strength is greater than team A's

### Requirement: Backfilled round simulations follow the model version
Every saved round simulation SHALL record the model version that computed it and whether it was computed after its round had started (backfilled). When the rounds are synchronized, a backfilled simulation computed with an older model version SHALL be recomputed with the current model, using only the results of earlier rounds and without the players' current-season involvement. A simulation frozen when its round started SHALL never be recomputed. The history SHALL indicate which rounds were backfilled, and the simulation page SHALL say that their prediction was computed afterwards.

#### Scenario: Backfilled round recomputed after a model change
- **WHEN** round 1 was backfilled with model version 1 and the rounds are synchronized with model version 2
- **THEN** round 1's simulation is recomputed with version 2 and stays frozen

#### Scenario: Round frozen in real time kept
- **WHEN** round 3 was frozen when it started with model version 1 and the rounds are synchronized with model version 2
- **THEN** round 3's simulation is unchanged

#### Scenario: Page shows backfilled rounds
- **WHEN** the user selects a backfilled round
- **THEN** the page says the prediction was computed afterwards

