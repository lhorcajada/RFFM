# player-form-status Specification

## Purpose
TBD - created by archiving change player-form-status-training-match-weighting. Update Purpose after archive.
## Requirements
### Requirement: Estado de forma derivado sin estado, independiente de Rodaje/Cansancio
El sistema SHALL calcular `FormStatus` (Estado de forma, 0-100 o `null`) de un jugador de forma
derivada y sin estado persistido, como cociente de carga recibida sobre carga ofrecida en una
ventana móvil de 6 semanas con peso por recencia: un bloque de entrenos (55%) y un bloque de
partidos (45%), multiplicados por el factor de Cansancio `1 − Fatigue/200`. Un jugador que asiste
a todo y juega al menos los minutos de estímulo completo en cada partido, con Cansancio 0, SHALL
obtener `100`. `FormStatus` no se deriva de `Readiness`; `Fatigue` solo entra como multiplicador.

#### Scenario: Jugador sin sesiones ni partidos en la ventana
- **WHEN** un jugador no tiene ninguna sesión de entrenamiento ofrecida ni ningún partido
  computable dentro de la ventana de 6 semanas
- **THEN** `FormStatus` es `null` y `FormStatusBreakdown` es `null`

#### Scenario: Jugador sano que asiste a todo y juega minutos completos
- **WHEN** un jugador de categoría Cadete asiste a todas las sesiones ofrecidas, juega 70 minutos
  o más en todos los partidos del equipo de la ventana y su `Fatigue` es `0`
