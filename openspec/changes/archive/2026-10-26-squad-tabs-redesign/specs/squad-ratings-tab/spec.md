## ADDED Requirements

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
