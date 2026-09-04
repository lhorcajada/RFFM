## ADDED Requirements

### Requirement: List team convocation notes with default seed
The system SHALL expose `GET /api/teams/{teamId}/notes` returning the team's convocation
notes ordered by creation order (oldest first). If the team has zero notes stored, the system
SHALL create and persist exactly two default notes for that team before returning them:
"Traed las dos equipaciones (por si acaso) y las espinilleras — son obligatorias." and "Sin la
equipación necesaria o sin espinilleras, el jugador no podrá jugar el partido." Subsequent
calls SHALL NOT re-seed once at least one note exists for the team (including when all seeded
notes have since been deleted or edited).

#### Scenario: Team has never had any notes
- **WHEN** a caller with read access requests `GET /api/teams/{teamId}/notes` for a team with
  no rows in the notes table
- **THEN** the system creates the two default notes for that team, persists them, and returns
  both in the response body in creation order

#### Scenario: Team already has notes
- **WHEN** a caller requests `GET /api/teams/{teamId}/notes` for a team that already has one
  or more notes (whether seeded or custom)
- **THEN** the system returns the existing notes in creation order without creating any new
  ones

#### Scenario: Unknown team
- **WHEN** a caller requests notes for a `teamId` that does not exist
- **THEN** the system responds `404 Not Found` with a `ProblemDetails` body

#### Scenario: Read access mirrors convocation read access
- **WHEN** a caller's role/team-membership would be allowed to read
  `GET /api/events/{eventId}/convocations` for a given team
- **THEN** the same caller is allowed to read `GET /api/teams/{teamId}/notes` for that team,
  and callers who would be rejected from reading convocations are rejected here too

### Requirement: Coach-only note creation
The system SHALL expose `POST /api/teams/{teamId}/notes` accepting `{ "text": string }`,
restricted to callers with the `Coach` role. On success it creates a new note appended after
all existing notes for the team (creation order preserved) and returns it.

#### Scenario: Coach creates a note
- **WHEN** a caller with the `Coach` role submits valid text to
  `POST /api/teams/{teamId}/notes` for an existing team
- **THEN** the system persists a new note for that team and responds `201 Created` with the
  note's id, team id, text, and order

#### Scenario: Non-Coach role attempts to create
- **WHEN** a caller without the `Coach` role submits `POST /api/teams/{teamId}/notes`
- **THEN** the system responds `403 Forbidden`

#### Scenario: Empty or too-long text
- **WHEN** a caller submits `text` that is empty, whitespace-only, or longer than the maximum
  allowed length
- **THEN** the system responds `400 Bad Request` with validation details and creates no note

#### Scenario: Unknown team
- **WHEN** a caller submits `POST /api/teams/{teamId}/notes` for a `teamId` that does not exist
- **THEN** the system responds `404 Not Found`

### Requirement: Coach-only note editing
The system SHALL expose `PUT /api/teams/{teamId}/notes/{noteId}` accepting
`{ "text": string }`, restricted to callers with the `Coach` role. On success it updates the
note's text in place, preserving its original creation order position.

#### Scenario: Coach edits a note
- **WHEN** a caller with the `Coach` role submits valid new text for an existing note of an
  existing team
- **THEN** the system updates the note's text and responds `200 OK` with the updated note

#### Scenario: Non-Coach role attempts to edit
- **WHEN** a caller without the `Coach` role submits `PUT /api/teams/{teamId}/notes/{noteId}`
- **THEN** the system responds `403 Forbidden`

#### Scenario: Unknown note or team
- **WHEN** a caller submits a `PUT` for a `noteId` that does not belong to the given `teamId`
  (or either does not exist)
- **THEN** the system responds `404 Not Found`

### Requirement: Coach-only note deletion
The system SHALL expose `DELETE /api/teams/{teamId}/notes/{noteId}`, restricted to callers
with the `Coach` role. On success it permanently removes the note.

#### Scenario: Coach deletes a note
- **WHEN** a caller with the `Coach` role requests `DELETE /api/teams/{teamId}/notes/{noteId}`
  for an existing note
- **THEN** the system removes the note and responds `204 No Content`

#### Scenario: Non-Coach role attempts to delete
- **WHEN** a caller without the `Coach` role requests
  `DELETE /api/teams/{teamId}/notes/{noteId}`
- **THEN** the system responds `403 Forbidden`

#### Scenario: Unknown note or team
- **WHEN** a caller requests deletion of a `noteId` that does not belong to the given
  `teamId` (or either does not exist)
- **THEN** the system responds `404 Not Found`
