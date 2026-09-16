## Context

- `player-fatigue-derived-window` (change previa, todavía no archivada en `openspec/changes/`)
  sustituyó el modelo persistido/incremental de `Fatigue` (que siempre convergía a 0) por
  `PlayerFatigueCalculator`: una función pura que suma **conteos planos** de entrenos asistidos
  y minutos de partido dentro de una **ventana fija de 7 días**, sin decaimiento por recencia.
  Este change corrige un bug real de ese modelo, detectado con datos de producción: el conteo
  plano hace que cualquier jugador con una semana de compromiso normal (2 entrenos + 1 partido
  completo) sature `Fatigue` a 100%, sin importar si esos eventos ocurrieron hoy o hace 6 días.
- `GetTeamPlayerStatistics.cs` ya calcula, para Rodaje, un conjunto de convocatorias/
  participaciones en una ventana de 8 semanas (`trainingConvocationsInWindow`,
  `participationsInWindow`) que es un superset estricto de cualquier ventana de Cansancio
  razonable (7 o 14 días) — la ventana de Cansancio se deriva en memoria de esos datos, sin
  queries nuevas a base de datos.

### Caso real que expone el bug (jugador "Lucas", evaluado un miércoles)

Entrenó jueves (hace 6 días), descansó viernes/sábado, jugó partido domingo (hace 3 días, 90
min), descansó lunes, entrenó martes (hace 1 día), hoy (miércoles) aún no ha entrenado.

Con el modelo de conteo plano (ventana de 7 días, sin decaimiento):
```
TrainingComponent = min(100, 2 entrenos / 2 referencia × 100) = 100
MatchComponent    = min(100, 90 min / 70 min × 100)           = 100
Fatigue           = round(0.40×100 + 0.60×100)                = 100
```
Pegado al máximo, aunque el jugador ya tuvo 2 días de descanso desde el partido y 1 desde el
último entreno — fisiológicamente incorrecto.

## Goals / Non-Goals

**Goals:**
- Sustituir el conteo plano por un decaimiento exponencial por recencia: cada entreno/partido
  pesa menos cuantos más días hayan pasado desde que ocurrió.
- Garantizar que un jugador con varios días de descanso recientes muestre un `Fatigue` más bajo
  que uno recién exigido, incluso con la misma carga total en la ventana.
- Mantener el contrato del DTO (`Fatigue: int`, 0-100, no-nulo) sin cambios — sin impacto en
  frontend.

**Non-Goals:**
- No se cambia el peso relativo entreno/partido (40/60, ver `player-fatigue-derived-window` →
  Decisión 2) ni las referencias (2 entrenos, 70 minutos).
- No se toca `PlayerReadinessCalculator`/Rodaje.
- No hay backfill histórico — `Fatigue` sigue siendo siempre calculado en caliente.

## Decisions

### Decisión 1 — Decaimiento exponencial con semivida de 2 días

Parámetro confirmado con el usuario: **semivida de 2 días** — el peso de un evento se reduce a
la mitad cada 2 días transcurridos.

```csharp
public const double HalfLifeDays = 2.0;
private static double Decay(int daysAgo) => Math.Pow(0.5, daysAgo / HalfLifeDays);
```

`PlayerFatigueCalculator.Calculate` pasa de recibir conteos/sumas planas a recibir listas de
eventos con su antigüedad en días:

```csharp
public static Result Calculate(
    IReadOnlyList<int> trainingDaysAgo,
    IReadOnlyList<(int DaysAgo, int MinutesPlayed)> matches)
{
    var decayedTrainingCount = trainingDaysAgo.Sum(Decay);
    var decayedMatchMinutes = matches.Sum(m => m.MinutesPlayed * Decay(m.DaysAgo));

    var trainingComponent = Math.Min(100d, decayedTrainingCount / ReferenceTrainingsPerWindow * 100d);
    var matchComponent = Math.Min(100d, decayedMatchMinutes / ReferenceMatchMinutes * 100d);

    var fatigue = (int)Math.Round(TrainingWeight * trainingComponent + MatchWeight * matchComponent);
    return new Result(fatigue, trainingComponent, matchComponent, decayedTrainingCount, decayedMatchMinutes);
}
```

`ReferenceTrainingsPerWindow` (2) y `ReferenceMatchMinutes` (70) se mantienen sin cambios — ahora
representan la suma *decayed* equivalente a "2 entrenos de hoy" / "70 minutos de un partido de
hoy", no un conteo bruto dentro de una ventana fija.

**Recalculo del caso de Lucas con decaimiento:**

