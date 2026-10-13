# squad-rating-sheets Specification

## Purpose
TBD - created by archiving change squad-rating-sheets. Update Purpose after archive.
## Requirements
### Requirement: Batch creation of team ratings
The system SHALL expose `POST /api/catalog/team/{teamId}/ratings`, restricted to Coach and Administrator roles, with body `{ ratedAt?, ratings: [{ teamPlayerId, isGoalkeeper, answers: [{ characteristicKey, categoryKey, level, concept }], notes? }] }`. It SHALL create one new conceptual rating per item, all with the same `ratedAt` (the current time when omitted), and return the created ratings with the same shape as `GET /api/catalog/team/{teamId}/ratings/latest`. The operation SHALL be atomic: when any item is invalid, no rating is created. Existing ratings SHALL NOT be modified.

#### Scenario: Ratings created for several players
- **WHEN** a coach of the team sends two items for two players of that team with `ratedAt` 2026-10-13
- **THEN** two new ratings are created, both dated 2026-10-13, with category averages computed from their answers, and both are returned

#### Scenario: Notes are stored per player
- **WHEN** an item includes `notes` «Mejora en el pase»
- **THEN** the rating created for that player has those notes

#### Scenario: Previous ratings are kept
- **WHEN** a player that already has a rating is included in the batch
- **THEN** the player has two ratings and the previous one is unchanged

#### Scenario: Player from another team rejected
- **WHEN** the batch includes a `teamPlayerId` that does not belong to `teamId`
- **THEN** the system returns `400` ProblemDetails with code `RatingPlayerNotInTeam` and no rating is created

#### Scenario: Unknown team
- **WHEN** `teamId` does not exist
- **THEN** the system returns `404`

#### Scenario: Coach of another team rejected
- **WHEN** a coach that cannot manage the team sends a batch
- **THEN** the system returns `403` and no rating is created

### Requirement: Batch validation
The system SHALL reject the batch with `400` ProblemDetails when `ratings` is empty or has more than 100 items, when a `teamPlayerId` is empty or repeated, when an item has no answers, when an answer has an empty `characteristicKey`, `categoryKey` or `concept`, when a `level` is outside 1–10, or when a `characteristicKey` is repeated within the same item.

#### Scenario: Empty batch
- **WHEN** `ratings` is empty
- **THEN** the system returns `400`

#### Scenario: Repeated player
- **WHEN** the same `teamPlayerId` appears twice
- **THEN** the system returns `400`

#### Scenario: Level out of range
- **WHEN** an answer has level 11
- **THEN** the system returns `400`

#### Scenario: Repeated characteristic
- **WHEN** an item has two answers for `physicalSpeed`
- **THEN** the system returns `400`

### Requirement: Rating sheet page
The Coach app SHALL provide a page at `/coach/squad/rating-sheet` (preserving `teamId` and `seasonId` query params) with two sheets, «Jugadores» and «Porteros». Each sheet SHALL list its characteristics grouped by category and, for the selected characteristic, show the 10 levels with their concept text and the players placed in each level, plus a «Sin colocar» tray with the players that have no level for that characteristic. Goalkeepers SHALL only appear in the «Porteros» sheet and field players only in «Jugadores». The sheet SHALL start from each player's latest rating, ignoring answers whose characteristic does not belong to the sheet. The page SHALL be usable from 360px wide without tables or horizontal scrolling.

#### Scenario: Players start in their latest level
- **WHEN** a field player's latest rating has level 7 for «Velocidad» and the coach opens the «Jugadores» sheet on «Velocidad»
- **THEN** the player appears in level 7

#### Scenario: Unrated player starts unplaced
- **WHEN** a player has no rating
- **THEN** the player appears in «Sin colocar» for every characteristic

#### Scenario: Goalkeepers are in their own sheet
- **WHEN** the team has a goalkeeper and the coach opens the «Jugadores» sheet
- **THEN** the goalkeeper is not shown, and is shown after switching to «Porteros»

#### Scenario: Progress per characteristic
- **WHEN** 2 of the 3 players of the sheet have a level for a characteristic
- **THEN** that characteristic shows «2/3»

### Requirement: Placing players by tapping
A Coach or Administrator SHALL place players by selecting one or more player chips and then selecting a level; the selected players move to that level and the selection is cleared. Selecting «Sin colocar» with players selected SHALL remove their level for that characteristic. Selecting an already selected chip SHALL deselect it. Users without the Coach or Administrator role SHALL see the sheet read-only.

#### Scenario: Place one player
- **WHEN** the coach taps an unplaced player and then level 6
- **THEN** the player appears in level 6 and no longer in «Sin colocar»

#### Scenario: Place several players at once
- **WHEN** the coach taps two players and then level 4
- **THEN** both players appear in level 4

#### Scenario: Move back to unplaced
- **WHEN** the coach taps a player placed in level 6 and then «Sin colocar»
- **THEN** the player appears in «Sin colocar»

#### Scenario: Read-only for other roles
- **WHEN** a user without the Coach or Administrator role opens the page
- **THEN** there is no «Guardar» button and tapping chips changes nothing

### Requirement: Filter by line
The «Jugadores» sheet SHALL offer a line filter with «Todos», «Defensas», «Medios» and «Delanteros». The filter SHALL only change which players are shown; it SHALL NOT change what is saved. The «Porteros» sheet SHALL NOT show the filter.

#### Scenario: Filter defenders
- **WHEN** the coach selects «Defensas»
- **THEN** only defenders are shown in the levels and in «Sin colocar»

### Requirement: Saving the sheets
«Guardar» SHALL send a single batch with one item for each player, of either sheet, whose answers differ from their latest rating and who has a level for every characteristic of their sheet. Each item SHALL carry the player's full set of answers and the notes of their latest rating. All items SHALL share the date chosen on the page (today by default). Players with changes but missing characteristics SHALL be listed in a warning and SHALL NOT be sent. «Guardar» SHALL be disabled when there is no player to save. After a successful save the page SHALL show a success message and take the saved ratings as the new starting point. Leaving the page with unsaved changes SHALL ask for confirmation with the app's confirmation dialog.

#### Scenario: Only changed players are saved
- **WHEN** the coach moves one fully rated player to another level and saves
- **THEN** the batch contains only that player, with all their answers

#### Scenario: Incomplete players are not saved
- **WHEN** the coach places an unrated player in a single characteristic
- **THEN** the page warns that the player is incomplete and «Guardar» does not include them

#### Scenario: Nothing to save
- **WHEN** no player has changed
- **THEN** «Guardar» is disabled

#### Scenario: Save failure
- **WHEN** the batch request fails
- **THEN** an error message is shown and the placements are kept

#### Scenario: Leaving with unsaved changes
- **WHEN** the coach taps «Volver» with unsaved changes
- **THEN** a confirmation dialog is shown before leaving

### Requirement: Entry point from the squad ratings tab
The «Valoraciones» tab of the squad page SHALL show a «Valorar plantilla» button that opens the rating sheet page, only when the tab is not read-only.

#### Scenario: Coach sees the button
- **WHEN** a coach opens the «Valoraciones» tab
- **THEN** «Valorar plantilla» is shown

#### Scenario: Player does not see the button
- **WHEN** a player or family member opens the «Valoraciones» tab
- **THEN** «Valorar plantilla» is not shown

