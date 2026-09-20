## Context

- `PlayerFormStatusCalculator` (change `player-form-status-training-match-weighting`, sin archivar)
  calcula `0.70 × min(100, Σ pesoTipo·asistida / 16 × 100) + 0.30 × min(100, Σ minutos / (8×70) ×
  100)` sobre 8 semanas. Las referencias 16 sesiones / 8 partidos de 70' son absolutas: un equipo
  que entrena 2 días por semana con mezcla de tipos nunca acerca a nadie al 100%, y el 100% no es
  el "estado normal" que el entrenador quiere ver.
- El usuario definió tras conversación un modelo nuevo (decisiones CONFIRMADAS, no se reabren
  aquí): 100% es lo normal para un jugador sano que asiste y juega; solo se resta por
  cansancio, lesiones y faltas.
- Piezas reutilizables ya en el repo: `TrainingTypeWeighting` (media de pesos de los tipos
  presentes, sin tipo = 1.00), `PlayerFatigueCalculator.Result.Fatigue` (int 0-100, siempre con
  valor), `AttributableAbsenceCalculator`, `PlayerReadinessCalculator.PointsFor` (criterio de
  exclusión "decisión técnica"), `MatchDurationMinutesByCategory` (minutos de CADA PARTE: Cadete
  40, Juvenil 45, Infantil 35, Alevín 30) y el gating `hasStandardMinutes` de
  `GetTeamPlayerStatistics`.
- El frontend (`PlayerFormBars`, `SquadStatistics`, `PlayerDetail`, `squadStatsPdfExport`,
  `teamPlayerStatisticsService.ts`) ya consume `formStatus`/`formStatusBreakdown` con el desglose
  expandible por eventos del change previo.

## Goals / Non-Goals

**Goals**
- Estado de forma = carga recibida / carga ofrecida, con 100% alcanzable y explicable.
- Recencia con "semana de gracia": una semana sin actividad no resta, luego decae rápido.
- Contrato de API que permita al frontend explicar cada paso de la fórmula sin recalcular.
- Enmendar el peso `Fisico` de Rodaje (0.00 → 0.30).

**Non-Goals**
- Sin cambios en Cansancio (`PlayerFatigueCalculator`): solo se consume su `Fatigue`.
- Sin cambios en el resto de la fórmula de Rodaje ni en `MatchTypeWeighting` (sigue para
  Cansancio y Rodaje).
- Sin migraciones EF, sin persistir el resultado, sin queries de tabla nuevas.
- Sin estado de forma para categorías sin duración estándar (queda `null`).

## Qué reemplaza este change del change anterior

| Change anterior (`player-form-status-training-match-weighting`) | Estado |
|---|---|
| Decisión 3 (fórmula aditiva 70/30 con `BaselineTrainings`/`BaselineMatches`) | **Reemplazada** por Decisiones 1, 3, 5 y 7 de aquí. Solo para Estado de forma; las partes de Cansancio y Rodaje de esa Decisión 3 siguen vigentes |
| Decisión 5 (ventana de 8 semanas para Estado de forma) | **Reemplazada** por Decisión 1 (6 semanas). Rodaje conserva 8 |
| Decisión 7 (contrato `FormStatusBreakdownDto`) | **Reemplazada** por Decisión 9 |
| Decisión 8 (transparencia: lista de eventos con `Contribution`) | **Reemplazada** para Estado de forma por Decisión 9 (la lista permanece, con campos nuevos). Vigente para Cansancio/Rodaje |
| Decisión 1, tabla de Rodaje (`Fisico` 0.00) | **Enmendada** por Decisión 11 (0.30) |
| Decisión 1, tabla de Estado de forma (Físico 1.00 / Táctico 0.50 / Técnico 0.00) | **Se mantiene** |
| Decisión 2 (tipo de partido) | Sigue para Cansancio/Rodaje; Estado de forma ya no pondera por tipo de partido |
| Open Question 70/30 | **Cerrada**: ahora 55/45 |

El change anterior no se reescribe. Debe archivarse antes que este (crea las specs base).

