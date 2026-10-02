## ADDED Requirements

### Requirement: Coaches save one evaluation per player and session
The system SHALL expose `PUT /api/teams/{teamId}/players/{teamPlayerId}/session-evaluations/{sessionId}` with `{ evaluations: [{ subprincipioId, assessment, comment? }] }` to create the player's evaluation of that training session, or replace it if it already exists, and SHALL return `200` with the evaluation. There SHALL be at most one evaluation per player and session. Each evaluation item SHALL reference a Subprincipio targeted by the session (directly or through a Zona of one of its Sub-subprincipios), with an assessment `Achieved`, `Partial` or `NotAchieved` and an optional comment of at most 500 characters. The evaluation SHALL store the session name and date and the Fase, Principio and Subprincipio labels.

#### Scenario: Create an evaluation
- **WHEN** a coach saves «Circular para desordenar» as `NotAchieved` with a comment for a session of 14/10/2026 that targets it
- **THEN** the system returns `200` with the session name, `sessionDate = 2026-10-14` and that item with its labels

#### Scenario: Saving again replaces
- **WHEN** the coach saves the same player and session again with a different set of items
- **THEN** the evaluation contains only the new items and there is still a single evaluation for that player and session

#### Scenario: Subprincipio not trained in the session
- **WHEN** an item references a Subprincipio that the session does not target
- **THEN** the system returns a `400` `ProblemDetails` response with code `SubprincipioNotInSession` and nothing is saved

#### Scenario: Session not held yet
- **WHEN** the session date is after today
- **THEN** the system returns a `400` `ProblemDetails` response with code `SessionNotHeldYet`

#### Scenario: Session of another team
- **WHEN** the session belongs to another team or does not exist
- **THEN** the system returns a `404` `ProblemDetails` response with code `SessionNotFound`

#### Scenario: Invalid body
- **WHEN** there are no items, a Subprincipio is repeated, an assessment is unknown or a comment exceeds 500 characters
- **THEN** the system returns a `400` `ValidationProblemDetails` response

### Requirement: Coaches read and delete a session evaluation
The system SHALL expose `GET` and `DELETE` on the same route. `GET` SHALL return `200` with the evaluation, and `DELETE` SHALL remove it returning `204`; both SHALL return `404` with code `SessionEvaluationNotFound` when the player has no evaluation for that session.

#### Scenario: Read
- **WHEN** a coach requests an existing evaluation
- **THEN** the system returns `200` with its items

#### Scenario: Delete
- **WHEN** a coach deletes an existing evaluation
- **THEN** the system returns `204` and a later `GET` returns `404`

### Requirement: Evaluations survive changes to sessions and the game model
Deleting the training session or the Subprincipio SHALL keep the evaluation with its stored session name, date and labels; the references SHALL become `null`.

#### Scenario: Session deleted
- **WHEN** the evaluated session is deleted
- **THEN** the evaluation still exists with `trainingSessionId = null` and the same session name and date

### Requirement: Session evaluations are restricted to coaches
The three endpoints SHALL require the Coach role, the `GameModel` feature permission (`Read` for `GET`, `ReadWrite` otherwise) and membership of the team.

#### Scenario: Non-coach roles are forbidden
- **WHEN** a Player, FamilyMember, ClubDirector, ClubMember or Administrator calls any of the endpoints
- **THEN** the system returns `403`
