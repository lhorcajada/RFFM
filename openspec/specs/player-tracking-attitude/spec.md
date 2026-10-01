# player-tracking-attitude Specification

## Purpose
TBD - created by archiving change player-tracking-attitude. Update Purpose after archive.
## Requirements
### Requirement: Coaches record attitude observations
`POST /api/teams/{teamId}/players/{teamPlayerId}/observations` SHALL accept `kind` (`GameModel`, default, or `Attitude`). With `Attitude`, it SHALL require an `attitudeKey` from the closed catalog `defensive-commitment` («Implicación en tareas defensivas»), `patience` («Paciencia con balón»), `courage-in-duels` («Valentía en los duelos»), `off-ball-effort` («Esfuerzo sin balón»), `listening` («Escucha y aplicación de consignas») and `focus` («Concentración durante la tarea»), SHALL NOT accept a `subprincipioId`, and SHALL apply the same date, assessment, comment and session rules as game-model observations. With `GameModel`, `subprincipioId` SHALL be required and `attitudeKey` SHALL NOT be accepted. Responses SHALL include `kind`, `attitudeKey` and `attitudeLabel`.

#### Scenario: Create an attitude observation from a session
- **WHEN** a coach posts `kind = Attitude`, `attitudeKey = defensive-commitment`, `NotAchieved` and the id of a team session
- **THEN** the system returns `201` with `kind = Attitude`, `attitudeLabel = "Implicación en tareas defensivas"`, the session linked and no Subprincipio

#### Scenario: Unknown attitude key
- **WHEN** the `attitudeKey` is not in the catalog
- **THEN** the system returns a `400` `ValidationProblemDetails` response

#### Scenario: Mixed fields rejected
- **WHEN** `kind = Attitude` comes with a `subprincipioId`, or `kind = GameModel` comes without `subprincipioId`
- **THEN** the system returns a `400` `ValidationProblemDetails` response

#### Scenario: List mixes both kinds
- **WHEN** a player has a game-model observation and an attitude observation
- **THEN** the list returns both, the attitude one with its `attitudeLabel` and null Subprincipio labels

### Requirement: The session form includes an attitude section
The session evaluation form SHALL show, after the Subprincipio blocks, an «Actitud» section with one block per attitude trait in catalog order, each with «Lo hace» / «A veces» / «No lo hace» and an optional comment. Assessed traits SHALL be saved as attitude observations with the session date and session id; unassessed traits SHALL not be saved. When the player did not attend, the comment SHALL be mandatory for assessed traits too. The attitude section and «Guardar» SHALL be available even when the session has no associated Subprincipios.

#### Scenario: Save attitude from the session
- **WHEN** the coach marks «Implicación en tareas defensivas» as «No lo hace» with comment «Pregunta si vamos a hacer eso todo el entreno» and saves
- **THEN** a request is sent with `kind = Attitude`, `attitudeKey = defensive-commitment`, the session date, the comment and the session id

#### Scenario: Attitude mandatory comment when absent
- **WHEN** the player did not attend and the coach assesses «Paciencia con balón» without comment
- **THEN** «Guardar» is disabled and the comment asks for the reason

#### Scenario: Session without Subprincipios
- **WHEN** the selected session has no targets
- **THEN** the form says it has no associated Subprincipios but still shows the «Actitud» section and «Guardar»

### Requirement: Attitude observations are shown as such
Observation cards of kind `Attitude` SHALL show «Actitud» as context and the trait label as title, and the delete confirmation SHALL name the trait.

#### Scenario: Attitude card
- **WHEN** the list contains an attitude observation of «Valentía en los duelos»
- **THEN** its card shows «Actitud» and «Valentía en los duelos»