## Decisions

### Decisión 1 — Modelo recibido/ofrecido sobre 6 semanas

```
FormStatus = ( 0.55 × Entrenos + 0.45 × Partidos ) × ( 1 − Fatigue / 200 )
Entrenos   = Σ(w_tipo × r) sesiones asistidas / Σ(w_tipo × r) sesiones ofrecidas   × 100
Partidos   = Σ(ratio × r) / Σ(r) sobre partidos computables                       × 100
```

Ventana: `DaysAgo <= 42` (6 semanas). `DaysAgo` se calcula como ya hacen los demás calculadores
(`(UtcNow.Date − eventDate.Date).Days`, calculado en el handler). Los datos ya cargados cubren
8 semanas (ventana de Rodaje), superset del que se filtra dentro del calculador
(`DaysAgo <= WindowDays`), sin query nueva.

*Por qué ratio y no baseline:* un ratio sobre lo ofrecido hace que el 100% dependa de lo que el
equipo realmente hizo, no de un número mágico. Un equipo que entrena 2 días o 4 días por semana
da la misma escala.

### Decisión 2 — Recencia con gracia de 7 días y semivida de 14

```
r(d) = 1.0                       si d <= 7
r(d) = 0.5 ^ ((d − 7) / 14)      si d > 7      (d = 21 → 0.5; d = 42 → 0.177)
```

Constantes nombradas: `RecencyFullWeightDays = 7`, `RecencyHalfLifeDays = 14`,
`WindowDays = 42`. Una semana sin actividad no resta (los eventos recientes pesan 1.0 tanto en
numerador como en denominador, así que su ausencia no mueve el ratio) y luego lo antiguo
pierde peso rápido: el destreno se nota. Se aplica igual a entrenos y partidos. Es una curva
distinta de la de Cansancio (decaimiento 2 días), deliberadamente: Cansancio mide fatiga
aguda; esto mide forma acumulada. Helper estático público `FormStatusRecency.Weight(int daysAgo)`
(testeable de forma aislada).

### Decisión 3 — Bloque Entrenos y sesiones con peso de tipo cero

- Peso por sesión: `w = TrainingTypeWeighting.Weight(tipos, {Físico 1.00, Táctico 0.50, Técnico
  0.00})` (sin tipo = 1.00, varios tipos = media de los presentes). Carga de la sesión = `w × r`.
- Numerador = carga de las sesiones cuyo resultado es "asistida"; denominador = carga de TODAS
  las sesiones ofrecidas (asistida + falta). Asistir a todo da 100% con cualquier mezcla de
  tipos.
- **Problema del peso 0**: una sesión Técnica pura tiene `w = 0`, no entra ni arriba ni abajo:
  faltar a ella no cuesta nada (coherente con "Técnico no aporta condición física") y si TODAS
  las sesiones ofrecidas son Técnicas puras el denominador es 0 (división por cero).
- **Decisión propuesta**: si `Σ w = 0` (denominador de peso cero), se usa `w = 1.00` para todas
  las sesiones de ese cálculo (ratio de asistencia solo por recencia) y el desglose marca
  `TrainingTypeWeightFallbackUsed = true`. Alternativas descartadas: (a) peso mínimo tipo 0.10
  para Técnico siempre — distorsiona la tabla confirmada 0.00 y hace que faltar a Técnico
  penalice; (b) omitir el bloque Entrenos — un jugador que solo tuvo sesiones técnicas y faltó a
  todas quedaría sin castigo. El fallback mantiene la tabla intacta y solo actúa en el caso
  degenerado. Ver Open Question 1.
- `Attended` incluye `Attendance` y `LateArrival` (llegada tarde cuenta entera; es lo que ya
  hacía `IsRealAttendance`).

### Decisión 4 — Clasificar cada convocatoria: Asistida / Falta / Excluida

