# live-match-server-state Specification

## Purpose
TBD - created by archiving change live-match-server-sync. Update Purpose after archive.
## Requirements
### Requirement: Single live state per event
The system SHALL keep at most one live match state per sport event. The state SHALL hold the complete live match: lineup, formation, match duration, score, events (goals, cards, substitution windows, formation changes, rating snapshots), phase and clock.

#### Scenario: Live state is created for an event without one
- **WHEN** a live match state is created for an event that has no live state
- **THEN** exactly one live state exists for that event, in the pre-match phase

#### Scenario: Concurrent creation keeps one state
- **WHEN** two live match states are created for the same event at the same time
- **THEN** only one live state is kept for the event and both requests observe that same state

### Requirement: Monotonic state version
Every live match state SHALL carry a version that increases by one each time an action is saved, and the state returned by the system SHALL always include its current version.

#### Scenario: Saved action increments the version
- **GIVEN** a live state at version N
- **WHEN** an action with base version N is saved
- **THEN** the live state is at version N+1

#### Scenario: Reading returns the full state with its version
- **WHEN** an authorized coach requests the live match of an event that has a live state
- **THEN** the response contains the full state, its version and the current server time (`serverNowUtc`)

### Requirement: Actions carry the base version
Every action on a live match SHALL carry the version of the state it was applied on. If the base version equals the current version, the system SHALL save the resulting state, increment the version and broadcast the full state. If it does not match, the system SHALL reject the action with a 409 response carrying the current state and SHALL NOT change the stored state.

#### Scenario: Action with matching base version
- **GIVEN** a live state at version 7
- **WHEN** a coach registers a goal with base version 7
- **THEN** the goal is stored, the version becomes 8 and the full state is broadcast to the match group

#### Scenario: Action with obsolete base version
- **GIVEN** a live state at version 8
- **WHEN** a coach sends an action with base version 7
- **THEN** the response is 409 with the current state at version 8 and the stored state is unchanged

#### Scenario: Two simultaneous actions on the same version
- **GIVEN** two coaches send an action with the same base version at the same time
- **WHEN** the system processes both
- **THEN** one action is saved and the other is rejected with 409 and the current state

### Requirement: Server-owned match clock
The system SHALL own and compute the match clock as the phase, the base seconds and a server reference instant. Kick-off, end of half, start of second half, finish and the minutes adjustment SHALL be actions on the state, and every response SHALL include `serverNowUtc` so devices can compute the elapsed time.

#### Scenario: Kick-off sets the clock reference
- **WHEN** the kick-off action is saved on a match in the pre-match phase
- **THEN** the phase becomes first half, the base seconds are 0 and the clock reference is the server instant of the action

#### Scenario: End of half freezes the clock
- **WHEN** the end-of-half action is saved while the first half is running
- **THEN** the phase becomes halftime and the base seconds hold the elapsed seconds at the server instant of the action

#### Scenario: Minutes adjustment moves the clock
- **GIVEN** a running match whose elapsed time is 30 minutes
- **WHEN** a coach adjusts the clock by plus 2 minutes
- **THEN** the base seconds correspond to 32 minutes and the clock reference is the server instant of the action

#### Scenario: Responses include the server time
- **WHEN** the system responds to a read or an action on a live match
- **THEN** the response includes `serverNowUtc`

### Requirement: Pre-match lineup, formation and duration are stored
The system SHALL store and synchronise the lineup, the formation and the match duration set before kick-off as part of the live state.

#### Scenario: Pre-match lineup is stored
- **WHEN** a coach saves the starting lineup and formation of a match in the pre-match phase
- **THEN** the lineup and formation are part of the live state and the version is incremented

#### Scenario: Match duration is stored
- **WHEN** a coach sets the match duration before kick-off
- **THEN** the duration is part of the live state and the version is incremented

### Requirement: Invalid actions are rejected with ProblemDetails
The system SHALL validate every live match action and SHALL return failures as RFC 7807 ProblemDetails.

#### Scenario: Invalid action payload
- **WHEN** a coach sends an action whose payload fails validation
- **THEN** the response is a ProblemDetails error and the stored state is unchanged

### Requirement: Finishing converts the live state into match participation
When a live match is finished, the system SHALL convert the live state into `MatchParticipation` reusing the current save logic (including the automatic sanctions behaviour of a finished match) and SHALL close the live state in the same transaction. The frontend SHALL NOT send a final match participation save for a match with server state.

#### Scenario: Finish converts and closes
- **WHEN** a coach finishes a live match
- **THEN** `MatchParticipation` rows exist for the match with its final score and events, the live state is closed, and both changes were committed in one transaction

#### Scenario: Conversion failure keeps the live state
- **WHEN** the conversion into match participation fails while finishing
- **THEN** no `MatchParticipation` is stored and the live state remains open and unchanged

#### Scenario: Finish broadcasts to all devices
- **WHEN** a live match is finished
- **THEN** every device connected to the match group receives the finished state

### Requirement: Deleting a live match removes its state and participation
When a match is deleted, the system SHALL remove the live state and the `MatchParticipation` of the event, and every connected device SHALL return to the phase prior to the match.

#### Scenario: Delete removes both records
- **WHEN** a coach deletes a match that has live state or match participation
- **THEN** the live state and the `MatchParticipation` of the event no longer exist

#### Scenario: Devices return to pre-match
- **WHEN** a match is deleted while several devices have it open
- **THEN** every device shows the match in the phase prior to the match

### Requirement: Manual edits of finished matches keep the current flow
Manual editing of finished matches and the change of the minutes reason SHALL keep operating on `MatchParticipation` as they do today, without going through the live state.

#### Scenario: Manual edit of a finished match
- **WHEN** a coach manually edits a finished match
- **THEN** the change is stored in `MatchParticipation` and no live state is created or modified

#### Scenario: Minutes reason change
- **WHEN** a coach changes the minutes reason of a player of a finished match
- **THEN** the reason is stored in `MatchParticipation` as before