- **THEN** `FormStatus` es `100`, sea cual sea la mezcla de tipos de las sesiones, siempre que
  haya acumulado la carga de referencia (12 sesiones asistidas y 6 × 70' jugados)

#### Scenario: Cansancio reduce el resultado como multiplicador
- **WHEN** el resultado base `0.55·Entrenos + 0.45·Partidos` es `100` y `Fatigue` es `20`
- **THEN** `FormStatus` es `90` (`100 × (1 − 20/200)`), y con `Fatigue` `100` el factor mínimo es
  `0.5`

#### Scenario: Recencia de eventos
- **WHEN** un evento ocurrió hace 7 días o menos
- **THEN** su peso de recencia es `1.0`
- **WHEN** un evento ocurrió hace `d > 7` días
- **THEN** su peso de recencia es `0.5^((d−7)/14)`

#### Scenario: Eventos fuera de la ventana no cuentan
- **WHEN** un evento ocurrió hace más de 42 días
- **THEN** no interviene en ningún bloque ni aparece en el desglose

#### Scenario: Entrenos, carga recibida sobre ofrecida
- **WHEN** un jugador tiene sesiones ofrecidas en la ventana
- **THEN** el componente de entrenos es
  `Σ(peso de tipo × recencia de las sesiones asistidas) / Σ(peso de tipo × recencia de todas las
  sesiones ofrecidas) × 100`

#### Scenario: Cualquier falta cuenta cero sin importar el motivo
- **WHEN** un jugador falta a una sesión por ausencia injustificada, justificada o lesión
- **THEN** esa sesión permanece en el denominador y aporta `0` al numerador

#### Scenario: La decisión técnica del entrenador se excluye
- **WHEN** un jugador no asiste a una sesión o partido por decisión técnica del entrenador
  (`ExcuseType` Decisión técnica, o convocatoria retirada por el entrenador)
- **THEN** ese evento se excluye tanto del numerador como del denominador y no penaliza

#### Scenario: Deconvocado sin asistencia y sin decisión técnica cuenta como falta
- **WHEN** una convocatoria a sesión o partido queda deconvocada (o justificada) sin asistencia
  registrada y su motivo no es decisión técnica
- **THEN** el evento cuenta como falta: permanece en el denominador y aporta `0`

#### Scenario: Sesión pendiente o sin resultado registrado se excluye
- **WHEN** una convocatoria de entrenamiento no tiene resultado de asistencia registrado
- **THEN** esa sesión se excluye del cálculo

#### Scenario: Un entreno Físico pesa más que uno Táctico y uno Técnico puro no pesa
- **WHEN** un jugador falta a una sesión `Fisico` o a una sesión `Tactico`, siendo todo lo demás
  igual
- **THEN** la falta a la sesión `Fisico` reduce más el componente de entrenos (pesos `1.00`,
  `0.50`); una falta a una sesión `Tecnico` pura (peso `0.00`) no lo reduce

#### Scenario: Sesión con varios tipos o sin tipo
- **WHEN** una sesión tiene varios tipos marcados
- **THEN** su peso es la media de los pesos de los tipos presentes
- **WHEN** una sesión no tiene ningún tipo marcado
- **THEN** su peso es `1.00`

#### Scenario: Todas las sesiones ofrecidas pesan cero
- **WHEN** la suma de pesos de tipo de las sesiones ofrecidas es `0` (solo sesiones `Tecnico`
  puras)
- **THEN** el componente de entrenos se calcula con peso de tipo `1.00` para todas las sesiones
  (ratio de asistencia solo por recencia) y el desglose marca `TrainingTypeWeightFallbackUsed`
  como `true`

#### Scenario: Partidos, minutos jugados sobre minutos de estímulo completo
- **WHEN** un jugador tiene partidos computables de su equipo en la ventana
- **THEN** cada partido aporta `min(1, minutosJugados / minutosCompletos)` con
  `minutosCompletos = 0.875 × 2 × MatchDurationMinutesByCategory` de la categoría (Cadete 70),
  y el componente de partidos es la media de esos ratios ponderada por recencia, multiplicada por
  `100`

#### Scenario: Partido con falta o sin minutos
- **WHEN** un jugador faltó a un partido por cualquier motivo salvo decisión técnica, o estuvo
  convocado y presente pero no jugó
- **THEN** ese partido aporta ratio `0` y permanece en el denominador
- **WHEN** el jugador no fue convocado o fue retirado por decisión técnica
- **THEN** ese partido se excluye

#### Scenario: El tipo de partido no pondera
- **WHEN** dos jugadores juegan los mismos minutos, uno en un partido de Liga y otro en un
  Amistoso o Torneo
- **THEN** ambos partidos aportan el mismo ratio

#### Scenario: Bloque sin eventos del equipo renormaliza pesos
- **WHEN** el equipo no tuvo ninguna sesión (o ningún partido) en la ventana
- **THEN** el bloque vacío se omite y el peso aplicado del bloque presente es `1.00`, quedando
  `TrainingWeightApplied`/`MatchWeightApplied` reflejados en el desglose

#### Scenario: Equipo con partidos pero ninguno computable para el jugador no renormaliza
- **WHEN** el equipo jugó partidos en la ventana y todos están excluidos para el jugador
- **THEN** el componente de partidos es `0` con peso aplicado `0.45` (simétrico para entrenos)
  y `FormStatus` no supera 55 aunque asista a todos los entrenos

#### Scenario: Solo entrenos sin jugar no supera 55
- **WHEN** un jugador asiste a todas las sesiones, el equipo jugó partidos computables en la
  ventana y el jugador no sumó minutos en ninguno, con `Fatigue` `0`
- **THEN** `FormStatus` es `55`

#### Scenario: Volumen de entrenos por debajo de la referencia escala el bloque
- **WHEN** un jugador asiste a 6 sesiones (referencia 12) y no hay bloque de partidos
- **THEN** `TrainingVolumeFactor` es `0.5`, `TrainingRatioComponent` es `100`, `TrainingComponent`
  es `50` y `FormStatus` es `50` (el factor no se renormaliza aunque el peso sea 1.00)

#### Scenario: Volumen de entrenos en o sobre la referencia no penaliza
- **WHEN** un jugador asiste a 12 o más sesiones
- **THEN** `TrainingVolumeFactor` es `1.0`

#### Scenario: Los partidos no llevan factor de volumen
- **WHEN** un jugador de Cadete juega 70' en cada uno de solo 2 partidos del equipo
- **THEN** `MatchComponent` es `100` (media ponderada de ratios, sin factor) y
  `MatchMinutesPossibleTotal` es `160` (2 × 80'); `MatchMinutesPlayedTotal` expone los minutos
  jugados

#### Scenario: Bloque ausente no lleva factor
- **WHEN** el equipo no tuvo sesiones en la ventana
- **THEN** `TrainingVolumeFactor` es `null` y no se aplica; el peso se renormaliza al bloque de partidos

#### Scenario: Inicio de temporada con poco volumen
- **WHEN** un jugador Cadete asiste a 7 de 7 entrenos, juega 134' en 2 amistosos y su `Fatigue`
  es `22`
- **THEN** `TrainingComponent` es ≈ 58.3, `MatchComponent` ≈ 95.7 y `FormStatus` es `67`

#### Scenario: Jugador con carga de referencia completa
- **WHEN** un jugador asiste a 12 sesiones y juega al menos 70' en cada partido del equipo (aunque solo haya 2) con `Fatigue` `0`
- **THEN** `FormStatus` es `100`

#### Scenario: Categoría sin duración estándar
- **WHEN** la categoría del equipo no tiene duración registrada en `MatchDurationMinutesByCategory`
  (F7 o menores)
- **THEN** `FormStatus` es `null` y `FormStatusBreakdown` es `null` para todos los jugadores del
  equipo

### Requirement: Exposición de FormStatus en las estadísticas de jugador
El sistema SHALL exponer `FormStatus` y un desglose completo en la respuesta de
`GET /api/catalog/team/{teamId}/player-stats`, con datos suficientes para que el cliente
reconstruya la fórmula sin recalcularla.

#### Scenario: DTO de estadísticas de jugador incluye FormStatus
- **WHEN** se consulta `GET /api/catalog/team/{teamId}/player-stats`
- **THEN** cada elemento incluye `FormStatus` (0-100 o `null`) y `FormStatusBreakdown` (`null`
  cuando `FormStatus` es `null`)

#### Scenario: El desglose explica cada bloque
- **WHEN** `FormStatusBreakdown` no es `null`
- **THEN** incluye, para entrenos: componente 0-100, sesiones ofrecidas y asistidas, suma de peso
  ofrecido y recibido; para partidos: componente 0-100, partidos considerados, minutos completos
  de la categoría y factor `0.875`; el `Fatigue` usado y su factor `1 − Fatigue/200`; los pesos
  nominales y aplicados de cada bloque; el resultado base previo al factor; y las listas de
  eventos considerados con su fecha, días atrás, peso de recencia y aportación

#### Scenario: Eventos excluidos se cuentan pero no se listan
- **WHEN** hay sesiones o partidos excluidos por decisión técnica o sin resultado
- **THEN** el desglose expone su número (`ExcludedTrainings`, `ExcludedMatches`) sin incluirlos en
  las listas de eventos considerados

