# coach-recurring-events Specification

## Purpose
TBD - created by archiving change coach-recurring-events. Update Purpose after archive.
## Requirements
### Requirement: Optional recurrence on event creation
`POST /api/sport-events` SHALL accept an optional `recurrence` object (`{ frequency: "daily" | "weekly" | "monthly", endDate }`). When present, the API SHALL generate one master `SportEvent` plus one instance per subsequent occurrence up to and including `endDate`, all linked by a shared `RecurrenceId`.

#### Scenario: Non-recurring request behaves exactly as today
- **WHEN** a coach calls `POST /api/sport-events` without a `recurrence` field
- **THEN** exactly one `SportEvent` is created, with `recurrenceId: null` and `isRecurrenceMaster: false` in the response

#### Scenario: Weekly recurrence generates one event per week up to the end date
- **WHEN** a coach calls `POST /api/sport-events` with `eveDateTime: 2026-08-03T18:00:00Z` and `recurrence: { frequency: "weekly", endDate: "2026-08-24" }`
- **THEN** 4 `SportEvent` rows are created (Aug 3, 10, 17, 24), all sharing one `recurrenceId`, only the Aug 3 event has `isRecurrenceMaster: true`, and the response reports `recurrenceInstanceCount: 4`

#### Scenario: Generated instances copy the master's shared fields but not match-specific fields
- **WHEN** a recurring series is created from a master event with a given `location`, `description`, `eventTypeId`, `teamId` and `rivalId`
- **THEN** every generated instance shares those same fields, and `codActa` is `null` on every instance (including the master unless explicitly provided) since it is match-specific

### Requirement: Recurring series capped at 52 generated events
The API SHALL reject (HTTP 400, `ProblemDetails`) any recurrence request whose frequency + end date would generate more than 52 events, rather than silently truncating the series.

#### Scenario: Exactly 52 instances is accepted
- **WHEN** a daily recurrence request from a given start date to an end date exactly 51 days later is submitted (52 total occurrences)
- **THEN** the request succeeds and 52 `SportEvent` rows are created

#### Scenario: 53 instances is rejected
- **WHEN** a daily recurrence request from a given start date to an end date 52 days later is submitted (53 total occurrences)
- **THEN** the API responds 400 with a `ProblemDetails` validation error naming the 52-event limit, and no `SportEvent` or `EventRecurrence` rows are persisted

#### Scenario: Invalid frequency code is rejected
- **WHEN** a `recurrence.frequency` value other than `"daily"`, `"weekly"` or `"monthly"` is submitted
- **THEN** the API responds 400 with a `ProblemDetails` validation error and creates nothing

### Requirement: Master/instance linkage supports future per-instance vs per-series operations
Every event belonging to a recurring series SHALL be individually addressable (`SportEvent.Id`) while also being identifiable as part of the series (`SportEvent.RecurrenceId`), so a later change can implement "edit/delete this occurrence only" vs. "edit/delete the whole series" without a schema migration.

#### Scenario: Series membership is queryable
- **WHEN** a recurring series has been created with `recurrenceId = R`
- **THEN** querying `SportEvents` filtered by `RecurrenceId == R` returns exactly the master and all its generated instances, and each has a distinct `Id`

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

