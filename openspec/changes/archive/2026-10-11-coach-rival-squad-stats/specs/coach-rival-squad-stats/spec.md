## ADDED Requirements

### Requirement: Generar las estadísticas de la liga a demanda
El sistema SHALL permitir a un usuario con acceso al equipo solicitar la generación de las
estadísticas de las plantillas de la liga del equipo (competición y grupo RFFM configurados en
el equipo, temporada RFFM actual). La generación SHALL ejecutarse en segundo plano y el informe
SHALL ser único por temporada, competición y grupo, compartido entre todos los equipos de
entrenador que jueguen esa liga.

#### Scenario: Liga sin estadísticas
- **WHEN** el entrenador solicita las estadísticas y no existe informe para su liga
- **THEN** se crea un informe pendiente, se encola su generación y la respuesta es 202

#### Scenario: Generación ya en curso
- **WHEN** se solicita la generación o la actualización mientras el informe está pendiente o en curso
- **THEN** no se encola un segundo proceso y la respuesta es 202 con el estado actual

#### Scenario: Equipo sin competición configurada
- **WHEN** el equipo no tiene competición o grupo RFFM configurados
- **THEN** la respuesta es un ProblemDetails 409 y no se crea ningún informe

#### Scenario: Usuario sin acceso al equipo
- **WHEN** un jugador o familiar que no pertenece al equipo solicita o consulta las estadísticas
- **THEN** la respuesta es 403

### Requirement: Contenido de las estadísticas
El informe SHALL contener todos los equipos del grupo y, por cada equipo, los jugadores de su
plantilla actual. Por cada jugador SHALL guardarse, para la temporada actual y la inmediatamente
anterior, los totales de su ficha RFFM: convocatorias, titularidades, suplencias, partidos
jugados, goles, tarjetas amarillas, rojas y dobles amarillas, además de los equipos en los que
participó esa temporada (competición, grupo, equipo, puntos y posición).

#### Scenario: Jugador con actividad en las dos temporadas
- **WHEN** se genera el informe y la RFFM devuelve la ficha del jugador en ambas temporadas
- **THEN** se guardan dos registros de estadísticas del jugador, uno por temporada

#### Scenario: Jugador sin actividad en la temporada pasada
- **WHEN** la RFFM no tiene actividad del jugador en la temporada anterior
- **THEN** el jugador aparece solo con la temporada actual y el informe se completa igualmente

#### Scenario: La ficha de un jugador falla
- **WHEN** la RFFM no devuelve la ficha de un jugador tras los reintentos
- **THEN** el jugador se cuenta como fallido, se conservan sus estadísticas guardadas anteriormente si existían y el resto del informe se completa

#### Scenario: No se pueden obtener los equipos del grupo
- **WHEN** la RFFM no devuelve los equipos del grupo
- **THEN** el informe pasa a estado fallido con un mensaje de error y conserva los datos de la última generación correcta

### Requirement: Las actualizaciones solo descargan la temporada actual
Al actualizar un informe, el sistema SHALL volver a descargar las plantillas y las fichas de la
temporada actual, y SHALL NOT volver a descargar la ficha de la temporada anterior de los
jugadores que ya la tienen guardada.

#### Scenario: Actualización de un informe existente
- **WHEN** se actualiza un informe cuyos jugadores ya tienen guardada la temporada anterior
- **THEN** solo se pide a la RFFM la ficha de la temporada actual de cada jugador

#### Scenario: Jugador nuevo en una plantilla
- **WHEN** en una actualización aparece en una plantilla un jugador que no estaba guardado
- **THEN** se descargan sus fichas de la temporada actual y de la anterior

#### Scenario: Jugador que ya no está en la plantilla
- **WHEN** en una actualización un jugador ya no figura en la plantilla del equipo
- **THEN** deja de aparecer en ese equipo del informe

### Requirement: Actualización a demanda con intervalo mínimo
El entrenador SHALL poder pedir la actualización de un informe ya generado. El sistema SHALL
rechazar la actualización si la última finalizó hace menos del intervalo mínimo configurado
(60 minutos por defecto), devolviendo el estado existente y el momento a partir del cual se
permite actualizar.

#### Scenario: Actualización permitida
- **WHEN** el entrenador pide actualizar y la última actualización terminó hace más del intervalo mínimo
- **THEN** el informe pasa a pendiente, se encola y la respuesta es 202

#### Scenario: Actualización demasiado reciente
- **WHEN** el entrenador pide actualizar y la última actualización terminó hace menos del intervalo mínimo
- **THEN** no se encola nada y la respuesta es 200 con el estado completado y la hora a partir de la cual podrá actualizar

### Requirement: Actualización automática semanal
El sistema SHALL actualizar, cada lunes a las 00:01 hora de Europe/Madrid, las estadísticas de
la liga de cada equipo de la app Coach que tenga competición y grupo RFFM configurados, sin
intervención del usuario y de una en una. SHALL NOT procesar ligas que no correspondan a ningún
equipo de Coach. Si el servidor no estaba en ejecución a esa hora, SHALL lanzar la actualización
pendiente al arrancar. La actualización automática SHALL NOT enviar notificaciones.

