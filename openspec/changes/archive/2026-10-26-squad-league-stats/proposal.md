## Why

La pestaña «Plantilla» muestra en cada cromo un resumen de temporada (minutos, goles, titularidades) que
sale de `GET /api/catalog/team/{teamId}/season-stats`, y ese endpoint suma **todos los partidos
terminados** (liga, amistosos y torneos). El entrenador quiere ver, por jugador, goles, convocatorias,
titularidades, tarjetas amarillas, rojas y minutos jugados **solo de partidos de liga**, y que quede claro
en pantalla que son datos de liga.

Diseño de referencia: https://claude.ai/artifact/Nx7WoUzAHBe6HuYeJtbFbZ (pestaña «Plantilla»).

## What Changes

- **Backend (`Back/ExtractionApi/`)**: nuevo endpoint `GET /api/catalog/team/{teamId}/league-stats` que
  devuelve, por jugador, goles, convocatorias, titularidades, amarillas, rojas y minutos, contando solo
  partidos de liga (`SportEventsConstants.MatchEventTypeId`). `season-stats` no cambia (lo siguen usando
  otros consumidores).
- **Frontend (Coach, `Front/`)**:
  - Servicio `getTeamLeagueStats` y carga no bloqueante en `Squad.tsx`.
  - `PlayerCromo` sustituye la fila de temporada (todos los partidos) por un bloque con la etiqueta
    «Solo liga» y las seis cifras.
  - Aviso sobre la lista: «Datos de liga. Goles, convocatorias, titularidades, tarjetas y minutos cuentan
    solo partidos de liga; no incluyen amistosos ni torneos».
  - Mismas reglas de visibilidad que hoy: el rol jugador/familia solo ve las cifras de su propio jugador;
    el aficionado no ve cifras.
- **Versiones**: API minor y web minor.

## Capabilities

### New Capabilities
- `squad-league-stats`: estadísticas de liga por jugador (endpoint y visualización en la plantilla).

### Modified Capabilities
- Ninguna (la fila de temporada del cromo queda sustituida; no hay spec previa de esa fila).

## Impact

- Nuevo `Back/.../Features/Coaches/Players/Queries/GetLeaguePlayerStats.cs` + tests.
- `Front/src/apps/coach/pages/squad/`: `Squad.tsx`, `components/PlayerCromo.tsx` (+ CSS Module),
  servicio nuevo, tests.
- **Fuera de alcance**: rediseño visual del resto de pestañas y de la cabecera (cambio
  `squad-tabs-redesign`), la app `Mobile/`, y cambiar `season-stats`.
