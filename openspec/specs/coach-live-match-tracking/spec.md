# coach-live-match-tracking Specification

## Purpose
TBD - created by archiving change live-match-tracking-enhancements. Update Purpose after archive.
## Requirements
### Requirement: Mid-match formation changes with confirmation and position history
The live match tracker SHALL allow the coach to change the tactical formation at any point
during `firstHalf`, `halftime`, or `secondHalf`, requiring explicit confirmation before
applying the change, and SHALL persist a chronological history of formation changes
(minute, half, formation, and resulting slot assignment) so which position each player
occupied over time can be derived.

#### Scenario: Formation change requires confirmation
- **WHEN** the coach selects a different formation while the match is running
- **THEN** a confirmation dialog is shown before the formation is applied

#### Scenario: Confirmed formation change is recorded
- **WHEN** the coach confirms a formation change at minute 60 of the second half
- **THEN** a `FormationChangeEvent` with `minute: 60`, `half: 2`, the new formation id/name,
  and the resulting slot map is added to the match's formation-change history

#### Scenario: Canceled formation change leaves the match untouched
- **WHEN** the coach opens the formation-change confirmation dialog and cancels it
- **THEN** the current formation, slots, and player states remain unchanged and no
  `FormationChangeEvent` is recorded

### Requirement: Unlimited substitution windows on friendly matches
The live match tracker SHALL NOT enforce the substitution-window quota (4 total / 3 in the
second half) when the sport event's match category is "Friendly"; all other match categories
SHALL keep the existing quota.

#### Scenario: Friendly match allows more than 4 substitution windows
- **GIVEN** the current sport event has `matchCategory: "Friendly"`
- **WHEN** the coach has already opened 4 substitution windows in the match
- **THEN** the coach can still open another substitution window

#### Scenario: Non-friendly match keeps the existing quota
- **GIVEN** the current sport event does not have `matchCategory: "Friendly"`
- **WHEN** the coach has already opened 4 substitution windows in the match
- **THEN** the coach cannot open another substitution window outside halftime

### Requirement: Goal pitch-zone selection
When registering a goal, the coach SHALL be able to select the pitch cell the goal was
scored from, out of a 5-column (pitch width) by 10-row (pitch length, covering both halves)
grid of unnamed cells.

#### Scenario: Goal records the selected pitch cell
- **WHEN** the coach registers a goal and selects column 2, row 7 on the pitch grid
- **THEN** the resulting goal event has `pitchZone: { col: 2, row: 7 }`

#### Scenario: Grid cells carry no names
- **WHEN** the pitch-zone grid is rendered
- **THEN** none of its 50 cells display an identifying name or label

### Requirement: Goal body-part selection
When registering a goal, the coach SHALL be able to indicate whether it was scored with the
head or with the foot.

#### Scenario: Goal records body part
- **WHEN** the coach registers a goal and selects "cabeza"
- **THEN** the resulting goal event has `bodyPart: "head"`

### Requirement: Visitor-team goal dorsal
When registering a goal for the rival/visitor team, the coach SHALL be able to enter the
scoring player's shirt number as free text, since no rival player roster exists.

#### Scenario: Rival goal records a dorsal
- **WHEN** the coach registers a rival goal and enters dorsal `9`
- **THEN** the resulting goal event has `scorerDorsal: 9` and `isOwnTeam: false`

### Requirement: Card (amonestación) registration with minute and match half
The live match tracker SHALL allow registering a yellow or red card for a player, capturing
the match minute and the half (first or second) in which it occurred. Extra time and
penalties are not supported as match halves.

#### Scenario: Card records minute and half
- **WHEN** the coach registers a yellow card at minute 30 of the first half for an own-team
  player
- **THEN** the resulting card event has `minute: 30`, `half: 1`, `cardType: "yellow"`

#### Scenario: Saved cards are retrievable
- **WHEN** a match with registered cards is saved and later fetched via the match
  participation endpoint
- **THEN** the same card events (including minute and half) are returned

### Requirement: Rival card dorsal
When registering a card for a rival player, the coach SHALL be able to enter that player's
shirt number as free text instead of selecting from a roster.

