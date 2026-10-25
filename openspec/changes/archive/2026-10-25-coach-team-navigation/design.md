## Context

- Todas las páginas Coach usan `BaseLayout hideFooterMenu`. En rutas `/coach/*`, `Footer` ignora
  `hideMenu` y pinta temporada + copyright + `BottomMenu` con «Inicio» (`/coach/dashboard`) y
  «Configuración» (solo rol `Coach`).
- `TeamDashboard.tsx` pinta `PushActivationBanner`, los widgets `UpcomingEventsWidget` y `NewsWidget` y la
  rejilla `TeamDashboardCards` (5 grupos, `LauncherTile` + `tileIllustrations`). Las reglas de visibilidad
  usan `isPlayer` (de `usePlayerAutoLoad`) y `usePermissions().hasFeatureAccess(COACH_FEATURE_ROUTES.*)`.
- El equipo en contexto viaja como `?teamId=` en la URL. Si no está, `useTeamAndClub` y
  `resolveTeamDashboardPath` usan el equipo preferido (`configurationCoachService.getCurrent()`), y el jugador
  tiene `localStorage["coach_player_teamId"]`.
- `AppHeader` ya incluye `NotificationsBell`, por eso «Avisos» no necesita pestaña.
- Referencia visual aprobada: lienzo «Coach Team Dashboard FC26», tableros «A · Barra inferior + Menú» y
  «A/C · Página Menú».

## Goals / Non-Goals

**Goals**: navegación del equipo persistente y por rol, Menú con todas las secciones, panel del equipo
centrado en la información, mismas reglas de rol/permiso que hoy, mobile-first y accesible.

**Non-Goals**: rediseño visual FC26 del contenido del panel del equipo, `AppHeader`, nueva tipografía
(se usa la familia actual del tema, mayúsculas y peso 700–800 para el aire FC26), Mobile, backend.

## Decisions

### D1. Fuente única de secciones (`navigation/teamSections.ts`)
Función pura, sin React:

```ts
export type TeamSectionItem = { key: string; label: string; to: string; icon: SvgIconComponent };
export type TeamSectionGroup = { title: string; items: TeamSectionItem[] };
export type TeamSectionsInput = {
  teamId: string | null;
  isPlayer: boolean;
  hasFeatureAccess: (route: string) => boolean;
};
export function buildTeamSections(input: TeamSectionsInput): TeamSectionGroup[];
```

Grupos e items con las **mismas** condiciones y rutas que hoy tiene `TeamDashboardCards` (por ejemplo
`team-users` solo `!isPlayer`, `my-documents` solo `isPlayer && MyDocuments`, `notifications` siempre).
Los grupos vacíos no se devuelven. Se añade el grupo **Cuenta**: «Panel general» (`/coach/dashboard`,
solo `!isPlayer`), «Configuración» (`/coach/settings`, `!isPlayer && Settings`) y «Mi perfil» (`/profile`).
Iconos: `@mui/icons-material` en tamaño de fila. `seasonId` se deja fuera porque hoy siempre llega vacío
(`selectedSeason = ""`).

### D2. Pestañas (`navigation/teamNavTabs.ts`)
`buildTeamNavTabs({ teamId, isPlayer, hasFeatureAccess, pathname })` devuelve
`{ key, label, to, icon, active }[]`:

| Rol | Pestañas (permiso) |
|---|---|
| Entrenador | Inicio · Calendario `/coach/convocations` (Convocations) · Eventos `/coach/attendance` (Events) · Entrenamientos `/coach/trainings` (Trainings) · Menú |
| Jugador/Familia | Inicio · Resultados `/coach/results` (Convocations) · Clasificación `/coach/classification` (Convocations) · Eventos (Events) · Menú |

- Inicio (`/coach/team-dashboard`) y Menú (`/coach/menu`) siempre están. Una pestaña sin permiso se omite.
- `?teamId=` se añade cuando existe.
- Activa: la pestaña cuya ruta coincide con el `pathname` (igual o con prefijo `ruta/`). Si ninguna
  coincide, se marca **Menú**: estás en una sección que se abrió desde el Menú.

### D3. Equipo en contexto (`navigation/useTeamContextId.ts`)
Orden:
1. `teamId` de la URL; se guarda en `sessionStorage["coach_nav_teamId"]`.
2. `sessionStorage["coach_nav_teamId"]`.
3. Si es jugador: `localStorage["coach_player_teamId"]`.
4. Si no es jugador: `configurationCoachService.getCurrent()?.preferredTeamId`, de forma asíncrona.
5. `null`: enlaces sin `teamId`; las páginas ya saben resolver el equipo preferido.

Los accesos a storage van en `try/catch`, igual que en `usePlayerAutoLoad`. Así, páginas sin `teamId` en
la URL (Noticias, Lotería, Rivales…) siguen enlazando al equipo correcto.

