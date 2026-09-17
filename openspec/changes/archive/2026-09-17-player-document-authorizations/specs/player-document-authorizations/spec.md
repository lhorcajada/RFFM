## ADDED Requirements

### Requirement: Document types form a reusable, data-backed catalog
The system SHALL expose `GET /api/catalog/document-types`, open to every authenticated role, returning every `DocumentType` as `{ id, name, description, isActive }`. `DocumentType` SHALL be a database-backed catalog (not a hardcoded enum), seeded with exactly one row ("Autorización para realizar físico fuera de las instalaciones"), so additional document types can be introduced later without a domain-model or code change.

#### Scenario: Any authenticated role lists document types
- **WHEN** an authenticated user of any role calls `GET /api/catalog/document-types`
- **THEN** the system returns `200 OK` with the seeded "Autorización para realizar físico fuera de las instalaciones" type among the results

### Requirement: A player document is scoped to a season through TeamPlayer
Each `PlayerDocument` SHALL be keyed by `TeamPlayerId` + `DocumentTypeId` (unique pair), never directly by `PlayerId`/`SeasonId`. Because a player has a distinct `TeamPlayer` row per season, moving to a new season SHALL leave prior seasons' `PlayerDocument` rows untouched and SHALL NOT copy or carry over their status to the new season's `TeamPlayer`.

#### Scenario: A new season starts every player back at Pending
- **GIVEN** a player had an `Approved` document for a given `DocumentType` under last season's `TeamPlayer`
- **WHEN** the player is rostered under a new season's `TeamPlayer` row and their documents are listed for that new season
- **THEN** the document for that `DocumentType` reports `status: "Pending"`, and the prior season's `Approved` row is unaffected

### Requirement: A document with no upload yet reads as Pending, not a missing resource
When no `PlayerDocument` row exists yet for a given `TeamPlayerId` + `DocumentTypeId` pair, `GET /api/catalog/teamplayer/{teamPlayerId}/documents` and `GET /api/catalog/team/{teamId}/documents` SHALL report that document with `status: "Pending"` rather than omitting it or returning an error.

#### Scenario: Listing a player's documents before any upload
- **WHEN** an authorized caller calls `GET /api/catalog/teamplayer/{teamPlayerId}/documents` for a `TeamPlayer` with no `PlayerDocument` rows
- **THEN** the response includes one entry per active `DocumentType` with `status: "Pending"` and null file fields

### Requirement: Player/FamilyMember can upload only their own document; Coach/Administrator can upload for anyone
The system SHALL expose `POST /api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}` (multipart/form-data, field `file`), restricted to roles `Coach`, `Administrator`, `Player`, `FamilyMember`. A caller with role `Player` or `FamilyMember` SHALL only be allowed to upload when `UserTeam.LinkedTeamPlayerId` (for the calling user) equals the target `teamPlayerId`; otherwise the system SHALL return `403 Forbidden` with error code `PlayerDocumentAccessForbidden` and SHALL NOT create or modify any row. A caller with role `Coach` or `Administrator` SHALL be allowed to upload for any `teamPlayerId`.

#### Scenario: A family member uploads their own player's document
- **GIVEN** a user with role `FamilyMember` whose `UserTeam.LinkedTeamPlayerId` equals `teamPlayerId`
- **WHEN** they POST a valid PDF file to `/api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}`
- **THEN** the system returns `200 OK` with `status: "Delivered"` and the document is retrievable via `GET /api/catalog/teamplayer/{teamPlayerId}/documents`

#### Scenario: A family member cannot upload for another player
- **GIVEN** a user with role `FamilyMember` whose `UserTeam.LinkedTeamPlayerId` does not equal `teamPlayerId`
- **WHEN** they POST a file to `/api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}`
- **THEN** the system returns `403 Forbidden` with error code `PlayerDocumentAccessForbidden`, and no `PlayerDocument` row is created

#### Scenario: A coach uploads on behalf of a player
- **GIVEN** an authenticated user with role `Coach`
- **WHEN** they POST a valid file to `/api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}` for any `teamPlayerId`
- **THEN** the system returns `200 OK` with `status: "Delivered"` and `uploadedOnBehalf: true`

