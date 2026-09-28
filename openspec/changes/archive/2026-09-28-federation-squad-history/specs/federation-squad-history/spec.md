## ADDED Requirements

### Requirement: Solicitar el historial de la plantilla desde Plantilla
La página Plantilla de Federación SHALL mostrar un botón "Historial" cuando hay un equipo
seleccionado. Al pulsarlo, si ya existe un informe completado para ese equipo y temporada, SHALL
navegar a `/federation/squad-history/{teamCode}?seasonId={seasonId}`. Si no existe o está en
curso, SHALL encolar la generación en segundo plano y mostrar el aviso "Estamos recopilando el
historial. Te avisaremos con una notificación cuando esté listo." sin navegar.

#### Scenario: Informe ya disponible
- **WHEN** el usuario pulsa "Historial" y el informe del equipo para la temporada está completado
- **THEN** se abre la página de historial sin lanzar un nuevo proceso

#### Scenario: Informe inexistente
- **WHEN** el usuario pulsa "Historial" y no existe informe para el equipo y la temporada
- **THEN** se crea un informe pendiente, se encola y se muestra el aviso de notificación

#### Scenario: Informe en curso solicitado por otro usuario
- **WHEN** un segundo usuario pulsa "Historial" mientras el informe se está generando
- **THEN** no se encola un segundo proceso y el segundo usuario también recibe la notificación al terminar

### Requirement: Contenido del historial por equipo
El informe SHALL contener, para cada jugador de la plantilla y para la temporada seleccionada y
la inmediatamente anterior, una entrada por cada equipo en el que participó con: temporada,
competición, grupo, equipo, club, puntos y posición del equipo, goles, tarjetas amarillas,
tarjetas rojas (incluidas dobles amarillas), titularidades y convocatorias. Si el jugador
participó en un único equipo en la temporada, SHALL usar los totales de su ficha RFFM; si
participó en varios, SHALL calcular los valores de cada equipo a partir de las actas de sus partidos.

#### Scenario: Un solo equipo en la temporada
- **WHEN** la ficha del jugador en una temporada tiene una única competición
- **THEN** la entrada usa los totales de la ficha y se marca como "Totales de temporada"

#### Scenario: Varios equipos en la temporada
- **WHEN** la ficha del jugador en una temporada tiene dos competiciones con equipos distintos
- **THEN** hay una entrada por equipo con goles, tarjetas, titularidades y convocatorias calculados desde las actas de ese equipo y marcada "Desde actas"

#### Scenario: Error al obtener los datos de un jugador
- **WHEN** las peticiones de un jugador fallan tras agotar los reintentos
- **THEN** el informe se completa igualmente y las entradas de ese jugador se marcan como incompletas

### Requirement: Posibles jugadores para una plantilla todavía vacía
Si el equipo seleccionado no tiene jugadores, el proceso SHALL proponer como posibles jugadores a
los que, en la temporada anterior, jugaron en equipos del mismo club de la categoría del equipo o
de la categoría inmediatamente inferior (Cadete→Infantil, Infantil→Alevín, Juvenil→Cadete,
Senior→Juvenil; Alevín sin inferior), del mismo tipo (femenino o no), y cuyo año de nacimiento
corresponde a la categoría del equipo en la temporada seleccionada (con Y = año de inicio: Alevín
Y-11..Y-10, Infantil Y-13..Y-12, Cadete Y-15..Y-14, Juvenil Y-18..Y-16, Senior ≤ Y-19). Los equipos
del club SHALL obtenerse de la ficha del club y, si no está disponible, identificarse por nombre en
las competiciones y grupos de la temporada anterior. Como la RFFM solo publica la plantilla actual
de cada equipo, los jugadores de la temporada anterior SHALL obtenerse de las dos últimas actas de
cada equipo en su grupo de esa temporada. El historial de cada posible jugador SHALL incluir su
equipo de procedencia.

