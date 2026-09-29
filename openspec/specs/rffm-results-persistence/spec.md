# rffm-results-persistence Specification

## Purpose
TBD - created by archiving change persist-rffm-results. Update Purpose after archive.
## Requirements
### Requirement: Resultados persistidos y compartidos entre usuarios
El sistema SHALL guardar en la base de datos, por grupo de la RFFM, las jornadas (número, nombre,
fecha), los partidos con todos los campos que devuelve la RFFM para una jornada, la clasificación
del grupo y la duración de sus partidos (`minutos_juego`, `numero_partes` de la competición). Los
datos SHALL ser compartidos por todos los usuarios: la primera consulta de una jornada que no está
guardada SHALL descargarla de la RFFM y guardarla, y las consultas siguientes de cualquier usuario
SHALL servirse desde la base de datos mientras no falten datos.

#### Scenario: Primer usuario que consulta una jornada
- **WHEN** un usuario consulta la jornada 1 de un grupo que no está en la base de datos
- **THEN** el sistema descarga la jornada de la RFFM, guarda el grupo, todas sus jornadas y los partidos de la jornada 1, y devuelve los partidos

#### Scenario: Segundo usuario con datos completos
- **WHEN** otro usuario consulta la misma jornada y todos sus partidos tienen el acta cerrada
- **THEN** la respuesta sale de la base de datos sin ninguna petición a la RFFM

#### Scenario: Contrato sin cambios
- **WHEN** se consulta `GET /calendar/matchday?groupId=&round=`
- **THEN** la respuesta tiene la misma forma y los mismos valores que cuando se leía directamente de la RFFM

### Requirement: Refresco de la jornada solo cuando faltan datos
Al consultar una jornada guardada, el sistema SHALL pedirla de nuevo a la RFFM, y actualizar los
partidos que hayan cambiado, solo si alguno de sus partidos sin el acta cerrada cumple una de estas
condiciones:
(a) no tiene fecha u hora, y la jornada no se ha consultado a la RFFM en las últimas 6 horas;
(b) ya ha podido terminar (`inicio + minutos_juego + 10 minutos × (numero_partes − 1)`, en la hora
de Madrid) y la jornada no se ha consultado a la RFFM en los últimos 10 minutos (o en las últimas
24 horas si el fin estimado fue hace más de 48 horas);
(c) empieza en los próximos 7 días y la jornada no se ha consultado a la RFFM en las últimas 24 horas.
Un partido con el acta cerrada SHALL considerarse definitivo y no provocar ningún refresco.

#### Scenario: Partido sin horario
- **WHEN** un partido de la jornada no tiene hora y la última consulta a la RFFM fue hace 7 horas
- **THEN** el sistema pide la jornada a la RFFM y guarda la hora si ya está publicada

#### Scenario: Partido sin horario consultado recientemente
- **WHEN** un partido no tiene hora y la última consulta a la RFFM fue hace 1 hora
- **THEN** la respuesta sale de la base de datos sin ninguna petición a la RFFM

#### Scenario: Partido de 80 minutos que ya ha podido terminar
- **WHEN** un partido de una competición de 80 minutos en 2 partes empezó a las 12:30, son las 14:05 y su acta no está cerrada
- **THEN** el sistema pide la jornada a la RFFM y guarda el resultado

#### Scenario: Partido de 90 minutos que aún no ha podido terminar
- **WHEN** un partido de una competición de 90 minutos en 2 partes empezó a las 12:30, son las 14:05 y ningún otro partido cumple una condición de refresco
- **THEN** la respuesta sale de la base de datos sin ninguna petición a la RFFM

#### Scenario: Consultas simultáneas
- **WHEN** dos usuarios consultan a la vez una jornada que necesita refresco
- **THEN** se hace una única petición a la RFFM y ambos reciben los datos actualizados

#### Scenario: La RFFM no responde
- **WHEN** hay que refrescar una jornada guardada y la RFFM falla
- **THEN** se devuelven los datos guardados, sin error para el usuario

### Requirement: Acta completa de los partidos cerrados
Cuando un partido pase a tener el acta cerrada, el sistema SHALL descargar su acta completa
(alineaciones, goles, tarjetas, sustituciones, técnicos y árbitros) en segundo plano, una sola vez,
con el cliente RFFM con reintentos y throttling, y SHALL guardarla. Las actas pendientes SHALL
volver a encolarse al reiniciar la aplicación. `GET /acta/{codActa}` SHALL devolver el acta guardada
sin llamar a la RFFM cuando exista.

#### Scenario: Se cierra el acta de un partido
- **WHEN** un refresco detecta que un partido tiene ahora el acta cerrada
- **THEN** su acta se encola, se descarga y se guarda, y se actualiza la clasificación del grupo

#### Scenario: Acta ya guardada
- **WHEN** se consulta `GET /acta/{codActa}` de un partido con el acta guardada
- **THEN** se devuelve el acta guardada sin ninguna petición a la RFFM

#### Scenario: Reinicio con actas pendientes
- **WHEN** la aplicación arranca y hay partidos con el acta cerrada pero sin acta guardada
- **THEN** esas actas se encolan para descargarse

