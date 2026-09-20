## Context

- `PlayerFatigueCalculator` (Cansancio, ver `openspec/specs/player-fatigue/spec.md`) suma, por
  jugador, entrenos asistidos y minutos de partido dentro de una ventana de carga de 14 días,
  cada evento ponderado por un decaimiento exponencial de recencia (semivida 2 días). No mira el
  tipo de entrenamiento ni el tipo de partido: un entreno físico decae igual que uno técnico, un
  partido de Liga pesa igual que un amistoso.
- `PlayerReadinessCalculator` (Rodaje) suma puntos de asistencia real a entrenamiento (con
  penalización por lesión/ausencia) más minutos de partido, sobre una ventana de 8 semanas
  (`WindowWeeks`), ponderados 70/30 entreno/partido. Introducido en el change archivado
  `squad-statistics-form-status`, nunca llegó a tener una spec propia en `openspec/specs/` — este
  change la crea (`player-readiness`) al mismo tiempo que le añade la ponderación por tipo.
- `SportEvent.TrainingTypes: List<string>` (jsonb, `Infrastructure/Migrations/20260918074115_AddTrainingTypesToSportEvent.cs`
  + fix de default `20260918075608_FixSportEventTrainingTypesDefault.cs`) ya persiste, por sesión
  de entrenamiento, cuáles de los tres `TrainingType` (`Fisico`/`Tecnico`/`Tactico`,
  `Domain/Aggregates/Assistances/TrainingType.cs`) estuvieron presentes. Solo tiene sentido
  cuando `EventTypeId == SportEventType.TrainingId`; puede estar vacío (sesiones creadas antes
  de esta migración, o un coach que no marcó ningún tipo).
- El tipo de partido ya existe como `EventTypeId` en `SportEvent`: `SportEventsConstants.MatchEventTypeId = 1`
  (Liga/oficial), `FriendlyEventTypeId = 4` (Amistoso), `TournamentEventTypeId = 6` (Torneo).
- `GetTeamPlayerStatistics.cs` ya carga, sin filtrar por `EventTypeId`, todos los `SportEvent` del
  equipo dentro de la ventana de 8 semanas (`matchEventsInWindow`, superset del que se derivan
  tanto los datos de Rodaje como los de Cansancio, ver comentario "Load window for Cansancio" en
  el handler) — añadir `TrainingTypes`/`EventTypeId` a esas proyecciones no requiere queries
  nuevas, solo ampliar los `Select(...)` ya existentes.
- El frontend calcula hoy "Ef" (Estado de forma, mostrado como leyenda "Ef" en `PlayerFormBars`)
  como `computeEf(readiness, fatigue) = readiness × (1 − fatigue/200)`
  (`Front/src/apps/coach/utils/playerFormMetrics.ts`) — una fórmula derivada, sin dato propio.
  Consumido en `SquadStatistics.tsx`, `squadStatsPdfExport.ts`, `PlayerDetail.tsx` (pestaña
  Estadísticas) vía `PlayerFormBars`. El usuario confirmó que quiere sustituir esa fórmula
  derivada por un tercer valor calculado en backend con reglas propias, no una combinación de
  Rodaje/Cansancio.

## Goals / Non-Goals

**Goals:**
- Introducir ponderación por tipo de entrenamiento (Físico/Técnico/Táctico) y por tipo de
  partido (Liga/Amistoso/Torneo) en `PlayerFatigueCalculator` y `PlayerReadinessCalculator`, con
  un orden de importancia distinto y explícito por métrica (ver Decisión 1).
- Introducir `PlayerFormStatusCalculator`, una tercera métrica de backend ("Estado de forma"),
  independiente de Rodaje/Cansancio, con sus propias reglas de ponderación por tipo.
- Exponer `FormStatus` en `PlayerStatisticsDto` (`GET /api/catalog/team/{teamId}/player-stats`)
  con un contrato cerrado y estable para que el frontend lo consuma sin ambigüedad en un change
  posterior.
- Cuando una sesión combina varios tipos de entrenamiento, ponderar solo entre los tipos
  presentes en esa sesión — un tipo ausente en una sesión concreta no participa ni resta peso a
  los presentes de otras sesiones.
- Proponer y documentar valores numéricos concretos para todos los pesos, con el mismo nivel de
  razonamiento que los comentarios "Decisión N" ya existentes en los calculadores.

