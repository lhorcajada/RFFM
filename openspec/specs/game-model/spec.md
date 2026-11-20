# game-model Specification

## Purpose
TBD - created by archiving change move-game-scenario. Update Purpose after archive.
## Requirements
### Requirement: Game model follows the ADN hierarchy
The system SHALL model a `GameModel`'s content as `Fase (GameMoment) → Principio (GamePrinciple) → Subprincipio → (Zona, 0..N) → SubSubPrincipio → Habilidad`, where each `SubSubPrincipio` hangs from exactly one parent: either directly off its `Subprincipio` (a "general" SubSubPrincipio) or off one of that `Subprincipio`'s `Zona`s. A `Subprincipio` MAY have general `SubSubPrincipio`s and `Zona`s with `SubSubPrincipio`s at the same time. A `Nota` MAY be anchored to a `Principio`, `Subprincipio`, `Zona`, or `SubSubPrincipio`. The "Balón parado" `Fase` instead holds a flat list of `SetPieceRule`s with no Principio/Subprincipio/Zona nesting. `Habilidad.Nombre` SHALL be restricted to the fixed **15-value** vocabulary defined in `docs/game-model/ADN-modelo-de-juego-especificacion-tecnica.md` §4; any other value is rejected.

#### Scenario: SubSubPrincipio hangs off a Zona when the Subprincipio varies by zone
- **WHEN** a Coach adds a `SubSubPrincipio` under a `Zona` that belongs to a `Subprincipio`
- **THEN** the `SubSubPrincipio` is persisted anchored to that `Zona`, not directly to the `Subprincipio`

#### Scenario: SubSubPrincipio hangs directly off a Subprincipio with no zone variation
- **WHEN** a Coach adds a `SubSubPrincipio` to a `Subprincipio` that has no `Zona`s
- **THEN** the `SubSubPrincipio` is persisted anchored directly to that `Subprincipio`

#### Scenario: Subprincipio with general and zone SubSubPrincipios
- **WHEN** a Coach saves a `Subprincipio` with one general `SubSubPrincipio` and one `Zona` holding another `SubSubPrincipio`
- **THEN** both are persisted, the first anchored to the `Subprincipio` and the second to the `Zona`

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

### Requirement: El editor del modelo vuelve a la pantalla de origen
El editor del Modelo de Juego (`/coach/game-model/create` y `/coach/game-model/edit`) SHALL aceptar
un `returnTo` en el state de navegación. Al cancelar, SHALL navegar a `returnTo` si existe y, si no,
a `/coach/game-model` conservando la query string. Al guardar, SHALL quedarse en el editor: si el
guardado va bien, SHALL mostrar una alerta de éxito y recargar el modelo guardado (un modelo recién
creado pasa a `/coach/game-model/edit`); si falla, SHALL mostrar una alerta de error con el `detail`
del backend o "No se pudo guardar el modelo." y conservar los cambios sin guardar.

#### Scenario: Guardar bien sin salir
- **WHEN** el editor se abrió con `returnTo` "/coach/trainings/content-board?teamId=t1" y el
  entrenador guarda correctamente
- **THEN** sigue en el editor, se muestra una alerta de éxito y el modelo se recarga del servidor

#### Scenario: Guardar con error
- **WHEN** el guardado falla con `detail` "La zona no es válida"
- **THEN** sigue en el editor con sus cambios y se muestra la alerta de error "La zona no es válida"

#### Scenario: Crear y seguir editando
- **WHEN** el entrenador guarda un modelo nuevo desde `/coach/game-model/create`
- **THEN** se muestra una alerta de éxito y la pantalla pasa a `/coach/game-model/edit`

#### Scenario: Volver al origen al cancelar
- **WHEN** el editor se abrió con `returnTo` y el entrenador cancela
- **THEN** se navega a `returnTo`

#### Scenario: Sin origen
- **WHEN** el editor se abrió sin `returnTo` y el entrenador cancela
- **THEN** se navega a `/coach/game-model` con la misma query string

