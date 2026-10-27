## Why

La pantalla «Ajustes» del Coach usa en móvil una barra de pestañas con scroll horizontal, y sus listas (temporadas, clubes, equipos) son tablas, prohibidas por las reglas de UI. El rediseño de referencia está en `.design/coach-settings` (escritorio y móvil, tema de desarrollo y de producción).

## What Changes

- **Solo frontend (`Front/`)**, página `Settings` y sus secciones; sin cambios de API ni backend.
  - **Navegación**: en móvil (≤600px) el menú se oculta tras un selector («Sección · Temporadas»); en escritorio, botones con icono y `aria-current`.
  - **Listas sin tablas**: temporadas, clubes y equipos se muestran siempre como tarjetas (rejilla en escritorio). Temporadas separa «Temporada activa» (tarjeta destacada) de «Anteriores»; el club preferido sale destacado.
  - **Formularios**: crear/editar temporada y crear club pasan a un panel lateral (pantalla completa en móvil) con título y botón de cierre.
  - **Notificaciones**: tarjeta destacada con el interruptor push y notas para los estados no soportados.
  - **Colores**: solo variables del tema (`--rffm-dash-*`, `color-mix`), de modo que sirve en el tema naranja de desarrollo y el cian de producción.
  - **Crear y editar equipo** (`/coach/clubs/:id/teams/new` y `/:teamId/edit`): formulario en tarjetas «Datos del equipo» y «Competición RFFM» (esta con su botón de guardado propio), foto con vista previa y barra inferior Cancelar / Guardar.
- Se mantiene: secciones, orden, visibilidad por rol, sección inicial por `location.state`, textos, acciones (eliminar, preferido, copiar/generar código, editar equipo).
- **Versión**: web minor (1.82.0 → 1.83.0).

## Capabilities

### New Capabilities
- `coach-settings-redesign`: navegación sin scroll horizontal, listas en tarjetas y formularios en panel lateral.

## Impact

- `settings/Settings.tsx` + `.module.css`; `components/shared/SettingsRowCard`, nuevo `components/shared/SettingsDrawer`.
- `Seasons/SeasonManager`, `Seasons/SeasonEditorForm`, `ClubSelector`, `MyTeams/TeamManager`, `NotificationSettings`.
- Tests: `Settings.nav.test.tsx` y los de `SeasonManager`, `ClubSelector`, `TeamManager`.
- `Front/package.json` (versión).
- `clubTeams/edit/EditTeam.tsx`, `clubTeams/create/CreateTeam.tsx`, nuevo `clubTeams/TeamForm.module.css`.
- **Fuera de alcance**: backend, la lógica de los selectores compartidos (`CategorySelect`, `LeagueSelect`, `Rffm*Select`), el diálogo anidado de crear club dentro del formulario de temporada.
