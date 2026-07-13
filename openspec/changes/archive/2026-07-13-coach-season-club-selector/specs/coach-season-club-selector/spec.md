## ADDED Requirements

### Requirement: Mandatory club selection on season creation
The Coach "Crear temporada" form SHALL require an explicit club selection before a season can be created, sourced from `GET /api/catalog/user-clubs`, and SHALL NOT depend on a club having been pre-selected on a different screen.

#### Scenario: Save disabled without a club
- **WHEN** a coach opens the "Crear temporada" form and has not selected a club
- **THEN** the "Crear temporada" button is disabled

#### Scenario: Save enabled once a club is selected
- **WHEN** a coach selects a club from the club field
- **THEN** the "Crear temporada" button becomes enabled (name and dates being valid) and the created season is submitted with that club's id

#### Scenario: Editing an existing season does not require re-selecting a club
- **WHEN** a coach opens the form to edit an existing season
- **THEN** no mandatory club selection is shown or required to save the edit

### Requirement: Inline club creation when the coach has no clubs
When a coach has zero clubs, or explicitly chooses to create a new one, the season creation form SHALL offer inline club creation without navigating away from the Seasons screen.

#### Scenario: Zero clubs shows a create-club affordance
- **WHEN** `GET /api/catalog/user-clubs` returns an empty list for the current coach
- **THEN** the club field shows an affordance to create a new club instead of only an empty dropdown

#### Scenario: Successful inline club creation auto-selects the new club
- **WHEN** a coach submits the inline club creation sub-form with a valid name and country
- **THEN** `POST /api/catalog/club` is called, and on success the newly created club becomes the selected club for the season being created

### Requirement: Localized 400 error messages for club and season creation
Errors returned by `POST /api/catalog/club` and season creation SHALL be shown to the coach as localized Spanish text resolved from the `code` field of the ProblemDetails response, not as raw backend text.

#### Scenario: Club quota exceeded
- **WHEN** `POST /api/catalog/club` responds 400 with `code: "club_quota_exceeded"`
- **THEN** the inline club creation form shows the Spanish message "Has alcanzado el número máximo de clubes que puedes crear (3)."

#### Scenario: Club validation failure
- **WHEN** `POST /api/catalog/club` responds 400 with `code: "ValidationFailed"`
- **THEN** the inline club creation form shows the existing Spanish `ValidationFailed` translation instead of the raw `detail` string
