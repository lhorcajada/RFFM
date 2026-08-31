## ADDED Requirements

### Requirement: Create a family member for a team player
A Coach or Administrator SHALL be able to create a new family member/contact (familiar/tutor) attached to a specific `TeamPlayer` via `POST /api/catalog/teamplayer/{id}/family-members`, with no maximum limit on the number of family members per `TeamPlayer`.

#### Scenario: Coach creates a family member with valid data
- **WHEN** a Coach sends `POST /api/catalog/teamplayer/{id}/family-members` with a
  valid `Name`, `LastName`, `FamilyMemberId` (relationship), and optional `Phone`/
  `Email`/`Dni` for an existing `TeamPlayer`
- **THEN** the API returns `201 Created` with a `FamilyMemberResponse` body
  containing a non-empty `Id`, and the record is persisted in `TeamPlayerFamilies`
  linked to that `TeamPlayer`

#### Scenario: Missing required fields are rejected
- **WHEN** a Coach sends `POST /api/catalog/teamplayer/{id}/family-members` without
  `Name`, without `LastName`, or without a valid `FamilyMemberId`
- **THEN** the API returns `400 Bad Request` as a `ProblemDetails` (validation
  errors), and no record is persisted

#### Scenario: Invalid email or phone format is rejected
- **WHEN** a Coach sends `POST /api/catalog/teamplayer/{id}/family-members` with a
  non-empty `Email` that is not a valid email address, or a non-empty `Phone` that
  does not match the accepted phone format
- **THEN** the API returns `400 Bad Request` as a `ProblemDetails`, and no record
  is persisted

#### Scenario: Team player does not exist
- **WHEN** a Coach sends `POST /api/catalog/teamplayer/{id}/family-members` for a
  `{id}` that does not correspond to any existing `TeamPlayer`
- **THEN** the API returns `404 Not Found`

#### Scenario: Caller without Coach/Administrator role is forbidden
- **WHEN** an authenticated user without the `Coach` or `Administrator` role calls
  `POST /api/catalog/teamplayer/{id}/family-members`
- **THEN** the API returns `403 Forbidden`

### Requirement: Delete a family member from a team player
A Coach or Administrator SHALL be able to delete an individual family member by its `Id` via `DELETE /api/catalog/teamplayer/{id}/family-members/{familyMemberId}`, without affecting any other family member of the same `TeamPlayer`.

#### Scenario: Coach deletes an existing family member
- **WHEN** a Coach sends `DELETE /api/catalog/teamplayer/{id}/family-members/{familyMemberId}`
  for a family member that belongs to `TeamPlayer` `{id}`
- **THEN** the API returns `204 No Content`, the family member is removed from
  `TeamPlayerFamilies`, and the `TeamPlayer`'s remaining family members are
  unaffected

#### Scenario: Family member does not exist or belongs to another team player
- **WHEN** a Coach sends `DELETE /api/catalog/teamplayer/{id}/family-members/{familyMemberId}`
  for a `familyMemberId` that does not exist, or that exists but belongs to a
  different `TeamPlayer` than `{id}`
- **THEN** the API returns `404 Not Found`, and no record is deleted

#### Scenario: Caller without Coach/Administrator role is forbidden
- **WHEN** an authenticated user without the `Coach` or `Administrator` role calls
  `DELETE /api/catalog/teamplayer/{id}/family-members/{familyMemberId}`
- **THEN** the API returns `403 Forbidden`

### Requirement: Family member responses expose a stable identifier
Every family member returned by the API (creation response, and the `FamilyMembers` collection embedded in `GetTeamPlayer` and `UpdateTeamPlayer` responses) SHALL include a non-empty `Id` field that uniquely and stably identifies that family member, usable to target it for deletion.

#### Scenario: GetTeamPlayer response includes family member Ids
- **WHEN** a client calls `GET /api/catalog/teamplayer/{id}` for a `TeamPlayer`
  with one or more family members
- **THEN** each entry in the `FamilyMembers` array of the response includes a
  non-empty `Id` field matching the value usable in the delete endpoint

### Requirement: Family member relationship catalog includes non-parental roles
The relationship (`FamilyMember`/parentesco) catalog SHALL include, at minimum, Mother, Father, Legal Guardian ("Tutor legal"), and Other ("Otro"), so contacts who are not the player's biological parent can be classified.

#### Scenario: Creating a family member with a non-parental relationship
- **WHEN** a Coach sends `POST /api/catalog/teamplayer/{id}/family-members` with a
  `FamilyMemberId` corresponding to "Tutor legal" or "Otro"
- **THEN** the API accepts the request and persists the relationship name
  accordingly (not rejected as an invalid `FamilyMemberId`)
