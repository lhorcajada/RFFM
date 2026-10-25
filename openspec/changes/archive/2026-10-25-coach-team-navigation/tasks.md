## 1. Lógica de navegación (~2h)

- [x] 1.1 Red: `apps/coach/navigation/__tests__/teamSections.test.ts`: grupos y orden, rutas con/sin `teamId`, reglas de rol (team-users, documentos/mis documentos, Cuenta), permisos (Player, Coach, Administrator), grupos vacíos omitidos. Migrar aquí los casos de `TeamDashboardCards.{grouping,permissions,rivalStats,teamUsers}.test.tsx` (D1).
- [x] 1.2 Red: `__tests__/teamNavTabs.test.ts`: pestañas por rol, ocultar por permiso, `teamId` en `to`, activa por ruta y Menú como activa por defecto (D2).
- [x] 1.3 Red: `__tests__/teamNavRoutes.test.ts`: rutas incluidas/excluidas y comparación por segmento (D4).
- [x] 1.4 Red: `__tests__/useTeamContextId.test.tsx`: orden URL → sessionStorage → jugador → preferido → null; storage que lanza excepción (D3).
- [x] 1.5 Green: `teamSections.ts`, `teamNavTabs.ts`, `teamNavRoutes.ts`, `useTeamContextId.ts`.
- **Verify**: `npx vitest run src/apps/coach/navigation`.

## 2. Barra y maquetación (~2h)

- [x] 2.1 Red: `navigation/__tests__/CoachTeamNav.test.tsx`: pestañas de entrenador y de jugador, `aria-current`, solo Inicio y Menú mientras cargan los permisos, enlaces con `teamId`.
- [x] 2.2 Red: `shared/components/ui/BaseLayout/__tests__/BaseLayout.teamNav.test.tsx`: la navegación aparece en `/coach/squad` y no en `/coach/dashboard`. Ampliar `Footer.coachMenu.test.tsx`: con `teamNav` no se pinta `BottomMenu`.
- [x] 2.3 Green: `CoachTeamNav.tsx` + `.module.css`, `BaseLayout` (`withTeamNav`, `.teamNav`, media query de 1200 px), prop `teamNav` en `Footer`, tokens `--rffm-team-nav-*` en `muiCoachTheme.ts` (D5).
- **Verify**: `npx vitest run src/apps/coach/navigation src/shared/components/ui`.

## 3. Página Menú y panel del equipo (~2h)

- [x] 3.1 Red: `pages/team-menu/__tests__/TeamMenu.test.tsx`: grupos visibles, «Plantilla» con `teamId`, búsqueda sin tildes, estado sin resultados.
- [x] 3.2 Green: `TeamMenu.tsx` + `.module.css` y ruta lazy `menu` en `routes.tsx` (D6).
- [x] 3.3 Red: ajustar `team-dashboard/__tests__/TeamDashboard.test.tsx`: sin tarjetas de acceso, con widgets.
- [x] 3.4 Green: quitar la rejilla de `TeamDashboard.tsx` y `.module.css`; borrar `TeamDashboardCards.*`, `LauncherTile.*`, `tileIllustrations.tsx` y sus tests (D7).
- [x] 3.5 Subir la versión minor de la web (`npm version 1.62.0 --no-git-tag-version`).
- **Verify**: `npm run test` y `npm run build` en `Front/`.

## 4. Cierre

- [x] 4.1 `openspec validate coach-team-navigation --strict`.
- [x] 4.2 Comprobación visual a ~390 px, 834 px y 1440 px (panel del equipo, Menú, una sección y `/coach/dashboard`), con entrenador y con jugador.
- [x] 4.3 Commit tras confirmación del usuario.
