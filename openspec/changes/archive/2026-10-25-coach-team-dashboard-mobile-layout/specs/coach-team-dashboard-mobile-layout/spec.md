## ADDED Requirements

### Requirement: El inicio del equipo destaca el próximo evento

`/coach/team-dashboard` SHALL mostrar el primer evento futuro del equipo en una tarjeta «Próximo
evento» con la etiqueta del día («Hoy», «Mañana», el día de la semana o la fecha), el tipo de evento
(«Partido de liga», «Amistoso» o «Torneo» según la categoría del partido, si no el tipo del evento,
p. ej. «Entrenamiento»), «Local» o «Visitante» en partidos con rival, el nombre del evento (su
`name` cuando no trae título), la hora con la llegada (o «Hora por confirmar») y el lugar, enlazado
al mapa cuando el evento tiene `locationMapUrl`. Las filas de «Después» SHALL mostrar el mismo
nombre y la línea «tipo · Local/Visitante · hora».

#### Scenario: Tarjeta del próximo evento
- **WHEN** el próximo evento es «vs CF Majadahonda B» el sábado a las 10:30 con llegada a las 09:45
- **THEN** la tarjeta «Próximo evento» muestra «Próximo · sábado», «vs CF Majadahonda B» y «10:30 · Llegada 09:45»

#### Scenario: Partido de liga en «Después»
- **WHEN** un evento siguiente es el partido de liga en casa «vs A.D.C.R. LEMANS 'D'» a las 10:30
- **THEN** su fila muestra «vs A.D.C.R. LEMANS 'D'» y «Partido de liga · Local · 10:30»

#### Scenario: Entrenamiento sin título
- **WHEN** un evento de tipo Entrenamiento no tiene título y se llama «Entrenamiento Jueves»
- **THEN** su fila muestra «Entrenamiento Jueves» y «Entrenamiento · 19:00 · Llegada 19:40»

#### Scenario: Evento sin hora
- **WHEN** el próximo evento no tiene hora de inicio
- **THEN** la tarjeta muestra «Hora por confirmar»

### Requirement: El jugador responde desde el próximo evento

Para Player/FamilyMember, la tarjeta del próximo evento SHALL mostrar el estado propio («Estás
convocado · sin responder», «Vas», «No vas», «Lesionado», «¿Estás disponible?», «Disponible» o «No
disponible») y, cuando la convocatoria está pendiente, los botones «Voy» y «No voy»; cuando se le
pide disponibilidad, «Sí» y «No». Las filas de «Después» SHALL ofrecer las mismas respuestas como
botones de icono con esos mismos nombres accesibles. «No voy» y «No» SHALL pedir el motivo como hoy.

#### Scenario: Convocatoria pendiente
- **WHEN** un jugador convocado sin responder abre el inicio del equipo
- **THEN** la tarjeta muestra «Estás convocado · sin responder» y los botones «Voy» y «No voy»

#### Scenario: Ya ha respondido
- **WHEN** el jugador ya aceptó la convocatoria del próximo evento
- **THEN** la tarjeta muestra «Vas» y no muestra «Voy» ni «No voy»

#### Scenario: Responder desde una fila
- **WHEN** el jugador pulsa «Voy» en una fila de «Después»
- **THEN** se acepta la convocatoria de ese evento igual que desde la tarjeta

### Requirement: El entrenador ve el estado de la convocatoria

Para Coach/Administrator, la tarjeta del próximo evento SHALL mostrar una barra con el reparto van /
pendientes / no van, las cifras Convocados, Van, Pendientes y No van, y un enlace «Gestionar
convocatoria» al detalle del evento. Sin convocados SHALL mostrar «Aún no hay convocados» en lugar
de la barra.

#### Scenario: Cifras de la convocatoria
- **WHEN** el próximo evento tiene 14 convocados, 9 van, 3 pendientes y 2 no van
- **THEN** la tarjeta muestra esas cuatro cifras y la barra se describe como «14 convocados: 9 van, 3 pendientes, 2 no van»

#### Scenario: Sin convocados
- **WHEN** el próximo evento no tiene convocados
- **THEN** la tarjeta muestra «Aún no hay convocados» y no muestra la barra

### Requirement: Bloque Liga para jugadores y familias

Para Player/FamilyMember cuyo equipo tiene competición y grupo RFFM, el inicio SHALL mostrar un
bloque «Liga» con la posición y los puntos del equipo (de la clasificación), la racha de los últimos
cinco partidos jugados y el último resultado con V/E/D, enlazados a Resultados y Clasificación con
el `teamId`. Los partidos y el resultado SHALL salir del calendario del equipo con las mismas reglas
que la página de Resultados: solo cuentan los partidos con goles numéricos (un marcador vacío no es
un 0–0), se ignoran los suspendidos y las jornadas de descanso, se ordenan por jornada y el marcador
se muestra con los goles propios primero. El bloque
SHALL NOT mostrarse al entrenador, sin competición, mientras carga ni si el equipo no aparece en la
clasificación. Sin partidos jugados SHALL mostrar solo la posición.

#### Scenario: Liga con partidos jugados
- **WHEN** el equipo es 3.º con 7 puntos y en la jornada 3 ganó 0–4 como visitante a S.A.D. A.V. CASERIO PERALES 'B'
- **THEN** el bloque muestra «3.º», «7 pts», «4 – 0», «V» y «J3 · vs S.A.D. A.V. CASERIO PERALES 'B'»

#### Scenario: Partido aún sin jugar
- **WHEN** la jornada 4 del equipo tiene los goles vacíos
- **THEN** no cuenta en la racha ni como último resultado

#### Scenario: Equipo sin competición
- **WHEN** el equipo no tiene competición RFFM asociada
- **THEN** no se muestra el bloque «Liga»

#### Scenario: Entrenador
- **WHEN** un entrenador abre el inicio del equipo
- **THEN** no se muestra el bloque «Liga»

### Requirement: Acciones rápidas del entrenador

Para Coach/Administrator, el inicio SHALL mostrar «Acciones rápidas» con Plantilla, Lesionados y
Resumen de asistencias, cada una solo si el usuario tiene permiso, con las mismas rutas que el Menú
del equipo. Sin ninguna visible, el bloque SHALL NOT mostrarse. Player/FamilyMember SHALL NOT verlo.

#### Scenario: Entrenador con permisos
- **WHEN** un entrenador con acceso a Plantilla y Lesionados abre el inicio
- **THEN** ve «Plantilla» y «Lesionados» enlazados a `/coach/squad?teamId=…` y `/coach/injured?teamId=…`

#### Scenario: Jugador
- **WHEN** un jugador abre el inicio del equipo
- **THEN** no se muestra «Acciones rápidas»
