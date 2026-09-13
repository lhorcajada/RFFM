# injury-protocol Specification

## Purpose
TBD - created by archiving change add-injury-protocol-and-documents-tabs. Update Purpose after archive.
## Requirements
### Requirement: Team injury protocol content is a singleton per team
The system SHALL expose `GET /api/catalog/team/{teamId}/injury-protocol`, open to every authenticated role, returning `{ teamId, content, updatedAt, attachments[] }`. When no protocol row exists yet for the team, the system SHALL return `200 OK` with `content: null`, `updatedAt: null`, and `attachments: []` rather than `404`. The system SHALL expose `PUT /api/catalog/team/{teamId}/injury-protocol` with body `{ content: string }`, restricted to the `Coach` and `Administrator` roles, which upserts the team's protocol row (creating it on first write) and returns the updated protocol. An empty `content` SHALL be rejected with `400` `ValidationProblem`.

#### Scenario: No protocol yet returns null content, not 404
- **WHEN** an authenticated user calls `GET /api/catalog/team/{teamId}/injury-protocol` for a team with no protocol row
- **THEN** the system returns `200 OK` with `content: null` and `attachments: []`

#### Scenario: Coach creates the protocol on first write
- **WHEN** an authenticated Coach PUTs a non-empty `content` for a team with no existing protocol row
- **THEN** the system creates the row and returns `200 OK` with the saved `content` and an updated `updatedAt`

#### Scenario: Coach updates the protocol in place
- **WHEN** an authenticated Coach PUTs a new `content` for a team that already has a protocol
- **THEN** the system updates the same row (no duplicate row is created) and returns the new `content`

#### Scenario: Non-Coach roles cannot write the protocol
- **WHEN** an authenticated user without the `Coach` or `Administrator` role PUTs or DELETEs `/api/catalog/team/{teamId}/injury-protocol`
- **THEN** the system returns `403 Forbidden` and the protocol is unchanged

#### Scenario: Empty content is rejected
- **WHEN** an authenticated Coach PUTs an empty `content`
- **THEN** the system returns `400` with a validation body and the protocol is unchanged

### Requirement: Deleting the protocol clears its content but keeps attachments
The system SHALL expose `DELETE /api/catalog/team/{teamId}/injury-protocol`, restricted to the `Coach` and `Administrator` roles, which sets the protocol's `content` to `null` while keeping the row and all of its attachments intact. Deleting a protocol that does not exist yet SHALL return `204 No Content` without error.

#### Scenario: Deleting the protocol keeps attachments
- **WHEN** an authenticated Coach DELETEs the protocol for a team that has a content and attachments
- **THEN** the system returns `204 No Content`, a subsequent `GET` returns `content: null`, and the same `attachments` are still present

### Requirement: PDF attachments can be uploaded, listed, and deleted per protocol
The system SHALL expose `POST /api/catalog/team/{teamId}/injury-protocol/attachments` (multipart/form-data), restricted to the `Coach` and `Administrator` roles, accepting one PDF file (`content-type: application/pdf`, up to 10 MB) and storing it via the existing `IStorageService` under a dedicated `injury-protocol-attachments` bucket. A non-PDF content type or a file exceeding 10 MB SHALL be rejected with `400` `ValidationProblem` and no row created. The system SHALL expose `DELETE /api/catalog/team/{teamId}/injury-protocol/attachments/{attachmentId}`, restricted to the same roles, which removes the file from storage and its database row. Attachments SHALL be included in the `GET` protocol response for every authenticated role, each with `{ id, fileName, url, uploadedAt }`.

#### Scenario: Coach uploads a valid PDF attachment
- **WHEN** an authenticated Coach POSTs a PDF file to the attachments endpoint for a team
- **THEN** the system returns `201 Created` with the new attachment's `{ id, fileName, url, uploadedAt }`, and it subsequently appears in the protocol's `GET` response

#### Scenario: Non-PDF upload is rejected
- **WHEN** an authenticated Coach POSTs a file whose content type is not `application/pdf`
- **THEN** the system returns `400` with a validation body and no attachment is created

#### Scenario: Oversized upload is rejected
- **WHEN** an authenticated Coach POSTs a PDF file larger than 10 MB
- **THEN** the system returns `400` with a validation body and no attachment is created

#### Scenario: Non-Coach roles cannot upload or delete attachments
- **WHEN** an authenticated user without the `Coach` or `Administrator` role POSTs or DELETEs an attachment
- **THEN** the system returns `403 Forbidden`

#### Scenario: Coach deletes an attachment
- **WHEN** an authenticated Coach DELETEs an existing attachment by id
- **THEN** the system returns `204 No Content`, the file is removed from storage, and it no longer appears in the protocol's `GET` response

### Requirement: Stored PDF attachments are served with the correct content type
The system SHALL expose `GET /api/public/storage?url=` (existing generic endpoint), open to any caller, serving a locally-stored file with a content type derived from its extension. A `.pdf` file SHALL be served with `content-type: application/pdf` rather than falling back to `application/octet-stream`, so a downloading client can render or save it correctly.

#### Scenario: Downloading a stored PDF returns the correct content type
- **WHEN** a client calls `GET /api/public/storage?url=` with the relative path of a locally-stored `.pdf` file
- **THEN** the system returns `200 OK` with `content-type: application/pdf` and the file's bytes

### Requirement: Injured page groups listing, protocol, and documents into tabs
The Coach "Lesionados" page (`coach/injured?teamId=`) SHALL present three tabs — "Lesionados", "Protocolo", "Documentos" — instead of a single flat view. The "Lesionados" tab SHALL render the existing per-player injury listing as responsive cards instead of a `<table>`, with edit/discharge actions visible only to the `Coach`/`Administrator` roles. The "Protocolo" tab SHALL render the team's injury protocol using a rich-text editor: editable (with Save and Delete controls) for `Coach`/`Administrator`, read-only for every other role. The "Documentos" tab SHALL list the protocol's PDF attachments as responsive cards, each with a working download control visible to every role, and upload/delete controls visible only to `Coach`/`Administrator`. All three tabs SHALL remain usable without horizontal scrolling at mobile widths (~360–400px).

#### Scenario: Coach sees full controls across all three tabs
- **WHEN** an authenticated Coach opens the Injured page for a team
- **THEN** they see the injury cards with edit/discharge actions, the protocol editor with Save/Delete, and the documents list with upload/delete controls

#### Scenario: Non-Coach role sees read-only protocol and documents, no injury edit controls
- **WHEN** an authenticated user without the `Coach`/`Administrator` role opens the Injured page for a team
- **THEN** they see the injury cards without edit/discharge actions, the protocol content in read-only mode with no Save/Delete controls, and the documents list without upload/delete controls, while still able to download any attachment

#### Scenario: Downloading a document from the Documentos tab saves the file
- **WHEN** any authenticated user clicks the download control for a PDF attachment
- **THEN** the browser downloads the file (rather than navigating to a blank or broken page)