**Non-Goals:**
- No se implementa el cambio de frontend (retirar `computeEf`, actualizar `PlayerFormBars`,
  `SquadStatistics.tsx`, `squadStatsPdfExport.ts`, `PlayerDetail.tsx`) — queda para un change
  posterior de front-specialist, una vez el usuario apruebe este diseño. Este design.md solo
  fija el contrato de API que ese change consumirá.
- No se cambia el mecanismo de decaimiento por recencia de Cansancio (semivida 2 días) ni el
  mecanismo de puntuación por motivo de ausencia de Rodaje (`PointsFor`) — solo se les añade un
  multiplicador de ponderación por tipo encima de lo que ya calculan.
- No hay backfill histórico ni migración de datos — `TrainingTypes`/`EventTypeId` ya están
  persistidos; las tres métricas siguen siendo siempre calculadas en caliente, sin estado
  persistido.
- No se toca `AttributableAbsenceCalculator`, los ratios de asistencia por temporada
  (`AttendanceRatioDto`), ni el "minutes-target" de temporada (`MinutesPlayedPercentOfSeasonTotal`).

## Decisions

### Decisión 1 — Tablas de pesos por tipo de entrenamiento, una por métrica

Cada métrica tiene un orden de importancia distinto para los tres `TrainingType`, confirmado por
el usuario en la solicitud. Se proponen los siguientes valores concretos (0.0-1.0), como
multiplicador de la contribución de la sesión:

| Tipo       | Cansancio | Rodaje | Estado de forma |
|------------|-----------|--------|------------------|
| `Fisico`   | **1.00**  | 0.00   | **1.00**         |
| `Tactico`  | 0.70      | **1.00** | 0.50           |
| `Tecnico`  | 0.40      | 0.60   | 0.00             |

Razonamiento (judgment call, sin dato fisiológico exacto que lo derive, igual que
`HalfLifeDays`/`TrainingWeight` en los calculadores existentes — decisión de producto explícita,
constantes nombradas y fácilmente reajustables):

- **Cansancio**: un entreno físico (series, sprints, resistencia) genera más fatiga muscular real
  que uno táctico (posicionamiento, lectura de juego, intensidad media) o uno técnico (control,
  pase, finalización, intensidad baja-media). Orden pedido: Físico > Táctico > Técnico. Se separa
  Técnico (0.40) claramente de Táctico (0.70) porque el trabajo técnico puro suele ser el de menor
  exigencia física de los tres.
- **Rodaje**: mide "cuánto lista está la cabeza/el automatismo de juego del jugador para
  competir", no su desgaste físico — un entreno táctico (donde se ensayan patrones de juego reales)
  aporta más a esa soltura competitiva que uno técnico (aislado, sin contexto de juego), y un
  entreno puramente físico (gimnasio, carrera continua) no aporta nada a esa soltura futbolística
  en absoluto: peso 0.00, tal como pidió el usuario explícitamente ("Físico aporta 0 a Rodaje").
- **Estado de forma**: mide condición física de base, así que el físico manda (1.00); el táctico
  aporta algo porque incluye carga de movimiento/intensidad dentro de contexto de juego (0.50);
  el técnico no mejora la condición física en absoluto (0.00), tal como pidió el usuario
  explícitamente.

**Sesión sin tipos marcados (`TrainingTypes` vacío)** — retrocompatibilidad: peso neutro **1.00**
para las tres métricas. Motivo: `TrainingTypes` es un campo añadido en la migración del
2026-09-18 (`AddTrainingTypesToSportEvent`); cualquier entreno creado antes de esa fecha, o
cualquier entreno nuevo donde el coach no marque ningún tipo, tiene la lista vacía. Tratarlo como
peso 0 penalizaría injustamente datos históricos y coaches que no rellenan el campo (opcional);
tratarlo como peso 1.00 (máximo, "cuenta como si fuera de todos los tipos a la vez") preserva
exactamente el comportamiento actual (pre-change) para esos casos, que es el criterio ya usado
implícitamente hoy (todo entreno cuenta igual).

**Sesión con varios tipos presentes**: se pondera con la **media aritmética de los pesos de los
tipos presentes en esa sesión únicamente** — un tipo ausente en la sesión no participa en la
media ni "roba" peso a los presentes de otras sesiones (cada sesión se pondera de forma
independiente). Ejemplo para Cansancio, sesión con `["Fisico", "Tecnico"]`:
`peso = (1.00 + 0.40) / 2 = 0.70`. Se descartó normalizar a que los pesos presentes sumen 1 (p.
ej. softmax o reparto proporcional) porque distorsionaría la escala absoluta ya calibrada de cada
calculador (`ReferenceTrainingsPerWindow`, `BaselineTrainings`) — la media aritmética mantiene la
misma escala 0.0-1.00 que un tipo único, sin necesitar recalibrar las referencias existentes.

