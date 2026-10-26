## ADDED Requirements

### Requirement: Global attendance ring
The «Panel» tab SHALL show the global attendance rate as a ring with the percentage and the totals of events, attendees and absentees.

#### Scenario: Global rate
- **WHEN** the team has 648 attendances and 142 absences
- **THEN** the ring is labelled with the rounded rate (82%) and the totals are shown

### Requirement: Category cards
The «Panel» tab SHALL show one card per category (Entrenamientos, Partidos, Otros eventos) with its rate, bars for the latest events and totals, and an empty state when the category has no events.

#### Scenario: Empty category
- **WHEN** a category has no finished events
- **THEN** its card shows an empty state instead of bars

### Requirement: No table
The «Panel» tab SHALL NOT render a `<table>`.

#### Scenario: Table absent
- **WHEN** the tab renders
- **THEN** no table element is present
