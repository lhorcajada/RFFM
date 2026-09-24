## Context

- `PlayerFormStatusCalculator` (change archivado `player-form-status-received-offered-load` +
  fix `08757066`) calcula `(0.55·Entrenos + 0.45·Partidos) × (1 − Cansancio/200)` sobre 42 días,
  con los partidos ponderados por recencia (`FormStatusRecency`). Caso real reportado (4 jugadores,
  9/9 entrenos, 2/2 amistosos Cadete): 125' → 71%, 120' → 68%, 110' → 66%, 106' → 66%, y 108' por
  debajo de 106'. Causa: el peso por recencia hace que el reparto de minutos entre partidos
  cambie el resultado.
- `PlayerReadinessCalculator` suma contra referencias fijas en 8 semanas: un evento que sale de la
  ventana hace caer el Rodaje de golpe el día 57.
- `PlayerFatigueCalculator` ya sigue la lógica "sube con carga, baja con descanso" (semivida 2 días).
  No se toca.
- Decisiones del usuario (confirmadas en conversación, no se reabren aquí):
  1. Actividad ⇒ EF sube, Rodaje sube, Cansancio sube.
  2. 1-4 días seguidos sin actividad ⇒ EF y Rodaje se mantienen, Cansancio baja.
  3. Desde el 5º día sin actividad el EF baja, cada día un poco más.
  4. El Cansancio NO multiplica al EF: son indicadores separados.
  5. Las vacaciones del equipo (sin eventos) cuentan como descanso y también hacen bajar el EF.
  6. El Rodaje se estanca 3 semanas sin actividad y después baja, más despacio que el EF.

## Goals / Non-Goals

**Goals**
- EF y Rodaje como estado que evoluciona día a día, explicable paso a paso.
- Monotonía: con los mismos días de actividad, más carga (minutos, entrenos) nunca da menos valor.
- Un único motor puro compartido (`DailyLoadModel`) parametrizado para EF y Rodaje.

**Non-Goals**
- Sin cambios en Cansancio (`PlayerFatigueCalculator`, `FatigueBreakdownDto`).
- Sin persistir estado: se recalcula en cada consulta ("sin estado persistido" se mantiene).
- Sin EF para categorías sin duración estándar (sigue `null`); Rodaje sí se calcula.
- Sin migraciones EF ni tablas nuevas.

## Decisión 1 — Motor `DailyLoadModel` (puro)

`Features/Coaches/Players/Services/DailyLoadModel.cs`, estático, sin EF:

```csharp
public static class DailyLoadModel
{
    public record Parameters(
        double GainRate,          // k
        int GraceRestDays,        // días de descanso sin pérdida
        double DecayStepPerDay,   // pérdida del día n-ésimo tras la gracia = min(step·n, max)
        double DecayMaxPerDay);

    public record LoadEvent(
        string EventId, DateTime Date, int EventTypeId, IReadOnlyList<string> TrainingTypes,
        int MinutesPlayed, double TypeWeight, double Load);

    public record Step(
        DateTime Date, DateTime? EndDate, string Kind,        // "Activity" | "Decay"
        double Load, double ValueBefore, double ValueAfter, LoadEvent[] Events);

    public record Result(double Value, int CurrentRestStreakDays, Step[] Steps);

    public static Result Simulate(DateTime startDate, DateTime today, IReadOnlyList<LoadEvent> events, Parameters p);
}
```

Algoritmo (fechas en `Date` UTC, igual que hoy `DateTime.UtcNow.Date`):

```
v = 0; rest = 0
end = hay eventos hoy ? today : today − 1       // hoy solo cuenta si ya hubo actividad
para cada día d en [startDate, end]:
    L = Σ Load de los eventos de ese día
    si hay algún evento ese día (aunque L = 0):      // día activo
        rest = 0
        v = 100 − (100 − v) · e^(−k·L)
    si no:                                              // día de descanso
        rest += 1
        si rest > GraceRestDays:
            n = rest − GraceRestDays
            v = max(0, v − min(DecayStepPerDay·n, DecayMaxPerDay))
```

