## ADDED Requirements

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
