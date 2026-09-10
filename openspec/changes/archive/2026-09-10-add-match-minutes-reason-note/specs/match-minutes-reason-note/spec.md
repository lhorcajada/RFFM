## ADDED Requirements

### Requirement: Pre-match minutes reason on a convocation
The system SHALL expose `PUT /api/events/{eventId}/convocations/{convocationId}/minutes-reason`
accepting `{ "reason": string | null }`, restricted to callers with the `Coach` or
`Administrator` role. On success it sets (or clears, when `reason` is null/empty/whitespace)
the convocation's free-text `MinutesReason` field, independently of the convocation's status,
assistance type, or excuse type.

#### Scenario: Coach sets a pre-match reason
- **WHEN** a caller with the `Coach` role submits non-empty `reason` text for an existing
  convocation of an existing event
- **THEN** the system persists the text as the convocation's `MinutesReason` and responds
  `200 OK`

#### Scenario: Coach clears a previously set reason
- **WHEN** a caller with the `Coach` role submits `null` or empty/whitespace `reason` for a
  convocation that already has a `MinutesReason`
- **THEN** the system clears the field (stores it as absent) and responds `200 OK`

#### Scenario: Reason too long
- **WHEN** a caller submits `reason` text longer than 500 characters
- **THEN** the system responds `400 Bad Request` with validation details and does not change
  the stored value

#### Scenario: Non-Coach/Administrator role attempts to set a reason
- **WHEN** a caller without the `Coach` or `Administrator` role submits this request
- **THEN** the system responds `403 Forbidden`

#### Scenario: Unknown convocation
- **WHEN** a caller submits a `convocationId` that does not belong to the given `eventId`, or
  either does not exist
- **THEN** the system responds `404 Not Found` (or an equivalent 4xx per this endpoint's
  existing error convention) and does not create a convocation

### Requirement: Post-match minutes reason on a match participation record
The system SHALL expose `PUT /api/events/{eventId}/match-participation/{teamPlayerId}/reason`
accepting `{ "reason": string | null }`, restricted to callers with the `Coach` or
`Administrator` role. On success it sets (or clears) the free-text `MinutesReason` field on
the existing `MatchParticipation` row for that `(eventId, teamPlayerId)` pair, without
requiring or altering any other field of that row (minutes played, starter status, scores,
substitutions, cards, etc.).

#### Scenario: Coach sets a post-match reason on an existing participation
- **WHEN** a caller with the `Coach` role submits non-empty `reason` text for a
  `teamPlayerId` that already has a `MatchParticipation` row for the given `eventId`
- **THEN** the system persists the text as that row's `MinutesReason`, leaves every other
  field of the row unchanged, and responds `200 OK`

#### Scenario: Coach clears a previously set post-match reason
- **WHEN** a caller with the `Coach` role submits `null` or empty/whitespace `reason` for a
  participation row that already has a `MinutesReason`
- **THEN** the system clears the field and responds `200 OK`

#### Scenario: No participation recorded yet for the player
- **WHEN** a caller submits this request for a `(eventId, teamPlayerId)` pair with no
  existing `MatchParticipation` row
- **THEN** the system responds `404 Not Found` and creates no row

#### Scenario: Reason too long
- **WHEN** a caller submits `reason` text longer than 500 characters
- **THEN** the system responds `400 Bad Request` with validation details and does not change
  the stored value

#### Scenario: Non-Coach/Administrator role attempts to set a reason
- **WHEN** a caller without the `Coach` or `Administrator` role submits this request
- **THEN** the system responds `403 Forbidden`

#### Scenario: Re-saving live match state never clears a previously set reason
- **WHEN** `POST /api/events/{eventId}/match-participation` (the full live-match upsert) is
  called again for a player whose `MatchParticipation` row already has a `MinutesReason`
- **THEN** the row's `MinutesReason` is left unchanged by that upsert

### Requirement: Minutes reason surfaced in existing listing endpoints
The system SHALL include the `MinutesReason` field (nullable string) in the response of every
existing endpoint that already exposes per-convocation or per-match minutes data:
`GET /api/events/{eventId}/convocations`, `GET /api/events/{eventId}/match-participation`,
`GET /api/catalog/team-player/{teamPlayerId}/match-history`, and
`GET /api/catalog/team/{teamId}/match-minutes`.

#### Scenario: Convocation listing includes the pre-match reason
- **WHEN** a caller with read access requests `GET /api/events/{eventId}/convocations` for an
  event where a convocation has a `MinutesReason` set
- **THEN** the corresponding entry in the response includes that `MinutesReason` value

#### Scenario: Match participation listings include the post-match reason
- **WHEN** a caller with read access requests `GET /api/events/{eventId}/match-participation`,
  `GET /api/catalog/team-player/{teamPlayerId}/match-history`, or
  `GET /api/catalog/team/{teamId}/match-minutes`, and a returned row's underlying
  `MatchParticipation` has a `MinutesReason` set
- **THEN** the corresponding entry in the response includes that `MinutesReason` value

#### Scenario: No reason set
- **WHEN** any of the above endpoints returns an entry whose underlying `Convocation` or
  `MatchParticipation` has no `MinutesReason` set
- **THEN** the corresponding entry's `MinutesReason` field is `null`