```csharp
// Services/TrainingTypeWeighting.cs — helper compartido por los tres calculadores
public static class TrainingTypeWeighting
{
    public const double UntypedWeight = 1.0; // sesión sin tipos marcados: peso neutro (retrocompat)

    public static double Weight(IReadOnlyList<string> trainingTypesPresent, IReadOnlyDictionary<string, double> weightByCode)
    {
        if (trainingTypesPresent.Count == 0) return UntypedWeight;

        var matched = trainingTypesPresent
            .Where(weightByCode.ContainsKey)
            .Select(t => weightByCode[t])
            .ToList();

        return matched.Count == 0 ? UntypedWeight : matched.Average();
    }
}
```

### Decisión 2 — Pesos por tipo de partido

> **Enmienda (confirmada con el usuario tras revisar el detalle expandible en frontend):** el
> peso por tipo de partido de esta decisión **solo aplica a Cansancio y Rodaje**. Para Estado de
> forma, Liga y Amistoso/Torneo pesan **igual** (ver Decisión 3 y
> `PlayerFormStatusCalculator.Calculate`), porque el Estado de forma mide condición física de
> base: el desgaste/beneficio físico de jugar X minutos no depende de si hay puntos en juego. El
> texto original de esta decisión ("compartido por las tres métricas") queda obsoleto; se conserva
> debajo sin reescribir para no perder el razonamiento de Cansancio/Rodaje, que sí sigue vigente.

A diferencia del entreno (orden distinto por métrica), el usuario pidió inicialmente el mismo
criterio para las tres métricas: un partido de Liga/oficial pesa más que un Amistoso. Tras ver el
detalle expandible en frontend, se corrigió para Estado de forma (ver enmienda arriba). Para
Cansancio y Rodaje se mantiene el peso compartido:

| Tipo de evento           | Peso |
|--------------------------|------|
| `Match` (Liga, Id 1)     | **1.00** |
| `FriendlyMatch` (Id 4)   | 0.70 |
| `Tournament` (Id 6)      | 0.70 |
| Cualquier otro/no reconocido | 1.00 (neutro, defensivo) |

Razonamiento: un partido oficial de Liga tiene presión competitiva, intensidad y exigencia
superiores a un amistoso — factor **0.70**, mismo orden de magnitud que el peso Técnico/Táctico
del entreno, elegido para que un amistoso siga contando de forma sustancial (no es "casi nada",
sigue siendo esfuerzo físico real, tal como ya documenta el comentario existente en
`GetTeamPlayerStatistics.cs`: *"a friendly still costs real physical effort"*). Torneo se agrupa
con Amistoso (0.70): el usuario no distinguió explícitamente Torneo, y a nivel de exigencia
competitiva un torneo de categorías base se parece más a un amistoso que a una jornada de Liga
regular. El caso "cualquier otro" cubre defensivamente cualquier `EventTypeId` inesperado que
pudiera colarse en las consultas existentes (que hoy no filtran por tipo al construir
`matchEventsInWindow`) sin romper el cálculo.

```csharp
// Services/MatchTypeWeighting.cs
public static class MatchTypeWeighting
{
    public static double Weight(int eventTypeId) => eventTypeId switch
    {
        SportEventsConstants.MatchEventTypeId => 1.00,
        SportEventsConstants.FriendlyEventTypeId => 0.70,
        SportEventsConstants.TournamentEventTypeId => 0.70,
        _ => 1.00
    };
}
```

### Decisión 3 — Dónde entra la ponderación en cada fórmula existente

**`PlayerFatigueCalculator`** — cada elemento de las listas de entrada pasa a llevar su tipo:

```csharp
public static Result Calculate(
    IReadOnlyList<(int DaysAgo, IReadOnlyList<string> TrainingTypes)> trainings,
    IReadOnlyList<(int DaysAgo, int MinutesPlayed, int EventTypeId)> matches)
{
    var decayedTrainingCount = trainings.Sum(t =>
        Decay(t.DaysAgo) * TrainingTypeWeighting.Weight(t.TrainingTypes, FatigueTrainingWeights));
    var decayedMatchMinutes = matches.Sum(m =>
        m.MinutesPlayed * Decay(m.DaysAgo) * MatchTypeWeighting.Weight(m.EventTypeId));
    // resto de la fórmula (TrainingComponent/MatchComponent/Fatigue) sin cambios
}
```

