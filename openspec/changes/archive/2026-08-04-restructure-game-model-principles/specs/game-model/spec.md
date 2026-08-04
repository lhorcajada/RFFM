## ADDED Requirements

### Requirement: Scenarios are grouped under a Principio within each moment/zone cell
The system SHALL introduce a `GamePrinciple` (Principio) level between the Momento de Juego × Zona de Juego cell and `GameScenario`. Each `GamePrinciple` SHALL have a `Title` and a `Description`, belong to exactly one Momento de Juego and Zona de Juego, and contain zero or more `GameScenario`s. A Coach with access to the team SHALL be able to create, edit, and delete `GamePrinciple`s within a moment/zone cell, and create, edit, and delete `GameScenario`s within a `GamePrinciple`, via the existing `POST /api/game-models` / `PUT /api/game-models/{id}` full-model save.

#### Scenario: Coach creates a principle with scenarios in a moment/zone cell
- **WHEN** a Coach saves a game model with a new `GamePrinciple` (title, description) containing one or more new scenarios under a given moment/zone
- **THEN** the principle and its scenarios are persisted, associated with that moment/zone

#### Scenario: Coach edits a principle's title and description
- **WHEN** a Coach saves a game model with changes to an existing principle's `Title` and/or `Description`
- **THEN** the principle is updated in place and its scenarios are unaffected

#### Scenario: Coach deletes a principle
- **WHEN** a Coach saves a game model that no longer includes a previously-existing principle
- **THEN** the principle and all of its scenarios (with their sub-principles, sub-sub-principles, and essential skills) are removed

### Requirement: Existing scenarios are migrated into one generated principle each
The system SHALL, as part of introducing the `GamePrinciple` level, create exactly one `GamePrinciple` per pre-existing `GameScenario`, in the same moment/zone as the scenario, with `Title` set to the scenario's current name and an empty `Description`. No existing scenario, sub-principle, sub-sub-principle, essential skill, or media reference SHALL be lost or reparented incorrectly by this migration.

#### Scenario: Pre-existing scenario is wrapped in a generated principle
- **WHEN** the migration runs against a game model that has an existing scenario "Escenario 1: El rival juega por bandas" in Defensa Organizada / Zona de Iniciación
- **THEN** a new `GamePrinciple` with `Title` = "Escenario 1: El rival juega por bandas", empty `Description`, in Defensa Organizada / Zona de Iniciación is created, and the scenario is reparented under it as its only scenario

## MODIFIED Requirements

### Requirement: Coach can move a game scenario to a different moment/zone with an atomic, immediate save
The system SHALL let an authenticated Coach reclassify an existing `GameScenario` into a different `GamePrinciple` from the game-model edit view, via `PATCH /api/game-models/scenarios/{scenarioId}/location`, persisting the change immediately without requiring the general "Guardar cambios" action. The target principle SHALL belong to the same `GameModel` as the scenario. The scenario's nested content (sub-principles, sub-sub-principles, essential skills, media) SHALL remain unchanged — only its owning principle and ordering are affected. The scenario is appended to the end of the target principle's scenarios, and the scenarios remaining in the source principle are renumbered to stay contiguous.

#### Scenario: Coach moves an already-saved scenario to a different principle
- **WHEN** a Coach with access to the team selects a different principle (in the same game model) for a persisted scenario (has a backend id) and confirms the move
- **THEN** the app calls `PATCH /api/game-models/scenarios/{scenarioId}/location` with the target principle id, the scenario's `GamePrincipleId` is updated, it is placed after the existing scenarios of the target principle, and all of its sub-principles, sub-sub-principles and essential skills remain associated and unchanged

#### Scenario: Remaining scenarios in the source principle are renumbered
- **WHEN** a scenario is moved out of a principle that had other scenarios after it in order
- **THEN** the scenarios left behind in that principle are renumbered to a contiguous `1..N` sequence

#### Scenario: Moving to the same principle is a no-op
- **WHEN** the requested target principle is identical to the scenario's current principle
- **THEN** the scenario's order is left unchanged and no sibling scenarios are renumbered

#### Scenario: Coach moves a scenario not yet saved to the backend
- **WHEN** a Coach selects a different principle for a scenario that only exists in the local draft (not yet persisted)
- **THEN** the app updates the local draft to reflect the new principle without calling the move endpoint

#### Scenario: User without access to the team cannot move a scenario
- **WHEN** an authenticated user without a `UserClub` link to the scenario's team's club calls the move endpoint
- **THEN** the API returns an access-denied error and the scenario is not modified

#### Scenario: Move to a principle in a different game model is rejected
- **WHEN** the requested target `GamePrincipleId` belongs to a different `GameModel` than the scenario's
- **THEN** the API returns a not-found/validation error and the scenario is not modified

#### Scenario: Move fails gracefully in the UI
- **WHEN** the move API call fails
- **THEN** the Coach app shows an error notification and the local draft keeps the scenario in its original principle

<!--
Note: the pre-existing "Principios tácticos colectivos" scenario selector was never captured
in openspec/specs/game-model/spec.md (only the move-scenario requirement was tracked there),
so there is nothing for the archiver to remove from the canonical spec. Its removal —
ScenarioTacticalPrinciple/TacticalGoalsEnum tables dropped, GET /api/technical-goals removed,
no replacement field — is documented in this change's proposal.md "What Changes"/"Impact"
sections instead.
-->