Nuevo clasificador puro `FormStatusOutcome.Classify(assistanceTypeId, convocationStatusId,
excuseTypeId)` (delega la falta imputable en `AttributableAbsenceCalculator.IsAttributableAbsence`,
la misma definición que alimenta el contador de ausencias; **enmienda**: ya no se mirroriza
`PlayerReadinessCalculator.PointsFor` para `Deconvoke`, divergencia intencionada con Rodaje):

| Condición (orden) | Resultado |
|---|---|
| `ExcuseType` = Lesión (1) | Falta |
| `ExcuseType` = Decisión técnica (7) | **Excluida** |
| `Attendance` o `LateArrival` | Asistida |
| `UnexcusedAbsence` o `ExcusedAbsence` | Falta |
| sin asistencia y `Deconvoke` o `Justified` (motivo distinto de Decisión técnica) | Falta |
| resto (pendiente, sin resultado) | **Excluida** |

Cualquier falta cuenta 0 sin distinguir motivo (mismo efecto físico). Ver Open Question 2 (resuelta): un
`Deconvoke` sin asistencia y con motivo distinto de decisión técnica es falta, tanto en entrenos
como en partidos. Motivo: si no penalizaba, un jugador con 0 minutos y amistosos "convocado y no
asistió" llegaba a 92% al vaciarse el bloque de partidos.

### Decisión 5 — Bloque Partidos: minutos de estímulo completo por categoría

```
duraciónPartido   = 2 × MatchDurationMinutesByCategory(categoría)   // Cadete 80, Juvenil 90, Infantil 70, Alevín 60
minutosCompletos  = 0.875 × duraciónPartido                          // Cadete 70, Juvenil 78.75, Infantil 61.25, Alevín 52.5
ratio             = min(1, minutosJugados / minutosCompletos)
```

Constante nombrada `FullStimulusFraction = 0.875`. **Fuente única**: solo
`MatchDurationMinutesByCategory` (guarda minutos de CADA parte, de ahí el `2 ×`); no se
duplican constantes. Se usa la duración estándar de la categoría, no la duración real
registrada del partido (Open Question 3). El resultado del bloque es la media de ratios
ponderada por recencia (`Σ ratio·r / Σ r`). El tipo de partido (Liga/Amistoso/Torneo) NO pondera.

**Gating**: si `MatchDurationMinutesByCategory.TryGetMinutes(teamCategoryId)` es falso (F7 o
menores), `FormStatus` y `FormStatusBreakdown` son `null` para todo el equipo, igual que
`MinutesPlayedPercentOfSeasonTotal` (mismo `hasStandardMinutes` del handler). Los entrenos
tampoco se muestran en ese caso (decisión confirmada).

### Decisión 6 — Qué partidos cuentan para cada jugador

Partidos computables del equipo en la ventana = eventos de tipo Liga/Amistoso/Torneo con al
menos una `MatchParticipation` en fase `finished` (misma definición de "partido jugado" que ya
usa el handler para `matchDurationByEventId`), con `EveDateTime` dentro de 42 días y dentro del
periodo del jugador en la plantilla (`JoinedDate`..`LeftDate`, criterio de `PossibleFor`). Por
jugador y partido:

| Situación | Ratio |
|---|---|
| Tiene participación con `MinutesPlayed > 0` | `min(1, min/minutosCompletos)` (los minutos mandan) |
| Convocatoria clasificada como Falta (Decisión 4) | `0`, cuenta en el denominador |
| Convocatoria clasificada como Asistida sin minutos (suplente que no juega) | `0`, cuenta en el denominador |
| Convocatoria Excluida (decisión técnica, pendiente) o sin convocatoria | Excluido |

### Decisión 7 — Combinación, bloques vacíos, Cansancio y redondeo

