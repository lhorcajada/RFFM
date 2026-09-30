# player-tracking-observations Specification

## Purpose
TBD - created by archiving change player-tracking-observations-api. Update Purpose after archive.
## Requirements
### Requirement: Coaches record game-model observations about a player
The system SHALL expose `POST /api/teams/{teamId}/players/{teamPlayerId}/observations` to create a game-model observation about a team player with `date` (not after today, UTC), `subprincipioId` (a Subprincipio of a game model of that team), `assessment` (`Achieved`, `Partial` or `NotAchieved`) and an optional `comment` of at most 500 characters. The system SHALL store the author and, at creation, a snapshot of the Fase name, the Principio label (`"{numero}. {titulo}"`) and the Subprincipio label (`"{numero} {titulo}"`), and SHALL return `201` with the created observation.

#### Scenario: Create a game-model observation
- **WHEN** a coach posts an observation with a Subprincipio «2.3 Circular para desordenar» of Principio «2. Ataque posicional» in Fase «Ataque organizado», assessment `NotAchieved` and a comment
- **THEN** the system returns `201` with `kind = GameModel`, the three labels, the assessment and the comment

#### Scenario: Subprincipio of another team
- **WHEN** the `subprincipioId` belongs to a game model of a different team or does not exist
- **THEN** the system returns a `404` `ProblemDetails` response and stores nothing

#### Scenario: Player of another team
- **WHEN** `teamPlayerId` does not belong to `teamId`
- **THEN** the system returns a `404` `ProblemDetails` response

#### Scenario: Invalid input
- **WHEN** the date is after today, the assessment is unknown or the comment exceeds 500 characters
- **THEN** the system returns a `400` `ValidationProblemDetails` response

### Requirement: Observations survive changes of the game model
An observation SHALL keep its stored labels when its Subprincipio is removed from the game model; its `subprincipioId` SHALL become `null`.

#### Scenario: Subprincipio removed
- **WHEN** the Subprincipio referenced by an observation is deleted
- **THEN** the observation still exists with `subprincipioId = null` and the same Fase, Principio and Subprincipio labels

### Requirement: Coaches list a player's observations
The system SHALL expose `GET /api/teams/{teamId}/players/{teamPlayerId}/observations` returning the player's observations ordered by `date` descending and then by creation time descending.

#### Scenario: Most recent first
- **WHEN** a player has observations dated 1 October, 14 October and 7 October
- **THEN** the list returns them in the order 14, 7, 1 October

#### Scenario: Only the requested player
- **WHEN** another player of the same team also has observations
- **THEN** the list contains only the requested player's observations

### Requirement: Observations are restricted to the technical staff
Both endpoints SHALL require the `GameModel` feature permission (`ReadWrite` to create, `Read` to list), which the Player role does not have, and membership of the team.

#### Scenario: Requests declare the GameModel permission and team membership
- **WHEN** the create command and the list query are inspected
- **THEN** both require the `GameModel` feature route (`ReadWrite` and `Read` respectively) and team membership for their `teamId`

