# player-tracking-session-link Specification

## Purpose
TBD - created by archiving change player-tracking-session-link. Update Purpose after archive.
## Requirements
### Requirement: Observations can be linked to a training session of the team
`POST /api/teams/{teamId}/players/{teamPlayerId}/observations` SHALL accept an optional `trainingSessionId`. When provided, it SHALL reference a training session of the same team, otherwise the system SHALL return a `404` `ProblemDetails` response with code `SessionNotFound` and store nothing. The created observation SHALL be returned with `trainingSessionId` and `trainingSessionName`.

#### Scenario: Observation linked to a session
- **WHEN** a coach creates an observation with the id of the team's session «Sesión 1»
- **THEN** the system returns `201` with `trainingSessionId` set and `trainingSessionName = "Sesión 1"`

#### Scenario: Session of another team
- **WHEN** the `trainingSessionId` belongs to another team
- **THEN** the system returns `404` with code `SessionNotFound` and no observation is stored

#### Scenario: Observation without session
- **WHEN** no `trainingSessionId` is sent
- **THEN** the observation is created with `trainingSessionId = null` and `trainingSessionName = null`

### Requirement: The observation list shows the session
`GET /api/teams/{teamId}/players/{teamPlayerId}/observations` SHALL include `trainingSessionId` and the current `trainingSessionName` of each observation (`null` when it has none or the session was deleted). The Coach web observation cards SHALL show «Sesión: {name}» when present.

#### Scenario: Card shows the session
- **WHEN** an observation is linked to «Sesión 1»
- **THEN** its card shows «Sesión: Sesión 1»

#### Scenario: Card without session
- **WHEN** an observation has no session
- **THEN** its card shows no session line

### Requirement: The session form links its observations
Observations saved from the session evaluation form SHALL be sent with the selected session's id.

#### Scenario: Session id sent
- **WHEN** the coach evaluates «Circular para desordenar» in «Sesión 1» and saves
- **THEN** the request includes `trainingSessionId` of «Sesión 1»

