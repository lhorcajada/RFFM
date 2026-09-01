## ADDED Requirements

### Requirement: Update a family member for a team player
A Coach or Administrator SHALL be able to update the details of an individual family member/contact already attached to a `TeamPlayer` via `PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId}`, preserving the family member's `Id` and not affecting any other family member of the same `TeamPlayer`.

#### Scenario: Coach updates a family member with valid data
- **WHEN** a Coach sends `PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId}` with a valid `Name`, `LastName`, `FamilyMemberId` (relationship), and optional `Phone`/`Email`/`Dni` for a family member that belongs to `TeamPlayer` `{id}`
- **THEN** the API returns `200 OK` with a `FamilyMemberResponse` body containing the same `Id`, and the updated values are persisted without changing the record's identity or affecting other family members of the same `TeamPlayer`

#### Scenario: Missing required fields are rejected
- **WHEN** a Coach sends `PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId}` without `Name`, without `LastName`, or without a valid `FamilyMemberId`
- **THEN** the API returns `400 Bad Request` as a `ProblemDetails` (validation errors), and the existing record is not modified

#### Scenario: Invalid email or phone format is rejected
- **WHEN** a Coach sends `PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId}` with a non-empty `Email` that is not a valid email address, or a non-empty `Phone` that does not match the accepted phone format
- **THEN** the API returns `400 Bad Request` as a `ProblemDetails`, and the existing record is not modified

#### Scenario: Family member does not exist or belongs to another team player
- **WHEN** a Coach sends `PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId}` for a `familyMemberId` that does not exist, or that exists but belongs to a different `TeamPlayer` than `{id}`
- **THEN** the API returns `404 Not Found`, and no record is modified

#### Scenario: Caller without Coach/Administrator role is forbidden
- **WHEN** an authenticated user without the `Coach` or `Administrator` role calls `PUT /api/catalog/teamplayer/{id}/family-members/{familyMemberId}`
- **THEN** the API returns `403 Forbidden`

### Requirement: Frontend allows editing an existing family member
The player detail screen (Coach app) SHALL let a coach edit the data of a family member already saved on the player, without having to delete and re-create it.

#### Scenario: Coach edits an existing family member
- **WHEN** a coach opens the player detail screen for a `TeamPlayer` with at least one family member and clicks "Editar" on a family member card
- **THEN** the inline form opens pre-filled with that family member's current data, and saving it calls the update endpoint and reflects the updated values on the card without a full page reload
