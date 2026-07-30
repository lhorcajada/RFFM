# mobile-event-cards Specification

## Purpose
TBD - created by archiving change mobile-events-cards. Update Purpose after archive.
## Requirements
### Requirement: Events section title
The Mobile calendar screen SHALL label its events section "Eventos".

#### Scenario: Screen title
- **WHEN** a user opens the calendar screen for a team
- **THEN** the section title reads "Eventos"

### Requirement: Event list renders as cards
The Mobile calendar screen SHALL render each event returned by the API as a card component, not a plain text row, showing at minimum: title, date, location (when present), and rival (when present).

#### Scenario: Generic event card
- **WHEN** the events request resolves with a non-match event (e.g. "Entrenamiento")
- **THEN** a card is rendered showing the event title, formatted date, and location if provided

#### Scenario: Match event card
- **WHEN** the events request resolves with an event whose type name includes "partido"
- **THEN** the card shows the team and rival names/shields, home/away indicator, and the score if both `localGoals` and `visitorGoals` are present, otherwise "vs" and the kickoff time

#### Scenario: Match result badge
- **WHEN** a match card has both goal counts present and numeric
- **THEN** the card shows a result badge of "Victoria", "Empate", or "Derrota" computed from the user's team perspective (accounting for home/away)

### Requirement: Event time shown in device local time
The event card SHALL display the event's time of day, converted from the backend's UTC `eveDateTime` to the device's local time zone, whenever the event carries a non-midnight time component.

#### Scenario: Generic event with a time component
- **WHEN** an event's `eveDateTime` includes a non-midnight time
- **THEN** the card shows the local time next to the formatted date

#### Scenario: UTC time is converted, not shown raw
- **WHEN** an event's `eveDateTime` is a UTC instant (e.g. ends in `Z`)
- **THEN** the displayed time reflects the device's local time zone, not the raw UTC hour

#### Scenario: Match without a score shows kickoff time
- **WHEN** a match event has no score yet and a non-midnight time component
- **THEN** the card shows the local kickoff time next to "vs"

#### Scenario: No time component
- **WHEN** an event's `eveDateTime` has no time component (date-only) or is exactly midnight
- **THEN** no time is shown on the card

### Requirement: Navigation labels say "Eventos"
The Mobile app's bottom tab label and stack header title for the calendar screen SHALL read "Eventos" instead of "Calendario".

#### Scenario: Bottom tab label
- **WHEN** a user views the bottom tab bar
- **THEN** the tab pointing to the calendar screen is labeled "Eventos"

#### Scenario: Stack header title
- **WHEN** a user navigates into the calendar screen
- **THEN** the header title reads "Eventos"

### Requirement: Event type resolution
The Mobile calendar screen SHALL resolve each event's type name via `GET /api/sport-event-types`, matched by `eventTypeId`, to decide the card's header style and whether the event is treated as a match.

#### Scenario: Type name drives header style
- **WHEN** an event's resolved type name contains "entrenamiento"
- **THEN** the card header uses the training color/icon; other type names fall back to the generic header

### Requirement: Card navigation unchanged
Tapping an event card SHALL navigate to `EventDetail` with the same parameters as the current row-based implementation (`eventId`, `teamId`, `teamPlayerId`).

#### Scenario: Tap navigates to detail
- **WHEN** a user taps an event card
- **THEN** navigation to `EventDetail` occurs with `{ eventId, teamId, teamPlayerId }`

### Requirement: Loading, error, and empty states preserved
The screen SHALL keep its existing loading indicator, error message with retry, and empty-state message, unchanged in behavior and test IDs (`loading-indicator`, `error-message`, `retry-button`, `empty-message`).

#### Scenario: Empty state
- **WHEN** the events request resolves with an empty array
- **THEN** the empty-state message is shown instead of any cards

#### Scenario: Error with retry
- **WHEN** the events request rejects
- **THEN** an error message is shown with a retry action that re-fetches events

