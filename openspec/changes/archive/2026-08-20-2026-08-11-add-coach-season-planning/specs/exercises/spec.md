## ADDED Requirements

### Requirement: Exercise can optionally link to a Microciclo
An `Exercise` (`TaskTrainingBase`) SHALL optionally reference one `Microciclo` from the team's season plan. This link is independent of the exercise's own ADN game-model links (see "Exercise can reference the game model" below) — a Microciclo link says which week an exercise was created for; the exercise's own model links say what it trains, and the two are edited separately.

#### Scenario: Creating an exercise from a Microciclo
- **WHEN** a Coach creates a new exercise from the "Crear ejercicio" action on a Microciclo card in the Planificación tab
- **THEN** the created exercise is linked to that Microciclo

#### Scenario: Creating an exercise without a Microciclo
- **WHEN** a Coach creates a new exercise from the Ejercicios tab without selecting a Microciclo
- **THEN** the exercise is created with no Microciclo link, exactly as before this change

#### Scenario: Linking an existing exercise to a Microciclo
- **WHEN** a Coach edits an existing exercise and selects a Microciclo from the optional selector
- **THEN** the exercise is updated to link to that Microciclo

#### Scenario: Microciclo deleted while exercises are linked to it
- **WHEN** a `SeasonPlan` (or one of its Microciclos) is deleted while one or more `Exercise`s are linked to it
- **THEN** those exercises are preserved, only their Microciclo link is cleared

### Requirement: Exercise can reference the game model

An `Exercise` (`TaskTrainingBase`) SHALL optionally reference one or more nodes of the team's `GameModel` — each link to exactly one `Subprincipio` or `SubSubPrincipio` (never both on the same link), tagged FOCO or INTEGRADO — plus a set of `Habilidad` names drawn from the closed 15-value vocabulary. This reverses the "Exercises and training sessions are independent of the game model" requirement from the archived `game-model-adn-hierarchy` change (see this change's `specs/game-model/spec.md` delta), per explicit direction after the exercise/session content templates (`docs/game-model/Plantilla-Ejercicio.md`) matured to require it.

#### Scenario: Linking an exercise to a Subprincipio
- **WHEN** a Coach editing an exercise selects a `Subprincipio` from the team's `GameModel` and tags it FOCO
- **THEN** the link is saved and shown on the exercise as FOCO

#### Scenario: Linking an exercise to a SubSubPrincipio
- **WHEN** a Coach editing an exercise selects a `SubSubPrincipio` from the team's `GameModel`
- **THEN** the link is saved anchored to that `SubSubPrincipio`, not its parent `Subprincipio`

#### Scenario: Habilidad selection restricted to the closed vocabulary
- **WHEN** a Coach selects Habilidades imprescindibles for an exercise
- **THEN** only the 15-value closed vocabulary is offered, and any value outside it is rejected by the backend

#### Scenario: Team with no GameModel yet
- **WHEN** a Coach edits an exercise for a team with no `GameModel` for that season
- **THEN** the Subprincipio/SubSubPrincipio pickers show an empty state directing the coach to build the ADN first, while the rest of the exercise form remains editable

#### Scenario: Linked Subprincipio or SubSubPrincipio later removed from the GameModel
- **WHEN** a `Subprincipio` or `SubSubPrincipio` referenced by an exercise is removed from the team's `GameModel`
- **THEN** the corresponding link is silently removed from the exercise, without affecting the rest of the exercise's content

#### Scenario: Creating an exercise with no game-model field is no longer the only option
- **WHEN** a Coach creates or edits an exercise
- **THEN** the form has optional fields to select Subprincipio/SubSubPrincipio (with FOCO/INTEGRADO) and Habilidades, and the saved exercise carries these links when set
