# deconvocation-proposal-search Specification

## Purpose
TBD - created by archiving change deconvocation-proposal-search-and-saved. Update Purpose after archive.
## Requirements
### Requirement: Search controls in the current proposal
The current proposal view SHALL offer a name search, the quick filters «Nunca desconvocados» and «Sin decisión técnica», and a sort selector with «Orden de la propuesta» (default), «Menos desconvocatorias» and «Más jornadas sin técnica». The controls SHALL NOT be offered in the estimates of upcoming matches.

#### Scenario: Default view is unchanged
- **WHEN** the search is empty, no filter is active and the sort is «Orden de la propuesta»
- **THEN** the proposal shows its usual sections and no result list

#### Scenario: Estimate tab
- **WHEN** the coach opens the tab of an upcoming match
- **THEN** no search, filter or sort control is shown

### Requirement: Result list
While any search, filter or non-default sort is active, the view SHALL replace the proposal sections with a single list of the matching players, taken from every evaluated and already deconvoked player, each exactly once. Each result SHALL show the player's name, position, situation in the proposal («Se desconvoca», «Protegido», «No elegido» or «Ya desconvocado») and the league deconvocation history. The view SHALL show how many players match.

#### Scenario: A player appears once
- **WHEN** a filter is active and a player appears both in the order list and in the proposed players
- **THEN** the result list shows that player once

#### Scenario: Nobody matches
- **WHEN** no player matches the search and filters
- **THEN** the view shows «Ningún jugador cumple la búsqueda»

#### Scenario: Clearing the search
- **WHEN** the coach presses «Limpiar»
- **THEN** the search, filters and sort return to their defaults and the usual sections are shown

### Requirement: Name search
The name search SHALL match any part of the player's displayed name, ignoring case and accents.

#### Scenario: Accents and case
- **WHEN** the coach types «alvaro»
- **THEN** the player «Álvaro» is listed

### Requirement: League-only filters
The filters and sorts SHALL use league matches only. «Nunca desconvocados» SHALL keep the players with no league deconvocation of any cause. «Sin decisión técnica» SHALL keep the players with no league deconvocation by technical decision. Active filters and the name search SHALL be combined, keeping the players that satisfy all of them.

#### Scenario: Friendlies do not count
- **WHEN** a player has only been deconvoked in a friendly and «Nunca desconvocados» is active
- **THEN** the player is listed

#### Scenario: Injured but never by technical decision
- **WHEN** a player has one league deconvocation by injury
- **THEN** «Nunca desconvocados» excludes the player and «Sin decisión técnica» includes the player

### Requirement: Sorting
«Menos desconvocatorias» SHALL order by total league deconvocations ascending, then by technical decisions ascending. «Más jornadas sin técnica» SHALL order by league matchdays without a technical decision descending. Remaining ties SHALL keep the order of the proposal.

#### Scenario: Fewest deconvocations first
- **WHEN** the coach sorts by «Menos desconvocatorias»
- **THEN** a player with 0 league deconvocations is listed before a player with 2

#### Scenario: Longest without a technical decision first
- **WHEN** the coach sorts by «Más jornadas sin técnica»
- **THEN** a player with 6 matchdays without a technical decision is listed before a player with 1

### Requirement: Mobile friendly controls
The controls and results SHALL be usable from 360px wide without horizontal page scroll, with touch targets of at least 44px, using cards or a list and no table.

#### Scenario: Narrow screen
- **WHEN** the view is shown at 360px wide
- **THEN** the controls wrap onto several lines and the page does not scroll horizontally

