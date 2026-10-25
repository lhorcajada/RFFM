## Why

El panel del equipo (`/coach/team-dashboard`) mezcla la información del día a día (próximos eventos,
noticias) con una rejilla de hasta 17 tarjetas de acceso, y fuera del panel no hay forma de saltar de
una sección del equipo a otra: el menú inferior de Coach solo ofrece «Inicio» (panel general) y
«Configuración». El usuario ha elegido, entre tres alternativas diseñadas, la **opción A**: una barra
de navegación del equipo (inferior en móvil, columna lateral en escritorio) y una página «Menú» con
todas las secciones.

## What Changes

Solo **Frontend (`Front/`, app Coach)**; el backend no cambia.

- **Barra de navegación del equipo** (`CoachTeamNav`) con 5 pestañas con icono y texto:
  - Entrenador: Inicio, Calendario, Eventos, Entrenamientos, Menú.
  - Jugador / Familia: Inicio, Resultados, Clasificación, Eventos, Menú.
  - Cada pestaña intermedia se oculta si el usuario no tiene el permiso de la funcionalidad.
  - Se muestra en las páginas del equipo (panel del equipo, Menú y las secciones que enlaza el Menú)
    y sustituye allí al menú inferior actual. En pantallas ≥ 1200 px pasa a columna lateral izquierda.
  - Conserva el equipo en contexto (`teamId`) entre páginas, también en las que no lo llevan en la URL.
- **Página Menú** (`/coach/menu`): todas las secciones agrupadas (Equipo, Actividad, Competición,
  Disciplina, Otros, Cuenta) como lista de filas, con buscador y las mismas reglas de rol y permiso
  que hoy aplican las tarjetas.
- **Panel del equipo**: deja de mostrar la rejilla de tarjetas; conserva la acción de cabecera, el aviso
  de notificaciones y los widgets de eventos y noticias.
- La definición de secciones se extrae a un módulo único (`teamSections.ts`) que usan el Menú y la barra.
- **Versión**: web minor (`Front/package.json` 1.61.0 → 1.62.0).

## Capabilities

### New Capabilities
- `coach-team-navigation`: barra de navegación del equipo y página Menú.

### Modified Capabilities
- `coach-dashboard-widgets`: el panel del equipo ya no tiene tarjetas de acceso bajo los widgets.
- `coach-dashboard-permission-ui`: el filtrado por permisos se aplica a las entradas del Menú en lugar
  de a `TeamDashboardCards`.

## Impact

- `Front/src/apps/coach/navigation/` (nuevo: secciones, pestañas, contexto de equipo, `CoachTeamNav`).
- `Front/src/apps/coach/pages/team-menu/` (nuevo) y `routes.tsx` (ruta lazy `menu`).
- `Front/src/apps/coach/pages/team-dashboard/` (se eliminan `TeamDashboardCards`, `LauncherTile`,
  `tileIllustrations` y sus tests; los casos de rol/permiso pasan a los tests de `teamSections`).
- `Front/src/shared/components/ui/BaseLayout/` y `Footer/` (hueco para la barra / columna).
- `Front/src/apps/coach/muiCoachTheme.ts` (tokens `--rffm-team-nav-*`).
- **Fuera de alcance**: el rediseño visual FC26 del panel del equipo (hero, próximo partido), la
  cabecera global (`AppHeader`, que ya tiene la campana de notificaciones), una tipografía nueva,
  el app Mobile y el backend.