### Requirement: Uploaded files must be PDF, JPEG, or PNG within 10 MB
The upload endpoint SHALL accept only `application/pdf`, `image/jpeg`, and `image/png` content types, up to 10 MB. A missing/empty file or unsupported content type SHALL be rejected with `400 BadRequest` and error code `PlayerDocumentInvalidFile`. A file exceeding 10 MB SHALL be rejected with `400 BadRequest` and error code `PlayerDocumentFileTooLarge`. In both cases no `PlayerDocument` row SHALL be created or modified, and any previously stored file for that pair SHALL remain untouched.

#### Scenario: Unsupported content type is rejected
- **WHEN** an authorized caller POSTs a `.docx` file to the upload endpoint
- **THEN** the system returns `400 BadRequest` with error code `PlayerDocumentInvalidFile` and the document's prior state (if any) is unchanged

#### Scenario: Oversized file is rejected
- **WHEN** an authorized caller POSTs a file larger than 10 MB
- **THEN** the system returns `400 BadRequest` with error code `PlayerDocumentFileTooLarge` and the document's prior state (if any) is unchanged

### Requirement: Re-uploading a document resets it to Delivered and clears any prior review
Uploading a file for a `TeamPlayerId` + `DocumentTypeId` pair that already has a `PlayerDocument` row SHALL replace the stored file (deleting the previous one from storage) and set `status: "Delivered"`, clearing any existing `reviewedAt`/`reviewNote`, regardless of whether the prior status was `Delivered`, `Approved`, or `Rejected`.

#### Scenario: Re-uploading over an approved document requires re-review
- **GIVEN** a `PlayerDocument` with `status: "Approved"`
- **WHEN** an authorized caller uploads a new file for the same `teamPlayerId` + `documentTypeId`
- **THEN** the system returns `200 OK` with `status: "Delivered"`, and the previous `reviewedAt`/`reviewNote` no longer apply

### Requirement: Only Coach/Administrator can approve or reject a delivered document
The system SHALL expose `PATCH /api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}/review` with body `{ approve: boolean, note: string | null }`, restricted to roles `Coach` and `Administrator`. The target `PlayerDocument` SHALL be in `Delivered` status; reviewing a document with no row yet SHALL return `404 Not Found` with error code `PlayerDocumentNotFound`, and reviewing one that is not currently `Delivered` (e.g., still `Pending`, or already `Approved`/`Rejected`) SHALL return `409 Conflict` with error code `PlayerDocumentNotDelivered`.

#### Scenario: Coach approves a delivered document
- **GIVEN** a `PlayerDocument` with `status: "Delivered"`
- **WHEN** a `Coach` PATCHes the review endpoint with `{ approve: true }`
- **THEN** the system returns `200 OK` with `status: "Approved"` and a non-null `reviewedAt`

#### Scenario: Coach rejects a delivered document with a note
- **GIVEN** a `PlayerDocument` with `status: "Delivered"`
- **WHEN** a `Coach` PATCHes the review endpoint with `{ approve: false, note: "Firma ilegible" }`
- **THEN** the system returns `200 OK` with `status: "Rejected"` and `reviewNote: "Firma ilegible"`

#### Scenario: Reviewing a document with no delivery yet fails
- **WHEN** a `Coach` PATCHes the review endpoint for a `teamPlayerId`/`documentTypeId` pair with no `PlayerDocument` row
- **THEN** the system returns `404 Not Found` with error code `PlayerDocumentNotFound`

#### Scenario: Reviewing an already-reviewed document fails
- **GIVEN** a `PlayerDocument` with `status: "Approved"`
- **WHEN** a `Coach` PATCHes the review endpoint again for the same pair
- **THEN** the system returns `409 Conflict` with error code `PlayerDocumentNotDelivered`, and the document's status is unchanged

#### Scenario: Non-Coach roles cannot review
- **WHEN** a user with role `Player` or `FamilyMember` PATCHes the review endpoint
- **THEN** the system returns `403 Forbidden` and the document's status is unchanged

### Requirement: Coach can see every team player's document status for a document type
The system SHALL expose `GET /api/catalog/team/{teamId}/documents?documentTypeId={documentTypeId}`, restricted to roles `Coach` and `Administrator`, returning one entry per `TeamPlayer` on that team with `{ teamPlayerId, playerId, playerName, dorsal, status, uploadedAt, reviewedAt }`. `documentTypeId` SHALL be required. The endpoint SHALL NOT accept a `seasonId` parameter — `teamId` alone determines the season, since `Team` is itself season-scoped (a team's roster, resolved the same way as `GET /api/catalog/team/{teamId}/players`, only ever contains `TeamPlayer` rows from that team's own season).

