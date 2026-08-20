## REMOVED Requirements

### Requirement: Exercises and training sessions are independent of the game model
**Reason**: Superseded by this change's Amendment 2 (see `design.md`) — the exercise/session content templates (`docs/game-model/Plantilla-Ejercicio.md`) matured to require every exercise to carry its own "Relación con el modelo de juego" (Subprincipio/SubSubPrincipio links tagged FOCO/INTEGRADO, plus Habilidades). This was a deliberate reversal of the archived `game-model-adn-hierarchy` change's decision, made after reviewing the actual code, not an oversight.
**Migration**: The replacement requirement ("Exercise can reference the game model") now lives in this change's `specs/exercises/spec.md` delta, since it's about `Exercise`, not `GameModel`, behavior.

The system SHALL NOT link `Exercise`/`TaskTrainingBase` or `TrainingSession` records to any game-model entity. No exercise or session creation/edit flow SHALL reference a Principio, Subprincipio, Zona, SubSubPrincipio, or Habilidad.

#### Scenario: Creating an exercise has no game-model field
- **WHEN** a Coach creates or edits an exercise
- **THEN** the form has no field to select a Subprincipio, Zona, SubSubPrincipio, or Habilidad, and the saved exercise carries no such reference

#### Scenario: Creating a session has no game-model field
- **WHEN** a Coach creates or edits a training session
- **THEN** the form has no field to select a Subprincipio, and the saved session carries no such reference

## MODIFIED Requirements

### Requirement: Game model follows the ADN hierarchy
The system SHALL model a `GameModel`'s content as `Fase (GameMoment) → Principio (GamePrinciple) → Subprincipio → (Zona, 0..N) → SubSubPrincipio → Habilidad`, where a `Subprincipio`'s `SubSubPrincipio`s hang either directly off it or off one of its `Zona`s, never both. A `Nota` MAY be anchored to a `Principio`, `Subprincipio`, `Zona`, or `SubSubPrincipio`. The "Balón parado" `Fase` instead holds a flat list of `SetPieceRule`s with no Principio/Subprincipio/Zona nesting. `Habilidad.Nombre` SHALL be restricted to the fixed **15-value** vocabulary defined in `docs/game-model/ADN-modelo-de-juego-especificacion-tecnica.md` §4; any other value is rejected.

#### Scenario: SubSubPrincipio hangs off a Zona when the Subprincipio varies by zone
- **WHEN** a Coach adds a `SubSubPrincipio` under a `Zona` that belongs to a `Subprincipio`
- **THEN** the `SubSubPrincipio` is persisted anchored to that `Zona`, not directly to the `Subprincipio`

#### Scenario: SubSubPrincipio hangs directly off a Subprincipio with no zone variation
- **WHEN** a Coach adds a `SubSubPrincipio` to a `Subprincipio` that has no `Zona`s
- **THEN** the `SubSubPrincipio` is persisted anchored directly to that `Subprincipio`

#### Scenario: Habilidad name outside the closed vocabulary is rejected
- **WHEN** a Coach (or the markdown importer) attempts to save a `Habilidad` with a `Nombre` not in the 15-value vocabulary
- **THEN** the save is rejected with a validation error and no `Habilidad` is created

#### Scenario: Balón parado phase holds flat SetPieceRules
- **WHEN** a Coach adds content under the Balón Parado `Fase`
- **THEN** it is persisted as a `SetPieceRule` (`subtype` + free text), with no `Principio`/`Subprincipio`/`Zona` nesting

### Requirement: Game model can be seeded and re-imported from the legible ADN document
The system SHALL provide a markdown importer that parses `docs/game-model/ADN-Modelo-de-Juego-Legible.md` per the parsing and key-derivation rules in `docs/game-model/ADN-modelo-de-juego-especificacion-tecnica.md` (§1–§5), producing entities keyed deterministically so re-running the import against an unchanged document upserts the same rows rather than duplicating them. This importer SHALL be used to seed the real game model so it does not have to be entered by hand.

#### Scenario: Re-running the import is idempotent
- **WHEN** the importer runs twice against the same unchanged legible document for the same `GameModel`
- **THEN** the second run does not create duplicate Principios/Subprincipios/Zonas/SubSubPrincipios — it upserts by key

#### Scenario: Unresolvable Zona heading is rejected, not guessed
- **WHEN** the legible document contains a Zona heading that matches neither the 4-zone catalog nor one of the documented special cases
- **THEN** the importer rejects it (or marks it pending) rather than forcing it into an incorrect catalog zone

#### Scenario: Habilidad name outside the vocabulary during import is rejected
- **WHEN** the legible document contains a Habilidad name not in the 15-value closed vocabulary
- **THEN** the importer rejects that entry rather than silently creating a new habilidad
