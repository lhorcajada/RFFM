# player-self-edit Specification

## Purpose
TBD - created by archiving change player-self-edit-physical-family-contact. Update Purpose after archive.
## Requirements
### Requirement: Player/FamilyMember can update their own linked team player's restricted fields
`PUT /api/catalog/teamplayer/{id}` SHALL succeed for an authenticated user with role `Player` or
`FamilyMember` when the target `TeamPlayer` is the one linked to that user
(`UserTeam.LinkedTeamPlayerId`). In that case the handler SHALL persist only `ContactInfo`,
`PhysicalInfo`, `FamilyMembers` and `PlayerInfo.UrlPhoto`; any submitted value for `Dorsal`,
`Demarcation`, and the remaining `PlayerInfo` fields (`Name`, `LastName`, `Alias`) SHALL be
ignored and left unchanged.

#### Scenario: Linked player updates contact, physical info, family and photo
- **GIVEN** a user with role `Player` whose `UserTeam.LinkedTeamPlayerId` points to team player `P`
- **WHEN** that user calls `PUT /api/catalog/teamplayer/{P.id}` with new `contactInfo`,
  `physicalInfo`, `familyMembers` and `playerInfo.urlPhoto`, and also new `dorsal`,
  `demarcation` and `playerInfo.name`
- **THEN** the request succeeds, `contactInfo`, `physicalInfo`, `familyMembers` and
  `urlPhoto` are persisted, and `dorsal`, `demarcation`, `name`, `lastName` and `alias`
  remain unchanged

#### Scenario: Linked family member updates their player's data
- **GIVEN** a user with role `FamilyMember` whose `UserTeam.LinkedTeamPlayerId` points to team
  player `P`
- **WHEN** that user calls `PUT /api/catalog/teamplayer/{P.id}` with valid `contactInfo`,
  `physicalInfo` and `familyMembers`
- **THEN** the request succeeds and those fields are persisted

### Requirement: Non-linked Player/FamilyMember is rejected
`PUT /api/catalog/teamplayer/{id}` SHALL return `403 Forbidden` with error code
`TeamPlayerEditForbidden` when the authenticated user has role `Player` or `FamilyMember` and
the target `TeamPlayer` is not the one linked via `UserTeam.LinkedTeamPlayerId` (including no
link at all, or a link to a different `TeamPlayer`). No data SHALL be persisted.

#### Scenario: Player not linked to the target team player is rejected
- **GIVEN** a user with role `Player` whose `UserTeam.LinkedTeamPlayerId` is `null` or points to
  a different team player than `P`
- **WHEN** that user calls `PUT /api/catalog/teamplayer/{P.id}` with any data
- **THEN** the request fails with `403 Forbidden` and error code `TeamPlayerEditForbidden`, and
  `P`'s data in the database is unchanged

### Requirement: Coach/Administrator retains full edit access
`PUT /api/catalog/teamplayer/{id}` SHALL continue to allow a `Coach` or `Administrator` to update
all fields of any `TeamPlayer`, unaffected by the restrictions applied to `Player`/`FamilyMember`.

#### Scenario: Coach updates all fields of a team player
- **GIVEN** a user with role `Coach`
- **WHEN** that user calls `PUT /api/catalog/teamplayer/{id}` with new `dorsal`, `demarcation`,
  `playerInfo`, `contactInfo`, `physicalInfo` and `familyMembers`
- **THEN** the request succeeds and all submitted fields are persisted

### Requirement: PlayerDetail edit mode is scoped by role
In the Coach app's `PlayerDetail` page, a user who can only edit restricted fields (`Player`/`FamilyMember` linked to the shown team player) SHALL see edit forms only in the Contact, Physical and Family tabs (plus the photo), and SHALL never see the Demarcation tab's edit form or the "Registrar lesión" action, even while in edit mode.

