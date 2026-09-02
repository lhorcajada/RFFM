## ADDED Requirements

### Requirement: Coach registers a pending account for a family member
The system SHALL allow an authorized coach (creator of the `TeamPlayer`'s team, or of its
parent club) to create a Pending Identity account for a `TeamPlayerFamilyMember` that has an
`Email` on file and no already-linked or already-pending account.

#### Scenario: Family member has no email on file
- **WHEN** the coach registers an account for a `TeamPlayerFamilyMember` whose `Email` is null
  or empty
- **THEN** the system SHALL return `400 Bad Request` with `ProblemDetails.Extensions["code"] ==
  "FamilyMemberEmailRequired"` and SHALL NOT create any `IdentityUser` or request row

#### Scenario: Family member already has a linked account
- **WHEN** the coach registers an account for a `TeamPlayerFamilyMember` whose `LinkedUserId`
  is already set
- **THEN** the system SHALL return `409 Conflict` with code `FamilyMemberAccountAlreadyLinked`

#### Scenario: A registration is already pending for this family member
- **WHEN** the coach registers an account for a `TeamPlayerFamilyMember` that already has a
  `FamilyMemberAccountRequest` with `Status == Pending`
- **THEN** the system SHALL return `409 Conflict` with code
  `FamilyMemberAccountRequestAlreadyPending`

#### Scenario: Successful pending registration
- **WHEN** the coach registers an account for an eligible `TeamPlayerFamilyMember`
- **THEN** the system SHALL create an `IdentityUser` with a generated unique alias and a
  generated password, create a `FamilyMemberAccountRequest` with `Status == Pending` linking
  that user to the `TeamPlayerFamilyMember`/`TeamPlayer`, assign no Identity role, create no
  `UserTeam`, and return the generated alias and plaintext password in the response body only
  (never persisted)

#### Scenario: Unauthorized coach
- **WHEN** a user who is not the creator of the family member's team (nor its parent club)
  attempts to register an account for that family member
- **THEN** the system SHALL return `403 Forbidden`

### Requirement: Coach approves a pending family member account request
The system SHALL allow the authorized coach to approve a Pending
`FamilyMemberAccountRequest`, granting the linked `IdentityUser` the `FamilyMember` role and
team access.

#### Scenario: Successful approval
- **WHEN** the coach approves a Pending `FamilyMemberAccountRequest`
- **THEN** the system SHALL mark the request `Approved`, create a `UserTeam` with
  `Membership.FamilyPlayer` linked to the `TeamPlayer`, upsert a `UserProfile`, assign the
  `FamilyMember` Identity role to the linked user, and set `TeamPlayerFamilyMember
  .LinkedUserId` to that user's id

#### Scenario: Approving an already-decided request
- **WHEN** the coach approves a `FamilyMemberAccountRequest` whose `Status` is not `Pending`
- **THEN** the system SHALL return `409 Conflict` with code
  `FamilyMemberAccountRequestAlreadyDecided`

#### Scenario: Unauthorized coach
- **WHEN** a user who is not the creator of the family member's team (nor its parent club)
  attempts to approve the request
- **THEN** the system SHALL return `403 Forbidden`

### Requirement: Coach rejects a pending family member account request
The system SHALL allow the authorized coach to reject a Pending `FamilyMemberAccountRequest`,
permanently preventing it from being approved, without ever granting team access.

#### Scenario: Successful rejection
- **WHEN** the coach rejects a Pending `FamilyMemberAccountRequest`
- **THEN** the system SHALL mark the request `Rejected`, SHALL NOT create a `UserTeam` or
  assign the `FamilyMember` role, and SHALL best-effort delete the orphaned `IdentityUser`

#### Scenario: Rejecting an already-decided request
- **WHEN** the coach rejects a `FamilyMemberAccountRequest` whose `Status` is not `Pending`
- **THEN** the system SHALL return `409 Conflict` with code
  `FamilyMemberAccountRequestAlreadyDecided`

### Requirement: Family member registration status is visible to the coach
The system SHALL expose, on the existing coach-facing `TeamPlayer` query DTO, a derived
registration status for each family member: `None` (no `LinkedUserId` and no `Pending`
request), `Pending` (a `FamilyMemberAccountRequest` with `Status == Pending` exists), or
`Approved` (`LinkedUserId` is set).

#### Scenario: Status reflects current state
- **WHEN** a coach fetches a `TeamPlayer` whose family member has an `Approved`
  `FamilyMemberAccountRequest`
- **THEN** the returned family member DTO SHALL report registration status `Approved`