- Pesos nominales `TrainingWeight = 0.55`, `MatchWeight = 0.45`.
- Bloque vacío (**enmienda**): solo se omite y el peso del otro pasa a 1.00 si el EQUIPO no tuvo
  ningún evento de ese bloque en la ventana (pretemporada, parón: nadie es penalizado por
  partidos que no existieron). Si el equipo sí tuvo partidos (entrenos) en la ventana pero el
  jugador no tiene ninguno computable (todos excluidos), el componente es `0` y se mantienen los
  pesos nominales 0.55/0.45; así quien solo entrena no supera 55. El dato "el equipo tuvo N
  eventos" se deduce de la lista completa de eventos de la ventana que recibe el calculador
  (incluye los excluidos para este jugador). Ambos bloques sin datos computables → `null`. El DTO
  no cambia de forma; `MatchComponent`/`TrainingComponent` pasan a ser `0` (no `null`) en ese caso,
  con `MatchesConsidered = 0` y `ExcludedMatches > 0`. Ver Open Question 4.
- `base = wT·Entrenos + wM·Partidos` con pesos aplicados. Factor de Cansancio
  `1 − Fatigue/200` (rango 0.5-1.0). `FormStatus = (int)Math.Round(base × factor,
  MidpointRounding.AwayFromZero)`, acotado a 0-100.
- `Fatigue` es el `FatigueResult.Fatigue` ya calculado: el handler debe calcular Cansancio antes
  que Estado de forma (hoy va después). No se recalcula.
- Garantías (propiedades comprobadas por test): asiste a todo, juega ≥ minutosCompletos en cada
  partido, Cansancio 0 → 100. Solo entrena, equipo con partidos y él sin minutos → 55 (con
  Cansancio 0).

### Decisión 8 — Lesión

Nada extra. Sesiones y partidos perdidos por lesión (`ExcuseType` Lesión) ya cuentan 0 por la
regla de faltas (Decisión 4). Una lesión larga hunde el ratio de forma natural y la recencia
hace que lo previo a la lesión se diluya. Un jugador lesionado que el entrenador retira de la
convocatoria por decisión técnica queda excluido (sin penalización), igual que en Rodaje.

### Decisión 9 — Contrato de API (`GET /api/catalog/team/{teamId}/player-stats`)

`FormStatus: int?` se mantiene (null = sin datos o categoría sin duración estándar).
`FormStatusBreakdown: FormStatusBreakdownDto?` se rediseña. **Breaking** respecto al DTO del
change previo (sin publicar): el frontend se adapta en este mismo change.

```csharp
public record FormStatusBreakdownDto(
    // Ventana y recencia (constantes para que el cliente muestre la regla)
    int WindowDays,                        // 42
    int RecencyFullWeightDays,             // 7
    int RecencyHalfLifeDays,               // 14

    // Bloque Entrenos
    double? TrainingComponent,             // 0-100; null si no hay sesiones computables
    int TrainingSessionsOffered,           // sesiones ofrecidas computables (denominador en nº)
    int TrainingSessionsAttended,          // de esas, las asistidas ("recibidas X de Y")
    double TrainingLoadOffered,            // Σ w·r de todas las ofrecidas
    double TrainingLoadReceived,           // Σ w·r de las asistidas
    bool TrainingTypeWeightFallbackUsed,   // Decisión 3
    int ExcludedTrainings,                 // decisión técnica / sin resultado

    // Bloque Partidos
    double? MatchComponent,                // 0-100; null si no hay partidos computables
    int MatchesConsidered,
    int CategoryMatchMinutes,              // duración del partido de la categoría (Cadete 80)
    double FullStimulusFraction,           // 0.875
    double FullMatchMinutes,               // minutosCompletos (Cadete 70.0)
    double MatchRecencyWeightSum,          // Σ r
    double MatchRatioWeightedSum,          // Σ ratio·r
    int ExcludedMatches,

    // Combinación
    double TrainingWeightNominal,          // 0.55
    double MatchWeightNominal,             // 0.45
    double TrainingWeightApplied,          // tras renormalizar si falta un bloque
    double MatchWeightApplied,
    double BaseScore,                      // wT·Entrenos + wM·Partidos (0-100, sin redondear)
    int Fatigue,                           // 0-100, el mismo de PlayerStatisticsDto.Fatigue
    double FatigueFactor,                  // 1 − Fatigue/200

    FormStatusConsideredTrainingDto[] ConsideredTrainings,
    FormStatusConsideredMatchDto[] ConsideredMatches);

public record FormStatusConsideredTrainingDto(
    string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
    int DaysAgo, double RecencyWeight,     // r
    double TypeWeight,                     // w efectivo (1.00 si se usó el fallback)
    double OfferedLoad,                    // w·r
    bool Attended,
    double ReceivedLoad,                   // Attended ? w·r : 0
    string? AbsenceReason);                // motivo de la falta (Lesión, Injustificada...), null si asistió

public record FormStatusConsideredMatchDto(
    string EventId, DateTime? EventDate, int EventTypeId,
    int DaysAgo, double RecencyWeight,     // r
    int MinutesPlayed, double FullMatchMinutes,
    double Ratio,                          // min(1, MinutesPlayed / FullMatchMinutes) o 0
    double Contribution,                   // Ratio·r
    string Status);                        // "Played" | "NotPlayed" | "Absent" (constantes)
```

