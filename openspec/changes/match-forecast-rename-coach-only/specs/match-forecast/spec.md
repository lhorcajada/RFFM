## Purpose
Definir el nombre «Pronóstico de partidos» de la página de pronóstico de la liga del equipo, sus rutas de frontend y de API, la redirección de las rutas antiguas y la reserva al rol Coach de las acciones que generan o actualizan el pronóstico.

## ADDED Requirements

### Requirement: La página se llama «Pronóstico de partidos»
La aplicación Coach SHALL llamar «Pronóstico de partidos» a la página que antes se llamaba «Estadísticas de rivales»: la entrada del menú del equipo y el título de la página SHALL usar ese nombre, y la página SHALL estar disponible en `/coach/match-forecast?teamId=` y su página de simulación en `/coach/match-forecast/simulation?teamId=`. El botón que abre la página de simulación SHALL llamarse «Crear pronóstico». Ningún texto visible de la página ni del menú SHALL seguir llamándola «Estadísticas de rivales». El renombrado SHALL NOT cambiar el cálculo ni los datos de las estadísticas ni de la simulación.

#### Scenario: Entrada del menú del equipo
- **WHEN** un usuario con acceso a la competición abre el menú del equipo
- **THEN** la sección «Competición» muestra la entrada «Pronóstico de partidos» que abre `/coach/match-forecast?teamId=` de su equipo y no muestra «Estadísticas de rivales»

#### Scenario: Título de la página
- **WHEN** el usuario abre `/coach/match-forecast?teamId=`
- **THEN** la página muestra el título «Pronóstico de partidos»

#### Scenario: Botón de la simulación
- **WHEN** un usuario con rol Coach abre la página de un equipo con competición RFFM configurada
- **THEN** ve el botón «Crear pronóstico», que abre `/coach/match-forecast/simulation` conservando la query string, y no ve ningún botón «Simulación»

#### Scenario: La barra de navegación del equipo se muestra en la ruta nueva
- **WHEN** el usuario está en `/coach/match-forecast` o en `/coach/match-forecast/simulation`
- **THEN** se muestra la navegación del equipo igual que antes se mostraba en las rutas `rival-stats`

#### Scenario: El cálculo no cambia
- **WHEN** se piden las estadísticas o la simulación de una liga después del renombrado, con los mismos datos guardados
- **THEN** la respuesta contiene los mismos valores que antes del renombrado

### Requirement: Las rutas antiguas del frontend redirigen a las nuevas
La aplicación Coach SHALL redirigir `/coach/rival-stats` a `/coach/match-forecast` y `/coach/rival-stats/simulation` a `/coach/match-forecast/simulation`, conservando en la redirección la query string, que incluye `teamId`; la ruta no lleva ningún identificador de equipo, que viaja solo en la query string. Los enlaces de notificaciones push enviadas antes del cambio SHALL seguir llevando a la página del equipo correspondiente.

#### Scenario: Ruta antigua de la página
- **WHEN** un usuario abre `/coach/rival-stats?teamId=abc`
- **THEN** la aplicación lo redirige a `/coach/match-forecast?teamId=abc` y se muestra la página «Pronóstico de partidos» del equipo `abc`

#### Scenario: Ruta antigua de la simulación
- **WHEN** un usuario abre `/coach/rival-stats/simulation?teamId=abc`
- **THEN** la aplicación lo redirige a `/coach/match-forecast/simulation?teamId=abc` y se muestra la página de simulación del equipo `abc`

#### Scenario: Enlace de una notificación push ya enviada
- **WHEN** un usuario abre el enlace `/coach/rival-stats?teamId=abc` de una notificación push enviada antes del cambio
- **THEN** llega a la página «Pronóstico de partidos» del equipo `abc`