`ReferenceTrainingsPerWindow` (2) y `ReferenceMatchMinutes` (70) se mantienen sin cambios: ahora
representan "2 entrenos de tipo Físico de hoy" / "70 minutos de un partido de Liga de hoy" — la
referencia ya asumía implícitamente el caso de máxima exigencia, que sigue siendo peso 1.00.

**`PlayerReadinessCalculator`** — `TrainingOutcome` gana un campo `TrainingTypes`, y la lista de
minutos de partido pasa a llevar también su `EventTypeId`:

```csharp
public record TrainingOutcome(
    string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
    int? AssistanceTypeId, int? ExcuseTypeId, int? ConvocationStatusId);

// scoringSum: Points × peso de tipo de entreno, solo para asistencia real (sin cambios en esa condición)
var scoringSum = scored
    .Where(x => IsRealAttendance(x.Outcome))
    .Sum(x => x.Points!.Value * TrainingTypeWeighting.Weight(x.Outcome.TrainingTypes, ReadinessTrainingWeights));

// matchMinutes: cada minuto ponderado por tipo de partido antes de sumar
public static Result Calculate(
    IReadOnlyList<TrainingOutcome> trainingOutcomesInWindow,
    IReadOnlyList<(int MinutesPlayed, int EventTypeId)> matchesInWindow)
{
    var matchMinutes = matchesInWindow.Sum(m => m.MinutesPlayed * MatchTypeWeighting.Weight(m.EventTypeId));
    // ...
}
```

Nota: `matchMinutes` (usado también para `MatchMinutesInWindow` en `ReadinessBreakdownDto`, un
campo puramente informativo para el frontend) pasa a ser una suma *ponderada*, no un conteo bruto
de minutos reales — se documenta explícitamente en el XML doc del record para que no se confunda
con "minutos reales jugados" en el tooltip del frontend.

**`PlayerFormStatusCalculator`** (nuevo) — mismo patrón que Rodaje, ventana de 8 semanas
compartida, pero solo asistencia real cuenta (sin puntuación por motivo de ausencia: el estado
físico no mejora por una ausencia justificada, a diferencia de la "confianza"/rodaje competitivo
que sí matiza por motivo):

```csharp
public static class PlayerFormStatusCalculator
{
    public const int WindowWeeks = PlayerReadinessCalculator.WindowWeeks; // 8, misma ventana que Rodaje
    public const int BaselineTrainings = PlayerReadinessCalculator.BaselineTrainings; // 16
    public const int BaselineMatches = PlayerReadinessCalculator.BaselineMatches;     // 8
    public const int ExpectedMinutesPerMatch = PlayerReadinessCalculator.ExpectedMinutesPerMatch; // 70
    public const double TrainingWeight = 0.70;
    public const double MatchWeight = 0.30;

    private static readonly IReadOnlyDictionary<string, double> FormStatusTrainingWeights = new Dictionary<string, double>
    {
        [TrainingType.Fisico.Code] = 1.00,
        [TrainingType.Tactico.Code] = 0.50,
        [TrainingType.Tecnico.Code] = 0.00,
    };

    public record TrainingAttendance(bool Attended, IReadOnlyList<string> TrainingTypes);

    public record Result(int? FormStatus, double TrainingComponent, double MatchComponent,
        int SessionsConsidered, int WeightedMatchMinutesInWindow);

    public static Result Calculate(
        IReadOnlyList<TrainingAttendance> trainingAttendancesInWindow,
        IReadOnlyList<(int MinutesPlayed, int EventTypeId)> matchesInWindow)
    {
        var sessionsConsidered = trainingAttendancesInWindow.Count;
        var weightedTrainingSum = trainingAttendancesInWindow
            .Where(a => a.Attended)
            .Sum(a => TrainingTypeWeighting.Weight(a.TrainingTypes, FormStatusTrainingWeights));
        var trainingComponent = sessionsConsidered == 0
            ? 0d
            : Math.Min(100d, weightedTrainingSum / BaselineTrainings * 100d);

        var weightedMatchMinutes = matchesInWindow.Sum(m => m.MinutesPlayed * MatchTypeWeighting.Weight(m.EventTypeId));
        var matchComponent = Math.Min(100d, weightedMatchMinutes / (double)(BaselineMatches * ExpectedMinutesPerMatch) * 100d);

        int? formStatus = sessionsConsidered == 0 && weightedMatchMinutes == 0
            ? null
            : (int)Math.Round(TrainingWeight * trainingComponent + MatchWeight * matchComponent);

        return new Result(formStatus, trainingComponent, matchComponent, sessionsConsidered, (int)weightedMatchMinutes);
    }
}
```

