## Why

La página «Plantilla» del entrenador (`/coach/squad`) tiene cinco pestañas (Plantilla, Valoraciones,
Estadísticas, Ranking, Alineación ideal) con estilos muy distintos entre sí, cromos de tamaño fijo, barras
de pestañas con scroll horizontal y barras de herramientas que se desbordan en móvil. El entrenador quiere
verlas con un diseño común, pensado primero para móvil y **sin scroll horizontal**.

Diseño de referencia: https://claude.ai/artifact/Nx7WoUzAHBe6HuYeJtbFbZ (tableros de escritorio y móvil de
las cinco pestañas).

## What Changes

- **Frontend (Coach, `Front/`)**, por etapas (cada una se puede entregar y commitear por separado):
  1. **Estructura común + pestaña Plantilla**: la barra de pestañas pasa a varias líneas en vez de hacer
     scroll horizontal; nueva franja de resumen (jugadores, por posición, lesionados), filtros por posición
     y buscador; nueva tarjeta `SquadPlayerCard` (avatar, dorsal, nombre, alias, lesionado, barras Ef/R/C,
     bloque «Solo liga»).
  2. **Valoraciones**: tarjetas con la media y cuatro barras, subvaloraciones desplegables en la propia
     tarjeta (sustituye al panel lateral deslizante), ordenación con chips.
  3. **Estadísticas**: barra de herramientas apilable en móvil, tarjetas con barras y rejilla de cifras.
  4. **Ranking**: podio de tres tarjetas, resto en filas, empates marcados y «Sin valorar».
  5. **Alineación ideal**: restyle de la pantalla (selector de sistema en chips, campo y banquillo a ancho
     completo en móvil). Sin tocar la lógica de arrastre.
- Se elimina todo scroll horizontal de la página y de las barras de herramientas.
- **Versión**: web minor por etapa entregada.

## Capabilities

### New Capabilities
- `squad-page-shell`: pestañas sin scroll horizontal y cabecera común.
- `squad-roster-tab`: resumen, filtros, buscador y tarjeta de jugador.
- `squad-ratings-tab`, `squad-statistics-tab`, `squad-ranking-tab`, `squad-ideal-lineup-tab`: nuevo
  aspecto de cada pestaña.

### Modified Capabilities
- `squad-league-stats`: el bloque «Solo liga» pasa de `PlayerCromo` a la nueva tarjeta (mismo contenido y
  reglas de visibilidad).

## Impact

- `Front/src/apps/coach/pages/squad/`: `Squad.tsx` + CSS, nuevos `SquadPlayerCard`, `SquadSummary`,
  `SquadFilters`; restyle de `SquadRatings`, `SquadStatistics`, `SquadRanking`, `IdealLineup`.
- `PlayerCromo` sigue existiendo para el resto de consumidores; pierde el bloque de liga (pasa a un
  componente compartido `LeagueStatsBlock`).
- `IdealLineup` también se usa en la pestaña de convocatoria: el restyle no debe cambiar su API ni su
  comportamiento (sus tests deben seguir en verde).
- Sin cambios de backend ni de API.
- **Fuera de alcance**: `Mobile/`, lógica de negocio de valoración/estadísticas, exportaciones PDF, diálogos
  de edición de valoración y la hoja de valoración (`rating-sheet`).
