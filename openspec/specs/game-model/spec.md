## Requirements

### Requirement: Coach can move a game scenario to a different moment/zone with an atomic, immediate save
The system SHALL let an authenticated Coach reclassify an existing `GameScenario` into a different Momento de Juego and/or Zona de Juego from the game-model edit view, via `PATCH /api/game-models/scenarios/{scenarioId}/location`, persisting the change immediately without requiring the general "Guardar cambios" action. The scenario's nested content (tactical principles, sub-principles, sub-sub-principles, essential skills, media) SHALL remain unchanged — only its moment, zone, and ordering are affected. The scenario is appended to the end of the target moment/zone, and the scenarios remaining in the source moment/zone are renumbered to stay contiguous.

#### Scenario: Coach moves an already-saved scenario to a different moment and zone
- **WHEN** a Coach with access to the team selects a new Momento de Juego and Zona de Juego for a persisted scenario (has a backend id) and confirms the move
- **THEN** the app calls `PATCH /api/game-models/scenarios/{scenarioId}/location` with the target ids, the scenario's `GameMomentId`/`GameZoneId` are updated, it is placed after the existing scenarios of the target moment/zone, and all of its tactical principles, sub-principles, sub-sub-principles and essential skills remain associated and unchanged

#### Scenario: Remaining scenarios in the source moment/zone are renumbered
- **WHEN** a scenario is moved out of a moment/zone that had other scenarios after it in order
- **THEN** the scenarios left behind in that moment/zone are renumbered to a contiguous `1..N` sequence

#### Scenario: Moving to the same moment/zone is a no-op
- **WHEN** the requested target moment/zone is identical to the scenario's current moment/zone
- **THEN** the scenario's order is left unchanged and no sibling scenarios are renumbered

#### Scenario: Coach moves a scenario not yet saved to the backend
- **WHEN** a Coach selects a new moment/zone for a scenario that only exists in the local draft (not yet persisted)
- **THEN** the app updates the local draft to reflect the new moment/zone without calling the move endpoint

#### Scenario: User without access to the team cannot move a scenario
- **WHEN** an authenticated user without a `UserClub` link to the scenario's team's club calls the move endpoint
- **THEN** the API returns an access-denied error and the scenario is not modified

#### Scenario: Move fails gracefully in the UI
- **WHEN** the move API call fails
- **THEN** the Coach app shows an error notification and the local draft keeps the scenario in its original moment/zone
