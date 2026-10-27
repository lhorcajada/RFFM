## Why

La pantalla «Gestión de usuarios» del Coach (`/coach/team-users?teamId`) lista a los usuarios del equipo en tarjetas MUI sin jerarquía: no hay forma de ver de un vistazo cuántos están pendientes de aprobación ni de filtrarlos. El rediseño de referencia está en `.design/team-users` (escritorio y móvil).

## What Changes

- **Solo frontend (`Front/`)**, página `TeamUsers`; sin cambios de API ni backend.
  - **Cabecera**: contadores «Usuarios» y «Pendientes».
  - **Filtros**: «Todos», «Pendientes» y «Aprobados», con su número y `aria-pressed`.
  - **Tarjetas**: avatar con la inicial, alias, email, rol (neutro; «Creador» destacado), estado de aprobación con icono, jugador vinculado, fecha de alta y acción Aprobar/Desaprobar; las pendientes llevan el borde destacado.
  - **Estado vacío del filtro**: mensaje cuando el filtro no devuelve usuarios.
  - **Colores**: solo variables del tema (`--rffm-dash-*`, `color-mix`).
- Se mantiene: endpoints, reglas de eliminar/aprobar (`canDelete`, `canToggleApproval`), diálogo de confirmación, snackbar, textos y roles traducidos.
- **Versión**: web minor (1.83.0 → 1.84.0).

## Capabilities

### New Capabilities
- `team-users-redesign`: contadores, filtros por aprobación y tarjetas de usuario del equipo.

## Impact

- `team-users/TeamUsers.tsx` + `TeamUsers.module.css`, tests en `team-users/__tests__/TeamUsers.test.tsx`.
- `Front/package.json` (versión).
- **Fuera de alcance**: backend, `teamUsersService`, reglas de permisos.