- **Saturación exponencial** (`e^(−k·L)`): el hueco hasta 100 se multiplica por `e^(−k·ΣL)` en
  una racha sin pérdidas, que solo depende de la carga total. Así se garantiza la monotonía que
  pedía el bug (106' vs 108'). Una fórmula lineal `v += k·L·(100−v)` NO la garantiza: el reparto
  entre partidos volvería a importar.
- **Día activo con carga 0** (entreno Técnico puro para EF): corta la racha de descanso (mantiene)
  pero no suma.
- **Hoy sin actividad todavía no es descanso**: un día no está terminado hasta que acaba (el
  entreno de la tarde aún no ha ocurrido). Si hoy no hay eventos pasados, la reproducción termina
  ayer: no suma a la racha ni resta valor.
- Se emite un `Step` "Activity" por día activo y un `Step` "Decay" por racha de descanso que haya
  perdido valor (de `Date` a `EndDate`). Las rachas dentro de la gracia no generan paso.
- `Value` sin redondear; el calculador redondea con `MidpointRounding.AwayFromZero` y clamp 0-100.

## Decisión 2 — Parámetros

| | Estado de forma | Rodaje |
|---|---|---|
| `GainRate` k | 0.16 | 0.10 |
| `GraceRestDays` | 4 | 21 |
| `DecayStepPerDay` | 0.5 | 0.25 |
| `DecayMaxPerDay` | 3 | 2 |
| Carga de entreno | peso de tipo: Físico 1.00 / Táctico 0.50 / Técnico 0.00 / sin tipo 1.00 (pesos actuales de EF) | Táctico 1.00 / Técnico 0.60 / Físico 0.30 / sin tipo 1.00 (pesos actuales de Rodaje) |
| Carga de partido | `1.5 × minutos / minutosCompletos` (Cadete 70), sin tope por partido, sin peso por tipo | `1.5 × minutos / 70 × MatchTypeWeighting` (Liga 1.00, Amistoso/Torneo 0.70) |
| Días reproducidos | 84 | 84 |

Un partido completo = 1.5 entrenos físicos: es el mayor estímulo de la semana.
Los pesos de tipo se reutilizan tal cual vía `TrainingTypeWeighting` (media de tipos presentes).

