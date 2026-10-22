## Why

En «Estadísticas de rivales» el entrenador ve la ficha de cada jugador de la liga (temporada actual
y anterior), y en «Resultados» ve lo que ya se ha jugado. Pero nada le dice **qué es previsible que
pase** en lo que queda de temporada: cómo de difícil es el próximo rival o dónde es probable que
termine su equipo.

Con los datos que ya guardamos —resultados de las jornadas disputadas y, por jugador, el puesto en
que quedó su equipo la temporada pasada, sus goles, convocatorias y titularidades— se puede estimar
la fuerza de cada equipo y simular el resto del calendario.

## What Changes

- **Nuevo endpoint** `GET /api/teams/{teamId}/rival-stats/simulation` con dos salidas:
  - **Partidos pendientes**: probabilidad de victoria local, empate y victoria visitante, goles
    esperados y marcador más probable de cada partido.
  - **Clasificación proyectada**: puntos esperados, puesto más probable y probabilidad de terminar
    en cada puesto, tras simular el resto del calendario 10.000 veces (Monte Carlo).
- **Modelo**: Poisson con ataque y defensa por equipo. Al principio pesa la **fuerza de la plantilla**
  (temporada pasada de sus jugadores; los jugadores nuevos cuentan como la media de la liga) y, según
  avanzan las jornadas, pesan cada vez más los **resultados reales**.
- Si las estadísticas de rivales no se han generado, se simula **solo con los resultados** y se
  indica en la respuesta y en la pantalla.
- **Nueva página «Simulación»** (`/coach/rival-stats/simulation`) con pestañas «Partidos» y
  «Clasificación», en tarjetas; se abre desde un botón en «Estadísticas de rivales».
- **Versiones**: API minor (`1.28.0`), Web minor (`1.57.0`). Mobile no cambia.

## Capabilities

### New Capabilities
- `rival-match-simulation`: estimación de resultados de los partidos pendientes y de la
  clasificación final de la liga del equipo.

## Impact

- `Back/ExtractionApi`: `Domain/Services/MatchSimulation/` (modelo puro y testeable) y
  `Features/Coaches/RivalStats/GetRivalSimulation.cs`. Sin migración: solo lee `RffmRound`/`RffmMatch`,
  `RffmCompetitionGroup`, `LeagueSquadStatsReport` y `RffmPlayerSeasonStats`.
- `Front`: `pages/rivalStats/simulation/` (página, hook y tarjetas), `rivalStatsService.ts`,
  `RivalStats.tsx` (botón) y `routes.tsx`.
- **Fuera de alcance**: ajustar por la categoría de procedencia de un jugador; zonas de
  ascenso/descenso; guardar simulaciones; backtesting en pantalla; Mobile.
