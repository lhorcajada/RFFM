## Context

`/coach/dashboard` (`Front/src/apps/coach/pages/Dashboard/Dashboard.tsx`) usa `ContentLayout` con el
equipo resuelto por `useTeamAndClub` como título (`teamTitleNode`) y el club como subtítulo,
`DashboardActionBar` («Volver al inicio»), `PushActivationBanner` y `DashboardCards` (rejilla de
`DashboardCard` FC26 con «Configuración» y un acceso por equipo). Las referencias visuales aprobadas
son tres maquetas HTML (1440 / 834 / 390 px). Todo el trabajo es Front, app Coach (tema oscuro,
`ThemeProvider` anidado de `muiCoachTheme.ts`); no se pide nada nuevo al backend.

`Dashboard.module.css` lo importan también `clubs/dashboard/Dashboard.tsx` y
`team-dashboard/TeamDashboard.tsx`, y `PushActivationBanner` se usa también en `TeamDashboard`: ninguno
de los dos puede cambiar de forma incompatible.

## Goals / Non-Goals

**Goals**: reproducir el diseño aprobado con datos reales, responsive mobile-first, accesible y sin
romper la lógica de roles/permisos ni a otros consumidores.

**Non-Goals**: cambiar la cabecera global (`AppHeader`), el `TeamDashboard`, el tema Federación o el
backend.

## Decisions

### D1. Breakpoints con MUI (`useDashboardLayout`)
Nuevo hook `pages/Dashboard/hooks/useDashboardLayout.ts` que devuelve
`"mobile" | "tablet" | "desktop"` con `useMediaQuery` (import directo `@mui/material/useMediaQuery`,
patrón de `DrillDownPanel`) y los breakpoints del tema: `mobile = down("sm")` (< 600 px),
`desktop = up("lg")` (≥ 1200 px), `tablet` el resto. La maqueta de tablet (834 px) cae en `tablet` y
la de escritorio (1440 px) en `desktop`. Los componentes reciben `layout` como prop y aplican clases
CSS Modules por variante (sin media queries manuales para el cambio de estructura), lo que además los
hace testeables sin mockear el viewport.

### D2. Nombre del saludo (`useGreetingName`)
Fuente: `UserContext` (`useUser().user`), que `CoachAuthContext` rellena al hacer login y
`refreshAccount` completa con `firstName`/`lastName`. Orden: `firstName` → `username` (si no contiene
`@`) → `null`. Con `null` el título es «Panel de control». La lógica pura vive en
`resolveGreetingName(user)` (exportada y testeada); el hook solo la envuelve.
Los tests de la página mockean `useGreetingName` porque no montan `UserProvider`.

### D3. Hero del equipo preferido (`PreferredTeamHero`)
`useTeamAndClub` añade a su retorno `teamImageUrl: string | null` (foto del equipo o, si no, el
escudo — la misma resolución que ya usaba para `teamTitleNode`) y `clubEmblemUrl: string | null`.
Es un cambio aditivo: los nodos `teamTitleNode`/`clubSubtitleNode` se siguen generando, así que los
~30 consumidores y sus mocks no cambian. El hero se muestra solo si `team` no es `null`; sin equipo
preferido **no se muestra nada** (decisión: el acceso rápido ya lista todos los equipos y un estado
vacío añadiría ruido; el equipo preferido se elige en Configuración). Durante la carga tampoco se
muestra, para no parpadear. CTA: `<Link>` «Abrir panel» («Abrir panel del equipo» en móvil) a
`/coach/team-dashboard?teamId=<id>`. El nombre del equipo es `h2` (el `h1` es el saludo).

### D4. Escudo con forma (`TeamShield`)
Componente pequeño que pinta la imagen recortada con forma de escudo (`clip-path`) o, si no hay
imagen, las iniciales del nombre real del equipo. Tamaños `sm | md | lg | xl` por clase CSS. Lo usan
hero, rejilla y lista.

### D5. Acceso rápido
`DashboardCards` se mantiene como orquestador (props `selectedSeason`, `isPlayer`, nueva `layout`
con valor por defecto `"desktop"`), conserva `useUserTeams`, `usePermissions` y la regla
`!isPlayer && hasFeatureAccess(COACH_FEATURE_ROUTES.Settings)`; la carga de fotos se extrae al hook
`useTeamPhotos(teams)` sin cambiar su lógica. Pinta la cabecera de sección (barra de acento,
«ACCESO RÁPIDO» / «MIS EQUIPOS» en móvil, contador «N equipos» / «1 equipo») y delega en:
- `QuickAccessGrid` (escritorio/tablet): `DashboardCard` reutilizada con `className`/`iconClassName`
  para el alto y la tipografía del diseño; 5 columnas en `desktop`, 3 en `tablet`. «Configuración»
  con borde discontinuo y acento secundario.
