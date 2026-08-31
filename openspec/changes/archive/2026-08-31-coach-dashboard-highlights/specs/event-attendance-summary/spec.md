## ADDED Requirements

### Requirement: Batch attendance summary per event, sourced from Convocation status
The system SHALL expose `GET /api/sport-events/attendance-summary?teamId={teamId}&eventIds={csv}`
returning, for each requested event id that exists and belongs to `teamId`, the count of
convocados (`Convocation` rows for that event), and among those convocados the count bucketed by
`Convocation.ConvocationStatusId`: `Accepted` counts as `going`; `Deconvoke` and `Justified` both
count as `notGoing`; `Pending` (or an unset/unrecognized status id) counts as `pending`. The
system SHALL NOT read `EventAttendanceConfirmation`/`AttendanceStatus` (the separate, unrelated
Mobile RSVP flow) for this endpoint. The response SHALL include `attendancePercentage`
(`going / convocados * 100`, `0` when convocados is `0`).

#### Scenario: Coach requests summaries for three events
- **WHEN** an authenticated Coach with access to `teamId` calls the endpoint with three valid
  `eventIds` belonging to that team
- **THEN** the system returns `200 OK` with one summary object per event id, each containing
  `convocados`, `going`, `pending`, `notGoing`, and `attendancePercentage`

#### Scenario: Event id not belonging to the team is omitted
- **WHEN** a requested event id belongs to a different team than `teamId`
- **THEN** that id is silently omitted from the response array, with no error

#### Scenario: Event with zero convocados reports zero percentage
- **WHEN** an event has no `Convocation` rows
- **THEN** its summary shows `convocados = 0` and `attendancePercentage = 0`

#### Scenario: Accepted convocation counts as going
- **WHEN** a convoked player's `Convocation.ConvocationStatusId` is `Accepted`
- **THEN** that player is counted in `going`

#### Scenario: Deconvoked convocation counts as notGoing
- **WHEN** a convoked player's `Convocation.ConvocationStatusId` is `Deconvoke`
- **THEN** that player is counted in `notGoing`

#### Scenario: Justified convocation counts as notGoing
- **WHEN** a convoked player's `Convocation.ConvocationStatusId` is `Justified`
- **THEN** that player is counted in `notGoing` (folded together with `Deconvoke` — a justified
  absence is still an absence for this aggregate)

#### Scenario: Pending convocation counts as pending
- **WHEN** a convoked player's `Convocation.ConvocationStatusId` is `Pending`, or unset
- **THEN** that player is counted in `pending`, not omitted

### Requirement: Caller's own status and convocation id, scoped to that specific event
The system SHALL include `myStatus`, `myStatusId`, and `myConvocationId` in a summary only when
the caller has the Player or FamilyMember role, has a `UserTeam.LinkedTeamPlayerId` for `teamId`,
AND that linked player has a `Convocation` row for that specific event. `myStatus`/`myStatusId`
SHALL reflect that `Convocation`'s own `ConvocationStatus` name/id
("Pending"/"Accepted"/"Deconvoke"/"Justified"), not a relabeled Going/NotGoing value.
`myConvocationId` SHALL be that `Convocation`'s id. When the linked player is not convoked to
that event, or the caller has no linked player, or the caller is Coach/Administrator/another
role, all three fields SHALL be `null`.

#### Scenario: Player convoked to the event sees their own status and convocation id
- **WHEN** an authenticated Player with a linked `TeamPlayer` convoked to a given event calls the
  endpoint
- **THEN** that event's summary includes `myStatus` reflecting the `ConvocationStatus` name of
  that player's own `Convocation`, `myStatusId` as its numeric id, and `myConvocationId` as that
  `Convocation`'s id

#### Scenario: Player not convoked to the event receives null, not Pending
- **WHEN** an authenticated Player's linked `TeamPlayer` has no `Convocation` row for a given
  event
- **THEN** that event's summary has `myStatus: null`, `myStatusId: null`, and
  `myConvocationId: null` — distinct from a `"Pending"` value, so the frontend can distinguish
  "not called up" from "called up, awaiting response"

#### Scenario: Coach receives null myStatus
- **WHEN** an authenticated Coach calls the endpoint
- **THEN** every returned summary has `myStatus: null`, `myStatusId: null`, and
  `myConvocationId: null`

### Requirement: Request validation and team-scoped authorization
The endpoint SHALL require `teamId` and a non-empty `eventIds` list, rejecting more than 50 ids
with `400 Bad Request`. Player/FamilyMember callers without a `UserTeam` for `teamId` SHALL
receive `403 Forbidden`; Coach/Administrator/other roles bypass the team-membership check.

#### Scenario: Missing teamId
- **WHEN** the endpoint is called without `teamId`
- **THEN** the system returns `400 Bad Request` as a `ProblemDetails` response

#### Scenario: Too many event ids
- **WHEN** the endpoint is called with more than 50 `eventIds`
- **THEN** the system returns `400 Bad Request`

#### Scenario: Player without team access is forbidden
- **WHEN** an authenticated Player with no `UserTeam` row for `teamId` calls the endpoint
- **THEN** the system returns `403 Forbidden`
