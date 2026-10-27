## Why

Las pantallas «Estadísticas de rivales» y «Simulación» del Coach son listas planas de tarjetas con poca jerarquía: no hay
resumen de la liga y las barras de probabilidad usan verde/rojo, que sugiere «bien/mal» cuando solo son resultados.
El rediseño de referencia está en `.design/rival-stats` (escritorio y móvil).

## What Changes

- **Solo frontend (`Front/`)**, páginas `RivalStats` y `RivalSimulation` y sus componentes; sin cambios de API ni backend.
  - **Estadísticas**: panel de resumen con el número de equipos y de jugadores de la liga, junto a la última actualización y «Actualizar».
  - **Tarjetas de equipo y jugador**: cabecera con más jerarquía, escudo mayor y objetivos táctiles ≥ 44 px.
  - **Simulación**: barra de probabilidad local / empate / visitante en naranja, gris y azul (sin verde/rojo), porcentajes destacados, aciertos totales más visibles.
- Se mantiene: textos, nombres accesibles, carga perezosa de plantillas, pestañas Partidos/Clasificación, filtros.
- **Versión**: web minor (1.80.0 → 1.81.0).

## Capabilities

### New Capabilities
- `rival-stats-redesign`: resumen de liga en estadísticas y visualización de probabilidades sin semántica verde/rojo.

## Impact

- `Front/src/apps/coach/pages/rivalStats/RivalStats.tsx` + `.module.css`.
- `components/RivalTeamCard.module.css`, `components/RivalPlayerCard.module.css`.
- `simulation/RivalSimulation.module.css`, `simulation/components/MatchPredictionCard.module.css`, `ProjectedStandingCard.module.css`.
- Tests: `RivalStats.leagueSummary.test.tsx`.
- `Front/package.json` (versión).
- **Fuera de alcance**: backend, `PlayerSeasonStats`, estados de carga/error.
