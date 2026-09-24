# player-season-minutes-target Specification

## Purpose
TBD - created by archiving change season-minutes-target-attributable-absences. Update Purpose after archive.
## Requirements
### Requirement: Veredicto del objetivo de minutos separando responsabilidad del jugador
El sistema SHALL calcular, para cada jugador de un equipo de categoría F11, el porcentaje de
minutos jugados sobre sus minutos disponibles y un veredicto del objetivo de temporada del 30%.
Los minutos disponibles SHALL ser los minutos totales de la temporada menos la duración de los
partidos con ausencia imputable al jugador, según la definición existente de ausencia imputable
(incluye lesión y cualquier motivo que no sea decisión técnica). La respuesta de
`GET /api/catalog/team/{teamId}/player-stats` SHALL incluir `MinutesPlayedPercentOfAvailable` y
`MinutesTargetStatus`.

#### Scenario: Cumple el objetivo
- **WHEN** un jugador ha jugado 130' de 400' totales
- **THEN** `MinutesTargetStatus` es `Met`

#### Scenario: No llega por sus ausencias
- **WHEN** un jugador ha jugado 100' de 400' totales y tiene ausencias imputables en 2 partidos de 80'
- **THEN** sus minutos disponibles son 240', `MinutesPlayedPercentOfAvailable` es ≈ 41,7 y
  `MinutesTargetStatus` es `NotMetByOwnAbsences`

#### Scenario: No llega por decisión del entrenador
- **WHEN** un jugador ha jugado 60' de 400' totales y tiene una ausencia imputable en 1 partido de 80'
- **THEN** `MinutesPlayedPercentOfAvailable` es ≈ 18,8 (redondeado a 1 decimal) y `MinutesTargetStatus` es `NotMet`

#### Scenario: No ha acudido a ningún partido
- **WHEN** todos los partidos de la temporada son ausencias imputables del jugador
- **THEN** `MinutesPlayedPercentOfAvailable` es `null` y `MinutesTargetStatus` es `NotMetByOwnAbsences`

#### Scenario: La lesión resta de los minutos disponibles
- **WHEN** un jugador fue desconvocado de un partido con motivo Lesión
- **THEN** la duración de ese partido no forma parte de sus minutos disponibles

#### Scenario: Convocado, presente y sin minutos sigue siendo disponible
- **WHEN** un jugador fue convocado, asistió al partido y jugó 0 minutos
- **THEN** la duración de ese partido forma parte de sus minutos disponibles

#### Scenario: Decisión técnica y no convocado no restan
- **WHEN** un jugador fue desconvocado por decisión técnica o no fue convocado a un partido
- **THEN** la duración de ese partido forma parte de sus minutos disponibles

#### Scenario: Categoría sin objetivo
- **WHEN** la categoría del equipo no es F11 o el equipo no tiene minutos disputados
- **THEN** `MinutesPlayedPercentOfAvailable` y `MinutesTargetStatus` son `null`

### Requirement: Lista de ausencias imputables como prueba
El sistema SHALL exponer por jugador `AttributableAbsences`: un elemento por cada partido,
amistoso o torneo finalizado de la temporada con ausencia imputable al jugador, del más reciente
al más antiguo. Cada elemento SHALL incluir la fecha, el tipo de partido, el rival (o el nombre
del evento si no tiene rival), la duración del partido usada en el cálculo, el tipo de ausencia y
el motivo si lo hay.

#### Scenario: Convocado que no se presenta
- **WHEN** un jugador tiene asistencia "No asiste con excusa" o "No asiste sin excusa" en un partido
- **THEN** el elemento tiene `Kind` `NoShow` y `Reason` el motivo registrado o `null`

#### Scenario: Rechaza la convocatoria
- **WHEN** un jugador no tiene asistencia y su convocatoria está `Justified` o `Deconvoke` con
  motivo Enfermedad
- **THEN** el elemento tiene `Kind` `Declined` y `Reason` `Enfermedad`

#### Scenario: La lista coincide con el contador
- **WHEN** se consulta un jugador
- **THEN** el número de elementos de `AttributableAbsences` es igual a
  `MatchesAbsentAttributableToPlayer`

### Requirement: Visualización del veredicto y de las ausencias
La tarjeta de estadísticas del jugador SHALL mostrar, en equipos F11, el veredicto del objetivo,
un tramo diferenciado en la barra con el % de minutos perdidos por sus ausencias y, si tiene
ausencias imputables, un desplegable con la lista de ausencias en tarjetas (sin tablas). El PDF
de estadísticas SHALL incluir el veredicto y la lista.

#### Scenario: Veredicto en la tarjeta
- **WHEN** `MinutesTargetStatus` es `NotMetByOwnAbsences` con `MinutesPlayedPercentOfAvailable` 41,7
- **THEN** la tarjeta muestra "No llega por sus ausencias: 42% de sus minutos disponibles"

#### Scenario: Desplegable de ausencias
- **WHEN** el coach pulsa "Partidos no asistidos: 2"
- **THEN** se muestran dos tarjetas con fecha, tipo de partido y rival, minutos, tipo de ausencia
  y motivo

#### Scenario: El desplegable se reconoce como tal
- **WHEN** el jugador tiene ausencias imputables
- **THEN** "Partidos no asistidos: N" se muestra subrayado y con una flecha de desplegar que gira
  al abrirse

#### Scenario: Sin ausencias no hay desplegable
- **WHEN** el jugador no tiene ausencias imputables
- **THEN** se muestra "Partidos no asistidos: 0" como texto, sin botón

#### Scenario: PDF con la prueba
- **WHEN** se exporta el PDF de estadísticas de un jugador con ausencias imputables
- **THEN** su tarjeta incluye el veredicto y una línea por ausencia

