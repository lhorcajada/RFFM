## ADDED Requirements

### Requirement: Team rules document viewing
The Mobile app SHALL provide a "Normas del equipo" screen, reachable from the Equipo menu, where any
team member can read the team's rules PDF, or see a message that none is available yet.

#### Scenario: Document exists
- **WHEN** a team member opens "Normas del equipo" for a team that has an uploaded rules document
- **THEN** the screen downloads and displays the PDF in-app

#### Scenario: No document uploaded
- **WHEN** a team member opens "Normas del equipo" for a team with no rules document uploaded
- **THEN** the screen shows the message "Aún no disponible" instead of a viewer

#### Scenario: Document fails to load
- **WHEN** the request to fetch the rules document fails
- **THEN** the screen shows an error message derived from `e.response?.data?.detail` or a Spanish
  fallback message, matching the standard Mobile data-loading pattern

### Requirement: Team rules document upload by Coach/Admin
Coach and Admin roles SHALL be able to upload a new rules document or replace the existing one from
the "Normas del equipo" screen. Other roles SHALL NOT see any upload/replace control.

#### Scenario: Coach uploads a first document
- **WHEN** a Coach on a team with no rules document picks a valid PDF (≤20 MB) and confirms the upload
- **THEN** the document is stored, and the screen immediately displays the newly uploaded PDF

#### Scenario: Admin replaces an existing document
- **WHEN** an Admin on a team that already has a rules document picks a new valid PDF and confirms
  the upload
- **THEN** the previous document is replaced and the screen displays the new PDF

#### Scenario: Non-coach/admin cannot upload
- **WHEN** a Player or FamilyMember opens "Normas del equipo"
- **THEN** no upload/replace control is shown, and any direct attempt to call the upload endpoint is
  rejected by the backend with an authorization error

### Requirement: Rules document format and size constraints
The system SHALL only accept PDF files up to 20 MB for the team rules document, enforced both
client-side (fast feedback) and server-side (source of truth).

#### Scenario: Client rejects a non-PDF file before uploading
- **WHEN** a Coach/Admin picks a file that is not a PDF
- **THEN** the app shows a Spanish error message and does not call the upload endpoint

#### Scenario: Client rejects an oversized file before uploading
- **WHEN** a Coach/Admin picks a PDF larger than 20 MB
- **THEN** the app shows a Spanish error message and does not call the upload endpoint

#### Scenario: Server rejects a non-PDF or oversized upload
- **WHEN** the upload endpoint receives a file that is not `application/pdf` or exceeds 20 MB
- **THEN** the backend returns a validation error and does not replace the stored document

### Requirement: Team rules document backend endpoints
The backend SHALL expose `POST /api/mobile/teams/{teamId}/rules-document` (Coach/Admin, team member)
to upload/replace the document, and `GET /api/mobile/teams/{teamId}/rules-document` (any team
member) to retrieve it.

#### Scenario: Upload replaces the stored URL
- **WHEN** `POST /api/mobile/teams/{teamId}/rules-document` succeeds
- **THEN** `Team.RulesDocumentUrl` is updated to the newly stored file's location and the response
  includes the resulting `Url` and `UploadedAt`

#### Scenario: Get returns the PDF bytes when present
- **WHEN** `GET /api/mobile/teams/{teamId}/rules-document` is called for a team with
  `RulesDocumentUrl` set
- **THEN** the response is `200 OK` with `Content-Type: application/pdf` and the file bytes

#### Scenario: Get returns no content when absent
- **WHEN** `GET /api/mobile/teams/{teamId}/rules-document` is called for a team with
  `RulesDocumentUrl` null
- **THEN** the response is `204 No Content`

#### Scenario: Get returns not found for a non-existent team
- **WHEN** `GET /api/mobile/teams/{teamId}/rules-document` is called with a `teamId` that does not
  exist
- **THEN** the response is `404 Not Found`