```
decay(6 días, jueves)  = 0.5^(6/2) = 0.5^3     = 0.125
decay(1 día, martes)   = 0.5^(1/2) = 0.5^0.5   ≈ 0.7071
decayedTrainingCount   = 0.125 + 0.7071        ≈ 0.8321
TrainingComponent      = min(100, 0.8321/2×100) ≈ 41.6

decay(3 días, domingo) = 0.5^(3/2) = 0.5^1.5   ≈ 0.3536
decayedMatchMinutes    = 90 × 0.3536           ≈ 31.82
MatchComponent         = min(100, 31.82/70×100) ≈ 45.46

Fatigue = round(0.40×41.6 + 0.60×45.46) = round(16.64 + 27.28) = round(43.92) = 44
```

`Fatigue ≈ 44%` — mucho más realista que el 100% anterior, y refleja la recuperación parcial del
jugador.

### Decisión 2 — Ventana de carga ampliada a 14 días (no es una ventana de saturación)

El decaimiento hace que eventos antiguos pesen casi 0 por sí solo, pero sigue haciendo falta un
corte de consulta a base de datos por rendimiento. `PlayerFatigueCalculator.WindowDays` pasa de
7 a **14** días — a los 14 días un evento pesa `0.5^7 ≈ 0.0078` (0.8%), ya despreciable, así que
ampliar la ventana le da margen real al decaimiento en vez de cortar en seco a los 7 días como
antes (que era, en la práctica, la causa raíz del bug: un evento de hace 6 días contaba exactamente
igual que uno de hoy, siempre que cayera dentro de los 7 días).

El comentario en el código documenta explícitamente que `WindowDays` cambia de significado: ya
no es "todo o nada dentro de este rango", es solo el límite de carga de datos.

### Decisión 3 — El handler construye `daysAgo` en vez de conteos, reutilizando los datos de Rodaje

`GetTeamPlayerStatistics.Handler` ya tiene, para Rodaje, `trainingConvocationsInWindow`
(ventana de 8 semanas) y `participationsInWindow`, junto con diccionarios `eventId → fecha`
(`trainingEventDateById`, `matchEventDateById`). En vez de contar/summar directamente, el
handler ahora filtra por `date >= fatigueWindowStart` (14 días) y proyecta cada evento a
`daysAgo = (int)(DateTime.UtcNow.Date - eventDate.Date).TotalDays`, agrupando por jugador en
`List<int>` (entrenos) y `List<(int DaysAgo, int MinutesPlayed)>` (partidos). No se añaden
queries nuevas a base de datos — mismo patrón de reutilización que la versión anterior.

### Decisión 4 — Sin caso especial para entreno + partido el mismo día

Confirmado con un test explícito (`SameDayTrainingAndMatch_BothContributeIndependently`): un
entreno y un partido el mismo día siguen sumando de forma independiente a su propio componente
(`decay(0) = 1` para ambos) — no hace falta ningún caso especial de deduplicación, igual que en
el modelo anterior a este fix (ver `player-fatigue-derived-window` → Decisión 3, que ya
confirmó esto para el modelo de suma; sigue siendo cierto con decaimiento porque el decaimiento
se aplica por evento, no de forma compartida).

## Risks / Trade-offs

- [Risk] La semivida de 2 días es un parámetro de producto, no derivado matemáticamente de datos
  fisiológicos reales. → Mitigación: confirmado explícitamente por el usuario antes de
  implementar, usando el caso real de Lucas como validación; `HalfLifeDays` es una constante
  nombrada, trivial de retunear si producto lo pide.
- [Risk] Un jugador que entrena/juega exactamente en el límite de referencia pero todo "hoy"
  sigue pudiendo llegar a 100% (comportamiento esperado, no un bug: recién exigido = cansado).
- [Risk] Ampliar la ventana de carga de 7 a 14 días duplica aproximadamente el volumen de filas
  en memoria para el sub-cálculo de Cansancio. → Mitigación: sigue siendo un subconjunto de los
  datos de 8 semanas ya cargados para Rodaje, sin queries nuevas; el coste real es despreciable.

## Migration Plan

1. TDD: reescribir `PlayerFatigueCalculatorTests.cs` (Red) con casos de decaimiento — evento hoy
   vs. varios días atrás, el caso exacto de Lucas (≈44%, no 100%), ausencia total de eventos
   (0%), evento fuera de la ventana ampliada.
2. Implementar la nueva firma de `PlayerFatigueCalculator.Calculate` (Green).
3. Actualizar `GetTeamPlayerStatistics.cs`: construir listas de `daysAgo` por jugador en vez de
   conteos/sumas planos, ampliar `fatigueWindowStart` a 14 días vía la constante ya renombrada.
4. Actualizar `GetTeamPlayerStatisticsHandlerTests.cs`: reescribir los tests de `Fatigue` para
   reflejar decaimiento en vez de conteo plano.
5. `dotnet build` + `dotnet test` (área `RFFM.Api.Tests`) en verde.
6. No commitear/pushear — dejar los cambios en el working tree para revisión del usuario.

## Open Questions

Ninguna — la semivida de 2 días y el recálculo del caso de Lucas fueron confirmados
explícitamente por el usuario antes de implementar.