`TrainingWeight`/`MatchWeight` (0.70/0.30) reutilizan la misma proporción que Rodaje: se decidió
no inventar una tercera proporción distinta sin una razón de producto clara — la condición física
de base, igual que el rodaje competitivo, se construye principalmente con repeticiones de
entrenamiento estructurado, y los minutos de partido son un complemento, no la vía principal. Es
una decisión de simplicidad/consistencia entre métricas, documentada como tal (no viene de un
dato del usuario).

**Solo asistencia real cuenta** (`Attended = true` cuando `AssistanceTypeId` es `Attendance` o
`LateArrival`, igual que `IsRealAttendance` en Rodaje) — cualquier ausencia, motivada o no, aporta
0 al Estado de forma: a diferencia de Rodaje (que puntúa parcialmente una ausencia justificada
porque mide compromiso/continuidad competitiva), el Estado de forma es un proxy de condición
física real, y la condición física no mejora por estar ausente con motivo válido.

### Decisión 4 — `null` cuando no hay datos, igual que Rodaje (no 0 como Cansancio)

`FormStatus` es `null` cuando no hay ninguna sesión de entreno considerada ni minutos de partido
en la ventana de 8 semanas (jugador nuevo en el equipo, o fuera de temporada), igual que
`Readiness`. Se prefiere este criterio sobre el de Cansancio (que sí devuelve `0` sin eventos)
porque el Estado de forma, como el Rodaje, es una métrica "constructiva" que se acumula con el
tiempo — "sin datos" no es lo mismo que "en baja forma" (0), mientras que Cansancio "sin eventos
recientes" sí es legítimamente "0 de cansancio" (nadie lo ha exigido). Mismo razonamiento que ya
distingue ambos calculadores hoy.

### Decisión 5 — Ventana de 8 semanas (la de Rodaje), no la de 14 días (la de Cansancio)

Se reutiliza `PlayerReadinessCalculator.WindowWeeks` (8 semanas) en vez de
`PlayerFatigueCalculator.WindowDays` (14 días, con decaimiento por recencia). Razonamiento: el
Estado de forma es, por naturaleza, una métrica de acumulación lenta (condición física de base),
no de recencia inmediata (eso es exactamente lo que ya mide Cansancio con su decaimiento de
semivida 2 días) — construir "forma física" requiere semanas de trabajo sostenido, no solo los
últimos días. Además, reutilizar la ventana de Rodaje permite construir `FormStatus` a partir de
los mismos datos ya cargados por el handler (`trainingConvocationsInWindow`,
`participationsInWindow`) sin ninguna query nueva, igual que Cansancio ya deriva su ventana más
estrecha de ese mismo superset. Se descartó usar decaimiento por recencia (como Cansancio) porque
no tendría sentido de producto: la forma física no "decae exponencialmente en 2 días" solo por no
entrenar ayer.

### Decisión 6 — Ampliación de las proyecciones EF existentes, sin queries nuevas

`GetTeamPlayerStatistics.Handler`:
- `trainingEventsInWindow`: el `Select(se => new { se.Id, se.EveDateTime })` gana `se.TrainingTypes`
  → nuevo diccionario `trainingEventTrainingTypesById: Dictionary<string, List<string>>`.
- `matchEventsInWindow`: el `Select(se => new { se.Id, se.EveDateTime })` gana `se.EventTypeId`
  → nuevo diccionario `matchEventEventTypeById: Dictionary<string, int>`.
- Las listas ya construidas por-jugador para Cansancio
  (`trainingsAttendedInFatigueWindowByPlayer`, `matchMinutesInFatigueWindowByPlayer`) pasan a
  incluir `TrainingTypes`/`EventTypeId` junto al `DaysAgo`/`MinutesPlayed` que ya llevaban,
  leyendo de los nuevos diccionarios (mismo patrón, sin queries nuevas).
- `trainingOutcomes` (para Rodaje) incorpora `TrainingTypes` desde `trainingEventTrainingTypesById`.
  `matchMinutesInWindowByPlayer` pasa de `List<int>` a `List<(int MinutesPlayed, int EventTypeId)>`
  leyendo `matchEventEventTypeById`.
