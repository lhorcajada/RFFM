# user-profile Specification

## Purpose
TBD - created by archiving change user-profile. Update Purpose after archive.
## Requirements
### Requirement: Users read their own account
The system SHALL expose `GET /api/users/me/account` for any authenticated user, returning `200` with the user's alias and email and, when saved, the first name, last name, second last name, phone number and avatar URL. Personal fields SHALL be `null` when the user has never saved personal data.

#### Scenario: Account without personal data
- **WHEN** a user who has never saved personal data requests their account
- **THEN** the system returns `200` with the alias and email and `null` personal fields

#### Scenario: Anonymous request
- **WHEN** the request has no valid token
- **THEN** the system returns `401`

### Requirement: Users save their personal data
The system SHALL expose `PUT /api/users/me/personal-data` with `{ firstName, lastName, secondLastName?, phoneNumber? }` that creates the user's personal data or updates it if it already exists, and SHALL return `200` with the account. First name and last name SHALL be required (at most 50 characters each); the second last name SHALL be optional (at most 50 characters); the phone number SHALL be optional and match `^\+?[0-9 ]{9,20}$`. There SHALL be at most one personal data record per user. Alias and email SHALL NOT be modifiable.

#### Scenario: First save creates the record
- **WHEN** a user without personal data saves «Ana» / «García»
- **THEN** the system returns `200` with those names and a later `GET /api/users/me/account` returns them

#### Scenario: Saving again updates
- **WHEN** the user saves again with a different phone number
- **THEN** the record is updated and the user still has a single personal data record

#### Scenario: Missing required name
- **WHEN** the first name or the last name is empty
- **THEN** the system returns a `400` `ValidationProblemDetails` response and nothing is saved

### Requirement: Users manage their avatar
The system SHALL expose `POST /api/users/me/avatar` (multipart `file`, JPEG, PNG or WebP, at most 2 MB) that stores the image, saves its URL as the user's avatar, removes the previous image on a best-effort basis and returns `200` with `avatarUrl`; and `DELETE /api/users/me/avatar` that clears the avatar and returns `204`, even when there is no avatar. Uploading SHALL require the user to have saved personal data first.

#### Scenario: Upload an avatar
- **WHEN** a user with personal data uploads a 500 KB PNG
- **THEN** the system returns `200` with the new `avatarUrl` and the account returns it

#### Scenario: Upload without personal data
- **WHEN** a user without personal data uploads an image
- **THEN** the system returns a `400` `ProblemDetails` response with code `PersonalDataRequired`

#### Scenario: Invalid file
- **WHEN** the file is empty, larger than 2 MB or not JPEG, PNG or WebP
- **THEN** the system returns a `400` `ValidationProblemDetails` response

#### Scenario: Remove the avatar
- **WHEN** the user deletes their avatar
- **THEN** the system returns `204` and the account returns `avatarUrl = null`

### Requirement: Users change their password
The system SHALL expose `PUT /api/users/me/password` with `{ currentPassword, newPassword }` that changes the password of the authenticated user and returns `204`. The new password SHALL differ from the current one and SHALL satisfy the Identity password policy.

#### Scenario: Change the password
- **WHEN** the user sends the correct current password and a valid new one
- **THEN** the system returns `204` and the user can log in only with the new password

#### Scenario: Wrong current password
- **WHEN** the current password is incorrect
- **THEN** the system returns a `400` `ProblemDetails` response with code `CurrentPasswordIncorrect` and the password does not change

#### Scenario: New password rejected by policy
- **WHEN** Identity rejects the new password
- **THEN** the system returns a `400` `ProblemDetails` response with code `PasswordChangeFailed`

### Requirement: Users see their club and team memberships
The system SHALL expose `GET /api/users/me/memberships` returning `200` with the clubs (`clubId`, `clubName`, `role`) and teams (`teamId`, `teamName`, `clubId`, `clubName`, `role`, `linkedPlayerName?`) the authenticated user belongs to, where `role` is the membership key (`Directive`, `Coach`, `ClubMember`, `Player`, `FamilyPlayer`, `Follower`), ordered by name. It SHALL only include the caller's own memberships.

#### Scenario: User with memberships
- **WHEN** a coach of «Infantil A» in club «CD Ejemplo» requests their memberships
- **THEN** the response includes the club with its role and the team with `role = Coach` and `clubName = CD Ejemplo`

#### Scenario: User without memberships
- **WHEN** a user has no club or team
- **THEN** the system returns `200` with empty lists

### Requirement: Web profile page
The web SHALL provide a protected page at `/profile`, opened from «Perfil» in the avatar menu of both the Federation and Coach apps, built with responsive cards (no tables) showing personal data, avatar, password change and memberships. Each team SHALL link to `/coach/team-dashboard?teamId={teamId}`. Each club SHALL link to `/coach/clubs/dashboard/{clubId}` when the user has the `ClubManagement` permission, and otherwise to the user's first team of that club, or be shown without a link if there is none. Roles SHALL be shown in Spanish. The header avatar SHALL show the uploaded photo, or else the initials of the first name and last name, or else the alias initial.

#### Scenario: Open the profile
- **WHEN** an authenticated user selects «Perfil» in the avatar menu
- **THEN** the app navigates to `/profile` and shows the four cards

#### Scenario: Return to the app
- **WHEN** the user opened the profile from a screen of the app and selects «Volver»
- **THEN** the app navigates back to that screen, or to `/appSelector` when the profile was opened directly by URL

#### Scenario: Required names on the form
- **WHEN** the first name or the last name is empty
- **THEN** the «Guardar» button is disabled

#### Scenario: Avatar requires personal data
- **WHEN** the user has never saved personal data
- **THEN** the avatar actions are disabled with the hint «Guarda primero tus datos personales»

#### Scenario: Team link
- **WHEN** the user selects a team in «Mis clubes y equipos»
- **THEN** the app navigates to that team's dashboard

#### Scenario: Club link without permission
- **WHEN** a user without `ClubManagement` sees a club where they belong to a team
- **THEN** the club links to the dashboard of their first team in that club

#### Scenario: Header shows the new photo
- **WHEN** the user uploads a photo on the profile page
- **THEN** the header avatar shows that photo without reloading the page

