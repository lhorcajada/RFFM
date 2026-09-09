## MODIFIED Requirements

### Requirement: Create a sanction for a team player
The system SHALL expose `POST /api/catalog/teamplayer/{id}/sanctions`, restricted to the `Coach` and `Administrator` roles, to create a new sanction record with a required `category` (`Competition` or `InternalDiscipline`), `startDate`, and `sanctionType`, and optional `description`, `estimatedEnd`, and `fine` (a non-negative monetary amount). A missing/invalid `category`, missing `sanctionType`, or non-existent team player SHALL be rejected. Manually created sanctions SHALL always have `isAutomatic: false`.

#### Scenario: Coach creates a competition sanction
- **WHEN** an authenticated Coach POSTs a valid sanction with `category: "Competition"` for an existing team player
- **THEN** the system returns `201 Created` with the created sanction record, including `category: "Competition"`, `isAutomatic: false`, and a null `endDate`

#### Scenario: Coach creates an internal discipline sanction
- **WHEN** an authenticated Coach POSTs a valid sanction with `category: "InternalDiscipline"` for an existing team player
- **THEN** the system returns `201 Created` with the created sanction record, including `category: "InternalDiscipline"`

#### Scenario: Coach creates a sanction with a fine
- **WHEN** an authenticated Coach POSTs a valid sanction including a `fine` amount
- **THEN** the system returns `201 Created` with the created sanction record's `fine` set to that amount

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
The system SHALL expose `PUT /api/catalog/teamplayer/{id}/sanctions/{sanctionId}`, restricted to the `Coach` and `Administrator` roles, allowing all editable fields (including `category`, `endDate`, and `fine`) to be replaced. Setting `endDate` marks the sanction as lifted/served. `isAutomatic` and the originating `sourceEventId` (for automatically created sanctions) are never modified by this endpoint.

#### Scenario: Coach updates a sanction's fields
- **WHEN** an authenticated Coach PUTs valid updated values for an existing sanction of an existing team player
- **THEN** the system returns `200 OK` with the updated sanction record reflecting the new values

#### Scenario: Coach lifts a sanction by setting endDate
- **WHEN** an authenticated Coach PUTs an update including a non-null `endDate` for an active sanction
- **THEN** the system returns `200 OK` and the returned record's `endDate` is set (sanction is no longer active)

#### Scenario: Coach adds a fine and description to an automatic sanction
- **WHEN** an authenticated Coach PUTs an update setting `fine` and `description` for a sanction with `isAutomatic: true`
- **THEN** the system returns `200 OK` with the updated `fine`/`description`, and `isAutomatic` remains `true`

#### Scenario: Disallowed role cannot update a sanction
- **WHEN** an authenticated user with the `Player` or `FamilyMember` role PUTs an update to a sanction
- **THEN** the system returns `403 Forbidden`

#### Scenario: Sanction or team player does not exist
- **WHEN** an authenticated Coach PUTs an update referencing a non-existent `sanctionId` or `id`
- **THEN** the system returns `404`
