## Why

La pestaña «Sesiones» de Entrenamientos muestra todas las sesiones del equipo en una sola lista plana,
ordenada de la más antigua a la más reciente. Con una temporada de planificación (macrociclos,
mesociclos y microciclos) la lista crece rápido y no refleja la estructura del plan: cuesta encontrar
las sesiones de la semana en curso y distinguir las que pertenecen al plan de las sueltas.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - `GET /api/trainings/sessions` acepta `seasonId` (opcional). Con él, devuelve:
    - las sesiones asignadas a un microciclo cuyo plan es de esa temporada;
    - las sesiones libres (sin microciclo) con fecha dentro del rango de la temporada;
    - las sesiones libres sin fecha («Sin programar»), siempre.
  - Sin `seasonId` el comportamiento no cambia (el tablero de contenido y la ficha del jugador lo
    siguen usando así).
  - `SessionListItem` añade el mesociclo y el macrociclo (id, nombre, orden) y las fechas del
    microciclo, para poder agrupar en el cliente.
  - **Versión**: API minor.
- **Frontend (Coach, `Front/`)**:
  - Selector de temporada encima de la lista; por defecto, la temporada activa.
  - Orden de la más reciente a la más antigua.
  - Agrupación colapsable: Macrociclo › Mesociclo › Microciclo, y un grupo final «Sesiones libres»
    (primero las sin fecha). Dentro de «Sesiones libres» se muestran 10 y un botón «Ver más».
  - Se mantienen la selección múltiple, el borrado masivo y las acciones de cada tarjeta.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `training-sessions-list-grouping`: listar las sesiones de una temporada agrupadas por el plan.

## Impact

- `Back/ExtractionApi`: `Features/Coaches/Trainings/Sessions/GetSessions.cs` y
  `tests/.../GetSessionsHandlerTests.cs`.
- `Front/`:
  - `trainingService.ts` y `types/training.ts`;
  - nueva lógica pura `pages/trainings/sessionsGrouping.ts`;
  - nuevo componente `pages/trainings/components/SessionsList.tsx` (+ `.module.css`);
  - `Trainings.tsx`.
- **Fuera de alcance**: búsqueda por texto, paginación en servidor y filtros por evento o por
  objetivo.