#### Scenario: Coach lists team-wide document status
- **GIVEN** a team with players in various document states (`Pending`, `Delivered`, `Approved`, `Rejected`) for a given document type
- **WHEN** a `Coach` calls `GET /api/catalog/team/{teamId}/documents?documentTypeId={documentTypeId}`
- **THEN** the system returns `200 OK` with one row per roster player showing their current status, including `Pending` for players with no upload yet

#### Scenario: Non-Coach roles cannot list team-wide status
- **WHEN** a user with role `Player` or `FamilyMember` calls `GET /api/catalog/team/{teamId}/documents`
- **THEN** the system returns `403 Forbidden`

### Requirement: Coach can generate a PDF delivery-status report per team and document type
The system SHALL expose `GET /api/catalog/team/{teamId}/documents/report?documentTypeId={documentTypeId}`, restricted to roles `Coach` and `Administrator`, returning `200 OK` with `content-type: application/pdf` listing every roster player and their document status for that team/document type, generated via the existing QuestPDF-based export pattern (no new PDF dependency). `documentTypeId` SHALL be required. The endpoint SHALL NOT accept a `seasonId` parameter, for the same reason as the list endpoint above; the report's season label comes from the team's own `Season.Name`.

#### Scenario: Coach downloads the delivery-status report
- **WHEN** a `Coach` calls `GET /api/catalog/team/{teamId}/documents/report?documentTypeId={documentTypeId}`
- **THEN** the system returns `200 OK` with `content-type: application/pdf` and a byte stream listing every roster player's name and status, labeled with that team's own season

#### Scenario: Non-Coach roles cannot generate the report
- **WHEN** a user with role `Player` or `FamilyMember` calls the report endpoint
- **THEN** the system returns `403 Forbidden`

### Requirement: The two new Coach-app document pages have seeded FeaturePermission rows
The system SHALL seed `FeaturePermission` rows (via the existing idempotent `SeedFeaturePermissionsAsync` startup routine, not an EF migration) so that `GET /api/permissions/me` reports `ReadWrite` access to feature route `/coach/my-documents` for roles `Player` and `FamilyMember`, and `ReadWrite` access to feature route `/coach/player-documents` for roles `Coach` and `ClubDirector`. Neither route SHALL be seeded for the other of these two role groups (`/coach/my-documents` is not seeded for `Coach`/`ClubDirector`; `/coach/player-documents` is not seeded for `Player`/`FamilyMember`).

#### Scenario: Player and FamilyMember gain access to their own documents page
- **WHEN** a user with role `Player` or `FamilyMember` calls `GET /api/permissions/me`
- **THEN** the response's `featurePermissions` includes an entry with `featureRoute: "/coach/my-documents"` and `permissionType: "ReadWrite"`

#### Scenario: Coach and ClubDirector gain access to the team-tracking documents page
- **WHEN** a user with role `Coach` or `ClubDirector` calls `GET /api/permissions/me`
- **THEN** the response's `featurePermissions` includes an entry with `featureRoute: "/coach/player-documents"` and `permissionType: "ReadWrite"`

#### Scenario: Player does not gain access to the team-tracking page
- **WHEN** a user with role `Player` calls `GET /api/permissions/me`
- **THEN** the response's `featurePermissions` does NOT include an entry with `featureRoute: "/coach/player-documents"`

### Requirement: MyProfile exposes the caller's own linked TeamPlayerId
`GET /api/users/me/profile` SHALL include a `teamPlayerId` field alongside the existing `roleName`, `playerId`, and `teamId`, resolved from `UserTeam.LinkedTeamPlayerId` for the calling user's `(ApplicationUserId, TeamId)` pair. When the caller has no player link for that team (or no `teamId` at all), `teamPlayerId` SHALL be `null`.

#### Scenario: A linked Player sees their own TeamPlayerId
- **GIVEN** a user with role `Player` whose `UserTeam.LinkedTeamPlayerId` is set for their team
- **WHEN** they call `GET /api/users/me/profile`
- **THEN** the response's `teamPlayerId` equals that `UserTeam.LinkedTeamPlayerId` value

#### Scenario: A user with no player link sees a null TeamPlayerId
- **GIVEN** a user with role `Coach` (no `LinkedTeamPlayerId`)
- **WHEN** they call `GET /api/users/me/profile`
- **THEN** the response's `teamPlayerId` is `null`
