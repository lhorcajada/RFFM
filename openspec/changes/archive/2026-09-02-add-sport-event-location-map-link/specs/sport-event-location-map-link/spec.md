## ADDED Requirements

### Requirement: Optional Google Maps link on a sport event
`SportEvent` SHALL support an optional `locationMapUrl` field, independent of the existing free-text `location` field, settable via `POST /api/sport-events` and `PUT /api/sport-events/{id}`.

#### Scenario: Creating an event with only a location description (no link)
- **WHEN** a coach calls `POST /api/sport-events` with `location: "Campo Municipal Norte"` and no `locationMapUrl`
- **THEN** the event is created with `location: "Campo Municipal Norte"` and `locationMapUrl: null`

#### Scenario: Creating an event with a location description and a map link
- **WHEN** a coach calls `POST /api/sport-events` with `location: "Campo Municipal Norte"` and `locationMapUrl: "https://maps.google.com/?q=Campo+Municipal+Norte"`
- **THEN** the event is created with both fields persisted and returned as given

#### Scenario: Malformed map link is rejected
- **WHEN** a coach calls `POST /api/sport-events` or `PUT /api/sport-events/{id}` with `locationMapUrl: "not a url"`
- **THEN** the API responds 400 with a `ProblemDetails` validation error and no event is created or modified

#### Scenario: Existing events are unaffected
- **WHEN** an event created before this change is fetched via `GET /api/sport-events/{teamId}` or `GET /api/sport-events/item/{id}`
- **THEN** it returns `locationMapUrl: null` and its existing `location` value is unchanged

#### Scenario: Recurring series shares the same map link across instances
- **WHEN** a coach creates a recurring event (per the existing recurrence feature) with a `locationMapUrl` set on the master
- **THEN** every generated instance in the series has the same `locationMapUrl`

### Requirement: Location renders as a clickable map link when available
Wherever a `SportEvent`'s location is displayed to the coach (attendance card, event detail), the location text SHALL render as a link opening `locationMapUrl` in a new tab when that field is present, and as plain text otherwise.

#### Scenario: Event with a map link renders as a clickable link
- **WHEN** a coach views an event card or event detail for an event with both `location` and `locationMapUrl` set
- **THEN** the location text is rendered as an anchor with `href` equal to `locationMapUrl`, opening in a new tab

#### Scenario: Event without a map link renders as plain text
- **WHEN** a coach views an event card or event detail for an event with `location` set but `locationMapUrl` null
- **THEN** the location renders as plain, non-interactive text, unchanged from current behavior

#### Scenario: Clicking the map link on an attendance card does not open the event
- **WHEN** a coach clicks the map link inside a clickable `EventCard`
- **THEN** only the external map link opens; the card's own click handler (opening the event) does not also fire
