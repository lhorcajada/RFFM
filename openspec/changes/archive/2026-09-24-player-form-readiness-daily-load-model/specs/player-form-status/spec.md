## MODIFIED Requirements

### Requirement: Estado de forma derivado sin estado, independiente de Rodaje/Cansancio
El sistema SHALL calcular `FormStatus` (Estado de forma, 0-100 o `null`) de un jugador sin estado
persistido, reproduciendo día a día los últimos 84 días con valor inicial `0`. Cada día con actividad suma carga con saturación exponencial
`v = 100 − (100 − v)·e^(−0.16·L)`. Cada día sin actividad a partir del 5º seguido resta
`min(0.5·n, 3)` puntos, siendo `n` el número de día tras los 4 de gracia, con mínimo `0`.
`FormStatus` no depende de `Readiness` ni de `Fatigue`.

#### Scenario: Sin actividad en la ventana
- **WHEN** un jugador no tiene ningún entreno asistido ni ningún partido con minutos en los
  últimos 84 días
- **THEN** `FormStatus` es `null` y `FormStatusBreakdown` es `null`

#### Scenario: Categoría sin duración estándar
- **WHEN** la categoría del equipo no tiene duración en `MatchDurationMinutesByCategory`
- **THEN** `FormStatus` y `FormStatusBreakdown` son `null` para todos los jugadores del equipo

#### Scenario: Un entreno sube el Estado de forma
- **WHEN** la única actividad de un jugador es un entreno `Fisico` asistido hoy
- **THEN** `FormStatus` es `15` (`100·(1 − e^(−0.16))`)

#### Scenario: La carga de un entreno depende de su tipo
- **WHEN** un jugador asiste a una sesión
- **THEN** su carga es el peso de tipo (`Fisico` 1.00, `Tactico` 0.50, `Tecnico` 0.00, media de
  los tipos presentes, sin tipo 1.00)

#### Scenario: Un entreno Técnico puro mantiene pero no suma
- **WHEN** un jugador asiste a una sesión solo `Tecnico` durante una racha de descanso
- **THEN** el valor no cambia ese día y la racha de días sin actividad vuelve a `0`

#### Scenario: Un partido suma según los minutos jugados
- **WHEN** un jugador de Cadete (minutos completos 70) juega 70' y es su única actividad
- **THEN** la carga del partido es `1.5` y `FormStatus` es `21`

#### Scenario: El tipo de partido no pondera
- **WHEN** dos jugadores juegan los mismos minutos el mismo día, uno en Liga y otro en un Amistoso
- **THEN** ambos obtienen la misma carga

#### Scenario: Más minutos nunca dan menos Estado de forma
- **WHEN** dos jugadores tienen los mismos días de entreno asistidos y juegan los mismos
  partidos, uno con 106' y otro con 108' en total, con cualquier reparto entre partidos
- **THEN** el `FormStatus` del jugador con 108' es mayor o igual que el del jugador con 106'

#### Scenario: Convocado sin jugar no es actividad
- **WHEN** un jugador está convocado a un partido y juega 0 minutos
- **THEN** ese día cuenta como día sin actividad

#### Scenario: Hoy solo cuenta si ya ha habido actividad
- **WHEN** un jugador entrenó ayer y hoy todavía no ha tenido actividad (por ejemplo, el entreno
  es por la tarde)
- **THEN** los días seguidos sin actividad son `0` y hoy no resta valor; si hoy ya hubo
  actividad, hoy cuenta como día activo

#### Scenario: Hasta 4 días sin actividad se mantiene
- **WHEN** un jugador con `FormStatus` 100 pasa 4 días seguidos sin actividad
- **THEN** `FormStatus` sigue siendo `100`

#### Scenario: Desde el 5º día sin actividad baja, cada día más
- **WHEN** un jugador con valor 100 pasa 5, 7, 14, 21 o 28 días seguidos sin actividad
- **THEN** su valor es `99.5`, `97`, `77.5`, `56.5` y `35.5` respectivamente, y `FormStatus` es
  su redondeo (`100`, `97`, `78`, `57`, `36`)

#### Scenario: El motivo de la falta no cambia el cálculo
- **WHEN** un jugador no asiste a un entreno por lesión, falta justificada, injustificada o
  decisión técnica
- **THEN** ese día es un día sin actividad en todos los casos y el evento aparece en
  `MissedEvents` con su motivo

#### Scenario: Días sin eventos del equipo cuentan como descanso
- **WHEN** el equipo no programa ningún evento durante 7 días (vacaciones) y el jugador tenía 100
- **THEN** `FormStatus` es `97`

#### Scenario: El Cansancio no modifica el Estado de forma
- **WHEN** dos jugadores tienen la misma actividad pero distinto `Fatigue`
- **THEN** ambos tienen el mismo `FormStatus`

### Requirement: Exposición de FormStatus en las estadísticas de jugador
El sistema SHALL exponer `FormStatus` y un desglose `DailyLoadBreakdownDto` en la respuesta de
`GET /api/catalog/team/{teamId}/player-stats`. El desglose SHALL contener los datos suficientes
para que el cliente explique la evolución del valor sin recalcularla.

#### Scenario: DTO de estadísticas incluye FormStatus
- **WHEN** se consulta `GET /api/catalog/team/{teamId}/player-stats`
- **THEN** cada elemento incluye `FormStatus` (0-100 o `null`) y `FormStatusBreakdown` (`null`
  cuando `FormStatus` es `null`)

#### Scenario: El desglose explica la evolución
- **WHEN** `FormStatusBreakdown` no es `null`
- **THEN** incluye el valor sin redondear, la fecha de inicio y los días reproducidos, los
  parámetros (ganancia, días de gracia, pérdida por día y pérdida máxima, carga por partido
  completo, minutos de referencia), los días seguidos sin actividad hasta hoy, los totales de
  entrenos asistidos, partidos jugados y minutos, los pasos (actividad y rachas de pérdida con
  valor antes y después, del más reciente al más antiguo) y hasta 10 eventos no realizados con
  su motivo

#### Scenario: Las rachas de descanso dentro de la gracia no generan paso
- **WHEN** un jugador descansa 3 días entre dos entrenos
- **THEN** el desglose no incluye ningún paso de pérdida para esos días