- Nuevo bloque, análogo al de Rodaje: construir `trainingAttendancesInWindowByPlayer:
  Dictionary<string, List<PlayerFormStatusCalculator.TrainingAttendance>>` a partir de
  `trainingConvocationsInWindow` (mismo dato que ya usa Rodaje, filtrando `Attended` con
  `IsRealAttendance`) y llamar `PlayerFormStatusCalculator.Calculate(...)` en el bucle por-jugador,
  reutilizando `matchMinutesInWindowByPlayer` (ya ponderable por tipo tras el cambio anterior).

### Decisión 7 — Contrato de API para el frontend

`PlayerStatisticsDto` gana dos campos nuevos, aditivos (no rompe el contrato existente):

```csharp
public record PlayerStatisticsDto(
    // ...campos existentes sin cambios (Fatigue: int, Readiness: int?, ReadinessBreakdown, ...)
    int? FormStatus,                              // 0-100, null = sin datos suficientes en la ventana de 8 semanas
    FormStatusBreakdownDto? FormStatusBreakdown);  // null cuando FormStatus es null

public record FormStatusBreakdownDto(
    double TrainingComponent,       // 0-100
    double MatchComponent,          // 0-100
    int SessionsConsidered,
    int TrainingSessionsBaseline,   // = PlayerFormStatusCalculator.BaselineTrainings
    int WeightedMatchMinutesInWindow,
    int MatchMinutesExpected);      // = BaselineMatches * ExpectedMinutesPerMatch
```