- `QuickAccessList` (móvil): filas `<Link>` (escudo, nombre, «categoría • club», chevron
  `aria-hidden`) de 68 px y, al final, dos enlaces de 52 px: «Configuración» (`/coach/settings`, según
  permiso) e «Inicio» (`/`).
Así los tests existentes de `DashboardCards` (permiso de Configuración, sin tarjeta Club) siguen
pasando sin cambios. No se usan tablas.

### D6. Aviso de notificaciones (`PushActivationBanner variant`)
Nueva prop `variant?: "banner" | "card" | "strip" | "row"` (por defecto `"banner"`, que es el
marcado y texto actuales → `TeamDashboard` y sus tests no cambian). `card` (escritorio), `strip`
(tablet) y `row` (móvil: todo el bloque es un `<button>` con
`aria-label="Activar notificaciones de convocatorias"`). Misma `shouldPrompt` y misma navegación
`navigate("/coach/settings", { state: { section: "notifications" } })`. En escritorio el hero y la
tarjeta van en una fila flex (`2fr`/`1fr` vía `flex: 2 1 0` / `flex: 1 1 0`): si el aviso no aplica,
el hero ocupa todo el ancho sin dejar hueco.

### D7. Página
`Dashboard.tsx` sigue envolviendo con `BaseLayout hideFooterMenu` + `ContentLayout` (solo
`children`, sin `title`/`actionBar`), mantiene `useAuditPageAccess('Dashboard')`,
`usePreferredSelection` (Snackbar) y `usePlayerAutoLoad`. Orden: `DashboardHeader` (con
`DashboardActionBar` como `action` salvo en móvil) → fila hero + aviso → acceso rápido. En móvil la
cabecera se muestra compacta (desviación consciente de la maqueta, que no la tiene: garantiza un `h1`
y el saludo también en móvil; el botón «Inicio» pasa al final de la lista).
`DashboardActionBar` pasa a tener su propio `DashboardActionBar.module.css`.
`Dashboard.module.css` conserva sus clases (las usan otras páginas) y añade las del nuevo layout.

### D8. Tokens
En `muiCoachTheme.ts` (bloque `.rffm-coach-theme`) se añaden: `--rffm-dash-muted-text`
(`rgba(232,232,232,0.62)`, ≥ 4.5:1 sobre `#111128`), `--rffm-dash-body-text`, `--rffm-dash-link`
(`#7ab8f5`), `--rffm-dash-link-border`, `--rffm-dash-section-title` (`#a8d4f5`),
`--rffm-dash-on-accent` (`#0d0d1f`), `--rffm-dash-card-border`, `--rffm-dash-card-border-dashed`,
`--rffm-dash-emblem-bg`, `--rffm-dash-secondary-tint`, `--rffm-dash-secondary-border`,
`--rffm-dash-hero-glow`, `--rffm-dash-hero-glow-mobile`. Los CSS Modules solo usan `var(--…)`.

## Archivos

Nuevos (todos con su `.module.css` salvo hooks):
- `pages/Dashboard/hooks/useDashboardLayout.ts`, `useGreetingName.ts`, `useTeamPhotos.ts`
- `pages/Dashboard/components/DashboardHeader.tsx`, `PreferredTeamHero.tsx`, `TeamShield.tsx`,
  `QuickAccessGrid.tsx`, `QuickAccessList.tsx`, `DashboardCards.module.css`,
  `DashboardActionBar.module.css`
- Tests en `__tests__/` co-ubicados.

Modificados: `Dashboard.tsx`, `Dashboard.module.css` (solo añade), `DashboardCards.tsx`,
`DashboardActionBar.tsx`, `hooks/useTeamAndClub.tsx`, `components/PushActivationBanner/*`,
`muiCoachTheme.ts`, tests de página existentes (añaden el mock de `useGreetingName`),
`Front/package.json`.

## Risks / Trade-offs

- `useMediaQuery` devuelve `false` en el primer render sin `noSsr` → se pasa `{ noSsr: true }` para
  evitar un parpadeo de escritorio a móvil.
- La revisión visual real (contraste, recortes del `clip-path`) no la cubren los tests unitarios.
