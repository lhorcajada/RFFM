# mobile-player-stats-grouping Specification

## Purpose
TBD - created by archiving change mobile-player-stats-group-by-position. Update Purpose after archive.
## Requirements
### Requirement: Group players by main position
The Mobile "Estadísticas" screen (`PlayerSeasonCardsScreen`) SHALL group a team's player season cards into fixed, ordered position sections, instead of rendering a single flat list.

#### Scenario: Players grouped into fixed sections
- **WHEN** the coach/family user opens the Estadísticas screen for a team with players in multiple positions
- **THEN** players are grouped into sections in this fixed order: Porteros, Defensas, Medio centros, Bandas, Delanteros, Sin posición

#### Scenario: Empty groups are not rendered
- **GIVEN** a team has no player whose `activeDemarcation.code` maps to a given group (e.g. no Delanteros)
- **WHEN** the user opens the Estadísticas screen
- **THEN** that group's section header is not rendered

#### Scenario: Players without a demarcation grouped separately
- **GIVEN** one or more players have `activeDemarcation` equal to null
- **WHEN** the user opens the Estadísticas screen
- **THEN** those players appear in a "Sin posición" section at the end of the list

### Requirement: Ordered within each group
Within each position section, players SHALL be ordered by sub-position first, then by dorsal ascending.

#### Scenario: Sort by sub-position then dorsal
- **GIVEN** a section contains players with different sub-position codes and dorsals
- **WHEN** the section is rendered
- **THEN** players are ordered by their sub-position's position in the group's defined code order, and within the same sub-position, by dorsal ascending with null dorsals last

### Requirement: Collapsible section headers with exclusive accordion
Each position section header SHALL be collapsible/expandable, starting collapsed by default, always showing the player count, and only one section may be expanded at a time.

#### Scenario: All sections collapsed on mount
- **WHEN** the user opens the Estadísticas screen
- **THEN** every position section is collapsed and no player cards are visible until a section header is tapped

#### Scenario: Tapping a header expands it
- **GIVEN** a section header is collapsed
- **WHEN** the user taps it
- **THEN** the section expands and shows its player cards

#### Scenario: Tapping an expanded header collapses it
- **GIVEN** a section header is expanded
- **WHEN** the user taps it again
- **THEN** the section collapses and hides its player cards

#### Scenario: Expanding one section collapses the previously expanded one
- **GIVEN** one section is currently expanded
- **WHEN** the user taps a different section's header
- **THEN** the previously expanded section collapses and the tapped section expands, so at most one section is expanded at a time

#### Scenario: Player count always visible
- **WHEN** a section header is rendered, whether collapsed or expanded
- **THEN** it shows the number of players in that section

