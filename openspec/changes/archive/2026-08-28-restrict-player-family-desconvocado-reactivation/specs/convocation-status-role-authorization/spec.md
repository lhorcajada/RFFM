## ADDED Requirements

### Requirement: Player/FamilyMember reactivation of a Deconvoked convocation is training-only
The system SHALL allow a caller with role `Player` or `FamilyMember` to change their own
player's `Convocation.ConvocationStatusId` from `Deconvoke` (5) to `Pending` (1) or `Accepted`
(2) via `PUT /api/events/{eventId}/convocations/{convocationId}/status` only when the
convocation's `SportEvent.EventTypeId` equals the `Training` event type. For any other
`SportEvent.EventTypeId`, the system SHALL reject the request with `403 Forbidden`
(`ForbiddenAccessException`) without mutating the convocation.

This requirement is additive to, and does not replace, the existing ownership check (a
Player/FamilyMember may only ever act on the convocation of the `TeamPlayer` their
`UserProfile.PlayerId` is linked to).

#### Scenario: Player reactivates their own Deconvoked convocation on a Training event
- **WHEN** a caller with role `Player`, linked to `TeamPlayer` X, sends
  `PUT /api/events/{eventId}/convocations/{convocationId}/status` with `newStatusId: 2`
  (Accepted) for a convocation of `TeamPlayer` X whose current status is `Deconvoke` and whose
  event has `EventTypeId = Training`
- **THEN** the request succeeds (`200 OK`) and the convocation's status is updated to `Accepted`

#### Scenario: FamilyMember reactivates their linked player's Deconvoked convocation to Pending on a Training event
- **WHEN** a caller with role `FamilyMember`, linked to `TeamPlayer` X, sends the same request
  with `newStatusId: 1` (Pending) for a convocation of `TeamPlayer` X whose current status is
  `Deconvoke` and whose event has `EventTypeId = Training`
- **THEN** the request succeeds (`200 OK`) and the convocation's status is updated to `Pending`

#### Scenario: Player attempts to reactivate a Deconvoked convocation on a Match event
- **WHEN** a caller with role `Player`, linked to `TeamPlayer` X, sends the same request with
  `newStatusId: 2` (Accepted) for a convocation of `TeamPlayer` X whose current status is
  `Deconvoke` and whose event has `EventTypeId = Match`
- **THEN** the request fails with `403 Forbidden` and the convocation's status remains `Deconvoke`

#### Scenario: FamilyMember attempts to reactivate a Deconvoked convocation on a FriendlyMatch event
- **WHEN** a caller with role `FamilyMember`, linked to `TeamPlayer` X, sends the same request
  with `newStatusId: 1` (Pending) for a convocation of `TeamPlayer` X whose current status is
  `Deconvoke` and whose event has `EventTypeId = FriendlyMatch`
- **THEN** the request fails with `403 Forbidden` and the convocation's status remains `Deconvoke`

#### Scenario: Player attempts to reactivate a Deconvoked convocation on a Tournament event
- **WHEN** a caller with role `Player`, linked to `TeamPlayer` X, sends the same request with
  `newStatusId: 2` (Accepted) for a convocation of `TeamPlayer` X whose current status is
  `Deconvoke` and whose event has `EventTypeId = Tournament`
- **THEN** the request fails with `403 Forbidden` and the convocation's status remains `Deconvoke`

#### Scenario: Coach reactivates a Deconvoked convocation on a Match event (unchanged)
- **WHEN** a caller with role `Coach` sends
  `PUT /api/events/{eventId}/convocations/{convocationId}/status` with `newStatusId: 2`
  (Accepted) for any convocation whose current status is `Deconvoke`, regardless of the event's
  `EventTypeId`
- **THEN** the request succeeds (`200 OK`) and the convocation's status is updated to `Accepted`

#### Scenario: Administrator reactivates a Deconvoked convocation on any event type (unchanged)
- **WHEN** a caller with role `Administrator` sends the same request for any convocation whose
  current status is `Deconvoke`, regardless of the event's `EventTypeId`
- **THEN** the request succeeds (`200 OK`) and the convocation's status is updated accordingly

#### Scenario: Player status transitions unrelated to Deconvoked reactivation remain unrestricted by event type
- **WHEN** a caller with role `Player`, linked to `TeamPlayer` X, sends the same request for a
  convocation of `TeamPlayer` X whose current status is `Pending`, with `newStatusId: 5`
  (Deconvoke, i.e. self-declining), regardless of the event's `EventTypeId`
- **THEN** the request succeeds (`200 OK`) — this rule only restricts moving OUT of `Deconvoke`
  into `Pending`/`Accepted`, not other transitions
