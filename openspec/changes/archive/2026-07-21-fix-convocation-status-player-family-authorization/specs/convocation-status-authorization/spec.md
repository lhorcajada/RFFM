## ADDED Requirements

### Requirement: Coach and Administrator can change any convocation status
Users authenticated with role `Coach` or `Administrator` SHALL be able to change the status (accept/reject/deconvoke/justify) of any convocation via `PUT /api/events/{eventId}/convocations/{convocationId}/status`, without an ownership restriction on the target player.

#### Scenario: Coach updates a convocation status
- **WHEN** an authenticated user with role `Coach` calls `PUT /api/events/{eventId}/convocations/{convocationId}/status` for a convocation belonging to any player
- **THEN** the request succeeds with `200 OK` and the convocation status is updated

### Requirement: Player and FamilyMember can only manage their own associated player's convocation
Users authenticated with role `Player` or `FamilyMember` SHALL be able to accept or reject a convocation only when the convocation's `TeamPlayerId` matches the `TeamPlayer.Id` associated with their account via `UserProfile.PlayerId`. The comparison MUST use the same ID space (`TeamPlayer.Id`) on both sides — not the master `Player.Id`.

#### Scenario: Player accepts their own convocation
- **WHEN** an authenticated user with role `Player` whose `UserProfile.PlayerId` equals the convocation's `TeamPlayerId` calls the status endpoint with a valid "Accepted" status
- **THEN** the request succeeds with `200 OK` and the convocation status is updated

#### Scenario: Player rejects their own convocation
- **WHEN** an authenticated user with role `Player` whose `UserProfile.PlayerId` equals the convocation's `TeamPlayerId` calls the status endpoint with a valid "Rejected/Deconvoke" status
- **THEN** the request succeeds with `200 OK` and the convocation status is updated

#### Scenario: FamilyMember accepts their associated player's convocation
- **WHEN** an authenticated user with role `FamilyMember` whose `UserProfile.PlayerId` equals the convocation's `TeamPlayerId` calls the status endpoint with a valid "Accepted" status
- **THEN** the request succeeds with `200 OK` and the convocation status is updated

#### Scenario: FamilyMember rejects their associated player's convocation
- **WHEN** an authenticated user with role `FamilyMember` whose `UserProfile.PlayerId` equals the convocation's `TeamPlayerId` calls the status endpoint with a valid "Rejected/Deconvoke" status
- **THEN** the request succeeds with `200 OK` and the convocation status is updated

### Requirement: Cross-player and missing-association attempts are rejected with 403, not 401
When a Player or FamilyMember user attempts to change the status of a convocation that does not belong to their associated player — including when they have no `UserProfile` row, or their `UserProfile.PlayerId` does not match the convocation's `TeamPlayerId` — the system SHALL reject the request with `403 Forbidden` and a `ProblemDetails` body. It SHALL NOT return `401 Unauthorized` for an authenticated user, since a 401 causes the frontend to treat the session as expired and redirect to login.

#### Scenario: Player attempts another player's convocation
- **WHEN** an authenticated user with role `Player` whose `UserProfile.PlayerId` does NOT match the convocation's `TeamPlayerId` calls the status endpoint
- **THEN** the request fails with `403 Forbidden` and a `ProblemDetails` response, and no convocation data is modified

#### Scenario: FamilyMember attempts another player's convocation
- **WHEN** an authenticated user with role `FamilyMember` whose `UserProfile.PlayerId` does NOT match the convocation's `TeamPlayerId` calls the status endpoint
- **THEN** the request fails with `403 Forbidden` and a `ProblemDetails` response, and no convocation data is modified

#### Scenario: Player or FamilyMember with no associated player profile
- **WHEN** an authenticated user with role `Player` or `FamilyMember` who has no `UserProfile` row (or a `UserProfile` with a null/empty `PlayerId`) calls the status endpoint
- **THEN** the request fails with `403 Forbidden` and a `ProblemDetails` response, and no convocation data is modified
