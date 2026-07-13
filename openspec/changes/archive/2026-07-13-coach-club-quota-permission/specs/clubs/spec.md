## ADDED Requirements

### Requirement: Coach role can manage clubs
The system SHALL grant the `Coach` identity role `Write` permission on the `/coach/clubs` feature route, so that `POST api/catalog/club`, `PUT api/catalog/club/{id}`, and `DELETE api/catalog/club/{id}` are reachable by an authenticated user with the `Coach` role, subject to any other business rule (e.g. the creation quota below).

#### Scenario: Coach creates a club
- **WHEN** an authenticated user with role `Coach` and no existing `FeaturePermission` restriction sends `POST api/catalog/club` with a valid `Name` and `CountryCode`
- **THEN** the system returns `200 OK` and creates the `Club` plus a `UserClub` row for that user with `IsCreator = true`

### Requirement: Club creation quota per creator
The system SHALL prevent a single user from being the creator (`UserClub.IsCreator = true`) of more than 3 clubs. When a user who is already the creator of 3 clubs attempts to create a 4th, the system SHALL reject the request with HTTP 400 and a `ProblemDetails` body carrying a stable machine-readable error code `club_quota_exceeded` in the `code` extension.

#### Scenario: User at quota attempts a 4th club
- **WHEN** an authenticated user who is already `IsCreator = true` on 3 `UserClub` rows sends `POST api/catalog/club` with an otherwise valid request
- **THEN** the system returns `400 Bad Request` with `ProblemDetails.Extensions["code"] == "club_quota_exceeded"` and does not create a new `Club` or `UserClub` row

#### Scenario: User under quota creates a club
- **WHEN** an authenticated user who is `IsCreator = true` on 0, 1, or 2 `UserClub` rows sends `POST api/catalog/club` with a valid request
- **THEN** the system returns `200 OK` and creates the `Club` plus a `UserClub` row with `IsCreator = true`

#### Scenario: Existing request validation still applies before the quota check
- **WHEN** an authenticated user under quota sends `POST api/catalog/club` with an empty `Name` or empty `CountryCode`
- **THEN** the system returns `400 Bad Request` with `ProblemDetails.Extensions["code"] == "ValidationFailed"` (FluentValidation), and the quota count is not consulted