### Requirement: Mover sub-subprincipios entre zonas conserva su identidad
El sistema SHALL conservar el `Id`, las `Habilidad`es y las `Nota`s de un `SubSubPrincipio`
existente cuando, al guardar un Modelo de Juego (`PUT /api/game-models/{id}`), aparece en la
petición bajo otro padre del **mismo** `Subprincipio` (general ↔ zona, o de una zona a otra,
incluida una zona nueva), y SHALL dejarlo colgado del nuevo padre. Sus objetivos de sesión y sus relaciones con ejercicios SHALL
mantenerse. Solo SHALL eliminarse los `SubSubPrincipio`s del `Subprincipio` que no aparecen bajo
ningún padre de ese `Subprincipio` en la petición.

#### Scenario: Mover un general a una zona existente
- **WHEN** el sub-subprincipio general S (con una habilidad y usado como objetivo de una sesión) se
  envía dentro de la zona Z del mismo subprincipio
- **THEN** S conserva su id, cuelga de Z, conserva su habilidad y la sesión sigue teniéndolo como
  objetivo

#### Scenario: Mover un general a una zona nueva
- **WHEN** se crea una zona nueva en el subprincipio y el sub-subprincipio general S se envía dentro
  de ella
- **THEN** la zona se crea y S conserva su id colgando de la zona nueva

#### Scenario: Devolver un sub-subprincipio de una zona a general
- **WHEN** el sub-subprincipio S de la zona Z se envía como general del subprincipio
- **THEN** S conserva su id y cuelga directamente del subprincipio

#### Scenario: Eliminar un sub-subprincipio
- **WHEN** un sub-subprincipio existente no aparece en ninguna parte de su subprincipio en la petición
- **THEN** se elimina

### Requirement: El editor permite crear zonas y mover sub-subprincipios a ellas
En el editor del Modelo de Juego, un `Subprincipio` SHALL ofrecer siempre "Añadir zona" y "Añadir
sub-subprincipio directo", y SHALL mostrar siempre sus sub-subprincipios generales (bajo "Sin zona
(generales)" cuando tiene zonas). Cuando el subprincipio tiene zonas, cada sub-subprincipio SHALL
tener un selector "Zona" con "Sin zona (general)" y las zonas de su subprincipio; al cambiarlo, el
sub-subprincipio SHALL moverse al destino conservando sus datos.

#### Scenario: Añadir zona con generales presentes
- **WHEN** el subprincipio tiene sub-subprincipios generales y ninguna zona
- **THEN** el editor muestra "Añadir zona"

#### Scenario: Generales visibles con zonas
- **WHEN** el subprincipio tiene una zona y un sub-subprincipio general
- **THEN** el editor muestra el general bajo "Sin zona (generales)"

#### Scenario: Mover con el selector
- **WHEN** el entrenador elige la zona Z en el selector "Zona" de un sub-subprincipio general
- **THEN** el sub-subprincipio pasa a la lista de Z con su rol, texto, habilidades y notas, y deja
  de estar en "Sin zona (generales)"

### Requirement: The game model carries a version marker
Every game model SHALL carry a version marker that changes each time the model is saved, and the read of the model SHALL return it. A model that has no marker SHALL be given one before it is first returned, and that marker SHALL be persisted, so that repeated reads return the same marker until the next save. The update of the model SHALL accept an optional expected marker; when it is supplied and differs from the current marker, the update SHALL be refused with HTTP `409 Conflict` as `ProblemDetails` with the error code `GameModelStale`, and the model SHALL stay unchanged. An update without an expected marker SHALL behave as before.

#### Scenario: Marker changes on save
- **WHEN** a model is saved
- **THEN** a later read returns a different marker

#### Scenario: Model without a marker
- **WHEN** a model that was created before the marker existed is read
- **THEN** it is returned with a marker

#### Scenario: Marker is stable between reads
- **WHEN** a model that had no marker is read twice with no save in between
- **THEN** both reads return the same marker

#### Scenario: Matching expected marker
- **WHEN** an update carries the current marker as the expected marker
- **THEN** the update is applied

#### Scenario: Stale expected marker
- **WHEN** an update carries a marker that is no longer current
- **THEN** the update is refused with `409 Conflict` as `ProblemDetails` with the error code `GameModelStale`, and the model is unchanged

#### Scenario: No expected marker
- **WHEN** an update carries no expected marker
- **THEN** the update is applied as before

