## Why

Bug real detectado con datos de producción: el "Cansancio" (`Fatigue`) de un jugador se queda
pegado al 100% durante cualquier semana de compromiso normal (2 entrenos + 1 partido completo),
incluso cuando el jugador ya ha tenido varios días de descanso desde su último entreno/partido.
Es el modelo introducido en `player-fatigue-derived-window`: `PlayerFatigueCalculator` suma
conteos/minutos planos dentro de una ventana fija de 7 días — basta con alcanzar la referencia
(2 entrenos, 70 minutos) en cualquier punto de la ventana para saturar el componente al 100%,
sin importar si el evento fue hace 1 día o hace 6. El modelo no distingue "recién exigido" de
"parcialmente recuperado", que es justo lo que `Fatigue` debería reflejar.

Caso real (jugador "Lucas", evaluado un miércoles): entrenó jueves (hace 6 días), descansó
viernes/sábado, jugó partido domingo (hace 3 días, 90 min), descansó lunes, entrenó martes (hace
1 día). Con el modelo de conteo plano: `TrainingComponent = 2/2×100 = 100`,
`MatchComponent = min(100, 90/70×100) = 100` → `Fatigue = 100`. Fisiológicamente incorrecto: el
jugador ya recuperó parcialmente.

## What Changes

- `PlayerFatigueCalculator.Calculate` deja de recibir conteos/minutos planos y pasa a recibir,
  por cada entreno asistido y cada participación de partido, sus días transcurridos desde hoy
  (`daysAgo`). Cada evento se pondera con un decaimiento exponencial de **semivida 2 días**:
  `decay(daysAgo) = 0.5^(daysAgo / 2)` — un evento de hoy pesa 1, hace 2 días pesa 0.5, hace 4
  días pesa 0.25, etc. `TrainingComponent`/`MatchComponent` se calculan sobre la suma ponderada
  (decayed) en vez de la suma plana.
- La ventana de carga de datos del handler (`PlayerFatigueCalculator.WindowDays`) se amplía de 7
  a 14 días — deja de ser un corte "todo o nada" y pasa a ser solo el límite de consulta a base
  de datos por rendimiento; el decaimiento hace el trabajo de ponderación real, y a los 14 días
  un evento ya pesa ~0.8% (despreciable).
- `GetTeamPlayerStatistics.cs` construye, por jugador, la lista de `daysAgo` de cada entreno
  asistido y de `(daysAgo, minutosJugados)` de cada participación de partido dentro de la nueva
  ventana de 14 días, reutilizando los datos ya cargados para Rodaje (superset de 8 semanas).
- Sin cambios de contrato: `Fatigue` sigue siendo `int` (0-100) no-nulo en el DTO
  `PlayerStatisticsDto` — el frontend no necesita cambios.

## Capabilities

### Modified Capabilities
- `player-fatigue`: el cálculo de Cansancio pasa de un conteo plano dentro de una ventana fija
  de 7 días a una suma ponderada por decaimiento exponencial de recencia (semivida 2 días) sobre
  una ventana de carga de 14 días.

## Impact

- Backend: modifica `Features/Coaches/Players/Services/PlayerFatigueCalculator.cs` (nueva firma
  de `Calculate`, constante `HalfLifeDays`, `WindowDays` pasa de 7 a 14 con significado
  distinto) y `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs` (construye listas de
  `daysAgo` por jugador en vez de conteos/sumas planos). Actualiza
  `tests/RFFM.Api.Tests/UnitTests/PlayerFatigueCalculatorTests.cs` y
  `GetTeamPlayerStatisticsHandlerTests.cs`.
- Frontend: sin cambios — el contrato `fatigue: number` no cambia de forma ni de nombre.
