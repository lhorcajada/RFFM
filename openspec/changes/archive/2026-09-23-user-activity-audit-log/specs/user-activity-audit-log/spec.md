## ADDED Requirements

### Requirement: Every audited event is recorded with a fixed set of attributes
The system SHALL record an audit event with: `userId`, `roleName`, `clubId` (nullable), `teamId` (nullable), `timestamp` (UTC, server-set), `ipAddress` (nullable), `eventType`, `actionOrPage`, `result`, `reason` (nullable), and `subjectId` (nullable). `eventType` SHALL be one of: `PageAccess`, `ConvocationAccepted`, `ConvocationRejected`, `PlayerEdited`.

#### Scenario: A recorded event has all required attributes populated
- **WHEN** any audited action completes successfully
- **THEN** the system persists a `UserActivityLog` row with a non-null `userId`, `roleName`, `timestamp`, `eventType`, `actionOrPage`, and `result`

### Requirement: A rejected call-up requires a non-empty reason
The system SHALL reject the creation of a `ConvocationRejected` audit event that has a null or empty `reason`.

#### Scenario: Creating a rejection audit event without a reason fails
- **WHEN** the system attempts to record an audit event with `eventType: "ConvocationRejected"` and a null or empty `reason`
- **THEN** the system throws a validation error and no `UserActivityLog` row is created

#### Scenario: Creating a rejection audit event with a reason succeeds
- **WHEN** the system records an audit event with `eventType: "ConvocationRejected"` and a non-empty `reason`
- **THEN** a `UserActivityLog` row is created with that `reason`

### Requirement: The frontend can record a page-access event
The system SHALL expose `POST /api/audit-log/page-access`, open to any authenticated role, accepting `{ pageIdentifier: string, clubId?: string, teamId?: string }`. `pageIdentifier` SHALL be required and non-empty. On success the system SHALL record a `PageAccess` audit event and return `200 OK`.

#### Scenario: An authenticated user records entering an audited section
- **WHEN** an authenticated user of any role calls `POST /api/audit-log/page-access` with a valid `pageIdentifier`
- **THEN** the system returns `200 OK` and a `UserActivityLog` row is created with `eventType: "PageAccess"` and `actionOrPage` equal to the given `pageIdentifier`

#### Scenario: Missing pageIdentifier is rejected
- **WHEN** a caller calls `POST /api/audit-log/page-access` with an empty or missing `pageIdentifier`
- **THEN** the system returns `400 BadRequest` and no `UserActivityLog` row is created

### Requirement: Accepting or rejecting a call-up is audited
Every successful call to `PUT /api/events/{eventId}/convocations/{convocationId}/status` that transitions a convocation to `Accepted` SHALL record a `ConvocationAccepted` audit event with `reason: null`. Every successful call that transitions a convocation to `Deconvoke` (a rejection/deconvocation) SHALL record a `ConvocationRejected` audit event whose `reason` is the resolved excuse type name (never null, using the endpoint's existing default when no excuse type is supplied).

#### Scenario: Accepting a call-up is audited without a reason
- **WHEN** a Player accepts their own convocation via `PUT /api/events/{eventId}/convocations/{convocationId}/status` with `newStatusId` resolving to `Accepted`
- **THEN** a `UserActivityLog` row is created with `eventType: "ConvocationAccepted"`, `subjectId` equal to the convocation id, and `reason: null`

#### Scenario: Rejecting a call-up with an explicit reason is audited
- **WHEN** a Player rejects their own convocation, supplying an `excuseTypeId`
- **THEN** a `UserActivityLog` row is created with `eventType: "ConvocationRejected"` and `reason` equal to that excuse type's name

#### Scenario: Rejecting a call-up without an explicit reason still records a resolved reason
- **WHEN** a Player rejects their own convocation without supplying an `excuseTypeId`
- **THEN** a `UserActivityLog` row is created with `eventType: "ConvocationRejected"` and a non-null `reason` (the endpoint's existing default excuse type)

#### Scenario: A denied convocation-status attempt is not audited
- **WHEN** a Player or FamilyMember attempts to change another player's convocation and the request is denied
- **THEN** no `UserActivityLog` row is created for that attempt

### Requirement: Editing a player's file is audited
Every successful call to `PUT api/catalog/player` SHALL record a `PlayerEdited` audit event with `subjectId` equal to the edited player's id and `clubId` equal to the player's club.

#### Scenario: Editing a player's data is audited
- **WHEN** a caller successfully calls `PUT api/catalog/player` to update a player's data
- **THEN** a `UserActivityLog` row is created with `eventType: "PlayerEdited"`, `subjectId` equal to the player's id, and `clubId` equal to the player's club id

### Requirement: Audit records are queryable with role-based scope
The system SHALL expose `GET /api/audit-log`, restricted to roles `Federation`, `Administrator`, `ClubDirector`, and `Coach`. `Federation` and `Administrator` callers SHALL see all records, unfiltered by club or team. `ClubDirector` callers SHALL see only records belonging to their own club(s)' users/teams. `Coach` callers SHALL see only records belonging to their own team(s). The response SHALL be paginated, with filters for club, team, user, event type, and date range applied within the caller's scope. Players and FamilyMembers SHALL NOT be able to access this endpoint.

#### Scenario: Federation sees all audit records
- **WHEN** a user with role `Federation` calls `GET /api/audit-log` with no filters
- **THEN** the response includes records for every club and team in the system

#### Scenario: A club director sees only their own club's records
- **GIVEN** a user with role `ClubDirector` associated with club A only (via `UserClub`)
- **WHEN** they call `GET /api/audit-log` with no filters
- **THEN** the response includes only records whose `clubId` (or resolvable club, via team) is club A, and excludes records belonging to any other club

#### Scenario: A coach sees only their own team's records
- **GIVEN** a user with role `Coach` associated with team A1 only (via `UserTeam`)
- **WHEN** they call `GET /api/audit-log` with no filters
- **THEN** the response includes only records whose `teamId` is team A1, and excludes records belonging to any other team

#### Scenario: A filter parameter cannot widen scope beyond the caller's own clubs/teams
- **GIVEN** a user with role `Coach` associated with team A1 only
- **WHEN** they call `GET /api/audit-log?teamId=team-B1` (a team they do not belong to)
- **THEN** the response returns zero records, not an error

#### Scenario: Players and family members cannot access the audit log
- **WHEN** a user with role `Player` or `FamilyMember` calls `GET /api/audit-log`
- **THEN** the system returns `403 Forbidden`

### Requirement: Audit records are retained indefinitely
The system SHALL NOT automatically delete `UserActivityLog` records. No scheduled retention/purge job SHALL run against this table as part of this capability.

#### Scenario: No automatic deletion occurs
- **GIVEN** a `UserActivityLog` record older than any arbitrary age
- **WHEN** the system runs its normal scheduled jobs
- **THEN** the record remains in the database, unmodified and undeleted
