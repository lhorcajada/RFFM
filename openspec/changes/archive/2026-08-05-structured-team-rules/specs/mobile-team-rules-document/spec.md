## REMOVED Requirements

### Requirement: Team rules document viewing
**Reason**: Replaced by structured, database-backed team rules (see the `team-rules` capability's "Team rules reading (any team member)" requirement). Rendering a PDF via a bundled PDF.js viewer inside a `WebView` is no longer needed — the Mobile app now renders rules natively.
**Migration**: The Mobile "Normas del equipo" screen keeps its name and menu location but now fetches `GET api/mobile/teams/{teamId}/rules` (structured JSON) instead of `GET api/mobile/teams/{teamId}/rules-document` (PDF bytes). No user-facing migration step is needed beyond the one-time backend data migration that seeds the single team that had an uploaded PDF (see `structured-team-rules`'s `design.md` Decision 4 and Appendix A).

The Mobile app SHALL provide a "Normas del equipo" screen, reachable from the Equipo menu, where any team member can read the team's rules PDF, or see a message that none is available yet.

#### Scenario: Document exists
- **WHEN** a team member opens "Normas del equipo" for a team that has an uploaded rules document
- **THEN** the screen downloads and displays the PDF in-app

#### Scenario: No document uploaded
- **WHEN** a team member opens "Normas del equipo" for a team with no rules document uploaded
- **THEN** the screen shows the message "Aún no disponible" instead of a viewer

#### Scenario: Document fails to load
- **WHEN** the request to fetch the rules document fails
- **THEN** the screen shows an error message derived from `e.response?.data?.detail` or a Spanish fallback message, matching the standard Mobile data-loading pattern

### Requirement: Team rules document upload by Coach/Admin
**Reason**: Replaced by structured CRUD (see `team-rules`'s "Team rules CRUD by Coach/Admin (Front and Mobile)" requirement) — Coach/Admin now edit individual rules as data instead of uploading a replacement file, and the same capability is now also available from Front (previously Mobile-only).
**Migration**: The upload/replace control on "Normas del equipo" is replaced by an "Editar normas"/"Eliminar normas" flow calling `PUT`/`DELETE api/mobile/teams/{teamId}/rules`. No file picker involved.

Coach and Admin roles SHALL be able to upload a new rules document or replace the existing one from the "Normas del equipo" screen. Other roles SHALL NOT see any upload/replace control.

#### Scenario: Coach uploads a first document
- **WHEN** a Coach on a team with no rules document picks a valid PDF (≤20 MB) and confirms the upload
- **THEN** the document is stored, and the screen immediately displays the newly uploaded PDF

#### Scenario: Admin replaces an existing document
- **WHEN** an Admin on a team that already has a rules document picks a new valid PDF and confirms the upload
- **THEN** the previous document is replaced and the screen displays the new PDF

#### Scenario: Non-coach/admin cannot upload
- **WHEN** a Player or FamilyMember opens "Normas del equipo"
- **THEN** no upload/replace control is shown, and any direct attempt to call the upload endpoint is rejected by the backend with an authorization error

### Requirement: Rules document format and size constraints
**Reason**: There is no longer a file to constrain — rules are structured text fields with their own (much simpler) validation, covered implicitly by `team-rules`'s CRUD requirement and its backend validator.
**Migration**: None — this requirement has no structured-data equivalent to migrate to; field-level validation (required strings, non-empty rule list) is a new, unrelated concern of the replacement feature.

The system SHALL only accept PDF files up to 20 MB for the team rules document, enforced both client-side (fast feedback) and server-side (source of truth).

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
**Reason**: Replaced by the dual-namespace structured endpoints in `team-rules`'s "Team rules backend endpoints (dual namespace)" requirement — `GET`/`PUT`/`DELETE` on structured JSON instead of `GET`/`POST` on PDF bytes, and now also exposed under `api/coaches/*` for Front.
**Migration**: `POST/GET api/mobile/teams/{teamId}/rules-document` are removed entirely (return `404` post-deploy, an intentional breaking change per this change's proposal). Callers move to `GET/PUT/DELETE api/mobile/teams/{teamId}/rules` (or the `api/coaches/*` equivalent for Front).

The backend SHALL expose `POST /api/mobile/teams/{teamId}/rules-document` (Coach/Admin, team member) to upload/replace the document, and `GET /api/mobile/teams/{teamId}/rules-document` (any team member) to retrieve it.

#### Scenario: Upload replaces the stored URL
- **WHEN** `POST /api/mobile/teams/{teamId}/rules-document` succeeds
- **THEN** `Team.RulesDocumentUrl` is updated to the newly stored file's location and the response includes the resulting `Url` and `UploadedAt`

#### Scenario: Get returns the PDF bytes when present
- **WHEN** `GET /api/mobile/teams/{teamId}/rules-document` is called for a team with `RulesDocumentUrl` set
- **THEN** the response is `200 OK` with `Content-Type: application/pdf` and the file bytes

#### Scenario: Get returns no content when absent
- **WHEN** `GET /api/mobile/teams/{teamId}/rules-document` is called for a team with `RulesDocumentUrl` null
- **THEN** the response is `204 No Content`

#### Scenario: Get returns not found for a non-existent team
- **WHEN** `GET /api/mobile/teams/{teamId}/rules-document` is called with a `teamId` that does not exist
- **THEN** the response is `404 Not Found`
