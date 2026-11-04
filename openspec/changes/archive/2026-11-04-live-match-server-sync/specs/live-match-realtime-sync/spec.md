## Purpose
Defines how the live match state is synchronised in real time to every device and coach of the team through a SignalR hub, including state recovery, clock offset handling, offline blocking and handling of rejected actions in the frontend.

## ADDED Requirements

### Requirement: One SignalR group per match
The system SHALL expose a SignalR hub at `/hubs/live-match` with one group per event. After saving each action the system SHALL emit `MatchUpdated` to the event group with the full state and its version, so one action produces one event.

#### Scenario: Saved action is broadcast
- **GIVEN** two devices joined the group of an event
- **WHEN** an action is saved from one of them
- **THEN** both devices receive one `MatchUpdated` event with the full state and the new version

#### Scenario: Rejected action is not broadcast
- **WHEN** an action is rejected because of an obsolete base version
- **THEN** no `MatchUpdated` event is emitted

### Requirement: Hub authentication through the access token query string
The hub connection SHALL authenticate with the coach JWT sent in the `access_token` query string, and the backend SHALL read that query-string token only for routes under `/hubs`.

#### Scenario: Hub connection with a valid token
- **WHEN** a device connects to `/hubs/live-match` with a valid JWT in `access_token`
- **THEN** the connection is authenticated

#### Scenario: Query-string token outside the hub
- **WHEN** a request to a route outside `/hubs` carries a JWT in `access_token`
- **THEN** the token is not used to authenticate the request

### Requirement: Full state recovery
The frontend SHALL request the full state of the match when the screen is opened, when the hub connection is re-established and when a received version is not the next expected version.

#### Scenario: Opening the screen
- **WHEN** a coach opens the live match screen of an event
- **THEN** the frontend requests the full state and applies it

#### Scenario: Reconnection
- **WHEN** the hub connection is re-established after a drop
- **THEN** the frontend requests the full state and applies it

#### Scenario: Version gap
- **GIVEN** the frontend holds version 5
- **WHEN** it receives a `MatchUpdated` event with version 8
- **THEN** the frontend requests the full state instead of applying the event

### Requirement: Server state is the source of truth in the frontend
For a match with server state, the frontend SHALL apply the state received from the server and SHALL send each user action with the base version it was applied on. The live match hook SHALL NOT keep its own authoritative copy of the match.

#### Scenario: Action sent with the base version
- **GIVEN** the frontend holds state at version 4
- **WHEN** the coach registers a goal
- **THEN** the action is sent with base version 4 and the UI reflects the goal after the server state is applied

#### Scenario: State from another device
- **WHEN** a `MatchUpdated` event produced by another device is received
- **THEN** the screen shows that state

### Requirement: Clock displayed with the server offset
The frontend SHALL display the match time computed from the server clock (phase, base seconds and server reference instant) using the offset between the device clock and `serverNowUtc`.

#### Scenario: Device clock differs from the server clock
- **GIVEN** a device whose clock is 20 seconds ahead of the server
- **WHEN** it displays a running match
- **THEN** the displayed time equals the time shown by a device with the correct clock

#### Scenario: Clock after a frozen phase
- **WHEN** the match is at halftime
- **THEN** the displayed time is the base seconds of the state and does not advance

### Requirement: Rejected action discards the local action
When an action is rejected by version, the frontend SHALL apply the current state returned in the response, discard the local action and notify the coach through `rffm.show_snackbar`.

#### Scenario: Rejection by obsolete version
- **WHEN** the server answers 409 to an action
- **THEN** the screen shows the state of the response, the local action is not applied and a notice informs the coach that the action must be repeated

### Requirement: Actions are blocked without connection
Without a connection to the server, the frontend SHALL block live match actions and show a notice, while keeping the clock visible computed from the last server reference.

#### Scenario: Action while offline
- **WHEN** the device has no connection and the coach attempts an action
- **THEN** the action is not performed and a notice explains that there is no connection

#### Scenario: Clock while offline
- **GIVEN** a running match
- **WHEN** the device loses connection
- **THEN** the clock keeps advancing from the last server reference

### Requirement: Local backup and recovery dialog are retired for server-backed matches
For matches with server state, the frontend SHALL NOT write the `localStorage` backup and SHALL NOT show the recovery dialog.

#### Scenario: Leaving the screen mid-match
- **WHEN** a coach leaves the screen of a match with server state
- **THEN** no live match backup is written to `localStorage`

#### Scenario: Returning to the screen
- **WHEN** a coach returns to the screen of a match with server state
- **THEN** the match is restored from the server and no recovery dialog is shown
