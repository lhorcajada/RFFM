## ADDED Requirements

### Requirement: The observation list can be filtered by date
`GET /api/teams/{teamId}/players/{teamPlayerId}/observations` SHALL accept optional `from` and `to` dates (`yyyy-MM-dd`) and return only the observations whose date is within the inclusive range. Without them it SHALL return all observations. When `from` is after `to` it SHALL return a `400` `ValidationProblemDetails` response.

#### Scenario: Inclusive range
- **WHEN** a player has observations on 1, 14 and 28 September and the list is requested with `from=2026-09-14&to=2026-09-28`
- **THEN** the observations of 14 and 28 September are returned

#### Scenario: No range
- **WHEN** no `from` nor `to` is sent
- **THEN** all the player's observations are returned

#### Scenario: Inverted range
- **WHEN** `from` is after `to`
- **THEN** the system returns `400`

### Requirement: The tracking tab shows observations of a period
The «Seguimiento» tab SHALL offer the periods «Último mes» (default, last 30 days), «Últimos 3 meses» (last 90 days) and «Todo», requesting the list with the corresponding `from` (none for «Todo»), and SHALL show the number of listed observations in the title «Observaciones (N)». When a newly saved observation is older than the selected period, it SHALL not be added to the list and the coach SHALL be told so.

#### Scenario: Default period
- **WHEN** the coach opens the tab on 2026-10-01
- **THEN** observations are requested with `from=2026-09-01` and «Último mes» is selected

#### Scenario: All observations
- **WHEN** the coach selects «Todo»
- **THEN** observations are requested without `from`

#### Scenario: Count in the title
- **WHEN** three observations are listed
- **THEN** the title shows «Observaciones (3)»

#### Scenario: Saved outside the period
- **WHEN** the coach saves an observation dated before the start of the selected period
- **THEN** it is not added to the list and the snackbar says it was saved but is not shown because it is older than the selected period
