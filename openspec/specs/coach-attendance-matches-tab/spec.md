# coach-attendance-matches-tab Specification

## Purpose
TBD - created by archiving change redesign-attendance-matches-tab-cards. Update Purpose after archive.
## Requirements
### Requirement: Per-player card layout instead of a matrix table
`AttendanceMatchesTab` SHALL render one collapsible card per player (an `Accordion`, matching the pattern used by `AttendanceTrainingsTab`) instead of a jugador × jornada matrix table, so the tab never requires horizontal scrolling regardless of how many matches exist in the season.

#### Scenario: Season with many matches renders without a horizontal scroll container
- **WHEN** `AttendanceMatchesTab` renders with 9 or more columns (matches)
- **THEN** no table element or horizontally-scrolling container is rendered — each player is a card in a vertical list

#### Scenario: Empty state is preserved
- **WHEN** `columns` is empty or `rows` is empty
- **THEN** the existing "Sin datos de partidos" empty state is rendered, unchanged

### Requirement: Friendly matches are always identifiable next to the match itself
Every match row inside a player's expanded card SHALL show an "Amistoso" tag when `column.isFriendly` is true, positioned next to the match name/date — not inside a table column header that can scroll out of view.

#### Scenario: Friendly match shown inside an expanded card
- **WHEN** a player's card is expanded and one of their match columns has `isFriendly: true`
- **THEN** the "Amistoso" tag is visible directly next to that match's name/date

#### Scenario: Official-only season shows no friendly tag
- **WHEN** all of a player's match columns have `isFriendly: false`
- **THEN** no "Amistoso" tag is rendered anywhere in that player's card

### Requirement: Collapsed card summarizes season shape without expanding
Each player's collapsed card SHALL show, without requiring expansion: aggregate chips for total matches, matches started, matches not-called, and season minutes played; and a compact per-match state indicator (a "form strip") in chronological column order.

#### Scenario: Aggregate chips visible while collapsed
- **WHEN** a player's card is rendered collapsed
- **THEN** chips showing `totalMatches`, `startedMatches`, `notCalledMatches`, and `seasonMinutesPlayed` are present in the DOM

#### Scenario: Form strip shows one indicator per match
- **WHEN** a player's card is rendered collapsed with N match columns
- **THEN** N compact state indicators are shown in the card summary, one per column, in the same chronological order as `columns`

### Requirement: Expanded card shows per-match detail
Expanding a player's card SHALL list every match column as its own row, showing the match label, rival, date, the friendly tag when applicable, the player's state for that match (Titular/Convocado/Desconvocado/No convocado), and minutes played when the player was called.

#### Scenario: Starter shows minutes played
- **WHEN** a player's cell for a match has `state: "starter"` and `minutesPlayed: 78`
- **THEN** the expanded detail row for that match shows a "Titular" state and `78'`

#### Scenario: Not-called player shows no minutes
- **WHEN** a player's cell for a match has `state: "notCalled"` and `minutesPlayed: null`
- **THEN** the expanded detail row for that match shows a "Desconvocado" state and no minutes text

### Requirement: Cards show player photo and dorsal, colored by position
Each card SHALL show the player's photo (or initials fallback) and, when available, a jersey-shaped badge with the player's dorsal number overlaid on the avatar's corner, colored blue for outfield players and red for goalkeepers.

#### Scenario: Photo available
- **WHEN** a player row has a `photoUrl`
- **THEN** the card's avatar renders that photo

#### Scenario: No photo available
- **WHEN** a player row has no `photoUrl`
- **THEN** the card's avatar renders the player's initials

#### Scenario: Dorsal available for an outfield player
- **WHEN** a player row has `dorsal` set and `position` is not a goalkeeper position
- **THEN** the jersey badge is shown with that dorsal number in blue

#### Scenario: Dorsal available for a goalkeeper
- **WHEN** a player row has `dorsal` set and `position` matches a goalkeeper position (`portero`/`keeper`/`arquero`)
- **THEN** the jersey badge is shown with that dorsal number in red

#### Scenario: No dorsal available
- **WHEN** a player row has no `dorsal`
- **THEN** no jersey badge is rendered

### Requirement: Cards ordered by dorsal, associated player first
Cards SHALL be ordered by ascending `dorsal` (players without a dorsal sorted last, by name), except that the player linked to the logged-in user (Player/Family role) always appears first regardless of dorsal.

#### Scenario: Ascending dorsal order
- **WHEN** the tab renders players with different `dorsal` values
- **THEN** cards appear in ascending dorsal order

#### Scenario: Players without dorsal sorted last
- **WHEN** some players have no `dorsal`
- **THEN** those cards appear after every card with a `dorsal`, ordered by name

#### Scenario: Associated player always first
- **WHEN** the logged-in user is linked to a player on the team (Player/Family role)
- **THEN** that player's card appears first, even if their `dorsal` would otherwise place them later

### Requirement: Multi-column layout on desktop/tablet
The card list SHALL flow multiple cards per row on desktop/tablet widths, collapsing to a single column on mobile (≤640px), so horizontal space is not wasted while narrow screens stay usable.

#### Scenario: Wide viewport shows multiple cards per row
- **WHEN** the tab renders at a desktop/tablet width wide enough for more than one 380px-minimum card
- **THEN** more than one player card appears in the same row

#### Scenario: Mobile viewport stays single column
- **WHEN** the tab renders at a viewport ≤640px wide
- **THEN** cards stack one per row

