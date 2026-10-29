## 1. Limpieza del intento anterior (~15 min)

- [x] Revertir `DashboardHeader.tsx` a su forma original (sin `eyebrow`/`title`) y borrar `DashboardHeader.customTitle.test.tsx` (D5).
- **Verify**: `npx vitest run src/apps/coach/pages/Dashboard/components/__tests__/DashboardHeader`.

## 2. Hook y widgets (~2h)

- [x] Red: `useClubPendingRequests.test.ts` (devuelve el contador; fallo → 0).
- [x] Red: `ClubQuickActions.test.tsx` (6 acciones y rutas; `seasonId`; sin acceso a ClubTeams oculta Equipos y Nuevo equipo; badge de solicitudes).
- [x] Red: `ClubTeamsWidget.test.tsx` (lista con categoría y enlace; vacío; error; cargando; «Ver todos»).
- [x] Red: `ClubPendingWidget.test.tsx` (contador y enlace; «Nada pendiente»).
- [x] Green: hook, `ClubQuickActions`, `ClubTeamsWidget`, `ClubPendingWidget` + CSS Modules (D2, D3, D4).

## 3. Página (~1h)

- [x] Red: actualizar `ClubsDashboard.test.tsx` (cabecera del club, «Volver» a `/coach/dashboard`, composición de widgets).
- [x] Green: `Dashboard.tsx` y `Dashboard.module.css` con `widgetsGrid` responsive (D1, D2).
- [x] Subir la versión minor de la web (`Front/package.json`).

## 4. Verificación final

- [x] Suite completa `npx vitest run --maxWorkers=2` y `npm run build` (una sola vez, al terminar).
- [x] Comprobación visual a 390 px y a escritorio (pendiente de la persona usuaria).
- **Verify**: `openspec validate club-dashboard-team-style --strict`.