Las listas van ordenadas por fecha descendente. `ExcludedTrainings`/`ExcludedMatches` solo
cuentan (no se listan). Desaparecen: `TrainingSessionsBaseline`, `WeightedMatchMinutesInWindow`,
`MatchMinutesExpected`, `SessionsConsidered`, `TrainingWeight`/`MatchWeight`,
`FormStatusConsideredTrainingDto.Contribution`. Con esto el frontend puede mostrar literalmente:

- "Entrenos 55%: recibidas X de Y sesiones ofrecidas (peso por tipo y recencia) → Z%"
  (`TrainingSessionsAttended`/`TrainingSessionsOffered`, `TrainingLoadReceived`/`Offered`).
- "Partidos 45%: minutos jugados / `FullMatchMinutes` por partido → W%" (`ConsideredMatches`).
- "Cansancio N% → factor (1−N/200)" (`Fatigue`, `FatigueFactor`).
- "Resultado = (0.55×Z + 0.45×W) × factor" (`*WeightApplied`, `BaseScore`, `FormStatus`).

### Decisión 10 — Cambios de firma y de handler

```csharp
PlayerFormStatusCalculator.Calculate(
    IReadOnlyList<TrainingParticipation> trainings,   // (EventId, EventDate, DaysAgo, TrainingTypes, Outcome)
    IReadOnlyList<MatchInput> matches,                // (EventId, EventDate, EventTypeId, DaysAgo, MinutesPlayed, Outcome)
    int fatigue,
    int categoryHalfMinutes)                          // MatchDurationMinutesByCategory (por parte)
```

`Outcome` es un enum interno `{ Attended, Absent, Excluded }` de la Decisión 4 (el calculador
sigue puro; el handler clasifica con `FormStatusOutcome.Classify`). Handler:
1. Calcular `fatigueResult` antes que `formStatusResult`.
2. Solo llamar al calculador si `hasStandardMinutes`; si no, `FormStatus = null`.
3. Construir la lista de partidos del equipo en ventana a partir de `finishedParticipations`
   (`matchEventsInWindow` filtrado a Liga/Amistoso/Torneo) y de `matchLikeConvocations` (ya
   cargado, filtrable por evento y jugador). Sin queries de tabla nuevas.
4. `TrainingAttendance`/`playerTrainingConvocations` (ya cargados) alimentan los entrenos.

### Decisión 11 — Enmienda Rodaje: peso de `Fisico` 0.00 → 0.30

`ReadinessTrainingWeights` pasa a Físico 0.30 / Táctico 1.00 / Técnico 0.60. Razón: un entreno
físico sí aporta algo de ritmo/rodaje aunque menos que uno táctico o técnico; 0.00 lo trataba
como si no existiera. Consecuencias: una sesión `Fisico`+`Tactico` pondera 0.65 (antes 0.50);
tests y escenario de spec "Un entreno puramente Físico no aporta nada" pasan a "aporta poco".
Sin efecto sobre Estado de forma ni Cansancio.

### Decisión 12 — Factor de volumen solo de ENTRENOS: el 100% exige una carga de referencia

