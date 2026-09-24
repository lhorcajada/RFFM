## ADDED Requirements

### Requirement: Duración de cada partido en el objetivo de minutos
El sistema SHALL usar como duración de cada partido del objetivo de minutos la duración guardada
del partido (`MatchDurationMinutes`) si es mayor que 0 y, si es 0 o nula, la duración estándar de
la categoría (2 × minutos por parte). Los minutos de un jugador en un partido SHALL contar como
máximo hasta la duración de ese partido.

#### Scenario: Sin duración guardada se usa la categoría
- **WHEN** un jugador de Cadete juega 50' en uno de dos partidos sin duración guardada, y en ese
  partido nadie pasó de 70'
- **THEN** los minutos totales son 160 y su `MinutesPlayedPercentOfSeasonTotal` es 31,2 (31,25 redondeado a 1 decimal; en pantalla 31%)

#### Scenario: Con duración guardada se usa esa
- **WHEN** un partido de Cadete tiene `MatchDurationMinutes` 70
- **THEN** ese partido aporta 70' al total, aunque la categoría sea de 80'

#### Scenario: Duración cero cae a la categoría
- **WHEN** un partido de Cadete tiene `MatchDurationMinutes` 0
- **THEN** ese partido aporta 80' al total

#### Scenario: Minutos del jugador limitados a la duración
- **WHEN** un partido tiene `MatchDurationMinutes` 60 y un jugador registró 70'
- **THEN** ese partido le cuenta 60' en el objetivo de minutos

#### Scenario: La ausencia usa la misma duración
- **WHEN** un jugador tiene una ausencia imputable en un partido sin duración guardada de Cadete
- **THEN** `MatchMinutes` de esa ausencia es 80
