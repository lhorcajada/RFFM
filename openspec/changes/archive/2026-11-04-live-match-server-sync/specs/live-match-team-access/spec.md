## Purpose
Restricts reading and acting on a live match, through REST and through the SignalR hub, to the coaches assigned to the team of the event, using one shared membership check.

## ADDED Requirements

### Requirement: Only coaches of the event team can read and act
Only coaches assigned to the team of the event SHALL be able to read a live match or act on it, through REST and through the hub. Any other authenticated user, including an administrator with no team assigned, SHALL receive 403.

#### Scenario: Assigned coach reads the live match
- **WHEN** a coach assigned to the team of the event requests the live match
- **THEN** the system returns the live state

#### Scenario: Coach of another team
- **WHEN** a coach not assigned to the team of the event requests the live match
- **THEN** the response is 403

#### Scenario: Administrator without team
- **WHEN** an administrator with no team assigned requests or acts on the live match
- **THEN** the response is 403

#### Scenario: Unauthorized action
- **WHEN** a user who is not assigned to the team sends an action
- **THEN** the response is 403 and the stored state is unchanged

### Requirement: Hub join is restricted to the event team
Joining the match group of the hub SHALL verify that the user is a coach assigned to the team of the event. Users who fail the check SHALL be rejected and SHALL NOT be added to the group.

#### Scenario: Authorized join
- **WHEN** a coach assigned to the team calls `JoinMatch` for the event
- **THEN** the connection is added to the group of the event and receives its `MatchUpdated` events

#### Scenario: Unauthorized join
- **WHEN** a user who is not assigned to the team calls `JoinMatch`
- **THEN** the join is rejected and the connection receives no `MatchUpdated` events of that event

### Requirement: One shared membership check
REST endpoints and the hub SHALL use the same team membership check, so both enforce identical access rules.

#### Scenario: Same decision on both channels
- **WHEN** a user is denied by the REST check for an event
- **THEN** the same user is also denied joining the hub group of that event
