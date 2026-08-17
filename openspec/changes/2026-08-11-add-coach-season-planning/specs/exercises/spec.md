## ADDED Requirements

### Requirement: Exercise can optionally link to a Microciclo
An `Exercise` (`TaskTrainingBase`) SHALL optionally reference one `Microciclo` from the team's season plan. This link is independent of, and does not replace, the ADN game-model (that linkage was removed entirely by a prior change and is not reintroduced here).

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
