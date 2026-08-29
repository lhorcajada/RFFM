## ADDED Requirements

### Requirement: Event date/time are optional at creation
`POST /api/sport-events` SHALL accept `eveDateTime` and `startTime` as optional fields.
When omitted, the API SHALL create the `SportEvent` with `eveDateTime: null` and
`startTime: null`, to be completed later via `PUT /api/sport-events/{id}`.

#### Scenario: Event created without a date
- **WHEN** a coach calls `POST /api/sport-events` with `name`, `eventTypeId`, `teamId`
  set but `eveDateTime` and `startTime` omitted (`null`)
- **THEN** the request succeeds and the response reports `eveDateTime: null`,
  `startTime: null`

#### Scenario: Undated event can be completed later via update
- **WHEN** a coach calls `POST /api/sport-events` without a date, then calls `PUT
  /api/sport-events/{id}` with a concrete `eveDateTime`/`startTime`
- **THEN** the event is updated with the provided date/time, exactly as if it had been
  provided at creation

### Requirement: Recurrence requires an event date
`POST /api/sport-events` SHALL reject (HTTP 400, `ProblemDetails`) any request that
includes a `recurrence` object but omits `eveDateTime`, since a recurring series needs
an anchor date to generate its instances.

#### Scenario: Recurrence without a date is rejected
- **WHEN** a coach calls `POST /api/sport-events` with `recurrence: { frequency:
  "weekly", endDate: ... }` set but `eveDateTime: null`
- **THEN** the API responds 400 with a `ProblemDetails` validation error naming that
  recurrence requires an event date, and no `SportEvent` or `EventRecurrence` rows are
  persisted

### Requirement: Optional rival creation at event creation time
`POST /api/sport-events` SHALL accept an optional `newRival` object (`{ name,
urlPhoto?, category? }`) as an alternative to `rivalId`. When `newRival` is present,
the API SHALL create a new `Rival` and link it to the created `SportEvent` in the same
request. `rivalId` and `newRival` are mutually exclusive; both may be omitted to
create an event with no rival.

#### Scenario: Event created with a brand-new rival
- **WHEN** a coach calls `POST /api/sport-events` with `newRival: { name: "CD Rival" }`
  and no `rivalId`
- **THEN** a new `Rival` row is created with that name, and the created `SportEvent`'s
  `rivalId` points at it

#### Scenario: Event created with an existing rival (unchanged behavior)
- **WHEN** a coach calls `POST /api/sport-events` with `rivalId` set to an existing
  rival's id and no `newRival`
- **THEN** the created `SportEvent` is linked to that existing rival and no new `Rival`
  row is created

#### Scenario: Event created with no rival at all
- **WHEN** a coach calls `POST /api/sport-events` with both `rivalId` and `newRival`
  omitted
- **THEN** the request succeeds and the created `SportEvent` has `rivalId: null`

#### Scenario: Both rivalId and newRival provided is rejected
- **WHEN** a coach calls `POST /api/sport-events` with both `rivalId` and `newRival` set
- **THEN** the API responds 400 with a `ProblemDetails` validation error, and no
  `SportEvent` or `Rival` rows are persisted

#### Scenario: New rival without a name is rejected
- **WHEN** a coach calls `POST /api/sport-events` with `newRival: { name: "" }`
- **THEN** the API responds 400 with a `ProblemDetails` validation error, and no
  `SportEvent` or `Rival` rows are persisted
