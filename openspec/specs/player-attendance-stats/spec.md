# player-attendance-stats Specification

## Purpose
TBD - created by archiving change player-attendance-ratio-and-live-match-status. Update Purpose after archive.
## Requirements
### Requirement: Player attendance stats are shown as attended/possible ratios
`GET /api/catalog/team/{teamId}/player-stats` SHALL return, per player, three attendance ratios (`trainings`, `friendlies`, `league`), each with `attended`, `possible`, and `calledButAbsent` counts. `possible` SHALL count the team's `SportEvent`s of that type whose `EveDateTime` has already passed, restricted to the window during which the player was on the roster (`TeamPlayer.JoinedDate` through `TeamPlayer.LeftDate`, or through now if still active). `attended` SHALL count, within that same set of events, the player's convocations whose `AssistanceTypeId` is `Attendance` or `LateArrival`. `calledButAbsent` SHALL count, within that same set of events and the same roster window, the player's convocations whose `AssistanceTypeId` is `ExcusedAbsence` or `UnexcusedAbsence`. An event with no convocation row for the player SHALL still count toward `possible` but not toward `attended` or `calledButAbsent`.

#### Scenario: Only finished events count as possible
- **GIVEN** a team with 3 past trainings and 1 future training
- **WHEN** a player's attendance stats are requested
- **THEN** `trainings.possible` is 3, not 4

#### Scenario: Events before the player joined the squad are excluded
- **GIVEN** a team with 5 finished league matches, and a player whose `JoinedDate` is after the
  first 2 of them
- **WHEN** that player's attendance stats are requested
- **THEN** `league.possible` is 3

#### Scenario: Late arrival counts as attended
- **GIVEN** a player convocation for a finished friendly with `AssistanceTypeId = LateArrival`
- **WHEN** that player's attendance stats are requested
- **THEN** the event counts toward both `friendlies.possible` and `friendlies.attended`

#### Scenario: Excused or unexcused absence counts as possible and as calledButAbsent, not attended
- **GIVEN** a player convocation for a finished training with `AssistanceTypeId = ExcusedAbsence`
  (or `UnexcusedAbsence`)
- **WHEN** that player's attendance stats are requested
- **THEN** the event counts toward `trainings.possible` and `trainings.calledButAbsent`, but not
  toward `trainings.attended`

### Requirement: "Llegó tarde" can carry a reason
`PUT /api/events/{eventId}/convocations/{convocationId}/assistance` SHALL accept an optional `ExcuseTypeId` when `AssistanceTypeId` is `LateArrival`, in addition to the existing `ExcusedAbsence` case. For any other `AssistanceTypeId`, `ExcuseTypeId` SHALL continue to be cleared.

#### Scenario: Late arrival with a reason is persisted
- **WHEN** a coach sets a convocation's `AssistanceTypeId` to `LateArrival` with a valid
  `ExcuseTypeId`
- **THEN** the convocation's `ExcuseTypeId` is saved

#### Scenario: Late arrival without a reason stays reason-less
- **WHEN** a coach sets a convocation's `AssistanceTypeId` to `LateArrival` without an `ExcuseTypeId`
- **THEN** the convocation's `ExcuseTypeId` remains `null`

