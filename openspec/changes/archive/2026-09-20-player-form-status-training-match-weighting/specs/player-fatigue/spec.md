## MODIFIED Requirements

### Requirement: Cansancio derivado sin estado
El sistema SHALL calcular `Fatigue` (Cansancio, 0-100) de un jugador de forma derivada y sin
estado persistido, combinando asistencia real a entrenamientos y minutos jugados en partidos,
cada uno ponderado por (a) un decaimiento exponencial de recencia (semivida de 2 días), (b) el
tipo de entrenamiento presente en la sesión (Físico > Táctico > Técnico) y (c) el tipo de
partido (Liga > Amistoso/Torneo), sin acumular ningún checkpoint entre invocaciones.

#### Scenario: Jugador sin eventos recientes
- **WHEN** un jugador no tiene ninguna asistencia a entrenamiento ni participación de partido
  finalizada dentro de la ventana de carga (14 días)
- **THEN** `Fatigue` es `0`

#### Scenario: Eventos recientes pesan más que eventos antiguos dentro de la misma ventana
- **WHEN** dos jugadores acumulan la misma carga total de referencia (2 entrenos, 70 minutos de
  partido) dentro de la ventana de carga, pero uno de ellos tuvo esos eventos hace varios días y
  el otro los tuvo hoy o ayer
- **THEN** el jugador con eventos más recientes obtiene un `Fatigue` mayor que el jugador con
  eventos más antiguos, en vez de que ambos saturen igual a 100

#### Scenario: Entreno de hoy pesa el máximo, un entreno de hace 2 días pesa la mitad
- **WHEN** un jugador asiste a un entrenamiento hoy (decay = 1) y otro jugador asistió al mismo
  tipo de entrenamiento hace exactamente 2 días (decay = 0.5, semivida)
- **THEN** la contribución decayed del entreno de hoy al `TrainingComponent` es el doble que la
  del entreno de hace 2 días

#### Scenario: Caso real "Lucas" — recuperación parcial tras días de descanso
- **WHEN** un jugador entrenó hace 6 días, jugó un partido de 90 minutos hace 3 días, y volvió a
  entrenar hace 1 día, evaluado hoy sin ningún entreno adicional, y ninguno de esos eventos tiene
  tipo marcado
- **THEN** `Fatigue` es aproximadamente `44` (no `100`), reflejando que el jugador ya tuvo días
  de descanso desde su último entreno y desde el partido

#### Scenario: Carga completa concentrada hoy
- **WHEN** un jugador asiste a los 2 entrenamientos de referencia (sin tipo marcado, o de tipo
  Físico) y juega 70 minutos o más en un partido de Liga finalizado, todos ocurriendo hoy
  (decay = 1 para cada evento)
- **THEN** `Fatigue` es `100`

#### Scenario: Eventos fuera de la ventana de carga no cuentan
- **WHEN** un jugador tiene entrenamientos asistidos o minutos de partido registrados con más de
  14 días de antigüedad respecto al momento de cálculo
- **THEN** esos eventos no se incluyen en el cálculo en absoluto

#### Scenario: Ningún componente supera 100
- **WHEN** la suma ponderada (decayed y por tipo) de entrenos de un jugador supera la referencia
  de 2, o la suma ponderada de minutos de partido supera la referencia de 70
- **THEN** `TrainingComponent` y `MatchComponent` quedan acotados (clamped) a `100` como máximo

#### Scenario: Un entreno Físico pesa más que uno Técnico con el mismo decaimiento
- **WHEN** dos jugadores asisten hoy a un único entrenamiento cada uno, uno marcado como
  `Fisico` y el otro como `Tecnico`
- **THEN** la contribución decayed del entreno `Fisico` al `TrainingComponent` es mayor que la
  del entreno `Tecnico`

#### Scenario: Un partido de Liga pesa más que un Amistoso con los mismos minutos
- **WHEN** dos jugadores juegan hoy los mismos minutos en un partido finalizado, uno de tipo
  Liga (`Match`) y el otro de tipo `FriendlyMatch`
- **THEN** la contribución decayed del partido de Liga al `MatchComponent` es mayor que la del
  Amistoso

#### Scenario: Sesión con varios tipos de entrenamiento pondera solo los tipos presentes
- **WHEN** un jugador asiste hoy a una sesión marcada con los tipos `Fisico` y `Tecnico`
  simultáneamente
- **THEN** la contribución de esa sesión al `TrainingComponent` es la media de los pesos de
  `Fisico` y `Tecnico`, sin verse afectada por el peso de `Tactico` (ausente en esa sesión)

#### Scenario: Sesión sin tipo de entrenamiento marcado se trata como peso neutro
- **WHEN** un jugador asiste hoy a una sesión de entrenamiento sin ningún `TrainingType` marcado
  (lista vacía)
- **THEN** esa sesión contribuye al `TrainingComponent` con el mismo peso máximo que una sesión
  de tipo `Fisico`, preservando el comportamiento previo a esta capability para datos sin tipo

### Requirement: Retirada de Forma física y Disponibilidad
El sistema SHALL dejar de exponer `PhysicalFitness` y `Availability` en las estadísticas de
jugador, junto con toda su infraestructura de persistencia asociada.

#### Scenario: DTO de estadísticas de jugador ya no incluye Forma física/Disponibilidad
- **WHEN** se consulta `GET /api/catalog/team/{teamId}/player-stats`
- **THEN** la respuesta no incluye los campos `PhysicalFitness` ni `Availability`
