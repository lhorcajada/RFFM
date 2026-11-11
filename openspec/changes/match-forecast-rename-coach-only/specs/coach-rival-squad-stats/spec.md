## MODIFIED Requirements

### Requirement: Notificación al terminar
Cuando termina una generación o actualización pedida por un usuario, el sistema SHALL avisar a
cada usuario que la pidió con una notificación in-app y web push que enlaza a la página
«Pronóstico de partidos» de su equipo, indicando si terminó correctamente o falló. El título de la
notificación SHALL ser «Pronóstico de partidos listo» cuando termina correctamente y «No se pudo
generar el pronóstico de partidos» cuando falla, y ningún título ni texto SHALL llamar «Estadísticas
de rivales» a la página.

#### Scenario: Generación completada
- **WHEN** termina correctamente una generación pedida por un entrenador
- **THEN** el entrenador recibe una notificación con el título «Pronóstico de partidos listo» y enlace a `/coach/match-forecast?teamId=` de su equipo

#### Scenario: Generación fallida
- **WHEN** falla una generación pedida por un entrenador
- **THEN** el entrenador recibe una notificación de error con el título «No se pudo generar el pronóstico de partidos» y el mismo enlace

#### Scenario: Varios usuarios piden la misma liga
- **WHEN** un segundo usuario pide la generación mientras está en curso
- **THEN** ambos reciben la notificación al terminar, cada uno una sola vez

#### Scenario: Actualización semanal
- **WHEN** termina una actualización lanzada por la ejecución semanal
- **THEN** no se envía ninguna notificación

### Requirement: Identificar el equipo propio en la liga
El equipo del entrenador SHALL poder guardar el código RFFM del equipo que representa dentro de
su competición y grupo. La página «Pronóstico de partidos» SHALL distinguir ese equipo del resto.

#### Scenario: Elegir el equipo al configurar la competición
- **WHEN** el usuario edita el equipo y ha elegido competición y grupo RFFM
- **THEN** puede elegir su equipo entre los equipos de ese grupo y el código se guarda con la competición

#### Scenario: Cambiar de competición o grupo
- **WHEN** el usuario cambia la competición o el grupo
- **THEN** el equipo RFFM elegido se borra hasta que elija uno del nuevo grupo

#### Scenario: Equipo propio en la página de rivales
- **WHEN** el equipo tiene código RFFM guardado y se muestran las estadísticas en la página «Pronóstico de partidos»
- **THEN** su equipo aparece el primero y marcado como «Tu equipo»

#### Scenario: Equipo sin código RFFM
- **WHEN** el equipo no tiene código RFFM guardado
- **THEN** la página muestra todos los equipos sin distinguir y un aviso para elegirlo en la edición del equipo

### Requirement: Página de rivales del entrenador
La aplicación Coach SHALL ofrecer la página «Pronóstico de partidos» en `/coach/match-forecast?teamId=`, accesible desde el
panel del equipo, que muestra las estadísticas de la liga del equipo en tarjetas (sin tablas) y
se adapta a móvil. Los botones que generan o actualizan las estadísticas («Generar estadísticas», «Actualizar» y «Reintentar») SHALL mostrarse solo al rol Coach, según el requisito «Solo el rol Coach ve y usa las acciones que generan o actualizan el pronóstico» de la capacidad `match-forecast`.

#### Scenario: Sin estadísticas generadas
- **WHEN** un usuario con rol Coach abre la página y no existe informe para su liga
- **THEN** ve un estado vacío con el botón «Generar estadísticas»

#### Scenario: Generación en curso
- **WHEN** el informe está pendiente o en curso
- **THEN** la página muestra el progreso (jugadores procesados de total), se refresca sola hasta que termina y, si había datos anteriores, los sigue mostrando

#### Scenario: Estadísticas disponibles
- **WHEN** el informe está completado
- **THEN** la página muestra la fecha de la última actualización y la lista de equipos de la liga, y a un usuario con rol Coach también el botón «Actualizar»; al abrir un equipo se ven sus jugadores con las estadísticas de la temporada actual y de la pasada

#### Scenario: Actualización no disponible todavía
- **WHEN** la última actualización es demasiado reciente y el usuario tiene rol Coach
- **THEN** el botón «Actualizar» aparece deshabilitado indicando desde cuándo estará disponible

#### Scenario: Equipo sin competición configurada
- **WHEN** el equipo no tiene competición RFFM configurada
- **THEN** la página muestra el mismo aviso de competición sin configurar que Resultados y Clasificación

#### Scenario: La última generación falló
- **WHEN** el informe está en estado fallido
- **THEN** la página muestra un aviso de error con los datos anteriores si existen, y a un usuario con rol Coach también el botón para reintentar
