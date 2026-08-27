# game-model Specification

## Purpose
TBD - created by archiving change move-game-scenario. Update Purpose after archive.
## Requirements
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

### Requirement: Coach can create and edit the game model
A Coach with access to the team SHALL be able to create and edit a `GameModel`'s full ADN tree (Principios, Subprincipios, Zonas, SubSubPrincipios, Habilidades, Notas, SetPieceRules, OpenIssues) via the game-model edit view, and delete any node at any level, cascading to its descendants.

#### Scenario: Coach creates a full model tree
- **WHEN** a Coach saves a game model with a new Principio containing Subprincipios, Zonas/SubSubPrincipios, and Habilidades
- **THEN** the full tree is persisted with the structure and content as submitted

#### Scenario: Coach deletes a node and its descendants
- **WHEN** a Coach saves a game model that no longer includes a previously-existing Subprincipio
- **THEN** that Subprincipio and everything nested under it (Zonas, SubSubPrincipios, Habilidades, Notas) are removed

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

### Requirement: Game-model read views reproduce the legible document's structure
The Coach app's read and print views of a `GameModel` SHALL present the ADN tree in the same order and nesting as `docs/game-model/ADN-Modelo-de-Juego-Legible.md`: Fases in document order, numbered Principios and Subprincipios, Zona blocks where present, SubSubPrincipios with their Rol and Habilidades, Notas rendered near their anchor, and a flat "Balón parado" section.

#### Scenario: Read view mirrors the legible document's nesting
- **WHEN** a Coach opens a game model for a Fase with several numbered Principios and Subprincipios
- **THEN** the read view renders them in the same numbered, nested order as the legible document, including Zona blocks and Notas at their anchored level

