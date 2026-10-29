## Context

`pages/team-dashboard/TeamDashboard.tsx` es la referencia: `ContentLayout` con título/subtítulo y `actionBar` de botones-icono, y `widgetsGrid` de dos columnas (`3fr/2fr` desde 769px) con `QuickActions` (rejilla de 3 columnas) en la columna lateral. El panel del club actual (`pages/clubs/dashboard/Dashboard.tsx`) tiene un rediseño sin commitear estilo «home» que se sustituye.

## Decisions

### D1 — Estructura
`Dashboard.tsx` queda como orquestador (como `TeamDashboard`): `BaseLayout hideFooterMenu` › `ContentLayout` (`title` = `ClubHeader`, `subtitle` = «Panel del club», `actionBar` = botón-icono «Volver») › `div.pageContent` › `div.widgetsGrid` con `mainColumn` (`ClubTeamsWidget`) y `sideColumn` (`ClubQuickActions`, `ClubPendingWidget`). Cada widget envuelto en `ErrorBoundary`.

### D2 — Estilos
CSS Modules propios en `pages/clubs/dashboard/` (`Dashboard.module.css`, `components/*.module.css`) copiando los valores de `TeamDashboard.module.css` y `QuickActions.module.css` (mismas variables `--rffm-card-bg`, `--rffm-primary`, `--rffm-dash-*`). No se importan los CSS de `team-dashboard` para no acoplar los dos paneles. Sin tablas; sin `style={{}}`.

### D3 — Componentes (`pages/clubs/dashboard/components/`)
- `ClubQuickActions`: props `clubId`, `seasonId?`, `pendingRequests?`. Define las acciones en una constante (clave, etiqueta, ruta, icono MUI, requiere `ClubTeams`). Usa `usePermissions().hasFeatureAccess(COACH_FEATURE_ROUTES.ClubTeams)` para ocultar Equipos y Nuevo equipo.
- `ClubTeamsWidget`: props `clubId`, `seasonId?`. Carga con `teamService.getTeams(clubId, seasonId)`; estados cargando/vacío/error propios; fila = `Link` a `/coach/team-dashboard?teamId=…` con nombre y `category.name`; cabecera con «Ver todos» → `/coach/clubs/{id}/teams`.
- `ClubPendingWidget`: props `clubId`. Carga `clubJoinRequestsApi.getPendingCount(clubId)`; 0 → «Nada pendiente»; >0 → fila con contador y enlace a `/club-join-requests?clubId=`. Un fallo de carga se trata como «Nada pendiente» sin romper la página.

### D4 — Datos y rutas
- Sin backend nuevo. El contador de solicitudes se consulta una vez en `ClubPendingWidget`; el mismo número alimenta el badge de la acción «Solicitudes de acceso» a través de un hook `useClubPendingRequests(clubId)` compartido por ambos componentes (una sola petición, estado elevado en `Dashboard.tsx`).
- «Personal» apunta a `/scope/members?scope=club&id={id}` (la ruta `clubs/:id/staff` del panel actual no existe en `routes.tsx`).
- `seasonId` se propaga solo a teams, players y registrations, como hoy.

### D5 — Limpieza
Se revierte la extensión `eyebrow`/`title` de `DashboardHeader` (y su test `DashboardHeader.customTitle.test.tsx`), que solo servía al intento anterior; `DashboardHeader` vuelve a su forma original.

### Riesgos
- El mapeo de «Personal» a `scope/members` debe verificarse manualmente con un usuario con permisos de club.
- `teamService.getTeams` con `seasonId` ausente devuelve la temporada por defecto del backend; es el comportamiento actual de `ClubTeams`.
