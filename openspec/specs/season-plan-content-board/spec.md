# season-plan-content-board Specification

## Purpose
TBD - created by archiving change season-plan-content-board. Update Purpose after archive.
## Requirements
### Requirement: ADN coverage is a calculated view, never stored
A `Subprincipio` SHALL be considered "covered" when every one of its `SubSubPrincipio`s (via its
`Zona`s if any, or direct) is targeted by at least one `TrainingSession` (scheduled or
unscheduled). A `GamePrinciple` SHALL be considered "covered" when all of its `Subprincipio`s
are covered. Coverage SHALL be computed by querying live session-target data, never persisted as
a field on `Subprincipio`/`GamePrinciple`.

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

### Requirement: Sub-subprincipio usage is queryable per team/season
The backend SHALL expose an endpoint returning, for every `SubSubPrincipio` of a team's active
`GameModel`, whether it is used by at least one session and the list of sessions using it (each
with `SessionId`, `SessionName`, and `Date` — null when the referencing session is unscheduled).

#### Scenario: Unused Sub-subprincipio
- **WHEN** no `TrainingSession` targets a given `SubSubPrincipio`
- **THEN** the coverage endpoint reports it as unused with an empty session list

#### Scenario: Sub-subprincipio used by an unscheduled session
- **WHEN** a `SubSubPrincipio` is targeted only by a session with no `Date`
- **THEN** the coverage endpoint reports it as used, with that session's entry showing a null
  `Date`

### Requirement: Crear sesión desde un microciclo abre el tablero de contenido
En la pestaña Planificación de `/coach/trainings`, el botón "Crear sesión" de un microciclo SHALL
navegar al tablero de contenido con ese microciclo como contexto
(`/coach/trainings/content-board?clubId={clubId}&teamId={teamId}&microcicloId={id}`). La barra de
acciones de la pestaña Planificación SHALL NOT mostrar el botón "Planificar contenido". La pestaña
Sesiones SHALL ofrecer un botón "Tablero de contenido" que abre el tablero sin microciclo.

#### Scenario: Crear sesión desde un microciclo
- **WHEN** el entrenador pulsa "Crear sesión" en el microciclo "Semana 3"
- **THEN** se abre el tablero de contenido con el `microcicloId` de "Semana 3" en la URL

#### Scenario: Sin botón duplicado en Planificación
- **WHEN** el entrenador está en la pestaña Planificación
- **THEN** no aparece el botón "Planificar contenido"

#### Scenario: Acceso al tablero completo
- **WHEN** el entrenador pulsa "Tablero de contenido" en la pestaña Sesiones
- **THEN** se abre el tablero de contenido sin `microcicloId`

### Requirement: El tablero de contenido filtra y crea por microciclo
Cuando el tablero de contenido recibe un `microcicloId`, SHALL mostrar en la cabecera la semana y
sus fechas, SHALL listar en el panel derecho solo las sesiones con ese `microcicloId`, y SHALL crear
las sesiones nuevas con ese `microcicloId` y sin fecha. SHALL ofrecer "Ver todas las sesiones",
que quita el filtro. Sin `microcicloId`, el tablero SHALL comportarse como hasta ahora.

#### Scenario: Solo sesiones del microciclo
- **WHEN** el tablero se abre con el microciclo A y el equipo tiene sesiones en A, en B y sin
  microciclo
- **THEN** el panel derecho muestra solo las sesiones de A

#### Scenario: Nueva sesión asignada al microciclo
- **WHEN** el entrenador pulsa "Nueva sesión" en el tablero abierto con el microciclo A
- **THEN** se crea una sesión con `microcicloId` A y fecha nula, y aparece en el panel

#### Scenario: Quitar el filtro
- **WHEN** el entrenador pulsa "Ver todas las sesiones"
- **THEN** el tablero muestra todas las sesiones del equipo y las nuevas se crean sin microciclo

#### Scenario: Equipo sin Modelo de Juego con microciclo
- **WHEN** el tablero se abre con el microciclo A y el equipo no tiene Modelo de Juego
- **THEN** el estado vacío ofrece "Crear sesión sin contenido", que abre el editor de sesión con
  `microcicloId` A

### Requirement: El tablero muestra las habilidades imprescindibles de cada sub-subprincipio
El tablero de contenido SHALL mostrar, para cada sub-subprincipio, sus habilidades imprescindibles
(`Habilidad.Nombre`) como chips, tanto en el árbol ADN del panel izquierdo como en los objetivos de
cada tarjeta de sesión. Las habilidades SHALL leerse del Modelo de Juego cargado, no de la sesión.
Cada chip SHALL ofrecer su descripción y si es entrenable; si la habilidad tiene `referenciaAKey`,
SHALL indicar "Igual que {referenciaAKey}". Un sub-subprincipio sin habilidades SHALL NOT mostrar
chips.

#### Scenario: Habilidades en el árbol ADN
- **WHEN** el sub-subprincipio 1.1.1 tiene las habilidades "Perfilamiento" y "Anticipación"
- **THEN** su fila en el árbol ADN muestra los chips "Perfilamiento" y "Anticipación"

#### Scenario: Habilidades en el objetivo de una sesión
- **WHEN** una sesión tiene como objetivo el sub-subprincipio 1.1.1
- **THEN** ese objetivo en la tarjeta de sesión muestra los chips "Perfilamiento" y "Anticipación"

#### Scenario: Detalle de una habilidad
- **WHEN** el entrenador pulsa o pasa el ratón por el chip "Perfilamiento"
- **THEN** se muestra su descripción y su texto de entrenable

#### Scenario: Habilidad que remite a otro sub-subprincipio
- **WHEN** una habilidad tiene `referenciaAKey` "1.2.3"
- **THEN** su detalle indica "Igual que 1.2.3"

#### Scenario: Sub-subprincipio sin habilidades
- **WHEN** un sub-subprincipio no tiene habilidades
- **THEN** no se muestra ningún chip de habilidad para él

### Requirement: El tablero permite editar o crear el Modelo de Juego y volver
El tablero de contenido SHALL ofrecer "Editar modelo" cuando el equipo tiene Modelo de Juego, que
abre `/coach/game-model/edit` para la temporada activa. Cuando el equipo no tiene modelo, el estado
vacío SHALL ofrecer "Crear modelo", que abre `/coach/game-model/create`. En ambos casos, al guardar
o cancelar en el editor, SHALL volverse al tablero con la misma URL (incluido `microcicloId` si lo
había) y el tablero SHALL mostrar el modelo actualizado.

#### Scenario: Editar el modelo desde el tablero
- **WHEN** el entrenador pulsa "Editar modelo" en el tablero abierto con el microciclo A
- **THEN** se abre el editor del modelo de la temporada activa y, al guardar, vuelve al tablero
  con `microcicloId` A

#### Scenario: Crear el modelo desde el tablero
- **WHEN** el equipo no tiene Modelo de Juego y el entrenador pulsa "Crear modelo"
- **THEN** se abre el editor de creación y, al guardar o cancelar, vuelve al tablero

