## Why

El Estado de forma actual (cociente recibido/ofrecido con recencia en 6 semanas) produce
resultados que el entrenador no puede explicar: con el mismo número de entrenos y partidos, un
jugador con 110' puede tener el mismo EF que otro con 106', y uno con 108' menos EF que uno con
106', porque cada partido pesa según su antigüedad. Además el Cansancio multiplica el EF, así que
dos métricas que el entrenador lee por separado se contaminan. El Rodaje, por su parte, cae de
golpe cuando un evento sale de la ventana de 8 semanas, en vez de estancarse y bajar despacio.

El usuario ha definido el comportamiento esperado como una "rueda" diaria:

- Entrenar o jugar (según minutos) sube el EF y el Rodaje, y sube el Cansancio.
- Hasta 4 días seguidos sin actividad, el EF se mantiene; desde el 5º día baja, y cada día más.
- El Rodaje se mantiene 3 semanas sin actividad y después baja despacio.
- El Cansancio baja con el descanso (ya funciona así, no cambia).

## What Changes

- **Estado de forma** pasa a un modelo de carga diaria: se reproduce día a día (12 semanas) un
  valor 0-100 que sube con cada actividad con saturación exponencial (más minutos ⇒ nunca menos
  EF) y baja tras 4 días de descanso con pérdida creciente (tope 3 puntos/día).
  **Deja de multiplicarse por el Cansancio.** Las vacaciones del equipo cuentan como descanso.
- **Rodaje** pasa al mismo modelo con otros parámetros (ganancia más lenta, 21 días de gracia,
  pérdida máx. 2 puntos/día) y conserva sus pesos por tipo de entreno y de partido.
- **BREAKING (contrato API)**: `FormStatusBreakdownDto` y `ReadinessBreakdownDto` se sustituyen por
  un `DailyLoadBreakdownDto` común con la evolución paso a paso.
- Frontend (front-specialist): nuevo desglose común para EF y Rodaje, textos del popup y
  proyección de Rodaje en directo (`liveReadiness.ts`).

## Capabilities

### Modified Capabilities
- `player-form-status`: modelo de carga diaria, sin multiplicador de Cansancio.
- `player-readiness`: modelo de carga diaria con meseta de 21 días.

## Impact

- Backend: nuevo `DailyLoadModel` (puro) en `Features/Coaches/Players/Services/`;
  `PlayerFormStatusCalculator` y `PlayerReadinessCalculator` reescritos sobre él; se elimina
  `FormStatusRecency`; `GetTeamPlayerStatistics` amplía la carga de entrenos a 12 semanas y
  mapea el DTO nuevo. Sin migraciones.
- `PlayerFatigueCalculator` sin cambios.
- Frontend: `teamPlayerStatisticsService.ts`, `MetricBreakdown/*`, `MetricInfoDialog`,
  `liveReadiness.ts` y sus tests.
