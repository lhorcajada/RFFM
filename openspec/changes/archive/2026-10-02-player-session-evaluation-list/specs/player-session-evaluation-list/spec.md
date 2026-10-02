## ADDED Requirements

### Requirement: The API lists the season sessions with the player's attendance and evaluation status
The system SHALL expose `GET /api/teams/{teamId}/players/{teamPlayerId}/session-evaluations` returning the team's training sessions that have a date, most recent first, each with `sessionId`, `name`, `date`, `isHeld` (date not after today), `hasCalendarEvent`, the player's `assistanceTypeId` for the session's calendar event (or `null`) and, when the player has an evaluation for that session, its summary with the number of `Achieved`, `Partial` and `NotAchieved` items and `updatedAt`. It SHALL require the Coach role, the `GameModel` read permission and team membership.

#### Scenario: Sessions with attendance and status
- **WHEN** the team has a past session the player attended and evaluated (two `NotAchieved`, one `Partial`) and another past session the player missed without excuse and was not evaluated
- **THEN** the list returns both, the first with `assistanceTypeId = 1` and summary `notAchieved = 2`, `partial = 1`, the second with `assistanceTypeId = 3` and no evaluation

#### Scenario: Future session
- **WHEN** the team has a session dated after today
- **THEN** it is listed with `isHeld = false`

#### Scenario: Sessions without date are excluded
- **WHEN** the team has an unscheduled session
- **THEN** it is not listed

#### Scenario: Player of another team
- **WHEN** `teamPlayerId` does not belong to `teamId`
- **THEN** the system returns `404`

### Requirement: The tracking tab is a list of sessions
The «Seguimiento» tab SHALL show the season sessions as cards with date, name, the player's attendance («Asistió», «No asistió (con excusa)», «No asistió (sin excusa)», «Llegó tarde», «Sin registrar», «Sin evento») and status («Sin valorar», or «Valorado» with the counts per assessment). Past sessions without evaluation SHALL offer «Crear», sessions with evaluation SHALL offer «Editar» and «Eliminar», and future sessions SHALL show «Aún no se ha celebrado» without actions. A «Nuevo seguimiento» button SHALL open the evaluation dialog with a session selector listing held sessions without evaluation.

#### Scenario: Card of an evaluated session
- **WHEN** a session was evaluated with two «No lo hace» and one «A veces» and the player attended
- **THEN** its card shows «Asistió», «Valorado» with the counts, «Editar» and «Eliminar»

#### Scenario: Future session card
- **WHEN** a session has not been held yet
- **THEN** its card shows «Aún no se ha celebrado» and no «Crear»

#### Scenario: Delete asks for confirmation
- **WHEN** the coach clicks «Eliminar» and confirms
- **THEN** the evaluation is deleted, the card shows «Sin valorar» and «Seguimiento eliminado» is dispatched

### Requirement: Coaches create and edit a session evaluation in a dialog
The evaluation dialog SHALL show the session date and name, the attendance notice, the session objective and exercises (name, objective and duration) and one block per Subprincipio targeted by the session with «Lo hace» / «A veces» / «No lo hace» and a comment, pre-filled when editing. When the player did not attend, the comment SHALL be mandatory for assessed blocks. «Guardar» SHALL be enabled when at least one block is assessed and SHALL send a single `PUT` with the assessed blocks; on success the dialog closes, the list reloads and «Seguimiento guardado» is dispatched.

#### Scenario: Create from a card
- **WHEN** the coach clicks «Crear» on a session, rates «Circular para desordenar» as «No lo hace» and saves
- **THEN** a `PUT` is sent for that session with that item and the card shows «Valorado»

#### Scenario: Edit pre-fills
- **WHEN** the coach clicks «Editar» on an evaluated session
- **THEN** the blocks show the saved assessments and comments

#### Scenario: Exercises are shown
- **WHEN** the session has exercise «Rondo 4x4+3» with objective «Circular con paciencia» and 15 minutes
- **THEN** the dialog shows «Rondo 4x4+3» and «Circular con paciencia · 15'»

#### Scenario: Mandatory comment when absent
- **WHEN** the player did not attend and a block is rated without comment
- **THEN** «Guardar» is disabled
