# squad-ratings-tab Specification

## Purpose
TBD - created by archiving change squad-tabs-redesign. Update Purpose after archive.
## Requirements
### Requirement: Rating cards
The «Valoraciones» tab SHALL list players grouped by position as cards showing the average and the four ratings (Físico, Técnica, Táctica, Competitividad) as bars with their values. Sorting SHALL be offered as chips (the selected one marked as pressed) that wrap, never as a horizontally scrolling control.

#### Scenario: Sort by a rating
- **WHEN** the coach presses the «Físico» chip
- **THEN** the players of each position group are sorted by that rating, highest first, with unrated players last

### Requirement: Sub-ratings inside the card
Each card SHALL have a «Ver subvaloraciones» control that expands the detailed ratings inside the card itself; opening one card SHALL close the previously opened one. The control SHALL expose its expanded state.

#### Scenario: Expand and switch
- **WHEN** the coach expands a card and then expands another
- **THEN** only the second card shows its sub-ratings

### Requirement: Conduct filters
The «Valoraciones» tab SHALL offer, to coaches and administrators only, a «Conducta» filter bar built from the team's latest conduct (behavior trait) ratings. It SHALL allow filtering by a trait with a level range, and by the trend of the latest conduct rating (up, same, down). Several filters SHALL combine, keeping only the players that match all of them. The tab SHALL NOT render nor request conduct data when it is read-only (players and family).

#### Scenario: Filter by trait level
- **WHEN** the coach selects the trait «Presión» with a maximum level of 2
- **THEN** only the players whose latest conduct rating has «Presión» at level 2 or lower are listed

#### Scenario: Filter by trend
- **WHEN** the coach selects the trend «Bajando»
- **THEN** only the players whose latest conduct rating has trend down are listed

#### Scenario: Players without conduct rating
- **WHEN** a trait-level filter is active
- **THEN** players with no conduct rating, or with no level for that trait, are not listed

#### Scenario: Hidden for players and family
- **WHEN** a player or a family member opens the tab
- **THEN** no conduct filter bar is shown and no conduct rating is requested

### Requirement: Filtered position groups
When conduct filters are active, the tab SHALL keep the players grouped by position, in the usual position order, listing only the matching players in each group and hiding the groups left empty. The sort chosen with the existing chips SHALL still apply inside each group. When no player matches, the tab SHALL show an empty state with a «Quitar filtros» action that clears the conduct filters.

#### Scenario: Groups keep their order
- **WHEN** conduct filters leave players in Defensa and Delantero only
- **THEN** the tab shows the Defensa group followed by the Delantero group, and no other group

#### Scenario: No match
- **WHEN** no player matches the active conduct filters
- **THEN** the tab shows an empty message and pressing «Quitar filtros» lists all players again

#### Scenario: Sort inside a filtered group
- **WHEN** conduct filters are active and the coach presses the «Físico» chip
- **THEN** the matching players of each group are sorted by that rating, highest first, with unrated players last

