## ADDED Requirements

### Requirement: Cansancio derivado sin estado
El sistema SHALL calcular `Fatigue` (Cansancio, 0-100) de un jugador de forma derivada y sin
estado persistido, combinando asistencia real a entrenamientos y minutos jugados en partidos
dentro de una ventana móvil de 7 días, sin acumular ningún checkpoint entre invocaciones.

#### Scenario: Jugador sin eventos en la ventana
- **WHEN** un jugador no tiene ninguna asistencia a entrenamiento ni participación de partido
  finalizada en los últimos 7 días
- **THEN** `Fatigue` es `0`

#### Scenario: Entrenos completos, sin partido
- **WHEN** un jugador asiste a los 2 entrenamientos de referencia (ritmo real martes/jueves) en
  los últimos 7 días y no juega ningún partido en la ventana
- **THEN** `TrainingComponent` es `100`, `MatchComponent` es `0`, y `Fatigue` se calcula como
  `round(0.40 × 100 + 0.60 × 0) = 40`

#### Scenario: Partido completo, sin entrenos
- **WHEN** un jugador juega 70 minutos (referencia) en un partido finalizado dentro de la
  ventana de 7 días y no tiene ningún entrenamiento asistido en la ventana
- **THEN** `MatchComponent` es `100`, `TrainingComponent` es `0`, y `Fatigue` se calcula como
  `round(0.40 × 0 + 0.60 × 100) = 60`

#### Scenario: Carga completa (entrenos + partido)
- **WHEN** un jugador asiste a los 2 entrenamientos de referencia y juega 70 minutos o más en
  un partido finalizado, todo dentro de los últimos 7 días
- **THEN** `Fatigue` es `100`

#### Scenario: Eventos fuera de la ventana no cuentan
- **WHEN** un jugador tiene entrenamientos asistidos o minutos de partido registrados con más
  de 7 días de antigüedad respecto al momento de cálculo
- **THEN** esos eventos no contribuyen a `TrainingComponent` ni `MatchComponent`

#### Scenario: Ningún componente supera 100
- **WHEN** un jugador asiste a más de 2 entrenamientos en la ventana, o acumula más de 70
  minutos de partido en la ventana
- **THEN** `TrainingComponent` y `MatchComponent` quedan acotados (clamped) a `100` como máximo

### Requirement: Retirada de Forma física y Disponibilidad
El sistema SHALL dejar de exponer `PhysicalFitness` y `Availability` en las estadísticas de
jugador, junto con toda su infraestructura de persistencia asociada.

#### Scenario: DTO de estadísticas de jugador ya no incluye Forma física/Disponibilidad
- **WHEN** se consulta `GET /api/catalog/team/{teamId}/player-stats`
- **THEN** la respuesta no incluye los campos `PhysicalFitness` ni `Availability`