Comportamiento resultante (simulado, semana tipo: Físico + Táctico + partido de 70'):

| Tras | EF desde 0 | Rodaje desde 0* |
|---|---|---|
| 2 semanas | 62 | 43 |
| 4 semanas | 85 | 67 |
| 6 semanas | 94 | 81 |
| 8 semanas | 98 | 89 |

\* Rodaje con Liga.

| Días sin actividad desde 100 | EF | Rodaje |
|---|---|---|
| 4 | 100 | 100 |
| 5 | 99.5 | 100 |
| 7 | 97 | 100 |
| 14 | 77.5 | 100 |
| 21 | 56.5 | 100 |
| 28 | 35.5 | 93 |
| 42 | — | 65 |
| 56 | — | 37 |

Recuperar de 57 a 90 de EF cuesta ≈ 3 semanas normales.
Todos los valores son decisiones de producto ajustables en un solo sitio (constantes en cada
calculador). Los tests fijan el comportamiento, no solo los números.

## Decisión 3 — Qué cuenta como actividad

- **Entreno**: `FormStatusOutcome.Classify(...) == Attended` (Asistencia o Llegada tarde; la
  lesión nunca es asistencia). Sirve para EF y Rodaje.
- **Partido**: `MinutesPlayed > 0` en una participación `finished` de Liga/Amistoso/Torneo. Un
  convocado que no juega no tiene actividad ese día.
- **El motivo de la falta ya no importa para el valor**: decisión técnica, lesión o vacaciones
  son días sin carga. Es la consecuencia de la decisión 5 del usuario, y cambia el comportamiento
  anterior (antes la decisión técnica "no penalizaba"). Los motivos siguen apareciendo en
  `MissedEvents` para que el entrenador vea por qué hubo descanso.
- Eventos con fecha futura (> `DateTime.UtcNow`) no cuentan.

## Decisión 4 — Inicio de la reproducción

`startDate = today − 83 días` (84 días incluyendo hoy), con valor inicial 0, para todos los
jugadores. No se usa `JoinedDate`: es la fecha de alta en la app y puede ser posterior a actividad
real registrada; un jugador sin actividad previa ya parte de 0, así que el efecto es el mismo.
Los partidos del equipo anteriores a la incorporación sin participación del jugador se ignoran
(no son "faltas"). Con actividad normal, el arranque a 0 deja de notarse en ~6 semanas.

`null`:
- EF: categoría sin `MatchDurationMinutesByCategory`, o ningún evento de actividad en los 84 días.
- Rodaje: ningún evento de actividad en los 84 días.
Con actividad, el valor puede llegar a 0 pero no es `null`.

## Decisión 5 — Contrato API (BREAKING)

`FormStatusBreakdownDto`, `FormStatusConsideredTrainingDto`, `FormStatusConsideredMatchDto`,
`ReadinessBreakdownDto`, `ReadinessConsideredTrainingDto`, `ReadinessConsideredMatchDto` y
`RecentAbsenceDto` se eliminan. `PlayerStatisticsDto` pasa a:

```csharp
int? FormStatus, DailyLoadBreakdownDto? FormStatusBreakdown,   // null cuando FormStatus es null
int? Readiness,  DailyLoadBreakdownDto? ReadinessBreakdown,    // null cuando Readiness es null

public record DailyLoadBreakdownDto(
    double Value,                          // sin redondear
    DateTime ReplayStartDate,
    int ReplayDays,                        // 84
    double GainRate,
    int GraceRestDays,
    double DecayStepPerDay,
    double DecayMaxPerDay,
    double MatchLoadPerReferenceMatch,     // 1.5
    double ReferenceMatchMinutes,          // EF: minutos completos de la categoría; Rodaje: 70
    int CurrentRestStreakDays,             // días seguidos sin actividad hasta hoy
    int TrainingsAttended,
    int MatchesPlayed,
    int MatchMinutesPlayed,
    DailyLoadStepDto[] Steps,              // más reciente primero
    MissedEventDto[] MissedEvents);        // más reciente primero, máx. 10

public record DailyLoadStepDto(
    DateTime Date, DateTime? EndDate, string Kind,
    double Load, double ValueBefore, double ValueAfter,
    DailyLoadEventDto[] Events);

public record DailyLoadEventDto(
    string EventId, int EventTypeId, IReadOnlyList<string> TrainingTypes,
    int MinutesPlayed, double TypeWeight, double Load);

public record MissedEventDto(string EventId, DateTime Date, int EventTypeId, string Reason);
```

Implementación del motor: guarda el hueco hasta 100 (`gap *= e^(−kL)`, `gap += pérdida`) en vez
del valor, porque `100 − (100 − v)·e^(−kL)` se queda atascado en `100 − 1 ulp` en coma flotante
y un 99.5 exacto redondearía a 99.

`MissedEvents`: entrenos del equipo en la ventana sin asistencia y partidos sin minutos, con el
motivo de `FormStatusOutcome.ReasonFor` (o "Convocado sin jugar" / "No convocado").

## Decisión 6 — Handler `GetTeamPlayerStatistics`

- `windowStart` de entrenos pasa de 8 a 12 semanas (`DailyLoadModel` 84 días), y la ventana de
  partidos de EF/Rodaje también a 84 días. Sin queries nuevas: solo cambia el filtro de fecha.
- El Cansancio se sigue calculando igual, pero ya no se pasa a `PlayerFormStatusCalculator`.
- Nuevas firmas:

```csharp
PlayerFormStatusCalculator.Calculate(
    IReadOnlyList<TrainingInput> trainings, IReadOnlyList<MatchInput> matches,
    DateTime startDate, DateTime today, int categoryHalfMinutes)
PlayerReadinessCalculator.Calculate(
    IReadOnlyList<TrainingInput> trainings, IReadOnlyList<MatchInput> matches,
    DateTime startDate, DateTime today)

record TrainingInput(string EventId, DateTime Date, IReadOnlyList<string> TrainingTypes, ParticipationOutcome Outcome, string? Reason);
record MatchInput(string EventId, DateTime Date, int EventTypeId, int MinutesPlayed, string? Reason);
```

  Ambos devuelven `Result(int? Value, DailyLoadModel.Result? Model, int TrainingsAttended,
  int MatchesPlayed, int MatchMinutesPlayed, MissedEvent[] MissedEvents)`.
- `FormStatusRecency` se elimina. `FormStatusOutcome` se mantiene (clasifica la asistencia).

## Decisión 7 — Frontend (front-specialist)

- `teamPlayerStatisticsService.ts`: tipo `DailyLoadBreakdown` común; `formStatusBreakdown` y
  `readinessBreakdown` lo usan.
- `MetricBreakdown/FormStatusBreakdownView.tsx` y `ReadinessBreakdownView.tsx` se sustituyen
  por `DailyLoadBreakdownView.tsx`, que reutiliza `MetricBreakdown.module.css` (compartido por
  las vistas de desglose) y solo recibe el breakdown. Muestra:
  - Una cabecera con el valor, los días seguidos sin actividad y el aviso "Empieza a bajar
    en N días" o "Bajando desde hace N días".
  - La regla en una frase: "Cada entreno o partido suma; tras 4 días sin actividad empieza a
    bajar".
  - La lista de pasos como tarjetas, sin tablas: "12/09 · Físico + Táctico → +8 (70 → 78)", o
    "Descanso 15/09-20/09 → −4.5".
  - Las faltas con su motivo.
- `MetricInfoDialog`: textos de EF y Rodaje reescritos; se quita toda mención al multiplicador
  de Cansancio.
- `liveReadiness.ts`: la proyección en directo pasa a
  `100 − (100 − Value) · e^(−GainRate · 1.5 · minutosEnDirecto / ReferenceMatchMinutes)`.
  La simulación y el partido en directo no conocen el tipo de partido, así que se proyecta con
  peso 1.00 (Liga). En un amistoso sobreestima un poco hasta que se guarda el partido y el
  backend recalcula. Los tipos locales de `readinessBreakdown` (`SimulationPlayerSlot`,
  `useConvocationPlayerViews`, `IdealLineup`) pasan a esa misma proyección.
- CSS Modules y tema Coach; responsive a 360px.

## Qué reemplaza de los changes anteriores

| Anterior | Estado |
|---|---|
| `player-form-status-received-offered-load` Dec. 1-2 (ventana 42 d + recencia) | Reemplazada por Dec. 1-2 |
| Idem, cociente recibido/ofrecido y factor de volumen de entrenos | Reemplazado por saturación exponencial |
| Idem, multiplicador `1 − Cansancio/200` | **Eliminado** (decisión 4 del usuario) |
| Idem, decisión técnica excluida | Reemplazada por Dec. 3 (cuenta como descanso, se informa) |
| Fix `08757066` (suma de minutos) | Absorbido: la monotonía la garantiza la Dec. 1 |
| `player-readiness`: ventana 8 semanas, referencias 16/8×70, puntos por motivo, 70/30 | Reemplazado por Dec. 1-2 (se mantienen los pesos de tipo) |

## Riesgos

- **Valores más bajos al inicio de temporada**: con 2-3 semanas de actividad el EF ronda 60-70.
  Es coherente con una pretemporada, pero es un cambio visible para el entrenador.
- **Coste**: 84 días × jugadores × 2 métricas; trivial en memoria.
- **Parámetros**: son decisiones de producto. Se ajustan en un sitio y los tests de comportamiento
  (monotonía, gracia, meseta) siguen siendo válidos.
