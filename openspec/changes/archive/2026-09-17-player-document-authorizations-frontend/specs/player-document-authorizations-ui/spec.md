## ADDED Requirements

### Requirement: Self-service document view for Player/FamilyMember
The system SHALL provide a "Mis documentos" page in the Coach app where a Player or FamilyMember user can see the status of every active document type for their own linked player, and upload a file when the status is `Pending` or `Rejected`.

#### Scenario: Viewing own document statuses
- **WHEN** a Player or FamilyMember user navigates to the "Mis documentos" page
- **THEN** the system shows one card per active document type, each with its current status (Pendiente/Entregado/Aprobado/Rechazado)

#### Scenario: Uploading a pending document
- **WHEN** a Player or FamilyMember user selects a valid PDF, JPEG, or PNG file (≤10MB) for a document type currently `Pending` or `Rejected`
- **THEN** the system uploads the file and updates that document type's card to show status `Delivered` ("Entregado")

#### Scenario: Rejecting an invalid file client-side
- **WHEN** a Player or FamilyMember user selects a file that is not PDF/JPEG/PNG, or exceeds 10MB
- **THEN** the system shows a Spanish error message via the snackbar event bus without sending the request

#### Scenario: Backend rejects an invalid file
- **WHEN** the upload request fails with `PlayerDocumentInvalidFile` or `PlayerDocumentFileTooLarge`
- **THEN** the system shows the corresponding Spanish message via the snackbar event bus and leaves the document's status unchanged

#### Scenario: Re-uploading over an approved or rejected document
- **WHEN** a Player or FamilyMember user uploads a new file for a document type currently `Approved` or `Rejected`
- **THEN** the system shows an inline notice that the document will return to `Delivered` status and require review again, before the upload is confirmed

### Requirement: Team document tracking for Coach/ClubDirector
The system SHALL provide a team-scoped page in the Coach app where a Coach or ClubDirector can see every roster player's status for a chosen document type, upload a document on a player's behalf, approve or reject a delivered document, and download a PDF report. The team's season is implicit (`Team` is already season-scoped) — no season selection is presented.

#### Scenario: Viewing team status for a document type
- **WHEN** a Coach or ClubDirector selects a document type on the team-tracking page
- **THEN** the system lists every roster `TeamPlayer` as a card showing player name, dorsal, and current document status for that type

#### Scenario: Uploading a document on behalf of a player
- **WHEN** a Coach or ClubDirector uploads a valid file for a specific roster player's document type
- **THEN** the system marks that player's document status as `Delivered` and records that it was uploaded on behalf of the player

#### Scenario: Approving a delivered document
- **WHEN** a Coach or ClubDirector approves a document currently in `Delivered` status
- **THEN** the system updates that player's document status to `Approved`

#### Scenario: Rejecting a delivered document with a note
- **WHEN** a Coach or ClubDirector rejects a document currently in `Delivered` status, optionally providing a note
- **THEN** the system updates that player's document status to `Rejected` and stores the note

#### Scenario: Reviewing a document that is not currently delivered
- **WHEN** a Coach or ClubDirector attempts to approve or reject a document whose status is not `Delivered` (e.g. it was re-uploaded since the list was loaded)
- **THEN** the system shows a Spanish error message via the snackbar event bus and does not change the document's status

#### Scenario: Downloading the team delivery-status report
- **WHEN** a Coach or ClubDirector clicks the report button for a selected document type
- **THEN** the system downloads a PDF file summarizing delivery status for every roster player

### Requirement: Role-scoped access to document pages
The system SHALL restrict access to the two document pages using the existing `RequireFeaturePermission` route guard against the backend-seeded `FeaturePermission` rows: `/coach/my-documents` (`ReadWrite` for `Player`/`FamilyMember`) and `/coach/player-documents` (`ReadWrite` for `Coach`/`ClubDirector`).

#### Scenario: Player accessing the team-tracking route directly
- **WHEN** a Player or FamilyMember user navigates directly to the `/coach/player-documents` team-tracking page URL
- **THEN** the system redirects them away from the page, consistent with other Coach-only routes

#### Scenario: Coach accessing the self-service route
- **WHEN** a Coach or ClubDirector user navigates to the `/coach/my-documents` self-service page
- **THEN** the system does not block access based on the `allowPlayerAccess` check (Coach/ClubDirector are never "player role" per `isPlayerRole.ts`), though the page has no meaningful "own player" data for a pure Coach account without a linked player

### Requirement: No table-based listings
The system SHALL render both the self-service document list and the team-tracking roster list as responsive cards, never as an MUI `Table` or HTML `<table>`.

#### Scenario: Narrow viewport rendering
- **WHEN** either document page is viewed at a mobile viewport width (~360-400px)
- **THEN** all document/status cards stack vertically without horizontal scrolling and without any table element in the DOM
