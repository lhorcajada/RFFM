# mobile-user-registration Specification

## Purpose
TBD - created by archiving change mobile-user-registration. Update Purpose after archive.
## Requirements
### Requirement: Registration entry point from Login
Mobile SHALL offer a way to reach the registration screen from the unauthenticated `Login` screen,
and the registration screen SHALL be reachable without an authenticated session.

#### Scenario: Navigating from Login to Register
- **WHEN** an unauthenticated user is on `LoginScreen` and presses the "¿No tienes cuenta?
  Regístrate" link
- **THEN** Mobile navigates to the `Register` screen

#### Scenario: Register screen accessible without a session
- **WHEN** the app has no stored auth token (`isAuthenticated` is `false`)
- **THEN** the unauthenticated navigation stack includes both `Login` and `Register` as reachable
  screens

### Requirement: Core registration fields
The registration screen SHALL require an email, an alias (username), a password, and a role
selection before allowing submission, matching the fields of the existing web registration form.

#### Scenario: Submit disabled with missing required fields
- **WHEN** any of email, alias, password, or role is empty
- **THEN** the submit action is disabled

#### Scenario: Submit enabled once core fields and any role-specific requirement are satisfied
- **WHEN** email, alias, password, and role are filled and all role-specific conditions for that role
  (see role-conditional requirements below) are satisfied
- **THEN** the submit action is enabled

### Requirement: Role selection
The registration screen SHALL let the user choose exactly one account role from: `Fan`,
`ClubDirector`, `Coach`, `ClubMember`, `Player`, `FamilyMember`.

#### Scenario: Changing role resets role-specific fields
- **WHEN** the user selects a different role after having entered role-specific data (invitation
  code, trial acceptance, selected player)
- **THEN** all role-specific fields and validation state are reset for the newly selected role,
  while email/alias/password values are preserved

### Requirement: 7-day trial acceptance for ClubDirector and codeless Coach
The registration screen SHALL require explicit acceptance of a 7-day trial before submission is allowed when the selected role is `ClubDirector`, or when the role is `Coach` and no club invitation code is provided.

#### Scenario: ClubDirector must accept the trial
- **WHEN** the role is `ClubDirector` and the trial acceptance has not been confirmed
- **THEN** submission is disabled and a trial-confirmation prompt is shown

#### Scenario: Coach without a club code must accept the trial
- **WHEN** the role is `Coach`, the user has indicated they have no club invitation code, and trial
  acceptance has not been confirmed
- **THEN** submission is disabled and a trial-confirmation prompt is shown

#### Scenario: Cancelling the trial prompt aborts the role choice
- **WHEN** the user cancels the trial-confirmation prompt
- **THEN** the role selection and any role-specific fields are cleared back to their initial state

### Requirement: Club invitation code for Coach-with-code and ClubMember
The registration screen SHALL require a non-empty club invitation code, validated live against the backend, before submission is allowed when the selected role is `ClubMember`, or when the role is `Coach` and the user indicates they have a club invitation code.

#### Scenario: Live validation of a club invitation code
- **WHEN** the user types a non-empty club invitation code for `ClubMember` or code-holding `Coach`
- **THEN** after a short debounce the screen calls the club invitation preview endpoint and shows a
  checking indicator while the request is in flight

#### Scenario: Valid club invitation code enables submission
- **WHEN** the club invitation preview call succeeds
- **THEN** the code is marked valid and, combined with the other required fields, submission becomes
  possible

#### Scenario: Invalid club invitation code blocks submission
- **WHEN** the club invitation preview call fails
- **THEN** the code is marked invalid with an error message and submission remains disabled

### Requirement: Team invitation code and roster player selection for Player/FamilyMember
When the selected role is `Player` or `FamilyMember`, the registration screen SHALL require a
non-empty team invitation code validated live against the backend, and, once valid, SHALL require the
user to select one player from the returned team roster before submission is allowed.

#### Scenario: Live validation of a team invitation code
- **WHEN** the user types a non-empty team invitation code for `Player` or `FamilyMember`
- **THEN** after a short debounce the screen calls the team invitation preview endpoint and shows a
  checking indicator while the request is in flight

#### Scenario: Valid team code reveals the roster picker
- **WHEN** the team invitation preview call succeeds
- **THEN** the screen shows the returned roster players for selection

#### Scenario: Player role cannot select an already-linked roster player
- **WHEN** the role is `Player` and a roster player is already linked to another `Player` account
- **THEN** that roster player is shown as disabled and cannot be selected

#### Scenario: Submission requires a selected roster player
- **WHEN** the team invitation code is valid but no roster player has been selected
- **THEN** submission remains disabled

### Requirement: Registration submission
On submission, the registration screen SHALL call the registration endpoint with the collected
fields (email, alias, password, role, and any applicable role-specific fields), and SHALL not permit
duplicate submissions while a request is in flight.

#### Scenario: Successful submit sends the expected payload
- **WHEN** the user submits a valid `Fan` registration
- **THEN** the screen calls the registration endpoint with `{ email, alias, password, accountType:
  "Fan" }` and no role-specific fields

#### Scenario: Submit button reflects in-flight state
- **WHEN** a submission is in progress
- **THEN** the submit action is disabled and shows a loading indication until the request resolves

### Requirement: Post-registration outcome handling
After a successful registration call, the screen SHALL branch on the response status: an
`Active` status SHALL show a success confirmation and return the user to `Login`; a
`PendingClubApproval` status SHALL show a pending-approval notice without navigating away.

#### Scenario: Active registration shows success and returns to Login
- **WHEN** the registration call resolves with `status: "Active"`
- **THEN** the screen shows a success message and subsequently navigates back to `Login`

#### Scenario: Pending club approval shows a notice and stays on Register
- **WHEN** the registration call resolves with `status: "PendingClubApproval"`
- **THEN** the screen shows a pending-approval notice and does not navigate to `Login` or any
  authenticated screen

#### Scenario: No auto-login after registration
- **WHEN** a registration call succeeds with either status
- **THEN** the app does not store an auth token and `isAuthenticated` remains `false`

### Requirement: Registration error handling in Spanish
When the registration call fails, the screen SHALL show a single error banner above the form with a
Spanish message derived from the response's error `code` when recognized, otherwise from the
response's `detail`, otherwise a generic Spanish fallback message.

#### Scenario: Known error code produces a specific Spanish message
- **WHEN** the registration call fails with a response containing a recognized `code` (for example
  `AliasIsAlreadyTaken` or `EmailIsAlreadyTaken`)
- **THEN** the error banner shows the specific Spanish message mapped to that code

#### Scenario: Unrecognized code falls back to detail
- **WHEN** the registration call fails with an unrecognized `code` but a non-empty `detail`
- **THEN** the error banner shows the `detail` text

#### Scenario: No code or detail falls back to a generic message
- **WHEN** the registration call fails with neither a recognized `code` nor a `detail`
- **THEN** the error banner shows a generic Spanish fallback message

#### Scenario: Error clears on retry
- **WHEN** the user edits any field after a failed submission and resubmits
- **THEN** the previous error banner is cleared before the new submission attempt completes