*Problema (datos reales):* el ratio recibido/ofrecido ignora el volumen absoluto. Lucas (Cadete),
con solo 7 entrenos de 7 y 2 amistosos (134'), salía al 88%: a inicio de temporada casi todo el
que asiste sale alto.

- Constante pública: `ReferenceTrainingSessions = 12` (2 por semana × 6 semanas de ventana).
- `TrainingVolumeFactor = min(1, sesionesAsistidas / 12)`: cuenta sesiones `Attended` computables
  de la ventana, sin ponderar por tipo ni recencia (el ratio ya lo hace).
- `TrainingComponent = ratioEntrenos × TrainingVolumeFactor`. `BaseScore` y `FormStatus` usan este
  valor ya escalado; el Cansancio sigue siendo el multiplicador final.
- **Se descarta el factor de volumen de PARTIDOS** (versión anterior: `min(1, minutos / (6 ×
  minutosCompletos))`): el número de partidos depende del calendario del equipo, no del jugador.
  Si el equipo solo ha jugado 2 partidos, ningún jugador puede acercarse a 6 y quedaría
  penalizado por algo que no controla. `MatchComponent` es la media ponderada por recencia de
  `min(1, minutos / minutosCompletos)`, sin factor. Se eliminan `ReferenceMatches`,
  `MatchVolumeFactor` y `MatchRatioComponent` (ya igual a `MatchComponent`).
- Bloque ausente (`null`, el equipo no ofreció entrenos/partidos): sin factor y el peso se
  renormaliza al otro bloque. El bloque de entrenos presente sí lleva su factor y NO se
  renormaliza: con solo entrenos y 6 sesiones asistidas el resultado es 50.
- Bloque a `0` porque el jugador no tiene eventos computables sigue siendo 0.
- Contrato en `FormStatusBreakdownDto`: `ReferenceTrainingSessions`, `TrainingRatioComponent`
  (0-100, previo al factor), `TrainingVolumeFactor` (0-1, `null` sin bloque de entrenos),
  `MatchMinutesPlayedTotal` y `MatchMinutesPossibleTotal` (suma de `CategoryMatchMinutes` de los
  partidos considerados; Cadete con 2 partidos → 160', no 420').
- Ejemplos: Lucas (7/7 entrenos, 134' en 2 partidos, Cansancio 22): T = 100×7/12 = 58.3; M =
  media(70/70, 64/70) = 95.7; base = 0.55×58.3 + 0.45×95.7 = 75.2; ×0.89 = **67** (antes 88).
  Zuri (5/7 entrenos, 0', 2 amistosos ausente, Cansancio 0): T = 71.4×5/12 = 29.8, M = 0 → base
  16.4 → **16** (≤ 20). Jugador con 12 sesiones y ≥ 70' en cada partido (aunque solo haya 2),
  Cansancio 0 → **100**.

## Ejemplos numéricos (Cadete: `minutosCompletos = 70`)

Base común: 12 sesiones todas Físico (w = 1) en `DaysAgo = 1, 3, 8, 10, 15, 17, 22, 24, 29, 31,
36, 38` con recencias `r = 1, 1, 0.952, 0.862, 0.673, 0.610, 0.476, 0.431, 0.336, 0.305, 0.238,
0.215` (Σ = 7.098); 6 partidos a `DaysAgo = 2, 9, 16, 23, 30, 37` con `r = 1, 0.906, 0.640,
0.453, 0.320, 0.226` (Σ = 3.545). Cansancio 20 → factor `1 − 20/200 = 0.90`.

| Caso | Entrenos | Partidos | Base | Con Cansancio 20 |
|---|---|---|---|---|
| A. Asiste a todo, juega ≥ 70' en cada partido | 100 | 100 | 100.0 | **90** (100 con Cansancio 0) |
| B. Falta a 2 de 12 (`DaysAgo` 10 y 24): ratio 81.8 × volumen 10/12 | 68.2 | 100 | 82.5 | **74** |
| C. Asiste a todo, juega 10' en cada partido (ratio 10/70) | 100 | 14.3 | 61.4 | **55** |
| D. Falta a 2 de 12 y juega 10' | 68.2 | 14.3 | 43.9 | **40** |
| E. Asiste a todo, nunca juega (0') | 100 | 0 | 55.0 | **50** (55 con Cansancio 0) |

Nota (Decisión 12): B y D llevan el factor de volumen de entrenos (10/12); los partidos no llevan factor. A y E no cambian. Las cifras de la tabla son las vigentes.

Coherencia: A = techo real de un jugador sano y descansado; B pierde ~10 puntos por 2 faltas
(las de hace 10 y 24 días pesan 0.862 y 0.431, no 1.0 cada una, así que las recientes duelen
más); C y E muestran que jugar 10' se parece a no jugar (el bloque 45% domina la diferencia) y
que solo entrenar tope en 55; el Cansancio 20 resta 10% relativo en todos. Una falta a un partido
concreto (p. ej. `DaysAgo` 16, `r = 0.640`, resto a 70') daría Partidos = (3.545 − 0.640)/3.545 =
81.9% y `base = 0.55×100 + 0.45×81.9 = 91.9`. Sin sesiones Técnicas puras en el ejemplo; si las
12 fueran Técnicas y asistiera a todas, se activa el fallback (Decisión 3) y el resultado sería el
mismo que en A.

## Risks / Trade-offs

- **Sensibilidad del 100%**: cualquier jugador con todo "normal" marca 100 mientras
  Cansancio sea 0; Cansancio rara vez es 0 en semanas normales, así que el techo típico será
  ~85-95. Es intencional y coherente con "lo normal es alto".
- **Amistosos cortos**: se compara con la duración estándar de la categoría, no con la del
  partido real (Open Question 3): un amistoso de 60' en Cadete limita el ratio a 0.857.
- **Partidos donde el equipo no registró participaciones** no cuentan; sin registro no hay dato.
- **Cambio de contrato**: el DTO previo no está en producción (change sin archivar), pero
  frontend y backend deben desplegarse juntos.
- **Sesiones futuras/pendientes** se excluyen (Decisión 4), no penalizan.

## Migration Plan

1. Archivar `player-form-status-training-match-weighting` (crea las specs base) y después este.
2. Backend y frontend en el mismo release; sin migraciones de base de datos.
3. Rollback: revertir el commit; no hay estado persistido.

## Open Questions

1. **Sesiones con peso de tipo cero (Decisión 3)**: fallback propuesto `w = 1.00` cuando
   `Σ w = 0`. ¿Prefieres otra cosa (p. ej. bloque Entrenos omitido, o peso mínimo Técnico)?
2. **Deconvocado sin motivo técnico** — RESUELTA: es falta (alineado con
   `AttributableAbsenceCalculator`) en entrenos y partidos. Rodaje (`PointsFor`) sigue
   excluyéndolo: divergencia intencionada.
3. **Duración del partido**: `minutosCompletos` usa la duración estándar de la categoría, no la
   duración real registrada. Un amistoso de 60' penaliza. ¿Aceptable, o usar `min(estándar,
   máximo de minutos registrados en el partido)`?
4. **Bloque vacío** — RESUELTA: se renormaliza solo si el equipo no tuvo eventos de ese bloque en
   la ventana; si los tuvo y el jugador no tiene ninguno computable, el componente es 0.
5. **Llegada tarde** cuenta como asistencia completa (como hasta ahora). ¿Debería contar menos?
6. **Jugador que se incorpora a mitad de ventana**: solo cuenta lo posterior a `JoinedDate`. Si
   solo tiene 1-2 eventos el valor es muy volátil; ¿exigir un mínimo de eventos antes de mostrar
   el valor (hoy: cualquier evento basta, como el modelo anterior)?
7. **Cansancio como multiplicador**: usa el `Fatigue` a fecha de hoy, no el de cada día de la
   ventana (no hay histórico). Confirmado en el modelo; se anota por si se quiere refinar.
