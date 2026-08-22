# sessions Specification

## Purpose
TBD - created by archiving change 2026-08-21-session-exercise-plan-redesign.

## Requirements

### Requirement: Training session is a sequence of blocks
A `TrainingSession` SHALL be composed of an ordered, non-empty list of `SessionBlock`s. Each `SessionBlock` SHALL have an `Order`, a `Nombre`, a required `ComoConectaConAnterior` narrative (required even for the first block), an optional `RotacionEntreEjercicios` narrative (meaningful only when the block has more than one exercise), and an ordered, non-empty list of `SessionBlockExercise`s, each referencing one `Exercise` by `Position`.

#### Scenario: Saving a session with at least one block
- **WHEN** a Coach saves a session with one or more blocks, each with at least one exercise
- **THEN** the session is created with its blocks and their exercises, ordered as entered

#### Scenario: A block always states how it connects to the previous one
- **WHEN** a Coach attempts to save a session where the first block has no `ComoConectaConAnterior` text
- **THEN** the save is rejected with a validation error

#### Scenario: Multiple exercises in the same block are "in parallel"
- **WHEN** a block has two `SessionBlockExercise`s at `Position` 1 and 2
- **THEN** both exercises are considered to run in parallel within that block, and the Coach app renders them side by side

### Requirement: Training session content beyond blocks
A `TrainingSession` SHALL optionally carry `ObjetivoGeneral` (free text, meaningful with or without a plan association) and `MapaCampoTexto` (free text placeholder/caption for the session's overall field-setup map).

#### Scenario: Standalone session still states its objective
- **WHEN** a Coach creates a session with no `MicrocicloId` and fills `ObjetivoGeneral`
- **THEN** the objective is saved and shown on the session, independent of any plan association

### Requirement: Training session can optionally associate to a season plan week
A `TrainingSession` SHALL optionally reference one `Microciclo` (`MicrocicloId`), belonging to a `SeasonPlan` for the same `Team`. This association is entirely optional and explicit — a Coach decides at creation/edit time whether the session belongs to a plan week or is independent.

#### Scenario: Creating a session associated to a plan week
- **WHEN** a Coach creates a session and selects a `Microciclo` from the team's current season plan
- **THEN** the session is saved with that `MicrocicloId`, and is listed under that Microciclo in the Planificación tab

#### Scenario: Creating a session with no plan association
- **WHEN** a Coach creates a session without selecting any `Microciclo`
- **THEN** the session is saved with no `MicrocicloId`, fully usable, and listed as independent in the Sesiones tab

#### Scenario: Selecting a Microciclo from another team is rejected
- **WHEN** a Coach attempts to save a session with a `MicrocicloId` that belongs to a `SeasonPlan` for a different `Team`
- **THEN** the save is rejected with a validation error

#### Scenario: Microciclo deleted while a session is linked to it
- **WHEN** a `SeasonPlan` (or one of its Microciclos) is deleted while a `TrainingSession` is linked to it
- **THEN** the session is preserved, only its Microciclo link is cleared

### Requirement: Session list distinguishes plan-linked from independent sessions
The session list SHALL expose, per session, whether it carries a `MicrocicloId` (`IsAssociatedToPlan`) and, when set, the linked Microciclo's `WeekLabel`. The Coach app SHALL render this as a visible, distinct indicator (plan week label vs. "Independiente") in the session list.

#### Scenario: Session linked to a plan week
- **WHEN** the session list renders a session with `MicrocicloId` set
- **THEN** `IsAssociatedToPlan` is `true`, and the session's plan week label is shown

#### Scenario: Independent session
- **WHEN** the session list renders a session with no `MicrocicloId`
- **THEN** `IsAssociatedToPlan` is `false`, and an "Independiente" indicator is shown

### Requirement: An exercise can appear in more than one session block
The system SHALL NOT restrict an `Exercise` to a single `SessionBlock` — the same exercise MAY be referenced from multiple blocks across different (or the same) sessions.

#### Scenario: Reusing an existing exercise in a new session's block
- **WHEN** a Coach adds an exercise that is already used in another session to a new session's block
- **THEN** the new block reference is saved without affecting the exercise's other usages
