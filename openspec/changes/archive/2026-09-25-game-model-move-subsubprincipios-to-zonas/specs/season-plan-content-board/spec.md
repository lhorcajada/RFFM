## MODIFIED Requirements

### Requirement: ADN coverage is a calculated view, never stored
A `Subprincipio` SHALL be considered "covered" when every one of its `SubSubPrincipio`s — those in
its `Zona`s and its general (direct) ones — is targeted by at least one `TrainingSession`
(scheduled or unscheduled). A `GamePrinciple` SHALL be considered "covered" when all of its
`Subprincipio`s are covered. Coverage SHALL be computed by querying live session-target data, never
persisted as a field on `Subprincipio`/`GamePrinciple`.

#### Scenario: Subprincipio becomes covered
- **WHEN** every `SubSubPrincipio` of a `Subprincipio` is targeted by at least one session
- **THEN** the coverage query reports that `Subprincipio` as covered, with no manual action taken

#### Scenario: Subprincipio loses coverage when a target is removed
- **WHEN** the only session targeting one of a covered `Subprincipio`'s `SubSubPrincipio`s is
  edited to remove that target, with no other session targeting it
- **THEN** the coverage query reports that `Subprincipio` as no longer covered

#### Scenario: Principio covered only when all its Subprincipios are covered
- **WHEN** a `GamePrinciple` has one covered and one uncovered `Subprincipio`
- **THEN** the coverage query reports that `GamePrinciple` as not covered

#### Scenario: General SubSubPrincipios count in a Subprincipio with Zonas
- **WHEN** a `Subprincipio` has a `Zona` whose only `SubSubPrincipio` is targeted, and an untargeted
  general `SubSubPrincipio`
- **THEN** the coverage query reports that `Subprincipio` as in progress, not completed

### Requirement: El tablero permite editar o crear el Modelo de Juego y volver
El tablero de contenido SHALL ofrecer "Editar modelo" cuando el equipo tiene Modelo de Juego, que
abre `/coach/game-model/edit` para la temporada activa. Cuando el equipo no tiene modelo, el estado
vacío SHALL ofrecer "Crear modelo", que abre `/coach/game-model/create`. En ambos casos el editor
SHALL recibir la URL del tablero como `returnTo`: al salir del editor con "Cancelar", SHALL volverse
al tablero con la misma URL (incluido `microcicloId` si lo había) y el tablero SHALL mostrar el
modelo actualizado. Guardar en el editor no sale del editor.

#### Scenario: Editar el modelo desde el tablero
- **WHEN** el entrenador pulsa "Editar modelo" en el tablero abierto con el microciclo A, guarda y
  después pulsa "Cancelar"
- **THEN** vuelve al tablero con `microcicloId` A y ve el modelo guardado

#### Scenario: Crear el modelo desde el tablero
- **WHEN** el equipo no tiene Modelo de Juego y el entrenador pulsa "Crear modelo"
- **THEN** se abre el editor de creación y, al cancelar, vuelve al tablero

## ADDED Requirements

### Requirement: El tablero muestra los generales de un subprincipio con zonas
El árbol ADN del tablero de contenido SHALL mostrar, para un subprincipio con zonas y
sub-subprincipios generales, sus zonas y, además, un grupo "Sin zona" con los generales, arrastrables como el
resto. Arrastrar el subprincipio SHALL añadir todos sus sub-subprincipios (de zonas y generales).
El texto y las habilidades de los generales SHALL resolverse igual en las tarjetas de sesión.

#### Scenario: Grupo "Sin zona" en el árbol
- **WHEN** el subprincipio tiene la zona Z con el sub-subprincipio A y el general B
- **THEN** el árbol muestra Z con A y un grupo "Sin zona" con B

#### Scenario: Arrastrar el subprincipio incluye los generales
- **WHEN** el entrenador arrastra ese subprincipio a una sesión
- **THEN** la sesión recibe A y B como objetivos
