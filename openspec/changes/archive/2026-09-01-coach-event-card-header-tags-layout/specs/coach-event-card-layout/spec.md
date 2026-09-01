## ADDED Requirements

### Requirement: Arrival time chip visible for any event type
`EventCard` SHALL render the "Llegada HH:MM" chip whenever the event has a resolvable arrival time (`event.arrivalDate` or `event.arrival`), regardless of `eventTypeName` (training, match, tournament, or any other type).

#### Scenario: Training event with arrival time
- **WHEN** an `EventCard` renders a training event with `arrivalDate` set
- **THEN** the "Llegada HH:MM" chip is visible

#### Scenario: Match event with arrival time
- **WHEN** an `EventCard` renders a match (`eventTypeName` includes "Partido") with `arrivalDate` set
- **THEN** the "Llegada HH:MM" chip is visible

#### Scenario: Event without arrival time
- **WHEN** an `EventCard` renders any event with no `arrivalDate` and no `arrival`
- **THEN** no "Llegada" chip is rendered

### Requirement: Event-type tag lateralized in the header
`EventCard`'s generic (non-match) header SHALL render the `eventTypeName` chip left-aligned ("lateralized"), using the same JSX/logic in both `compact` and non-`compact` modes (no mode-specific conditional beyond CSS sizing).

#### Scenario: Non-match event shows a left-aligned type tag
- **WHEN** an `EventCard` renders a non-match event with a defined `eventTypeName`
- **THEN** the event-type chip is rendered flush to the left edge of the header, not centered

#### Scenario: Same behavior in compact and non-compact card
- **WHEN** the same non-match event is rendered once with `compact` and once without
- **THEN** the event-type chip is present in both, using the same component logic (only size/spacing may differ via CSS)

### Requirement: No clipped or overlapping content at any supported breakpoint
`EventCard`'s non-compact layout SHALL reserve enough height (desktop and `@media (max-width: 480px)`) for its header, title, meta, location/rival, chip row (Partido/Llegada/Convocatoria), and the attendance badges row, so none of them are clipped by the card's `overflow:hidden` boundaries or visually overlap each other.

#### Scenario: Mobile viewport shows all attendance badge chips
- **WHEN** an `EventCard` with a full attendance summary (Convocados/Van/Pendientes/No van/%) renders at a viewport ≤480px wide
- **THEN** all five attendance badge chips are present in the DOM and none are visually clipped out of the card's bounds

#### Scenario: No text overlap after adding the arrival and chip-row changes
- **WHEN** an `EventCard` renders a match event with `arrivalDate`, a score, and a full attendance summary
- **THEN** the title, meta row, chip row, and attendance badges row each occupy distinct, non-overlapping regions of the card
