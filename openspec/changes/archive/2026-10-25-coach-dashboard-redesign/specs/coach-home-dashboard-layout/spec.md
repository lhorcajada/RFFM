## ADDED Requirements

### Requirement: El panel de inicio saluda al usuario logueado
La página `/coach/dashboard` SHALL mostrar una cabecera con el eyebrow «PANEL DE CONTROL» y un título
«Hola, {nombre}», donde {nombre} es el `firstName` del usuario de `UserContext` o, si no existe, su
`username` (salvo que parezca un email). Sin nombre utilizable el título SHALL ser «Panel de control».
En escritorio y tablet la cabecera SHALL incluir el botón «Volver al inicio» (solo para quien no es
jugador ni familiar).

#### Scenario: Usuario con nombre
- **WHEN** un entrenador con `firstName` «Lucía» abre el panel
- **THEN** el título de la página es «Hola, Lucía»

#### Scenario: Usuario sin nombre
- **WHEN** el usuario del contexto no tiene `firstName` ni un `username` utilizable
- **THEN** el título de la página es «Panel de control»

### Requirement: El panel destaca el equipo preferido
El panel SHALL mostrar, cuando `useTeamAndClub` resuelve un equipo (por `teamId` en la URL o por el
equipo preferido de la configuración del entrenador), un bloque «EQUIPO PREFERIDO» con la foto o el
escudo del equipo, su nombre, el escudo y el nombre del club, la categoría y un enlace «Abrir panel»
a `/coach/team-dashboard?teamId=<id>`. Si no hay equipo resuelto, el bloque SHALL NOT mostrarse.

#### Scenario: Con equipo preferido
- **WHEN** el entrenador tiene como equipo preferido «Infantil B» con id `team-7`
- **THEN** se muestra el bloque «Equipo preferido» con «Infantil B» y el enlace «Abrir panel» apunta a `/coach/team-dashboard?teamId=team-7`

#### Scenario: Sin equipo preferido
- **WHEN** el entrenador no tiene equipo preferido ni `teamId` en la URL
- **THEN** no se muestra el bloque «Equipo preferido»

### Requirement: El acceso rápido se adapta al tamaño de pantalla
El panel SHALL mostrar la sección de acceso rápido con el número de equipos del usuario
(«N equipos» / «1 equipo»). En pantallas a partir de 600 px SHALL presentarse como una rejilla de
tarjetas (3 columnas por debajo de 1200 px, 5 a partir de 1200 px) con una tarjeta por equipo y la
tarjeta «Configuración». Por debajo de 600 px SHALL presentarse como una lista vertical de filas
(una por equipo) seguida de los botones «Configuración» e «Inicio». Cada equipo SHALL enlazar a
`/coach/team-dashboard?teamId=<id>`. La sección SHALL NOT mostrarse a jugadores ni familiares.

#### Scenario: Escritorio o tablet
- **WHEN** el entrenador con dos equipos abre el panel en una pantalla de 834 px
- **THEN** ve una rejilla con las tarjetas de sus dos equipos y la tarjeta «Configuración» y el texto «2 equipos»

#### Scenario: Móvil
- **WHEN** el entrenador abre el panel en una pantalla de 390 px
- **THEN** ve una lista de filas con sus equipos y, al final, los botones «Configuración» e «Inicio»

### Requirement: Configuración se muestra según permiso
La tarjeta o botón «Configuración» del acceso rápido SHALL mostrarse solo si el usuario no es jugador
ni familiar y `hasFeatureAccess("/coach/settings")` es verdadero, en todos los tamaños de pantalla.

#### Scenario: Sin permiso de configuración
- **WHEN** el usuario no tiene acceso a `/coach/settings`
- **THEN** no se muestra «Configuración» ni en la rejilla ni en la lista móvil

#### Scenario: Con permiso de configuración
- **WHEN** el usuario tiene acceso a `/coach/settings`
- **THEN** se muestra un enlace «Configuración» a `/coach/settings`