#### Scenario: Rival card records a dorsal
- **WHEN** the coach registers a red card for a rival player and enters dorsal `4`
- **THEN** the resulting card event has `isRivalPlayer: true`, `rivalDorsal: 4`,
  `teamPlayerId: null`

### Requirement: Zero-minute players show why they didn't play
The live-match and match-preparation rosters (bench and on-field lists) SHALL display a status badge instead of a bare placeholder for a player with 0 accrued minutes when their convocation carries a non-attendance `AssistanceTypeId`: "No asistió" for `UnexcusedAbsence`, "No asistió (justificado)" for `ExcusedAbsence`, or "Llegó tarde" for `LateArrival`. When the convocation also carries an `ExcuseTypeId`, the resolved reason name SHALL be shown alongside the badge (as label text or a tooltip). A player with no such convocation state (never called, or `Attendance`) SHALL keep showing the existing bare placeholder.

#### Scenario: Unexcused absence shows a badge with no reason
- **GIVEN** an accepted player with 0 minutes and convocation `AssistanceTypeId = UnexcusedAbsence`,
  no `ExcuseTypeId`
- **WHEN** the coach views the bench list in the live-match or preparation view
- **THEN** the player's minutes cell shows "No asistió" instead of a bare placeholder

#### Scenario: Excused absence shows a badge with the reason
- **GIVEN** an accepted player with 0 minutes and convocation `AssistanceTypeId = ExcusedAbsence`,
  `ExcuseTypeId` resolving to "Lesión"
- **WHEN** the coach views the bench list
- **THEN** the player's minutes cell shows "No asistió (justificado)" with "Lesión" shown as the
  reason

#### Scenario: Late arrival shows a badge with the reason
- **GIVEN** an accepted player with 0 minutes and convocation `AssistanceTypeId = LateArrival`,
  `ExcuseTypeId` resolving to a catalog reason
- **WHEN** the coach views the bench list
- **THEN** the player's minutes cell shows "Llegó tarde" with the reason shown

#### Scenario: Normal not-yet-used substitute keeps the existing placeholder
- **GIVEN** an accepted player with 0 minutes and convocation `AssistanceTypeId = Attendance` (or no
  assistance recorded yet)
- **WHEN** the coach views the bench list
- **THEN** the player's minutes cell shows the existing bare placeholder, unchanged

### Requirement: Own-team expulsion removes the player from the field
While the match is in `firstHalf`, `halftime`, or `secondHalf`, the live match tracker SHALL
treat an own-team player as expelled when they receive a red card or their second yellow card.
An expelled on-field player SHALL be moved to the bench at the card's minute, their played
minutes SHALL stop accumulating, and the expulsion SHALL NOT consume a substitution window. A
second yellow card SHALL be stored as a yellow card event; no red card event is added for it.
Card statistics SHALL count two yellow cards of the same player in one match as one red card
and no yellow cards.

#### Scenario: Direct red card
- **WHEN** the coach registers a red card at minute 30 for an own-team player who is on the field
- **THEN** the player leaves the field, appears on the bench, and their minutes stay at the value they had at minute 30

#### Scenario: Second yellow card
- **WHEN** an own-team player who already has one yellow card receives another yellow card
- **THEN** the player is expelled exactly as with a red card and the card list holds two yellow cards and no red card for that player

#### Scenario: Double yellow in the statistics
- **WHEN** a saved match holds two yellow cards for the same own-team player
- **THEN** that match contributes one red card and zero yellow cards to the player's statistics and to the yellow-card accumulation cycle

#### Scenario: Expulsion does not use a substitution window
- **WHEN** a player is expelled in a match with the substitution-window quota enforced
- **THEN** the number of used substitution windows is unchanged

#### Scenario: Rival red card
- **WHEN** the coach registers a red card for a rival player
- **THEN** the own team's field, bench, and formation are unchanged

### Requirement: Expelled players cannot return to the field
An expelled player SHALL remain visible on the bench and SHALL NOT be placeable on the field
for the rest of the match, neither in "preparar cambio" nor through a formation change.

