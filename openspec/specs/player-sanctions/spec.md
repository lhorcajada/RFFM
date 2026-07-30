# player-sanctions Specification

## Purpose
TBD - created by archiving change add-player-sanctions. Update Purpose after archive.
## Requirements
### Requirement: List sanctions for a team player
The system SHALL expose `GET /api/catalog/teamplayer/{id}/sanctions` returning all sanctions recorded for the given team player, ordered by `startDate` descending, accessible to any authenticated role. An optional `category` query parameter (`Competition` or `InternalDiscipline`) SHALL filter the results to that category only; an unrecognized value SHALL return `400` as a `ProblemDetails`. A non-existent team player id SHALL return `404`.

#### Scenario: Coach lists all sanctions for a player
- **WHEN** an authenticated Coach calls `GET /api/catalog/teamplayer/{id}/sanctions` for an existing team player with recorded sanctions
- **THEN** the system returns `200 OK` with a JSON array of sanction records including each record's `category`

#### Scenario: Filter by category
- **WHEN** an authenticated user calls `GET /api/catalog/teamplayer/{id}/sanctions?category=Competition`
- **THEN** the system returns `200 OK` with only sanctions whose `category` is `Competition`

#### Scenario: Invalid category filter
- **WHEN** an authenticated user calls `GET /api/catalog/teamplayer/{id}/sanctions?category=Unknown`
- **THEN** the system returns `400` with a `ProblemDetails` body

#### Scenario: Team player does not exist
- **WHEN** any authenticated user calls `GET /api/catalog/teamplayer/{id}/sanctions` for a non-existent `id`
- **THEN** the system returns `404`

#### Scenario: Read access is open to every authenticated role
- **WHEN** an authenticated user with the `Player` role calls `GET /api/catalog/teamplayer/{id}/sanctions`
- **THEN** the system returns `200 OK` (read access is not restricted to Coach/Administrator)

### Requirement: Create a sanction for a team player
The system SHALL expose `POST /api/catalog/teamplayer/{id}/sanctions`, restricted to the `Coach` and `Administrator` roles, to create a new sanction record with a required `category` (`Competition` or `InternalDiscipline`), `startDate`, and `sanctionType`, and optional `description` and `estimatedEnd`. A missing/invalid `category`, missing `sanctionType`, or non-existent team player SHALL be rejected.

#### Scenario: Coach creates a competition sanction
- **WHEN** an authenticated Coach POSTs a valid sanction with `category: "Competition"` for an existing team player
- **THEN** the system returns `201 Created` with the created sanction record, including `category: "Competition"` and a null `endDate`

#### Scenario: Coach creates an internal discipline sanction
- **WHEN** an authenticated Coach POSTs a valid sanction with `category: "InternalDiscipline"` for an existing team player
- **THEN** the system returns `201 Created` with the created sanction record, including `category: "InternalDiscipline"`

#### Scenario: Disallowed role cannot create a sanction
- **WHEN** an authenticated user with the `Player` or `FamilyMember` role POSTs a sanction
- **THEN** the system returns `403 Forbidden`

#### Scenario: Missing or unknown category is rejected
- **WHEN** an authenticated Coach POSTs a sanction with an empty or unrecognized `category` value
- **THEN** the system returns `400` with a `ProblemDetails` body and does not create a record

#### Scenario: Team player does not exist
- **WHEN** an authenticated Coach POSTs a sanction for a non-existent team player `id`
- **THEN** the system returns `404`

### Requirement: Update a sanction
The system SHALL expose `PUT /api/catalog/teamplayer/{id}/sanctions/{sanctionId}`, restricted to the `Coach` and `Administrator` roles, allowing all editable fields (including `category` and `endDate`) to be replaced. Setting `endDate` marks the sanction as lifted/served.

#### Scenario: Coach updates a sanction's fields
- **WHEN** an authenticated Coach PUTs valid updated values for an existing sanction of an existing team player
- **THEN** the system returns `200 OK` with the updated sanction record reflecting the new values

#### Scenario: Coach lifts a sanction by setting endDate
- **WHEN** an authenticated Coach PUTs an update including a non-null `endDate` for an active sanction
- **THEN** the system returns `200 OK` and the returned record's `endDate` is set (sanction is no longer active)

#### Scenario: Disallowed role cannot update a sanction
- **WHEN** an authenticated user with the `Player` or `FamilyMember` role PUTs an update to a sanction
- **THEN** the system returns `403 Forbidden`

#### Scenario: Sanction or team player does not exist
- **WHEN** an authenticated Coach PUTs an update referencing a non-existent `sanctionId` or `id`
- **THEN** the system returns `404`

### Requirement: Delete a sanction
The system SHALL expose `DELETE /api/catalog/teamplayer/{id}/sanctions/{sanctionId}`, restricted to the `Coach` and `Administrator` roles, permanently removing the sanction record.

#### Scenario: Coach deletes a sanction
- **WHEN** an authenticated Coach DELETEs an existing sanction of an existing team player
- **THEN** the system returns `204 No Content` and the record no longer appears in subsequent GET calls

#### Scenario: Disallowed role cannot delete a sanction
- **WHEN** an authenticated user with the `Player` or `FamilyMember` role DELETEs a sanction
- **THEN** the system returns `403 Forbidden`

#### Scenario: Sanction or team player does not exist
- **WHEN** an authenticated Coach DELETEs a non-existent `sanctionId` or `id`
- **THEN** the system returns `404`

