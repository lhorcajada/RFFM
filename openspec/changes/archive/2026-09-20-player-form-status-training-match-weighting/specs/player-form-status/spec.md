## ADDED Requirements

### Requirement: Estado de forma derivado sin estado, independiente de Rodaje/Cansancio
El sistema SHALL calcular `FormStatus` (Estado de forma, 0-100 o `null`) de un jugador de forma
derivada y sin estado persistido, como una métrica de backend propia — no una combinación
aritmética de `Readiness`/`Fatigue` — combinando asistencia real a entrenamientos y minutos
jugados en partidos finalizados dentro de una ventana móvil de 8 semanas, ponderados 70%/30%
entreno/partido. Cada entreno pondera su contribución por el tipo de entrenamiento presente en la
sesión (Físico > Táctico > Técnico = 0), y cada partido pondera sus minutos por tipo de partido
(Liga > Amistoso/Torneo).

#### Scenario: Jugador sin sesiones ni minutos en la ventana
- **WHEN** un jugador no tiene ninguna asistencia real a entrenamiento ni minutos de partido
  finalizado dentro de la ventana de 8 semanas
- **THEN** `FormStatus` es `null`

#### Scenario: Solo asistencia real cuenta, sin puntuación parcial por motivo de ausencia
- **WHEN** un jugador tiene convocatorias de entrenamiento con distintos resultados (asistencia,
  llegada tarde, ausencia injustificada, ausencia justificada, lesión, decisión técnica) dentro
  de la ventana
- **THEN** únicamente las convocatorias con asistencia real (presente o tarde) contribuyen al
  `TrainingComponent`; cualquier ausencia, motivada o no, contribuye `0`

#### Scenario: Un entreno Físico mejora el Estado de forma más que uno Táctico
- **WHEN** dos jugadores asisten cada uno a una única sesión de entrenamiento, una marcada como
  `Fisico` y la otra como `Tactico`
- **THEN** la contribución de la sesión `Fisico` al `TrainingComponent` es mayor que la de la
  sesión `Tactico`

#### Scenario: Un entreno puramente Técnico no mejora el Estado de forma
- **WHEN** un jugador asiste a una sesión de entrenamiento marcada únicamente como `Tecnico`
- **THEN** esa sesión contribuye `0` al `TrainingComponent`

#### Scenario: Sesión con varios tipos de entrenamiento pondera solo los tipos presentes
- **WHEN** un jugador asiste a una sesión marcada con los tipos `Fisico` y `Tecnico`
  simultáneamente
- **THEN** la contribución de esa sesión al `TrainingComponent` es la media de los pesos de
  `Fisico` y `Tecnico`, sin verse afectada por el peso de `Tactico` (ausente en esa sesión)

#### Scenario: Sesión sin tipo de entrenamiento marcado se trata como peso neutro
- **WHEN** un jugador asiste a una sesión de entrenamiento sin ningún `TrainingType` marcado
  (lista vacía)
- **THEN** esa sesión contribuye al `TrainingComponent` con el mismo peso máximo que una sesión
  de tipo `Fisico`

#### Scenario: Un partido de Liga mejora el Estado de forma más que un Amistoso con los mismos minutos
- **WHEN** dos jugadores juegan los mismos minutos en un partido finalizado dentro de la
  ventana, uno de tipo Liga (`Match`) y el otro de tipo `FriendlyMatch`
- **THEN** la contribución al `MatchComponent` del partido de Liga es mayor que la del Amistoso

#### Scenario: Ningún componente supera 100
- **WHEN** la suma ponderada de sesiones de entreno de un jugador supera la referencia
  (`BaselineTrainings` sesiones a peso pleno) o la suma ponderada de minutos de partido supera la
  referencia (`BaselineMatches` × `ExpectedMinutesPerMatch`)
- **THEN** `TrainingComponent` y `MatchComponent` quedan acotados (clamped) a `100` como máximo

#### Scenario: FormStatus no se deriva de Rodaje ni de Cansancio
- **WHEN** se calcula `FormStatus` para un jugador junto con `Readiness` y `Fatigue`
- **THEN** `FormStatus` se obtiene únicamente de la ventana de asistencia/minutos ponderada por
  tipo descrita en esta capability, sin usar `Readiness` ni `Fatigue` como entrada de ningún
  cálculo aritmético

### Requirement: Exposición de FormStatus en las estadísticas de jugador
El sistema SHALL exponer `FormStatus` y su desglose en la respuesta de
`GET /api/catalog/team/{teamId}/player-stats`, de forma aditiva sin romper el contrato existente.

#### Scenario: DTO de estadísticas de jugador incluye FormStatus
- **WHEN** se consulta `GET /api/catalog/team/{teamId}/player-stats`
- **THEN** cada elemento de la respuesta incluye `FormStatus` (0-100 o `null`) y
  `FormStatusBreakdown` (`null` cuando `FormStatus` es `null`) con `TrainingComponent`,
  `MatchComponent`, `SessionsConsidered`, `TrainingSessionsBaseline`,
  `WeightedMatchMinutesInWindow` y `MatchMinutesExpected`
