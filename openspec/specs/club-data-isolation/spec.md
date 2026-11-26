# club-data-isolation Specification

## Purpose
TBD - created by archiving change personal-and-club-spaces. Update Purpose after archive.
## Requirements
### Requirement: Club-scoped data is filtered by ClubId in the data layer
Every query of club-scoped data SHALL be filtered by its `ClubId` in the data layer, using the clubs the authenticated user belongs to, as given by the user's club membership rows and by the user's team links (a user linked to a team belongs to the club of that team), and not a single active club. The filter SHALL cover the entities Team, Player, TaskTrainingBase, Season, and UserActivityLog.

#### Scenario: Member reads data of their club
- **WHEN** an authenticated user who is a member of a club reads a Team of that club
- **THEN** the Team is returned

#### Scenario: Member of several clubs
- **WHEN** an authenticated user who is a member of two clubs lists Players
- **THEN** the result holds the Players of both clubs
- **AND** the result holds no Player of any other club

#### Scenario: Member through a team link
- **WHEN** an authenticated user who has a team link but no club membership row reads a Team of that team's club
- **THEN** the Team is returned
- **AND** the Team of any other club is not returned

#### Scenario: Filtered entities
- **WHEN** the data of Team, Player, TaskTrainingBase, Season, or UserActivityLog is queried by an authenticated user
- **THEN** every returned record that has a `ClubId` has one of the clubs the user belongs to

### Requirement: Records without a ClubId are not hidden by the filter
A record of a filtered entity whose `ClubId` is null, such as a Season or a UserActivityLog entry without a club, SHALL NOT be hidden or blocked by the club filter. Such a record SHALL stay readable and modifiable as it is before this change.

#### Scenario: Record with a null ClubId
- **WHEN** an authenticated user queries Seasons or UserActivityLog entries and a record has a null `ClubId`
- **THEN** the record is returned as it is before this change
- **AND** records with a `ClubId` of a club the user does not belong to are still not returned

### Requirement: Flows without a membership keep working
Existing flows that legitimately run without a membership of the club they act on, such as joining a club by its invitation code, sending a join request, and background work with no authenticated user, SHALL keep working and SHALL NOT be blocked by the filter. These flows SHALL NOT let an authenticated non-member read or modify the data of a club through the normal read and write paths.

#### Scenario: Join by invitation code
- **WHEN** a user who is not yet a member of a club joins it with a valid invitation code
- **THEN** the join succeeds as it does before this change

#### Scenario: Background work without an authenticated user
- **WHEN** background work with no authenticated user reads or writes club-scoped data as it does before this change
- **THEN** the work completes and is not blocked by the filter

#### Scenario: Player or family member onboarding by team code
- **WHEN** an authenticated user who is not yet linked to a team requests its player list, or verifies the identity of one of its players, and sends that team's join code
- **THEN** the request succeeds as it does before this change
- **AND** a successful identity verification links the user to that team, so the user can then read that team's data
- **AND** the same request without the join code, or with the join code of another team, returns not found and changes nothing

#### Scenario: Non-member through the normal paths
- **WHEN** an authenticated user who is not a member of a club uses a normal read or write path on that club's data
- **THEN** the data is not returned and not modified

### Requirement: Another club's data returns not found
A request for the data of a club the authenticated user does not belong to SHALL return not found, whether the request reads or modifies the data.

#### Scenario: Read of another club's data
- **WHEN** an authenticated user requests a record that belongs to a club the user is not a member of
- **THEN** the response is not found

#### Scenario: Modification of another club's data
- **WHEN** an authenticated user sends a modification of a record that belongs to a club the user is not a member of
- **THEN** the response is not found
- **AND** the record is unchanged

### Requirement: Isolation is proven by leak tests per filtered entity
Each filtered entity SHALL have a leak test proving that a user of one club cannot read or modify another club's data. The leak tests SHALL run against a real database, not a mock.

#### Scenario: Leak test per entity
- **WHEN** the leak tests run
- **THEN** each of Team, Player, TaskTrainingBase, Season, and UserActivityLog has a test in which a user of one club fails to read the data of another club
- **AND** each of those entities has a test in which a user of one club fails to modify the data of another club

#### Scenario: Leak tests use a real database
- **WHEN** a leak test runs
- **THEN** it runs against a real database instance and does not replace the data layer with a mock

