# rffm-standings Specification

## Purpose
TBD - created by archiving change compute-rffm-standings. Update Purpose after archive.
## Requirements
### Requirement: Clasificación calculada a partir de los resultados guardados
El sistema SHALL calcular la clasificación de un grupo con los partidos guardados que tienen
resultado (goles de local y visitante), tengan o no el acta cerrada. Para cada equipo SHALL
calcular: jugados, ganados, empatados, perdidos, goles a favor y en contra, lo mismo como local y
como visitante, puntos de local y de visitante, y la racha de sus 5 últimos resultados por orden de
jornada. Los puntos SHALL calcularse con los de la competición en la RFFM (`ptos_ganado`,
`ptos_empatado`, `ptos_perdido`) y restando los puntos de sanción conocidos.

#### Scenario: Partido con resultado y acta abierta
- **WHEN** un partido tiene goles pero su acta aún no está cerrada
- **THEN** cuenta en la clasificación

#### Scenario: Racha
- **WHEN** un equipo ha jugado las jornadas 1 a 7 con G, G, P, E, G, P, G
- **THEN** su racha es P, E, G, P, G (los 5 últimos, en orden de jornada)

### Requirement: Desempates del Reglamento General de la RFFM
Los equipos empatados a puntos SHALL ordenarse así:
- **Empate entre dos:** diferencia de goles en los partidos entre ellos; después, diferencia de
  goles general; después, goles a favor.
- **Empate entre más de dos:** puntos en los partidos entre ellos; después, diferencia de goles en
  esos partidos; después, diferencia de goles general y goles a favor.

Los criterios de enfrentamiento directo SHALL aplicarse solo cuando se han jugado todos los
partidos programados entre los equipos empatados; si no, se pasa directamente a la diferencia
general. Los criterios SHALL aplicarse de forma eliminatoria: cuando un criterio separa al grupo
mejor clasificado, los equipos restantes vuelven a desempatarse desde el primer criterio. Si el
empate persiste, SHALL ordenarse por nombre.

#### Scenario: Dos equipos con los dos partidos jugados
- **WHEN** A y B empatan a puntos, A ganó los dos partidos entre ellos y B tiene mejor diferencia general
- **THEN** A queda por delante de B

#### Scenario: Dos equipos con solo la ida jugada
- **WHEN** A y B empatan a puntos, A ganó la ida, aún no se ha jugado la vuelta y B tiene mejor diferencia general
- **THEN** B queda por delante de A

#### Scenario: Triple empate con carácter eliminatorio
- **WHEN** A, B y C empatan a puntos, sus partidos entre sí no están completos, A tiene la mejor diferencia general, y B ganó los dos partidos contra C aunque C tiene mejor diferencia general que B
- **THEN** el orden es A, B, C

### Requirement: Clasificación guardada y viva
El sistema SHALL guardar la clasificación vigente del grupo y una foto de la clasificación tras
cada jornada, y SHALL recalcularlas cada vez que una actualización desde la RFFM cambie algún
partido del grupo. `GET /classification` SHALL devolver la clasificación guardada del grupo con el
mismo contrato de hoy, actualizando antes desde la RFFM las jornadas que lo necesiten según la
política de refresco. Si faltan jornadas pasadas por descargar, SHALL devolver la clasificación
oficial de la RFFM.

#### Scenario: Termina un partido durante la jornada
- **WHEN** un usuario abre la clasificación después de que termine un partido y la jornada se refresca con su resultado
- **THEN** la clasificación devuelta ya incluye ese resultado

#### Scenario: Clasificación sin cambios
- **WHEN** un segundo usuario abre la clasificación y ninguna jornada necesita refresco
- **THEN** la respuesta sale de la base de datos sin ninguna petición a la RFFM

### Requirement: Conciliación con la clasificación oficial
Cuando todos los partidos de una jornada tengan el acta cerrada, el sistema SHALL pedir una vez, en
segundo plano, la clasificación oficial de esa jornada. SHALL guardar de ella los puntos de sanción
y los colores de las franjas de ascenso y descenso por posición, y aplicarlos a la clasificación
calculada. Si las estadísticas oficiales coinciden con las calculadas pero el orden es distinto,
SHALL usar el orden oficial para esa jornada y registrar la diferencia en el log.

#### Scenario: Puntos de sanción
- **WHEN** la clasificación oficial de la jornada indica que un equipo tiene 3 puntos de sanción
- **THEN** la clasificación calculada le resta esos 3 puntos

#### Scenario: Orden distinto con los mismos datos
- **WHEN** la clasificación oficial tiene los mismos puntos y goles por equipo que la calculada pero intercambia dos equipos empatados
- **THEN** la clasificación de esa jornada usa el orden oficial y la diferencia queda registrada en el log

