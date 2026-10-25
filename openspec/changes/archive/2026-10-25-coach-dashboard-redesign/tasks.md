## 1. Base: tokens y hooks (~1h)

- [x] 1.1 Red: `hooks/__tests__/useDashboardLayout.test.tsx` (mobile / tablet / desktop mockeando `@mui/material/useMediaQuery`) (D1).
- [x] 1.2 Red: `hooks/__tests__/useGreetingName.test.ts` (`resolveGreetingName`: firstName, username, email, null) (D2).
- [x] 1.3 Green: `useDashboardLayout.ts`, `useGreetingName.ts`, `useTeamPhotos.ts` (extracción sin cambio de lógica).
- [x] 1.4 Tokens `--rffm-dash-*` en `apps/coach/muiCoachTheme.ts` (D8).
- [x] 1.5 `useTeamAndClub` expone `teamImageUrl` y `clubEmblemUrl` (D3, aditivo).
- **Verify**: `npx vitest run src/apps/coach/pages/Dashboard`.

## 2. Componentes (~2h)

- [x] 2.1 Red: `DashboardHeader.test.tsx` (saludo con nombre, fallback «Panel de control», acción).
- [x] 2.2 Red: `PreferredTeamHero.test.tsx` (nombre, club, categoría, CTA a `/coach/team-dashboard?teamId=<id>`).
- [x] 2.3 Red: `DashboardCards.layout.test.tsx` (rejilla vs lista según `layout`, contador, Configuración según permiso en móvil, Inicio en móvil).
- [x] 2.4 Red: `PushActivationBanner.variants.test.tsx` (row pulsable entera navega a ajustes; card/strip con su botón).
- [x] 2.5 Green: `DashboardHeader`, `PreferredTeamHero`, `TeamShield`, `QuickAccessGrid`, `QuickAccessList`, `DashboardCards` (+ `.module.css`), `PushActivationBanner` `variant` (D4–D6).
- **Verify**: `npx vitest run src/apps/coach`.

## 3. Página (~1h)

- [x] 3.1 Red: `__tests__/CoachDashboard.layout.test.tsx` (hero visible/oculto, lista vs rejilla mockeando `useMediaQuery`, saludo).
- [x] 3.2 Green: `Dashboard.tsx` + clases nuevas en `Dashboard.module.css` + `DashboardActionBar.module.css` (D7).
- [x] 3.3 Actualizar los tests de página existentes con el mock de `useGreetingName` (no montan `UserProvider`).
- [x] 3.4 Subir la versión minor de la web (`npm version 1.61.0 --no-git-tag-version`).
- **Verify**: `npm run test` + `npm run build` en `Front/`.

## 4. Cierre

- [x] 4.1 `openspec validate coach-dashboard-redesign --strict`.
- [x] 4.2 Comprobación visual a ~390 px, 834 px y 1440 px.
- [x] 4.3 Commit tras confirmación del usuario.
