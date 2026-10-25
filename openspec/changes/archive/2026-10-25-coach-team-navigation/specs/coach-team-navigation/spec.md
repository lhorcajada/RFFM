## ADDED Requirements

### Requirement: Las páginas del equipo muestran una barra de navegación del equipo
La app Coach SHALL mostrar la navegación del equipo en `/coach/team-dashboard`, `/coach/menu` y en las
páginas de las secciones enlazadas desde el Menú (plantilla, eventos, entrenamientos, calendario,
resultados, clasificación, noticias, notificaciones, etc.), en lugar del menú inferior Inicio/Configuración.
En `/coach/dashboard`, `/coach/settings`, `/coach/clubs` y sus subrutas SHALL NOT mostrarse, y esas
páginas SHALL conservar el menú inferior actual.

#### Scenario: Página de una sección del equipo
- **WHEN** un entrenador abre `/coach/squad?teamId=team-1`
- **THEN** se muestra la navegación «Navegación del equipo» y no se muestra el enlace «Configuración» del menú inferior

#### Scenario: Panel general
- **WHEN** un entrenador abre `/coach/dashboard`
- **THEN** no se muestra la navegación del equipo y sí el menú inferior con «Inicio»

### Requirement: Las pestañas dependen del rol y de los permisos
La navegación del equipo SHALL mostrar, en este orden y con texto visible, para entrenadores (y
cualquier usuario que no sea solo jugador o familiar): «Inicio», «Calendario», «Eventos»,
«Entrenamientos», «Menú». Para jugadores y familiares SHALL mostrar: «Inicio», «Resultados»,
«Clasificación», «Eventos», «Menú». «Inicio» SHALL enlazar a `/coach/team-dashboard` y «Menú» a
`/coach/menu`, siempre visibles. Cada pestaña intermedia SHALL ocultarse cuando el usuario no tiene
acceso a su funcionalidad (Calendario, Resultados y Clasificación: `/coach/convocations`; Eventos:
`/coach/attendance`; Entrenamientos: `/coach/trainings`).

#### Scenario: Entrenador
- **WHEN** un entrenador con todos los permisos está en una página del equipo
- **THEN** ve las pestañas «Inicio», «Calendario», «Eventos», «Entrenamientos» y «Menú»

#### Scenario: Jugador
- **WHEN** un usuario con rol `Player` está en una página del equipo
- **THEN** ve las pestañas «Inicio», «Resultados», «Clasificación», «Eventos» y «Menú» y no ve «Entrenamientos»

#### Scenario: Sin permiso de entrenamientos
- **WHEN** un entrenador sin acceso a `/coach/trainings` está en una página del equipo
- **THEN** no se muestra la pestaña «Entrenamientos»

### Requirement: La pestaña activa refleja la página actual
La pestaña cuya ruta coincide con la página actual SHALL marcarse con `aria-current="page"`. Cuando
la página actual no corresponde a ninguna pestaña, SHALL marcarse «Menú».

#### Scenario: En eventos
- **WHEN** el usuario está en `/coach/attendance?teamId=team-1`
- **THEN** la pestaña «Eventos» tiene `aria-current="page"`

#### Scenario: En una sección del Menú
- **WHEN** el usuario está en `/coach/sanctions?teamId=team-1`
- **THEN** la pestaña «Menú» tiene `aria-current="page"`

### Requirement: La navegación conserva el equipo en contexto
Las pestañas y las entradas del Menú SHALL incluir `?teamId=<id>` del equipo en contexto, resuelto
en este orden: `teamId` de la URL actual; último `teamId` visto en la sesión; equipo vinculado del
jugador; equipo preferido del entrenador. Sin equipo resuelto, SHALL enlazar sin `teamId`.

#### Scenario: Página sin teamId en la URL
- **WHEN** el usuario pasa de `/coach/squad?teamId=team-1` a `/coach/news`
- **THEN** en `/coach/news` la pestaña «Inicio» enlaza a `/coach/team-dashboard?teamId=team-1`

### Requirement: En escritorio la navegación es una columna lateral
En pantallas de 1200 px o más, la navegación del equipo SHALL mostrarse como una columna fija a la
izquierda del contenido, con las mismas pestañas apiladas. Por debajo de 1200 px SHALL mostrarse como
una barra fija en la parte inferior. El contenido de la página SHALL NOT quedar tapado por la navegación.

#### Scenario: Escritorio
- **WHEN** el usuario abre una página del equipo en una pantalla de 1440 px
- **THEN** las pestañas se muestran en una columna a la izquierda y el contenido empieza a su derecha

#### Scenario: Móvil
- **WHEN** el usuario abre una página del equipo en una pantalla de 390 px
- **THEN** las pestañas se muestran en una barra inferior y el final del contenido sigue siendo visible al hacer scroll

### Requirement: La página Menú lista todas las secciones del equipo
`/coach/menu` SHALL mostrar las secciones agrupadas bajo «Equipo», «Actividad», «Competición»,
«Disciplina», «Otros» y «Cuenta», como lista de enlaces (sin tablas), con las mismas reglas de rol y
permiso que tenían las tarjetas del panel del equipo: «Gestión de usuarios» y «Documentos» solo para
quien no es jugador ni familiar; «Mis documentos» solo para jugadores y familiares con permiso;
«Notificaciones» para todos; el resto según `hasFeatureAccess`. «Cuenta» SHALL incluir «Mi perfil»
para todos, y «Panel general» y «Configuración» (esta última, según permiso) solo para quien no es
jugador ni familiar. Un grupo sin entradas visibles SHALL NOT mostrarse.

#### Scenario: Jugador en el Menú
- **WHEN** un usuario con rol `Player` abre `/coach/menu`
- **THEN** ve «Mis documentos» y no ve «Gestión de usuarios», «Documentos», «Rivales», «Entrenamientos», «Modelo de juego» ni «Pruebas de acceso»

#### Scenario: Entrada con teamId
- **WHEN** un entrenador abre `/coach/menu?teamId=team-1`
- **THEN** «Plantilla» enlaza a `/coach/squad?teamId=team-1`

### Requirement: El Menú permite buscar una sección
La página Menú SHALL tener un campo «Buscar sección» que filtra las entradas por su nombre sin
distinguir mayúsculas ni tildes, ocultando los grupos que se quedan vacíos. Si ninguna entrada coincide,
SHALL mostrar «No hay ninguna sección con ese nombre.».

#### Scenario: Búsqueda sin tilde
- **WHEN** el usuario escribe «clasificacion»
- **THEN** se muestra «Clasificación» y no se muestra «Plantilla»

#### Scenario: Sin resultados
- **WHEN** el usuario escribe «zzz»
- **THEN** se muestra «No hay ninguna sección con ese nombre.»