#### Scenario: Cadete sin jugadores
- **WHEN** el equipo seleccionado es Cadete en 2026-2027 (nacidos en 2011-2012), no tiene jugadores
  y el club tuvo en 2025-2026 un equipo Cadete con jugadores de 2011 y 2010 y un Infantil con
  jugadores de 2012 y 2013
- **THEN** se proponen los de 2011 (siguen en cadete) y 2012 (infantiles de último año que suben), y
  no los de 2010 (pasan a juvenil) ni 2013 (siguen en infantil)

#### Scenario: Plantillas actuales vaciadas al inicio de temporada
- **WHEN** la ficha actual de los equipos del club no tiene jugadores o ya tiene los de la nueva
  temporada
- **THEN** los posibles jugadores salen igualmente de las dos últimas actas de la temporada anterior

#### Scenario: Ficha del club no disponible
- **WHEN** la ficha del club no responde tras los reintentos
- **THEN** los equipos del club se obtienen de las competiciones y grupos de la temporada anterior

#### Scenario: Equipo femenino
- **WHEN** el equipo seleccionado es femenino
- **THEN** solo se buscan posibles jugadoras en equipos femeninos del club

#### Scenario: El equipo ya tiene jugadores al actualizar
- **WHEN** se actualiza el historial de un equipo que antes no tenía jugadores y ahora sí
- **THEN** el informe muestra la plantilla real y deja de mostrar posibles jugadores

### Requirement: Año de nacimiento en el historial
El historial SHALL mostrar el año de nacimiento de cada jugador cuando la RFFM lo proporciona.

#### Scenario: Jugador con año de nacimiento
- **WHEN** la ficha del jugador indica que nació en 2011
- **THEN** su tarjeta del historial muestra "Nacido en 2011"

### Requirement: Peticiones a la RFFM resilientes y espaciadas
El proceso en segundo plano SHALL realizar como máximo una petición a la RFFM a la vez, con una
pausa mínima configurable entre peticiones, y SHALL reintentar los errores transitorios (fallo de
conexión, timeout, 408, 429, 5xx) con backoff exponencial y jitter, respetando `Retry-After`.
Cada acta y cada calendario de grupo SHALL descargarse como máximo una vez por informe.

#### Scenario: Error transitorio
- **WHEN** una petición a la RFFM devuelve 503 y la siguiente devuelve 200
- **THEN** el dato se obtiene sin marcar el jugador como incompleto

#### Scenario: Acta compartida
- **WHEN** dos jugadores de la plantilla jugaron en el mismo equipo la temporada anterior
- **THEN** las actas de ese equipo se descargan una sola vez durante el informe

### Requirement: Persistencia, actualización y recuperación
El informe SHALL persistirse por (equipo, temporada). La página de historial SHALL ofrecer
"Actualizar", que regenera el informe en segundo plano mostrando mientras tanto los datos
anteriores y el progreso. Los informes pendientes o en curso SHALL reanudarse tras un reinicio
del servidor.

#### Scenario: Actualizar
- **WHEN** el usuario pulsa "Actualizar" en un informe completado
- **THEN** se muestra el progreso, los datos anteriores siguen visibles y se reemplazan al terminar

#### Scenario: Reinicio del servidor
- **WHEN** el servidor se reinicia con un informe en estado "En curso"
- **THEN** el informe se vuelve a encolar al arrancar y termina

### Requirement: Notificación en Federación
Al completarse o fallar un informe, SHALL crearse una notificación para cada usuario que lo
solicitó, con enlace a la página de historial. La cabecera de Federación SHALL mostrar una
campana con el número de notificaciones no leídas; al pulsar una notificación SHALL marcarse como
leída y navegar a su enlace.

#### Scenario: Notificación de informe listo
- **WHEN** termina la generación del informe solicitado por el usuario
- **THEN** la campana muestra una notificación no leída "Historial de plantilla listo"

#### Scenario: Abrir desde la notificación
- **WHEN** el usuario pulsa la notificación
- **THEN** se marca como leída y se abre `/federation/squad-history/{teamCode}?seasonId={seasonId}`
