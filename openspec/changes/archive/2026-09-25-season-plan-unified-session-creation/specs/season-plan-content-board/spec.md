## ADDED Requirements

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