### Requirement: Las rutas de la API usan `match-forecast`
La API SHALL exponer las operaciones de estadísticas y simulación de la liga del equipo bajo `/api/teams/{teamId}/match-forecast/...` con la misma estructura de subrutas, métodos, acceso y respuestas que tenían bajo `/api/teams/{teamId}/rival-stats/...`. Las rutas `/api/teams/{teamId}/rival-stats/...` SHALL dejar de existir y SHALL NOT redirigir a las nuevas.

#### Scenario: Ruta nueva disponible
- **WHEN** un miembro del equipo pide `GET /api/teams/{teamId}/match-forecast`
- **THEN** recibe el estado de las estadísticas de la liga con la misma respuesta que antes devolvía `GET /api/teams/{teamId}/rival-stats`

#### Scenario: Ruta antigua inexistente
- **WHEN** un cliente pide `GET /api/teams/{teamId}/rival-stats`
- **THEN** la API responde 404 y no redirige a la ruta nueva

### Requirement: Solo el rol Coach ve y usa las acciones que generan o actualizan el pronóstico
La página «Pronóstico de partidos» SHALL mostrar los controles «Crear pronóstico», «Actualizar», «Generar estadísticas» y «Reintentar» únicamente a los usuarios con rol Coach. Un usuario sin rol Coach, incluido uno con rol Administrator pero sin rol Coach, SHALL seguir viendo la página con sus datos (estado, equipos y jugadores con sus estadísticas), pero SHALL NOT ver esos controles.

#### Scenario: Entrenador ve los controles
- **WHEN** un usuario con rol Coach abre la página de un equipo con competición configurada y estadísticas completadas
- **THEN** ve los botones «Crear pronóstico» y «Actualizar»

#### Scenario: Usuario sin rol Coach no ve «Crear pronóstico» ni «Actualizar»
- **WHEN** un usuario sin rol Coach, por ejemplo un jugador o un familiar, abre la página de un equipo con estadísticas completadas
- **THEN** ve el estado, la lista de equipos y las estadísticas de sus jugadores, y no ve los botones «Crear pronóstico» ni «Actualizar»

#### Scenario: Administrador sin rol Coach no ve los controles
- **WHEN** un usuario con rol Administrator y sin rol Coach abre la página
- **THEN** no ve los botones «Crear pronóstico» ni «Actualizar»

#### Scenario: Usuario sin rol Coach ante una liga sin estadísticas
- **WHEN** un usuario sin rol Coach abre la página y no existe informe para la liga de su equipo
- **THEN** ve el estado vacío sin el botón «Generar estadísticas»

#### Scenario: Usuario sin rol Coach ante una generación fallida
- **WHEN** un usuario sin rol Coach abre la página y el informe está en estado fallido
- **THEN** ve el aviso de error con el mensaje y sin el botón «Reintentar»

### Requirement: El endpoint de actualización exige el rol Coach
`POST /api/teams/{teamId}/match-forecast/requests` SHALL exigir que el usuario autenticado tenga el rol Coach, además de las comprobaciones de acceso que ya tenía. Si el usuario no tiene el rol Coach, la API SHALL responder 403 con `ProblemDetails`, SHALL NOT crear ni modificar ningún informe y SHALL NOT encolar ninguna generación. Un usuario con rol Administrator y sin rol Coach SHALL recibir la misma respuesta.

#### Scenario: Usuario sin rol Coach llama directamente al endpoint
- **WHEN** un usuario sin rol Coach llama a `POST /api/teams/{teamId}/match-forecast/requests`
- **THEN** la API responde 403 con `ProblemDetails`, no se crea ni se modifica ningún informe y no se encola ninguna generación

#### Scenario: Administrador sin rol Coach llama al endpoint
- **WHEN** un usuario con rol Administrator y sin rol Coach llama al endpoint
- **THEN** la API responde 403 con `ProblemDetails` y no encola ninguna generación

#### Scenario: Entrenador llama al endpoint
- **WHEN** un usuario con rol Coach miembro del equipo llama al endpoint con una liga sin informe
- **THEN** se crea el informe pendiente, se encola su generación y la respuesta es 202
