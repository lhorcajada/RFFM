# rival-stats-redesign Specification

## Purpose
TBD - created by archiving change rival-stats-redesign. Update Purpose after archive.
## Requirements
### Requirement: League summary
Once the rival statistics are generated, the page SHALL show how many teams and how many players the league has.

#### Scenario: Totals
- **WHEN** the statistics are completed with two teams of 18 and 20 players
- **THEN** the page shows «Equipos» with 2 and «Jugadores» with 38

#### Scenario: No summary while generating
- **WHEN** the statistics are still being generated
- **THEN** the league summary is not shown

### Requirement: Neutral probability bar
The match probability bar SHALL NOT use success or error colours for home, draw and away.

#### Scenario: Bar colours
- **WHEN** a match prediction is shown
- **THEN** the bar segments use the primary, neutral and info palette tokens

