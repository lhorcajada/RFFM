# player-tracking-edit-delete Specification

## Purpose
TBD - created by archiving change player-tracking-edit-delete. Update Purpose after archive.
## Requirements
### Requirement: Coaches can correct an observation
The system SHALL expose `PUT /api/teams/{teamId}/players/{teamPlayerId}/observations/{observationId}` to change the `assessment` (`Achieved`, `Partial` or `NotAchieved`) and the optional `comment` (at most 500 characters) of an observation of that player and team, returning `200` with the updated observation. Date, Subprincipio, session and kind SHALL NOT change. It SHALL require the `GameModel` `ReadWrite` feature permission and team membership.

#### Scenario: Update assessment and comment
- **WHEN** a coach changes an observation from «No lo hace» to «A veces» with comment «Mejora tras la charla»
- **THEN** the system returns `200` with `assessment = Partial`, the new comment and the same date, Subprincipio and session

#### Scenario: Observation of another player
- **WHEN** the observation exists but belongs to another player or team
- **THEN** the system returns a `404` `ProblemDetails` response and nothing changes

#### Scenario: Invalid input
- **WHEN** the assessment is unknown or the comment exceeds 500 characters
- **THEN** the system returns a `400` `ValidationProblemDetails` response

### Requirement: Coaches can delete an observation
The system SHALL expose `DELETE /api/teams/{teamId}/players/{teamPlayerId}/observations/{observationId}` returning `204` after removing the observation, and `404` when it does not exist for that player and team. It SHALL require the `GameModel` `ReadWrite` feature permission and team membership.

#### Scenario: Delete an observation
- **WHEN** a coach deletes an observation of the player
- **THEN** the system returns `204` and the observation is no longer listed

#### Scenario: Unknown observation
- **WHEN** the observation does not exist for that player and team
- **THEN** the system returns a `404` `ProblemDetails` response

### Requirement: Observation cards can be edited and deleted
Each observation card in the «Seguimiento» tab SHALL offer «Editar observación» and «Eliminar observación». Editing SHALL happen in place with the assessment buttons and the comment pre-filled, «Guardar» and «Cancelar»; saving SHALL update the card and dispatch «Observación actualizada», and a failure SHALL keep the card in edit mode and dispatch an error. Deleting SHALL ask for confirmation with `ConfirmDialog` and only delete after confirming, removing the card and dispatching «Observación eliminada».

#### Scenario: Edit in place
- **WHEN** the coach clicks «Editar observación», selects «A veces», changes the comment and clicks «Guardar»
- **THEN** the card shows «A veces» and the new comment and a success snackbar «Observación actualizada» is dispatched

#### Scenario: Cancel editing
- **WHEN** the coach edits and clicks «Cancelar»
- **THEN** the card shows the original values and no request is sent

#### Scenario: Delete asks for confirmation
- **WHEN** the coach clicks «Eliminar observación»
- **THEN** a confirmation dialog «Eliminar observación» is shown and nothing is deleted until «Eliminar» is clicked

#### Scenario: Delete confirmed
- **WHEN** the coach confirms the deletion
- **THEN** the card disappears and «Observación eliminada» is dispatched

#### Scenario: Delete cancelled
- **WHEN** the coach cancels the confirmation dialog
- **THEN** no request is sent and the card remains

