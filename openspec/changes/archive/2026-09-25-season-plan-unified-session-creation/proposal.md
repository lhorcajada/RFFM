## Why

En `/coach/trainings` (pestaña Planificación) conviven dos botones que parecen hacer lo mismo:
"Planificar contenido" (abre el tablero de contenido, `ContentBoardPage`) y "Editar
planificación" (edita la estructura macro/meso/microciclos). Además, el "Crear sesión" de cada
microciclo salta directamente al editor de sesión (`NewSessionPage`) y se salta el paso de
decidir **qué** se trabaja según el Modelo de Juego. El entrenador no tiene un flujo claro:
estructura → contenido → detalle.

## What Changes

- Se elimina el botón "Planificar contenido" de la barra de acciones de la pestaña
  Planificación. La barra solo contiene acciones sobre la estructura (Nueva/Editar/Eliminar
  planificación).
- "Crear sesión" de un microciclo navega al tablero de contenido con ese microciclo como
  contexto (`/coach/trainings/content-board?clubId&teamId&microcicloId`).
- Con microciclo en contexto, el tablero:
  - muestra en la cabecera la semana (`weekLabel`) y sus fechas;
  - lista solo las sesiones de ese microciclo en el panel derecho;
  - crea las sesiones nuevas asignadas a ese microciclo (`microcicloId`), sin fecha;
  - ofrece "Ver todas las sesiones" para quitar el filtro.
- Si el equipo no tiene Modelo de Juego y hay microciclo en contexto, el estado vacío del tablero
  ofrece "Crear sesión sin contenido", que abre el editor de sesión con el `microcicloId`
  (el flujo actual).
- El tablero completo (sin filtro) sigue accesible desde la pestaña Sesiones con un botón
  "Tablero de contenido".
- "Nueva sesión" de la pestaña Sesiones no cambia (creación directa).

## Non-goals

- No se cambia el backend: `CreateSession` ya acepta `MicrocicloId` con `Date` nula y
  `GetSessions` ya devuelve `MicrocicloId`.
- No se mueven sesiones existentes entre microciclos desde el tablero.
- No se modifica `SeasonPlanEditor` ni el editor de sesión.

## Capabilities

### Modified Capabilities
- `season-plan-content-board`: el tablero acepta un microciclo como contexto (filtro, creación
  asignada y alternativa sin Modelo de Juego) y pasa a ser el destino de "Crear sesión" del plan.

## Impact

- Frontend (`front-specialist`) únicamente:
  `Front/src/apps/coach/pages/trainings/Trainings.tsx`,
  `Front/src/apps/coach/pages/trainings/season-plan/ContentBoardPage.tsx`,
  `Front/src/apps/coach/pages/trainings/season-plan/components/SessionBoardPanel.tsx` y sus tests.
- Backend (`Back/ExtractionApi`): sin cambios.
