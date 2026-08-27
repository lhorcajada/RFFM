## ADDED Requirements

### Requirement: Sport events list exposes whether an event has convoked players
`GET /api/sport-events/{teamId}` SHALL include a `hasConvokedPlayers` boolean field on
each item of the response, `true` when at least one `Convocation` exists for that
`SportEvent.Id`, `false` otherwise.

#### Scenario: Event with at least one convocation
- **GIVEN** a `SportEvent` with one or more `Convocation` rows pointing to it
- **WHEN** a coach calls `GET /api/sport-events/{teamId}`
- **THEN** that event's item in the response has `hasConvokedPlayers: true`

#### Scenario: Event with no convocations
- **GIVEN** a `SportEvent` with zero `Convocation` rows pointing to it
- **WHEN** a coach calls `GET /api/sport-events/{teamId}`
- **THEN** that event's item in the response has `hasConvokedPlayers: false`

### Requirement: Training event cards show arrival time and convocation status
A training event's card ("Entrenamiento") in the Coach app's attendance events list SHALL display a highlighted tag with its arrival time when available, and a tag with its convocation status ("Convocatoria abierta"/"Convocatoria sin iniciar") plus a matching border color. Match/tournament cards SHALL NOT show either tag, regardless of `hasConvokedPlayers`.

#### Scenario: Training card with an arrival time
- **GIVEN** a training event with a valid `arrivalDate`
- **WHEN** its card renders in the attendance events list
- **THEN** a highlighted tag shows the arrival time

#### Scenario: Training card without an arrival time
- **GIVEN** a training event with no `arrivalDate`
- **WHEN** its card renders in the attendance events list
- **THEN** no arrival-time tag is shown

#### Scenario: Training card with convoked players
- **GIVEN** a training event with `hasConvokedPlayers: true`
- **WHEN** its card renders in the attendance events list
- **THEN** it shows a "Convocatoria abierta" tag and its distinguishing border color

#### Scenario: Training card without convoked players
- **GIVEN** a training event with `hasConvokedPlayers: false` or `undefined`
- **WHEN** its card renders in the attendance events list
- **THEN** it shows a "Convocatoria sin iniciar" tag and its distinguishing border color

#### Scenario: Match card ignores convocation status
- **GIVEN** a match event with `hasConvokedPlayers: true`
- **WHEN** its card renders in the attendance events list
- **THEN** neither the arrival-time tag nor the convocation-status tag is shown

### Requirement: Event detail "Volver" returns to the events list
The "Volver" action on the Coach app's event detail page (`AttendanceEvent.tsx`) SHALL navigate back to the attendance events list for the event's team, instead of the team dashboard.

#### Scenario: Coach returns from an event's detail page
- **GIVEN** a coach viewing the detail page of an event belonging to team `T`
- **WHEN** they click "Volver"
- **THEN** they are navigated to the attendance events list scoped to team `T`, not the
  team dashboard
