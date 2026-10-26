# coach-event-card-layout Specification

## Purpose
TBD - created by archiving change coach-event-card-header-tags-layout. Update Purpose after archive.
## Requirements
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
`EventCard` SHALL render the event type label (`eventTypeName`) in the card's top row, left-aligned, using the same JSX/logic in both `compact` and non-`compact` modes (no mode-specific conditional beyond CSS sizing).

#### Scenario: Non-match event shows a left-aligned type label
- **WHEN** an `EventCard` renders a non-match event with a defined `eventTypeName`
- **THEN** the event-type label is rendered at the left of the card's top row, not centered

#### Scenario: Same behavior in compact and non-compact card
- **WHEN** the same non-match event is rendered once with `compact` and once without
- **THEN** the event-type label is present in both, using the same component logic (only size/spacing may differ via CSS)

### Requirement: No clipped or overlapping content at any supported breakpoint
`EventCard`'s non-compact layout SHALL size its height to its content (no fixed height) at desktop and at `@media (max-width: 480px)`, so the title, meta row, location, chip row and attendance badges are neither clipped nor overlap each other.

#### Scenario: Mobile viewport shows all attendance badge chips
- **WHEN** an `EventCard` with a full attendance summary (Convocados/Van/Pendientes/No van/%) renders at a viewport ≤480px wide
- **THEN** all five attendance badge chips are present in the DOM and none are visually clipped out of the card's bounds

#### Scenario: No text overlap with arrival and chip row
- **WHEN** an `EventCard` renders a match event with `arrivalDate`, a score, and a full attendance summary
- **THEN** the title, meta row, chip row, and attendance badges row each occupy distinct, non-overlapping regions of the card

### Requirement: The event card links to the event
In the events list, `EventCard` SHALL be a link to the event's attendance page (`/coach/attendance/:id`) and SHALL NOT render attendance, edit, delete or go-to-match action buttons. It SHALL show a date and time block, the event type, the location (a map link that does not trigger the card link) and the attendance badges. Matches SHALL show both teams and the score, or «vs» with the kick-off time when known.

#### Scenario: Open an event
- **WHEN** the coach selects an event card
- **THEN** the event's attendance page opens

#### Scenario: No action buttons
- **WHEN** an `EventCard` renders in the events list
- **THEN** there are no «Editar», «Eliminar», «Asistencias» or «Ir al partido» buttons

#### Scenario: Match without result
- **WHEN** a match has no score
- **THEN** the card shows «vs» and the kick-off time when known

