## ADDED Requirements

### Requirement: Player/FamilyMember registration resolves the player by an individual code
When self-registering with account type `Player` or `FamilyMember` via `POST api/register`, the system SHALL require exactly one identifier — the individual player link code (`TeamPlayer.LinkCode`) — and SHALL resolve the target `TeamPlayer` (and its `Team`) directly from that code. The system SHALL NOT require a team invitation code or a manual roster selection for these two roles.

#### Scenario: Registering with a valid player code
- **GIVEN** a `TeamPlayer` with a generated `LinkCode`
- **WHEN** a user registers with `AccountType = "Player"` (or `"FamilyMember"`) and `PlayerLinkCode` equal to that code
- **THEN** the registration resolves the `TeamPlayer` and its `Team` from the code alone, without any team invitation code or roster selection field

#### Scenario: Registering with a non-existent player code
- **GIVEN** no `TeamPlayer` has a `LinkCode` matching the submitted code
- **WHEN** a user registers with `AccountType = "Player"` or `"FamilyMember"` and that code
- **THEN** the system returns `400 BadRequest` with error code `PlayerLinkCodeInvalid`, and no user link is created

### Requirement: Only one Player-role user may be linked to a TeamPlayer; FamilyMember has no limit
The system SHALL continue to enforce that at most one user with the `Player` role can be linked to a given `TeamPlayer`, while allowing an unlimited number of users with the `FamilyMember` role to link to the same `TeamPlayer`.

#### Scenario: A TeamPlayer already has a linked Player account
- **GIVEN** a `TeamPlayer` already linked to a user with role `Player`
- **WHEN** another user registers with `AccountType = "Player"` and that same `TeamPlayer`'s link code
- **THEN** the system returns `409 Conflict` with error code `LinkedPlayerAlreadyClaimed`, and no second link is created

#### Scenario: Multiple FamilyMember accounts link to the same player
- **GIVEN** a `TeamPlayer` with zero or more `FamilyMember` accounts already linked
- **WHEN** a new user registers with `AccountType = "FamilyMember"` and that `TeamPlayer`'s link code
- **THEN** the registration succeeds and the new user is linked, regardless of how many `FamilyMember` accounts are already linked to that player

### Requirement: Registering as Player updates the player's contact email
When a user successfully registers with `AccountType = "Player"` and links to a `TeamPlayer`, the system SHALL update that `TeamPlayer`'s contact email to the registering user's email, preserving any existing address and phone.

#### Scenario: Player registration updates the contact email
- **GIVEN** a `TeamPlayer` with an existing address and phone in its contact info
- **WHEN** a user registers with `AccountType = "Player"`, a valid link code for that `TeamPlayer`, and email `new@example.com`
- **THEN** the `TeamPlayer`'s contact email becomes `new@example.com`, and its address and phone remain unchanged

### Requirement: Registering as FamilyMember adds the email to the player's family list when missing
When a user successfully registers with `AccountType = "FamilyMember"` and links to a `TeamPlayer`, the system SHALL add a new family member entry with the registering user's email to that `TeamPlayer`'s family list if no existing entry already has that email (case-insensitive). If an entry with that email already exists, the system SHALL NOT create a duplicate entry, but SHALL still create the user's link.

#### Scenario: Family member email not yet on file
- **GIVEN** a `TeamPlayer` whose family members list has no entry with email `family@example.com`
- **WHEN** a user registers with `AccountType = "FamilyMember"`, a valid link code for that `TeamPlayer`, and email `family@example.com`
- **THEN** a new family member entry with that email is added to the `TeamPlayer`'s family list, and the user is linked

#### Scenario: Family member email already on file
- **GIVEN** a `TeamPlayer` whose family members list already has an entry with email `family@example.com`
- **WHEN** a user registers with `AccountType = "FamilyMember"`, a valid link code for that `TeamPlayer`, and email `family@example.com`
- **THEN** no duplicate family member entry is created, and the user is still linked to the `TeamPlayer`

### Requirement: Player link approval fallback is removed
The system SHALL NOT create a pending `TeamPlayerLinkRequest` as part of `Player`/`FamilyMember` registration, since the player link code is now mandatory. The manual approve/reject endpoints for this flow SHALL be removed.

#### Scenario: A valid code always links immediately
- **GIVEN** a valid, unclaimed player link code
- **WHEN** a user registers with `AccountType = "Player"` or `"FamilyMember"` using that code
- **THEN** the user is linked immediately (`RegistrationStatus.Active`), never left in a pending-approval state tied to the player link
