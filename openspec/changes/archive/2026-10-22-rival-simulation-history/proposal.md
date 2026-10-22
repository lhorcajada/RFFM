## Why

La «Simulación» de rivales (`rival-match-simulation`) solo muestra la predicción actual: cuando se
juega una jornada, lo que se predijo para ella se pierde y no hay forma de saber si el modelo acierta.
El entrenador quiere ver, jornada a jornada, **lo que dijo la simulación y lo que pasó en realidad**,
incluidas las jornadas ya disputadas antes de tener la funcionalidad (la liga va por la 3ª jornada).

## What Changes

- **Simulación guardada por jornada** (tabla nueva `RffmRoundSimulations`, compartida por liga): para la
  jornada N se simula con los resultados de las jornadas anteriores a N, **como si no se supiera** lo
  que pasó de la N en adelante. Se guardan las predicciones de los partidos de la jornada N y la
  clasificación proyectada en ese momento.
- **Congelación al empezar la jornada**: mientras la jornada no ha empezado su simulación se recalcula
  con los datos nuevos; cuando su primer partido tiene resultado o llega su fecha, queda fija.
- **Jornadas pasadas sin simulación guardada** (las dos primeras de esta liga): se calculan a posteriori
  con solo los resultados anteriores y sin la implicación de los jugadores en la temporada actual
  (que ya incluye esas jornadas), y se guardan congeladas.
- **Acierto 1X2**: un partido se acierta si el resultado más probable (victoria local, empate o
  victoria visitante) coincide con el real.
- **Nuevos endpoints**: `PUT /api/teams/{teamId}/rival-stats/simulation/rounds` (actualiza y congela
  las simulaciones guardadas, idempotente) y `GET /api/teams/{teamId}/rival-stats/simulation/rounds`
  (historial con predicción, resultado real y acierto por partido, aciertos por jornada y totales, y la
  clasificación proyectada de cada jornada con el puesto real actual).
- **Página «Simulación»**:
  - «Partidos»: selector «Próximos partidos» / «Jornada N». En una jornada guardada, cada tarjeta
    muestra el resultado real y se colorea en **verde (acertado)** o **rojo (fallado)** con un
    distintivo; resumen de aciertos de la jornada y total.
  - «Clasificación»: selector «Actual» / «Antes de la jornada N», con el puesto real actual de cada
    equipo junto al proyectado.
- **Versiones**: API minor (`1.29.0`), Web minor (`1.58.0`). Mobile no cambia.

## Capabilities

### New Capabilities
- `rival-simulation-history`: simulaciones guardadas por jornada y su comparación con los resultados
  reales.

## Impact

- `Back/ExtractionApi`: entidad `RffmRoundSimulation` + configuración + migración (`FederationDbContext`);
  `Domain/Services/MatchSimulation/` (simulación «a fecha de» una jornada, estado de una jornada,
  resultado 1X2); `Features/Coaches/RivalStats/` (cargador de datos compartido, servicio de
  simulaciones por jornada, `SyncRivalSimulationRounds.cs`, `GetRivalSimulationHistory.cs`).
- `Front`: `rivalStatsService.ts`, `useRivalSimulation.ts`, `RivalSimulation.tsx`,
  `MatchPredictionCard.tsx`, `ProjectedStandingCard.tsx`.
- **Fuera de alcance**: acierto por marcador exacto; recalcular simulaciones congeladas si cambia el
  modelo; comparar con la clasificación final real (aún no existe); Mobile.