Se añaden al final del record (posición estable para consumidores por índice, aunque el frontend
ya consume por nombre vía JSON). `FormStatusBreakdown` se incluye ahora, aunque el frontend no lo
consuma en un primer momento, siguiendo exactamente el mismo patrón que `ReadinessBreakdownDto`
(ya usado hoy para el tooltip de Rodaje en `PlayerFormBars`'s `readinessTooltip`) — así un change
de frontend posterior puede añadir un tooltip de Estado de forma sin necesitar otro cambio de
contrato de backend.

**Nombre del campo**: `FormStatus` (inglés, consistente con `Fatigue`/`Readiness` ya existentes
en el DTO pese a que la UI muestra las etiquetas en español "Cansancio"/"Rodaje"/"Estado de
forma"). El frontend mostrará la etiqueta "Estado de forma" (sustituyendo a "Ef") en
`PlayerFormBars`, consumiendo `formStatus`/`formStatusBreakdown` (camelCase tras
deserialización JSON) exactamente igual que ya consume `readiness`/`readinessBreakdown`. Ese
cambio de frontend (eliminar `computeEf`, actualizar `PlayerFormBars.tsx`, `SquadStatistics.tsx`,
`squadStatsPdfExport.ts`, `PlayerDetail.tsx`) queda fuera de este change (ver Non-Goals) y se
delega a front-specialist en un change posterior, ya con el contrato cerrado.

### Decisión 8 — Transparencia del desglose: lista de eventos reales en vez de porcentaje agregado (addendum, implementado directamente sin nuevo change)

**Desviación de proceso**: este addendum se implementó directamente sobre el código de este
change (sin `openspec new change`), por indicación explícita del usuario — es una extensión de
la misma sub-funcionalidad de transparencia del desglose (`FatigueBreakdownDto`/
`ReadinessBreakdownDto`/`FormStatusBreakdownDto`), no una feature nueva. Se documenta aquí en
lugar de en un `proposal.md`/`tasks.md` propios.

**Problema**: tras el primer despliegue de los breakdowns (Decisión 7), el usuario probó el panel
expandible y reportó que el porcentaje agregado por componente (`TrainingComponent: 19`) es
ilegible para un entrenador — no explica a qué se compara ni qué aportó cada sesión concreta
("¿Qué significa entreno el 19%? Si han entrenado 1 día de físico, ¿qué aporta?").

**Solución**: cada uno de los tres calculadores (`PlayerFatigueCalculator`,
`PlayerReadinessCalculator`, `PlayerFormStatusCalculator`) expone ahora, además de los
componentes agregados, una lista de **todos los eventos realmente considerados** en la ventana —
mismo patrón que ya existía para `RecentAbsences` en Rodaje, generalizado a asistencias
completas y a las tres métricas:

```csharp
// PlayerFatigueCalculator
public record ConsideredTraining(string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
    int DaysAgo, double Decay, double TypeWeight, double Contribution);
public record ConsideredMatch(string EventId, DateTime? EventDate, int EventTypeId, int MinutesPlayed,
    int DaysAgo, double Decay, double TypeWeight, double EffectiveMinutes);

// PlayerReadinessCalculator (RecentAbsences se mantiene sin cambios, ConsideredTrainings lo generaliza)
public record ConsideredTraining(string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
    bool CountsTowardScore, double Points, double TypeWeight, double Contribution, string Reason);
public record ConsideredMatch(string EventId, DateTime? EventDate, int EventTypeId, int MinutesPlayed,
    double TypeWeight, double EffectiveMinutes);

// PlayerFormStatusCalculator (ConsideredMatch sin campo de peso: siempre 1.00 aquí)
public record ConsideredTraining(string EventId, DateTime? EventDate, IReadOnlyList<string> TrainingTypes,
    bool Attended, double TypeWeight, double Contribution);
public record ConsideredMatch(string EventId, DateTime? EventDate, int EventTypeId, int MinutesPlayed);
```

Cada `*BreakdownDto` (en `GetTeamPlayerStatistics.cs`) expone además `TrainingWeight`/
`MatchWeight` (0.40/0.60, 0.70/0.30 según la métrica) — los mismos `public const double` que ya
existían en cada calculador — para que el frontend componga "Entrenamientos (peso 70% del
total)" sin hardcodear el número.

**Decisiones de diseño no triviales tomadas al implementar**:

1. **`RecentAbsences` se mantiene intacto** en `ReadinessBreakdownDto` (no se fusiona ni se
   elimina) y se añade `ConsideredTrainings`/`ConsideredMatches` como campos nuevos aditivos —
   para no romper a ningún consumidor existente del array de ausencias, aunque
   `ConsideredTrainings` ya contiene toda la información de `RecentAbsences` (y más: también las
   sesiones con asistencia completa). Un cambio de frontend posterior puede decidir si sigue
   usando `RecentAbsences` para el resumen corto de ausencias y usa `ConsideredTrainings` para la
   tabla completa, o si migra a usar solo `ConsideredTrainings` y deja de leer `RecentAbsences`.
2. **Amplitud de firma de los `Calculate()`**: los tres calculadores pasaron a recibir
   `EventId`/`EventDate` reales en sus listas de entrada (antes `PlayerFatigueCalculator` solo
   recibía `DaysAgo` y `PlayerFormStatusCalculator.TrainingAttendance` no recibía ningún
   identificador de evento). Esto rompe binariamente la firma pública de `Calculate()` — aceptado
   porque los calculadores son `internal` a efectos prácticos (solo los llama
   `GetTeamPlayerStatistics.Handler`) y no hay otros consumidores en el código.
3. **`EventDate` es `DateTime?`** (no `DateTime`) en todos los nuevos records, reflejando que
   `SportEvent.EveDateTime` es nullable — el handler solo alimenta eventos ya fechados dentro de
   la ventana, pero se prefirió no forzar una aserción sin valor de negocio real.
4. **Ordenación**: las tres listas se devuelven ordenadas por fecha descendente (más reciente
   primero), coherente con el ejemplo de tabla acordado con el usuario (evento más reciente
   arriba).
5. **`PlayerFormStatusCalculator.ConsideredMatch` no tiene campo de peso** (a diferencia de los
   otros dos calculadores) porque el peso de partido es siempre 1.00 para Estado de forma —
   añadir un campo `TypeWeight` que siempre vale 1.00 no aportaría información y podría sugerir
   erróneamente al frontend que varía por tipo de partido, como sí ocurre en Cansancio/Rodaje.

**Verificación**: `dotnet build` y `dotnet test` en verde (1354 tests), incluyendo 10 tests
unitarios nuevos sobre los tres calculadores y 1 test end-to-end nuevo en
`GetTeamPlayerStatisticsHandlerTests` que siembra un entreno Físico + un amistoso y verifica que
las tres listas exponen `EventId`/peso/aportación correctos vía EF real (no solo el calculador
puro). Los tests existentes de los tres calculadores y del handler pasan sin modificar sus
aserciones (solo se actualizaron las firmas de las llamadas para el nuevo shape de tupla), lo que
confirma que el comportamiento agregado (`Fatigue`/`Readiness`/`FormStatus`/`TrainingComponent`/
`MatchComponent`) no cambió — este addendum es puramente aditivo.

## Risks / Trade-offs

- [Risk] Las tablas de pesos (Decisión 1 y 2) son juicios de producto sin dato fisiológico que
  las derive exactamente, igual que `HalfLifeDays`/`TrainingWeight` en los calculadores
  existentes. → Mitigación: documentadas explícitamente como judgment calls con su razonamiento,
  constantes nombradas y triviales de reajustar; no se presentan como cálculo científico.
- [Risk] Cambiar la firma interna de `Calculate(...)` en los tres calculadores obliga a reescribir
  también las secciones de construcción de datos del handler y los tests unitarios existentes —
  superficie de cambio no trivial en un archivo ya grande (`GetTeamPlayerStatistics.cs`, ~520
  líneas). → Mitigación: el cambio es mecánico (añadir un campo a tuplas/records ya existentes,
  sin tocar queries), y el helper compartido `TrainingTypeWeighting`/`MatchTypeWeighting` evita
  triplicar la lógica de "media de pesos presentes" en cada calculador.
- [Risk] `matchMinutes`/`MatchMinutesInWindow` en `ReadinessBreakdownDto` deja de representar
  minutos reales jugados (pasa a ser una suma ponderada) — un consumidor futuro del breakdown
  podría interpretarlo mal. → Mitigación: XML doc explícito en el record; el frontend actual solo
  lo muestra como número en un tooltip informativo, no lo usa para ningún cálculo propio (se
  verificará al tocar el frontend en el change posterior).
- [Risk] Agrupar `Tournament` con `FriendlyMatch` (mismo peso 0.70) es una extrapolación no pedida
  explícitamente por el usuario. → Mitigación: documentado como judgment call explícito en
  Decisión 2; trivial de separar en una constante propia si el usuario lo corrige.
- [Risk] Reutilizar la proporción 70/30 de Rodaje para Estado de forma sin una validación de
  producto específica. → Mitigación: documentado como decisión de consistencia/simplicidad, no de
  dato; open question dejada explícita más abajo por si el usuario prefiere otra proporción.

## Migration Plan

1. TDD: escribir `TrainingTypeWeighting`/`MatchTypeWeighting` con sus tests unitarios (media de
   pesos presentes, sesión sin tipos → neutro, tipo de partido no reconocido → neutro).
2. TDD: reescribir `PlayerFatigueCalculatorTests.cs` y `PlayerReadinessCalculatorTests.cs` (Red)
   con la nueva firma y casos de ponderación por tipo (entreno físico vs técnico con el mismo
   `daysAgo`, partido de Liga vs amistoso con los mismos minutos, sesión con dos tipos → media,
   sesión sin tipos → comportamiento idéntico al actual).
3. Implementar la nueva firma de ambos calculadores (Green).
4. TDD: escribir `PlayerFormStatusCalculatorTests.cs` (Red) con los casos base (sin datos → null,
   solo físico vs solo técnico con la misma asistencia, partido de Liga vs amistoso, combinación
   de tipos → media) e implementar `PlayerFormStatusCalculator` (Green).
5. Actualizar `GetTeamPlayerStatistics.cs`: ampliar proyecciones EF (`TrainingTypes`/`EventTypeId`),
   reconstruir las listas por-jugador con el tipo incluido, invocar `PlayerFormStatusCalculator`,
   añadir `FormStatus`/`FormStatusBreakdown` al DTO.
6. Actualizar `GetTeamPlayerStatisticsHandlerTests.cs`: ajustar los tests existentes de
   Fatigue/Readiness que asumían tipos neutros (deben seguir pasando si se siembran eventos sin
   `TrainingTypes`, gracias a Decisión 1), añadir tests de integración end-to-end para
   `FormStatus`.
7. `dotnet build` + `dotnet test` (área `RFFM.Api.Tests`) en verde.
8. No commitear/pushear — dejar los cambios en el working tree para revisión del usuario, y no
   tocar `Front/` en este change (ver Non-Goals).

## Open Questions

- ¿La proporción 70/30 entreno/partido de Estado de forma (Decisión 3, reutilizada de Rodaje) es
  aceptable, o el usuario prefiere que el entreno físico pese aún más (p. ej. 80/20) dado que los
  partidos rara vez son puramente "de acondicionamiento físico"? Propuesto 70/30 por consistencia
  con Rodaje; fácil de ajustar como constante nombrada si el usuario confirma otro valor durante
  la implementación.
- ¿Agrupar `Tournament` con `FriendlyMatch` (mismo peso 0.70, Decisión 2) es correcto, o el
  usuario quiere un tercer nivel de peso distinto para Torneo? No se pidió explícitamente en la
  solicitud original (solo Liga vs Amistoso); se asume agrupación por defecto hasta que el
  usuario lo corrija.