### D4. Dónde se ve (`navigation/teamNavRoutes.ts`)
`isTeamNavRoute(pathname)` es verdadero para `/coach/team-dashboard`, `/coach/menu` y los prefijos de
todas las secciones del Menú: `team-users`, `squad`, `player`, `injured`, `attendance`, `trainings`,
`convocations`, `results`, `classification`, `rival-stats`, `rivals`, `game-model`, `match-report`,
`team-rules`, `sanctions`, `my-documents`, `player-documents`, `news`, `lottery`, `season-access` y
`notifications`. La comparación es por segmento (`p === x || p.startsWith(x + "/")`).
Quedan fuera `/coach/dashboard`, `/coach/settings`, `/coach/clubs/*` y `/coach/audit-log`, que mantienen el
`Footer` actual (Inicio / Configuración).

### D5. `CoachTeamNav` y maquetación
- `navigation/CoachTeamNav.tsx` + `CoachTeamNav.module.css`: `<nav aria-label="Navegación del equipo">`
  con `<Link>` por pestaña (icono `aria-hidden` + texto visible) y `aria-current="page"` en la activa. Lee el
  rol con `useIsPlayerRole`, los permisos con `usePermissions` (mientras carga solo muestra Inicio y Menú,
  para no enseñar pestañas que luego desaparecen) y el equipo con `useTeamContextId`.
- `BaseLayout`: si `isTeamNavRoute(location.pathname)`, añade la clase `withTeamNav` a `.layoutWrap` y pinta
  `<CoachTeamNav />` en un hueco `.teamNav`. CSS:
  - **< 1200 px**: `.teamNav` fijo abajo con alto `--rffm-team-nav-h` (64 px); `.footer` oculto; `.content`
    con `bottom: var(--rffm-team-nav-h)`. La temporada pasa a la cabecera del Menú.
  - **≥ 1200 px**: `.teamNav` es una columna fija a la izquierda (`--rffm-team-nav-rail-w`, 96 px) entre la
    cabecera y el footer, con las pestañas apiladas; `.content` con `left: var(--rffm-team-nav-rail-w)`. El
    `Footer` sigue con temporada y copyright, sin `BottomMenu` (Inicio / Configuración están en Menú › Cuenta).
  - El cambio de estructura usa media queries en `BaseLayout.module.css` porque es posicionamiento fijo
    puro (sin cambio de DOM), y el componente se puede testear sin simular el viewport.
- `Footer` recibe la prop `teamNav?: boolean`; con ella, en rutas Coach no pinta `BottomMenu`.
- `BaseLayout` ya depende de `Footer`, que a su vez importa servicios de `apps/coach`; se sigue ese
  precedente para `isTeamNavRoute` y `CoachTeamNav`.
- Estilo: superficie `--rffm-dash-card-bg`, activo en `--rffm-secondary` con barra superior de 3 px en móvil
  (izquierda en la columna), inactivo `--rffm-dash-muted-text`, área táctil ≥ 48 px. Tokens nuevos en
  `muiCoachTheme.ts`: `--rffm-team-nav-h`, `--rffm-team-nav-rail-w`, `--rffm-team-nav-bg`,
  `--rffm-team-nav-active`, `--rffm-team-nav-text`.

### D6. Página Menú (`pages/team-menu/TeamMenu.tsx`)
- Ruta lazy `menu` en `apps/coach/routes.tsx`, sin guardia de permiso porque cada entrada ya se filtra.
- Cabecera con `ContentLayout`: título «Menú» y subtítulo con el equipo (`useTeamAndClub`).
- `<TextField label="Buscar sección" type="search">`: filtra por etiqueta sin distinguir mayúsculas ni tildes
  (`normalize("NFD")`); si no hay resultados, muestra «No hay ninguna sección con ese nombre.».
- Cada grupo es un `<section>` con `<h2>` y una lista `<ul>` de filas `<Link>` (icono, etiqueta y chevron
  `aria-hidden`; alto mínimo 52 px). Sin tablas y con una sola columna en móvil; en ≥ 900 px los grupos
  forman una rejilla de 2–3 columnas.
- `useAuditPageAccess('TeamMenu')`, igual que las demás páginas.

### D7. Panel del equipo
`TeamDashboard.tsx` quita `.tilesGrid` y `TeamDashboardCards`; `.layout` queda en una columna con los
widgets (en ≥ 769 px, eventos y noticias en dos columnas). Se borran `TeamDashboardCards.tsx/.module.css`,
`components/LauncherTile.*`, `components/tileIllustrations.tsx` y sus tests: los casos de
`TeamDashboardCards.{grouping,permissions,rivalStats,teamUsers}.test.tsx` se reescriben contra
`buildTeamSections` y `TeamMenu` (mismo comportamiento y mismas rutas). `TeamDashboard.test.tsx` se ajusta
para que ya no espere tarjetas.

## Risks / Trade-offs

- **Una petición `/api/permissions/me` más por página del equipo**, porque `CoachTeamNav` usa
  `usePermissions`. Se acepta por ahora (el backend cachea); si se nota, se puede cachear en
  `permissionService` en otro cambio.
- **Páginas a pantalla completa** (`convocations/live`, `convocations/lineup`) heredan la barra. Si
  estorba, basta con excluirlas en `isTeamNavRoute`.
- **Costumbre**: quien usaba la rejilla tendrá que ir a Menú. Lo compensan las pestañas, que cubren lo más
  usado de cada rol.
