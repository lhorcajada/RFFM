## ADDED Requirements

### Requirement: The player file has a «Seguimiento» tab for the technical staff
The Coach web player detail page SHALL show a «Seguimiento» tab after all existing tabs only when the user has access to the `GameModel` feature route. Existing tabs SHALL keep their positions.

#### Scenario: Tab visible with GameModel access
- **WHEN** a user with access to the `GameModel` feature opens a player file
- **THEN** the tabs end with «Lesiones», «Seguimiento» and selecting «Seguimiento» shows the tracking panel for that team and player

#### Scenario: Tab hidden without GameModel access
- **WHEN** a user without access to the `GameModel` feature (e.g. a Player) opens a player file
- **THEN** the «Seguimiento» tab is not rendered

### Requirement: Coaches register observations from the tracking tab
The tracking panel SHALL offer a form with a Subprincipio of the team's game model for the active season (grouped by «Fase › Principio»), a date defaulting to today that cannot be in the future, an assessment chosen among «Lo hace», «A veces» and «No lo hace», and an optional comment of at most 500 characters. «Guardar» SHALL be disabled until a Subprincipio and an assessment are chosen. Saving SHALL call `POST /api/teams/{teamId}/players/{teamPlayerId}/observations`, notify the result through `rffm.show_snackbar`, add the observation to the list, clear Subprincipio, assessment and comment, and keep the date.

#### Scenario: Save an observation
- **WHEN** the coach selects Subprincipio «2.3 Circular para desordenar», «No lo hace» and writes a comment, then clicks «Guardar»
- **THEN** the API receives the Subprincipio id, `NotAchieved`, today's date and the comment, a success snackbar «Observación guardada» is dispatched and the observation appears first in the list

#### Scenario: Save disabled until complete
- **WHEN** no Subprincipio or no assessment is selected
- **THEN** «Guardar» is disabled

#### Scenario: Date kept for chaining observations
- **WHEN** the coach changes the date, saves an observation and starts another one
- **THEN** the date field keeps the chosen date while Subprincipio, assessment and comment are empty

#### Scenario: Save error
- **WHEN** the API rejects the observation
- **THEN** an error snackbar is dispatched with the ProblemDetails `detail` or «No se pudo guardar la observación» and the form keeps its values

#### Scenario: Team without game model
- **WHEN** the team has no game model for the active season
- **THEN** an informative message is shown instead of the form and the list is still shown

### Requirement: Coaches see the player's observations as cards
The tracking panel SHALL list the player's observations as cards (no tables), most recent first, each showing the date (`dd/MM/yyyy`), the assessment label, «Fase · Principio», the Subprincipio label and the comment. It SHALL show a loading indicator, an error message with «Reintentar», and «Aún no hay observaciones para este jugador» when empty, and SHALL be usable at ~360 px width.

#### Scenario: Observations listed
- **WHEN** the player has an observation of 14/10/2026 with «No lo hace» on «2.3 Circular para desordenar»
- **THEN** a card shows «14/10/2026», «No lo hace», «Ataque organizado · 2. Ataque posicional», «2.3 Circular para desordenar» and the comment

#### Scenario: Empty list
- **WHEN** the player has no observations
- **THEN** «Aún no hay observaciones para este jugador» is shown

#### Scenario: Load error and retry
- **WHEN** loading the observations fails and the coach clicks «Reintentar»
- **THEN** the observations are requested again