#### Scenario: Expelled player is not draggable
- **WHEN** the coach opens "preparar cambio" after an expulsion
- **THEN** the expelled player's bench card is shown but cannot be dragged onto the field

### Requirement: Card indicators on the player photo
The live match tracker SHALL show, on the player's photo both on the field and on the bench, a
yellow card indicator for a player with one yellow card, a red card indicator for a player
with a direct red card, and a yellow card plus a red card indicator for a player expelled by a
second yellow card.

#### Scenario: Booked player on the field
- **WHEN** an on-field own-team player has one yellow card
- **THEN** their field card shows a yellow card indicator

#### Scenario: Player expelled by double yellow
- **WHEN** a player has been expelled by a second yellow card
- **THEN** their bench card shows both a yellow and a red card indicator

#### Scenario: Player expelled by direct red
- **WHEN** a player has been expelled by a direct red card and had no yellow card
- **THEN** their bench card shows only a red card indicator

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
- **WHEN** the page is reloaded mid-match after an expulsion and the coach accepts the recovered match
- **THEN** the field shows the reduced formation that was in use, not the starting formation

### Requirement: The goalkeeper position is always occupied
After an expulsion the goalkeeper position of the applied formation SHALL be occupied. If the
expelled player was the goalkeeper, a randomly chosen remaining on-field player SHALL be placed
in the goalkeeper position until the coach changes it.

#### Scenario: Goalkeeper expelled
- **WHEN** the player in the goalkeeper position is expelled
- **THEN** the goalkeeper position is occupied by one of the remaining on-field players and the other positions hold the rest

#### Scenario: Field player expelled
- **WHEN** a player who is not in the goalkeeper position is expelled
- **THEN** the same player stays in the goalkeeper position

### Requirement: Match ends when fewer than seven players remain
The live match tracker SHALL ask the coach to confirm ending the match when an expulsion
would leave the own team with fewer than 7 on-field players. On confirmation the card SHALL be
recorded, the match SHALL be finished, and it SHALL be saved with the score at that moment. On
cancellation the card SHALL NOT be recorded and the match SHALL continue unchanged.

#### Scenario: Expulsion leaving six players is confirmed
- **WHEN** the team has 7 on-field players, the coach registers a red card for one of them, and confirms ending the match
- **THEN** the match phase is `finished` and the match is saved with the current score and the red card

#### Scenario: Expulsion leaving six players is canceled
- **WHEN** the team has 7 on-field players, the coach registers a red card for one of them, and cancels the confirmation
- **THEN** no card is recorded and the match keeps running with 7 players

### Requirement: Match data is saved automatically when the match ends
The live match tracker SHALL save the match participation data as soon as the match is
finished, without a save button or a save confirmation. If the save fails, an error SHALL be
shown together with an action to retry it. Deleting the saved match data and the post-match
manual edit SHALL remain available.

#### Scenario: Ending the match saves it
- **WHEN** the coach confirms "Finalizar partido"
- **THEN** the match participation is saved without any further action and the saved-match banner is shown

#### Scenario: Save fails
- **WHEN** the automatic save fails
- **THEN** an error message is shown with a retry action and no data is lost from the screen

#### Scenario: No manual save button
- **WHEN** the match is finished
- **THEN** no "Guardar datos del partido" button is shown

### Requirement: Match event buttons below the bench
The live match tracker SHALL show a section below the bench with the buttons "Gol a favor",
"Gol en contra", "Tarjeta nuestra", and "Tarjeta rival", enabled during `firstHalf`,
`halftime`, and `secondHalf`. The scoreboard SHALL NOT contain goal or card buttons.

#### Scenario: Goal for the own team as visitor
- **WHEN** the own team is the visitor and the coach registers a goal with "Gol a favor"
- **THEN** the visitor score increases by one

#### Scenario: Rival card button
- **WHEN** the coach presses "Tarjeta rival"
- **THEN** the card dialog opens to register a rival card by dorsal, without the own-team player list

#### Scenario: Buttons disabled before kick-off
- **WHEN** the match phase is `preMatch`
- **THEN** the four buttons are disabled

