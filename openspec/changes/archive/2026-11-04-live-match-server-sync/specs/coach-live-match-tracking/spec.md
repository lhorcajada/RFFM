## MODIFIED Requirements

### Requirement: Reduced formations after an expulsion
The live match tracker SHALL provide formations for 10, 9, 8, and 7 players, each with exactly
one goalkeeper. When an own-team player is expelled, a default formation for the new number of
on-field players SHALL be applied at that moment, the remaining on-field players SHALL be
placed in its positions, and a formation change SHALL be recorded in the formation-change
history. The formation selector SHALL offer only formations for the number of players the team
is allowed to field (11 minus the currently expelled players), and the coach SHALL be able to
switch to another one through the existing confirmation. Removing a card SHALL NOT move any
player or change the formation by itself.

#### Scenario: First expulsion from an 11-player formation
- **WHEN** a field player is expelled while the team plays 4-4-2
- **THEN** the field shows 10 positions, all occupied, with a 10-player formation applied and no empty position

#### Scenario: Formation selector after an expulsion
- **WHEN** one own-team player is expelled
- **THEN** the formation selector lists only 10-player formations

#### Scenario: Card removed after a mistaken expulsion
- **WHEN** the coach removes the red card that expelled a player while the team has 10 on-field players
- **THEN** the field keeps its 10-player formation, the formation selector lists the 11-player formations, and the player can be brought back on through "preparar cambio"

#### Scenario: Filling an empty position does not use a substitution window
- **WHEN** the coach confirms a "preparar cambio" in which a player enters an empty position and nobody leaves the field
- **THEN** the number of used substitution windows is unchanged

#### Scenario: Successive expulsions
- **WHEN** a second own-team player is expelled while the team has 10 players
- **THEN** a 9-player formation is applied with all 9 positions occupied

#### Scenario: Current formation survives a reload
- **WHEN** the page is reloaded mid-match after an expulsion
- **THEN** the field shows the reduced formation that was in use, restored from the server state, not the starting formation, and no recovery prompt is shown

### Requirement: Match data is saved automatically when the match ends
The live match tracker SHALL save the match participation data as soon as the match is
finished, without a save button or a save confirmation. For a match with server state, the
backend SHALL convert the live state into the match participation as part of finishing the
match, and the frontend SHALL NOT send a separate final save. If finishing fails, an error
SHALL be shown together with an action to retry it. Deleting the saved match data and the
post-match manual edit SHALL remain available.

#### Scenario: Ending the match saves it
- **WHEN** the coach confirms "Finalizar partido"
- **THEN** the match participation is saved without any further action and the saved-match banner is shown

#### Scenario: Frontend does not post the final participation
- **WHEN** the coach finishes a match with server state
- **THEN** the participation is created by the backend and the frontend sends no final match participation save

#### Scenario: Save fails
- **WHEN** finishing the match fails
- **THEN** an error message is shown with a retry action and no data is lost from the screen

#### Scenario: No manual save button
- **WHEN** the match is finished
- **THEN** no "Guardar datos del partido" button is shown