#### Scenario: Lunes a las 00:01
- **WHEN** llega el lunes a las 00:01 de Madrid
- **THEN** se encola la actualización de la liga de cada equipo de Coach con competición configurada que no esté ya pendiente o en curso

#### Scenario: Liga de un equipo de Coach sin informe todavía
- **WHEN** en la ejecución semanal un equipo de Coach tiene competición configurada y su liga no tiene informe
- **THEN** se crea el informe y se encola su generación

#### Scenario: Varios equipos de Coach en la misma liga
- **WHEN** dos equipos de Coach tienen configurada la misma competición y grupo
- **THEN** la liga se procesa una sola vez

#### Scenario: Informe de una liga sin equipos de Coach
- **WHEN** existe un informe de una liga que ya no corresponde a ningún equipo de Coach
- **THEN** la ejecución semanal no lo actualiza

#### Scenario: Servidor parado durante la ejecución programada
- **WHEN** el servidor arranca y hay ligas de equipos de Coach cuya última actualización es anterior al último lunes a las 00:01
- **THEN** se encola la actualización de esas ligas

#### Scenario: Reinicio durante una generación
- **WHEN** el servidor se reinicia con informes pendientes o en curso
- **THEN** esos informes se vuelven a encolar al arrancar

### Requirement: Notificación al terminar
Cuando termina una generación o actualización pedida por un usuario, el sistema SHALL avisar a
cada usuario que la pidió con una notificación in-app y web push que enlaza a la página de
rivales de su equipo, indicando si terminó correctamente o falló.

#### Scenario: Generación completada
- **WHEN** termina correctamente una generación pedida por un entrenador
- **THEN** el entrenador recibe una notificación «Estadísticas de rivales listas» con enlace a `/coach/rival-stats?teamId=` de su equipo

#### Scenario: Generación fallida
- **WHEN** falla una generación pedida por un entrenador
- **THEN** el entrenador recibe una notificación de error con el mismo enlace

#### Scenario: Varios usuarios piden la misma liga
- **WHEN** un segundo usuario pide la generación mientras está en curso
- **THEN** ambos reciben la notificación al terminar, cada uno una sola vez

#### Scenario: Actualización semanal
- **WHEN** termina una actualización lanzada por la ejecución semanal
- **THEN** no se envía ninguna notificación

### Requirement: Identificar el equipo propio en la liga
El equipo del entrenador SHALL poder guardar el código RFFM del equipo que representa dentro de
su competición y grupo. La página de rivales SHALL distinguir ese equipo del resto.

#### Scenario: Elegir el equipo al configurar la competición
- **WHEN** el usuario edita el equipo y ha elegido competición y grupo RFFM
- **THEN** puede elegir su equipo entre los equipos de ese grupo y el código se guarda con la competición

#### Scenario: Cambiar de competición o grupo
- **WHEN** el usuario cambia la competición o el grupo
- **THEN** el equipo RFFM elegido se borra hasta que elija uno del nuevo grupo

#### Scenario: Equipo propio en la página de rivales
- **WHEN** el equipo tiene código RFFM guardado y se muestran las estadísticas
- **THEN** su equipo aparece el primero y marcado como «Tu equipo»

#### Scenario: Equipo sin código RFFM
- **WHEN** el equipo no tiene código RFFM guardado
- **THEN** la página muestra todos los equipos sin distinguir y un aviso para elegirlo en la edición del equipo

### Requirement: Página de rivales del entrenador
La aplicación Coach SHALL ofrecer la página `/coach/rival-stats?teamId=`, accesible desde el
panel del equipo, que muestra las estadísticas de la liga del equipo en tarjetas (sin tablas) y
se adapta a móvil.

#### Scenario: Sin estadísticas generadas
- **WHEN** el entrenador abre la página y no existe informe para su liga
- **THEN** ve un estado vacío con el botón «Generar estadísticas»

#### Scenario: Generación en curso
- **WHEN** el informe está pendiente o en curso
- **THEN** la página muestra el progreso (jugadores procesados de total), se refresca sola hasta que termina y, si había datos anteriores, los sigue mostrando

#### Scenario: Estadísticas disponibles
- **WHEN** el informe está completado
- **THEN** la página muestra la fecha de la última actualización, el botón «Actualizar» y la lista de equipos de la liga; al abrir un equipo se ven sus jugadores con las estadísticas de la temporada actual y de la pasada

#### Scenario: Actualización no disponible todavía
- **WHEN** la última actualización es demasiado reciente
- **THEN** el botón «Actualizar» aparece deshabilitado indicando desde cuándo estará disponible

#### Scenario: Equipo sin competición configurada
- **WHEN** el equipo no tiene competición RFFM configurada
- **THEN** la página muestra el mismo aviso de competición sin configurar que Resultados y Clasificación

#### Scenario: La última generación falló
- **WHEN** el informe está en estado fallido
- **THEN** la página muestra un aviso de error con el botón para reintentar y los datos anteriores si existen
