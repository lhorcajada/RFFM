## MODIFIED Requirements

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

## ADDED Requirements

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
