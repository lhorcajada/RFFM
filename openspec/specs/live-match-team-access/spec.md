# live-match-team-access Specification

## Purpose
TBD - created by archiving change live-match-server-sync. Update Purpose after archive.
## Requirements
### Requirement: Only coaches of the event team can read and act
Only coaches assigned to the team of the event SHALL be able to act on a live match. Reading a live match, through REST and through the hub, SHALL be allowed to coaches assigned to the team and to players and family members associated with the team of the event. Any other authenticated user, including an administrator with no team assigned, SHALL receive 403.

#### Scenario: Assigned coach reads the live match
- **WHEN** a coach assigned to the team of the event requests the live match
- **THEN** the system returns the live state

#### Scenario: Player of the team reads the live match
- **WHEN** a player or family member associated with the team of the event requests the live match
- **THEN** the system returns the live state

#### Scenario: Player cannot act
- **WHEN** a player or family member sends an action on the live match
- **THEN** the response is 403 and the stored state is unchanged

#### Scenario: Coach of another team
- **WHEN** a coach not assigned to the team of the event requests the live match
- **THEN** the response is 403

#### Scenario: Player of another team
- **WHEN** a player not associated with the team of the event requests the live match
- **THEN** the response is 403

#### Scenario: Administrator without team
- **WHEN** an administrator with no team assigned requests or acts on the live match
- **THEN** the response is 403

#### Scenario: Unauthorized action
- **WHEN** a user who is not assigned to the team sends an action
- **THEN** the response is 403 and the stored state is unchanged

### Requirement: Hub join is restricted to the event team
Joining the match group of the hub SHALL verify that the user is a coach assigned to the team of the event, or a player or family member associated with that team. Users who fail the check SHALL be rejected and SHALL NOT be added to the group.

#### Scenario: Authorized join
- **WHEN** a coach assigned to the team, or a player associated with it, calls `JoinMatch` for the event
- **THEN** the connection is added to the group of the event and receives its `MatchUpdated` events

#### Scenario: Unauthorized join
- **WHEN** a user who is not assigned to or associated with the team calls `JoinMatch`
- **THEN** the join is rejected and the connection receives no `MatchUpdated` events of that event

### Requirement: One shared membership check
REST endpoints and the hub SHALL use the same team membership check, so both enforce identical access rules.

#### Scenario: Same decision on both channels
- **WHEN** a user is denied by the REST check for an event
- **THEN** the same user is also denied joining the hub group of that event

