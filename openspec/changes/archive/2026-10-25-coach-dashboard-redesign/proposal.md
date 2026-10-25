## Why

El panel de inicio de la app Coach (`/coach/dashboard`) es hoy una cabecera genérica con el equipo
como título, un banner de notificaciones y una rejilla plana de tarjetas. No destaca el equipo
preferido (el que el entrenador abre casi siempre), no saluda al usuario y en móvil la rejilla de
tarjetas de dos columnas es poco legible. El usuario ha aprobado un diseño visual nuevo (escritorio
1440, tablet 834, móvil 390) que reorganiza la pantalla sin pedir datos nuevos al backend.

## What Changes

Solo **Frontend (`Front/`, app Coach)**; el backend no cambia.

- Cabecera de página: eyebrow «PANEL DE CONTROL» + «Hola, {nombre}» (nombre del usuario logueado,
  con alternativa «Panel de control»), y el botón «Volver al inicio» a la derecha en escritorio/tablet.
- Bloque hero «EQUIPO PREFERIDO» con foto/escudo, nombre, club, categoría y CTA «Abrir panel» →
  `/coach/team-dashboard?teamId=<id>`. Sin equipo preferido el hero no se muestra.
- Aviso de notificaciones con tres presentaciones: tarjeta lateral (escritorio), franja (tablet) y
  fila compacta pulsable (móvil). Misma lógica `shouldPrompt` y misma navegación. En
  `/coach/team-dashboard` el banner actual no cambia.
- «Acceso rápido» con contador de equipos: rejilla de 5 columnas (escritorio) / 3 (tablet); en móvil,
  lista vertical de filas y los botones «Configuración» e «Inicio» al final.
- Se mantiene intacta la lógica de roles y permisos (`isPlayer`, `usePlayerAutoLoad`,
  `hasFeatureAccess(COACH_FEATURE_ROUTES.Settings)`), el Snackbar y `useAuditPageAccess`.
- `useTeamAndClub` expone además las URLs de imagen del equipo y del escudo (cambio aditivo).
- Tokens de color nuevos `--rffm-dash-*` en `muiCoachTheme.ts`.
- **Versión**: web minor (`Front/package.json` 1.60.0 → 1.61.0).

## Capabilities

### New Capabilities
- `coach-home-dashboard-layout`: estructura y comportamiento responsive del panel de inicio Coach.

### Modified Capabilities
- `coach-push-activation-banner`: el aviso del panel de inicio adopta presentaciones por tamaño de
  pantalla con un texto adaptado; el de `/coach/team-dashboard` conserva el texto actual.

## Impact

- `Front/src/apps/coach/pages/Dashboard/` (página, componentes nuevos, hooks, CSS Modules, tests).
- `Front/src/apps/coach/components/PushActivationBanner/` (prop `variant`, por defecto el actual).
- `Front/src/apps/coach/hooks/useTeamAndClub.tsx` (campos nuevos en el retorno, sin romper consumidores).
- `Front/src/apps/coach/muiCoachTheme.ts` (tokens).
- **Fuera de alcance**: cabecera global de la app (AppHeader), datos nuevos de backend, tema Federación.