A `Coach`/`Administrator` SHALL see edit forms in every tab, including a new edit form for Family members (edit existing members' name, relationship, phone and email — without adding or removing rows).

#### Scenario: Restricted role sees limited edit surface
- **GIVEN** a user with role `Player` linked to the displayed team player, in edit mode
- **WHEN** they navigate the page's tabs
- **THEN** the Contact, Physical and Family tabs show editable forms, the Demarcation tab shows
  its read-only view, and the "Registrar lesión" action is not shown

#### Scenario: Coach retains unrestricted edit surface
- **GIVEN** a user with role `Coach`, in edit mode
- **WHEN** they navigate the page's tabs
- **THEN** every tab, including Demarcation and Family, shows its editable form, and
  "Registrar lesión" is shown

### Requirement: Save errors surface a translated message without redirecting
When saving a `TeamPlayer` from `PlayerDetail` fails with a business error (e.g. `TeamPlayerEditForbidden`), the UI SHALL display the corresponding translated message inline.

When it fails with a network, timeout or `500` error, the UI SHALL display the generic translated error message inline and SHALL NOT navigate to the global error page.

#### Scenario: Business error shows its translated message
- **GIVEN** a save request that fails with a `403` and error code `TeamPlayerEditForbidden`
- **WHEN** the save completes
- **THEN** the page shows the translated message for `TeamPlayerEditForbidden` and stays on
  `PlayerDetail`

#### Scenario: Server error shows generic message without global redirect
- **GIVEN** a save request that fails with a `500` response
- **WHEN** the save completes
- **THEN** the page shows the generic server-error message inline and no navigation to
  `/error-500` occurs

### Requirement: Saving contact info persists and preserves the postal address
`PUT /api/catalog/teamplayer/{id}` SHALL accept an `Address` (street, city, province, postal code, country) inside `ContactInfo` and persist it. Submitting `ContactInfo` without `Address` SHALL leave any previously saved address unchanged rather than clearing it.

#### Scenario: Address is saved together with phone and email
- **GIVEN** a user authorized to edit a team player's contact info
- **WHEN** they call `PUT /api/catalog/teamplayer/{id}` with `contactInfo.address` containing street, city and postal code
- **THEN** the request succeeds and the address fields are persisted and returned in the response

#### Scenario: Omitting address on a contact update does not erase the stored one
- **GIVEN** a team player with a previously saved address
- **WHEN** a user calls `PUT /api/catalog/teamplayer/{id}` with `contactInfo.phone`/`contactInfo.email` changed and no `address` field
- **THEN** the request succeeds and the previously saved address remains unchanged

### Requirement: PlayerDetail Contact tab exposes address fields when editing
The Contact tab's edit form SHALL include fields for street, city and postal code, in addition to phone and email, and SHALL include their values in the save payload.

#### Scenario: Editing contact shows and saves the address fields
- **GIVEN** a user with edit access to a team player, in edit mode on the Contact tab
- **WHEN** they fill street, city and postal code and save
- **THEN** the save request includes those values inside `contactInfo.address`

### Requirement: Family tab allows adding a family member when fewer than two exist
`FamilyMembersEdit` SHALL show an "Añadir familiar" action whenever the team player has fewer than 2 family members, allowing a new blank entry to be filled in and saved. It SHALL NOT offer a way to remove an already-saved family member. A newly added row left completely empty (no name, phone, email or relationship) SHALL be excluded from the save payload.

#### Scenario: Adding the first family member
- **GIVEN** a team player with no family members yet, in edit mode on the Family tab
- **WHEN** the user clicks "Añadir familiar", fills name, relationship, phone and email, and saves
- **THEN** the save request's `familyMembers` payload includes that new entry

#### Scenario: Add action is hidden once two family members exist
- **GIVEN** a team player with 2 family members already saved, in edit mode on the Family tab
- **WHEN** the user views the tab
- **THEN** no "Añadir familiar" action is shown

#### Scenario: An empty added row is not sent to the backend
- **GIVEN** a team player with 1 family member, in edit mode on the Family tab
- **WHEN** the user clicks "Añadir familiar" but leaves every field of the new row empty and saves
- **THEN** the save request's `familyMembers` payload contains only the original family member, not the blank row

