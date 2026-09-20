# player-readiness Specification

## Purpose
TBD - created by archiving change player-form-status-training-match-weighting. Update Purpose after archive.
## Requirements
### Requirement: Rodaje derivado sin estado, ponderado por tipo de sesión
El sistema SHALL calcular `Readiness` (Rodaje, 0-100 o `null`) de un jugador de forma derivada y
sin estado persistido, combinando asistencia real a entrenamientos (con puntuación por motivo de
ausencia) y minutos jugados en partidos finalizados dentro de una ventana móvil de 8 semanas,
ponderados 70%/30% entreno/partido. Cada entreno pondera adicionalmente su puntuación por el tipo
de entrenamiento presente en la sesión (Táctico 1.00 > Técnico 0.60 > Físico 0.30), y cada partido
pondera sus minutos por tipo de partido (Liga > Amistoso/Torneo).

#### Scenario: Jugador sin sesiones ni minutos en la ventana
- **WHEN** un jugador no tiene ninguna convocatoria de entrenamiento con resultado registrado ni
  minutos de partido dentro de la ventana de 8 semanas
- **THEN** `Readiness` es `null`

#### Scenario: Solo asistencia real (presente o tarde) suma al componente de entreno
- **WHEN** un jugador tiene convocatorias de entrenamiento con distintos resultados (asistencia,
  llegada tarde, ausencia injustificada, ausencia justificada, lesión, decisión técnica) dentro
  de la ventana
- **THEN** únicamente las convocatorias con asistencia real (presente o tarde) suman puntos al
  numerador del `TrainingComponent`; cualquier tipo de ausencia contribuye `0` al numerador,
  aunque siga apareciendo en `RecentAbsences` de forma informativa

#### Scenario: Un entreno Táctico aporta más Rodaje que uno Técnico con el mismo resultado
- **WHEN** dos jugadores asisten cada uno a una única sesión de entrenamiento con el mismo
  resultado de asistencia (presente), una marcada como `Tactico` y la otra como `Tecnico`
- **THEN** la contribución de la sesión `Tactico` al `TrainingComponent` es mayor que la de la
  sesión `Tecnico`

#### Scenario: Un entreno puramente Físico aporta poco a Rodaje
- **WHEN** un jugador asiste a una sesión de entrenamiento marcada únicamente como `Fisico`
- **THEN** esa sesión contribuye con peso `0.30` al `TrainingComponent`: más que `0` y menos que
  una sesión `Tecnico` (`0.60`) o `Tactico` (`1.00`) con el mismo resultado de asistencia

#### Scenario: Sesión con varios tipos de entrenamiento pondera solo los tipos presentes
- **WHEN** un jugador asiste a una sesión marcada con los tipos `Tactico` y `Fisico`
  simultáneamente
- **THEN** la contribución de esa sesión al `TrainingComponent` es la media de los pesos de
  `Tactico` y `Fisico` (`0.65`), sin verse afectada por el peso de `Tecnico` (ausente en esa
  sesión)

#### Scenario: Sesión sin tipo de entrenamiento marcado se trata como peso neutro
- **WHEN** un jugador asiste a una sesión de entrenamiento sin ningún `TrainingType` marcado
  (lista vacía)
- **THEN** esa sesión contribuye al `TrainingComponent` con el mismo peso máximo que una sesión
  de tipo `Tactico`, preservando el comportamiento previo a esta capability para datos sin tipo

#### Scenario: Un partido de Liga pesa más que un Amistoso con los mismos minutos
- **WHEN** dos jugadores juegan los mismos minutos en un partido finalizado dentro de la
  ventana, uno de tipo Liga (`Match`) y el otro de tipo `FriendlyMatch`
- **THEN** la contribución al `MatchComponent` del partido de Liga es mayor que la del Amistoso

#### Scenario: Ningún componente supera 100
- **WHEN** la suma ponderada de puntos de entreno de un jugador supera la referencia
  (`BaselineTrainings` sesiones a puntuación máxima) o la suma ponderada de minutos de partido
  supera la referencia (`BaselineMatches` × `ExpectedMinutesPerMatch`)
- **THEN** `TrainingComponent` y `MatchComponent` quedan acotados (clamped) a `100` como máximo

#### Scenario: Ausencias recientes informativas no afectan el cálculo
- **WHEN** un jugador tiene ausencias de entrenamiento dentro de la ventana con distintos motivos
- **THEN** cada ausencia aparece en `RecentAbsences` (hasta 10, ordenadas por fecha descendente)
  con su motivo y penalización informativa, sin que ese listado altere el valor numérico de
  `Readiness`

