## ADDED Requirements

### Requirement: Match player card
Each player card in «Partidos» SHALL show season minutes, matches, starts, the non-zero issue counters (técnica, no disp., lesión, enferm.) and the state of the last 5 played matches.

#### Scenario: Recent form
- **WHEN** more than 5 matches have been played
- **THEN** only the last 5 played matches appear in the form strip

### Requirement: Match detail
Expanding a card SHALL list every match with date, state badge, minutes and the «Amistoso» tag for friendlies.

#### Scenario: Friendly
- **WHEN** a match is a friendly
- **THEN** its row shows the «Amistoso» tag

### Requirement: Toolbar kept
The PDF export buttons (non-player roles only), the jornadas/amistosos counts and the refresh action SHALL remain, stacking on narrow screens.

#### Scenario: Narrow screen
- **WHEN** the viewport is 390 px wide
- **THEN** the toolbar stacks without horizontal scroll
