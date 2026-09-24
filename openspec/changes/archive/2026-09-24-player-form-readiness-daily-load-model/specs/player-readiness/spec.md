## MODIFIED Requirements

### Requirement: Rodaje derivado sin estado, ponderado por tipo de sesión
El sistema SHALL calcular `Readiness` (Rodaje, 0-100 o `null`) de un jugador sin estado
persistido. Reproduce día a día los últimos 84 días con valor inicial `0`. Cada día con actividad suma carga con saturación exponencial
`v = 100 − (100 − v)·e^(−0.10·L)`. Cada día sin actividad a partir del 22º seguido resta
`min(0.25·n, 2)` puntos, siendo `n` el número de día tras los 21 de gracia, con mínimo `0`.
La carga de un entreno es su peso por tipo (Táctico 1.00 > Técnico 0.60 > Físico 0.30). La de un
partido es `1.5 × minutos / 70 × peso de tipo de partido` (Liga 1.00, Amistoso/Torneo 0.70).

#### Scenario: Sin actividad en la ventana
- **WHEN** un jugador no tiene ningún entreno asistido ni ningún partido con minutos en los
  últimos 84 días
- **THEN** `Readiness` es `null` y `ReadinessBreakdown` es `null`

#### Scenario: Solo la asistencia real suma
- **WHEN** un jugador tiene convocatorias con asistencia, llegada tarde, ausencias, lesión o
  decisión técnica
- **THEN** solo los días con asistencia o llegada tarde suman carga; el resto son días sin
  actividad y aparecen en `MissedEvents` con su motivo

#### Scenario: Un entreno Táctico aporta más Rodaje que uno Técnico
- **WHEN** dos jugadores asisten a una única sesión, una `Tactico` y otra `Tecnico`
- **THEN** el Rodaje del jugador de la sesión `Tactico` es mayor (`10` frente a `6`)

#### Scenario: Un entreno puramente Físico aporta poco a Rodaje
- **WHEN** un jugador asiste a una sesión marcada únicamente como `Fisico`
- **THEN** su carga es `0.30`: más que `0` y menos que una sesión `Tecnico` (`0.60`) o `Tactico`
  (`1.00`)

#### Scenario: Sesión con varios tipos pondera solo los tipos presentes
- **WHEN** un jugador asiste a una sesión marcada con `Tactico` y `Fisico`
- **THEN** su carga es `0.65`

#### Scenario: Sesión sin tipo se trata como peso neutro
- **WHEN** un jugador asiste a una sesión sin ningún `TrainingType` marcado
- **THEN** su carga es `1.00`

#### Scenario: Un partido de Liga pesa más que un Amistoso con los mismos minutos
- **WHEN** dos jugadores juegan 70' en un partido, uno de Liga y otro Amistoso, como única actividad
- **THEN** el Rodaje es `14` para el de Liga y `10` para el del Amistoso

#### Scenario: Más minutos nunca dan menos Rodaje
- **WHEN** dos jugadores tienen los mismos días de actividad y el mismo tipo de partidos, y uno
  suma más minutos
- **THEN** su `Readiness` es mayor o igual

#### Scenario: Se estanca 21 días sin actividad
- **WHEN** un jugador con valor 100 pasa 21 días seguidos sin actividad
- **THEN** `Readiness` sigue siendo `100`

#### Scenario: Después baja despacio
- **WHEN** un jugador con valor 100 pasa 28, 42 o 56 días seguidos sin actividad
- **THEN** su valor es `93`, `65` y `37` respectivamente

#### Scenario: Desglose expuesto
- **WHEN** `Readiness` no es `null`
- **THEN** `ReadinessBreakdown` es un `DailyLoadBreakdownDto` con los mismos campos que el de
  Estado de forma y `ReferenceMatchMinutes` `70`
