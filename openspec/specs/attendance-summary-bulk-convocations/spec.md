# attendance-summary-bulk-convocations Specification

## Purpose
TBD - created by archiving change attendance-summary-bulk-convocations. Update Purpose after archive.
## Requirements
### Requirement: Team convocations summary endpoint
The system SHALL expose `GET /api/attendance/team-convocations/{teamId}` returning, in
a single response, one row per convocation across every `SportEvent` belonging to
`teamId` — `eventId`, `convocationId`, `teamPlayerId`, `playerId`, `alias`, `statusId`,
`excuseTypeId`, `assistanceTypeId`.

#### Scenario: Team with convocations across multiple events
- **GIVEN** a team with several `SportEvent`s, each with one or more `Convocation` rows
- **WHEN** a coach calls `GET /api/attendance/team-convocations/{teamId}`
- **THEN** the response contains one row per convocation, each tagged with its
  `eventId`, across all of the team's events, in a single HTTP call

#### Scenario: Team with no convocations
- **GIVEN** a team with `SportEvent`s but zero `Convocation` rows
- **WHEN** a coach calls `GET /api/attendance/team-convocations/{teamId}`
- **THEN** the response is an empty array

### Requirement: Attendance summary loads with a minimal, event-count-independent number of HTTP calls
The Coach attendance summary page (`AttendanceSummaryContent.tsx`) SHALL fetch
convocation data for all of a team's events with exactly one HTTP call (via
`getTeamConvocationsSummary`), and SHALL fetch the team's ideal lineup with exactly one
HTTP call, regardless of how many events or official matches the team has. Neither call
count SHALL grow with the number of events.

#### Scenario: Team with many events loads convocations in one call
- **GIVEN** a team with N events (N > 1) each with convocations
- **WHEN** the attendance summary page loads for that team
- **THEN** exactly one HTTP call is made to fetch convocations for all N events (not N
  calls)

#### Scenario: Team with many official matches loads the ideal lineup once
- **GIVEN** a team with M official match events (M > 1)
- **WHEN** the attendance summary page loads for that team
- **THEN** exactly one HTTP call is made to fetch the team's ideal lineup (not M calls),
  and that same lineup is used to compute the "starter" state for every match column

#### Scenario: Dashboard, Trainings and Matches tabs render identical data
- **GIVEN** the same team and underlying data as before this change
- **WHEN** the attendance summary page loads
- **THEN** the Dashboard summary counts, the Trainings tab rows, and the Matches tab
  rows/columns are identical to what they were before the refactor

