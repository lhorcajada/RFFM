## Why

La página «Estadísticas de rivales» es una herramienta de pronóstico, no solo de estadísticas, y las acciones que generan o actualizan datos deben quedar reservadas a los entrenadores. Este cambio es el esqueleto (nombre, rutas y control de rol) del que dependen los demás cambios de la serie de pronóstico (issue #10).

## What Changes

- Renombrar la página «Estadísticas de rivales» como «Pronóstico de partidos» en el menú del equipo, el título, las rutas, los ficheros, los hooks, el servicio y los tests del frontend, y la carpeta del backend (`Features/Coaches/RivalStats/` pasa a `Features/Coaches/MatchForecast/`).
- Rutas del frontend `match-forecast` y `match-forecast/simulation`; las rutas antiguas `rival-stats` y `rival-stats/simulation` redirigen a las nuevas conservando la query string.
- Rutas de API `/api/teams/{teamId}/match-forecast/...` en lugar de `/api/teams/{teamId}/rival-stats/...`. **BREAKING**: las rutas de API antiguas dejan de existir, sin redirección; frontend y backend se despliegan juntos.
- El botón «Simulación» pasa a llamarse «Crear pronóstico».
- «Crear pronóstico», «Actualizar» y los controles que piden generar o reintentar las estadísticas solo se muestran al rol Coach, y el endpoint `POST .../match-forecast/requests` responde 403 con `ProblemDetails` a quien no tenga ese rol, sin encolar ninguna generación.
- Las notificaciones push nuevas usan el nombre «Pronóstico de partidos» (títulos «Pronóstico de partidos listo» y «No se pudo generar el pronóstico de partidos») y enlazan a la ruta nueva; los enlaces de notificaciones ya enviadas siguen funcionando gracias a la redirección.
- No cambia el cálculo ni los datos de las estadísticas. Mobile no cambia.

## Capabilities

### New Capabilities
- `match-forecast`: nombre «Pronóstico de partidos», rutas del frontend y de la API, redirección de las rutas antiguas y reserva al rol Coach de las acciones que generan o actualizan el pronóstico.

### Modified Capabilities
- `coach-rival-squad-stats`: la notificación al terminar, la identificación del equipo propio y la página del entrenador pasan a usar el nombre y la ruta nuevos; los botones que generan o actualizan quedan para el rol Coach.
- `rival-match-simulation`: la ruta del endpoint de simulación y la ruta, el nombre y el botón de apertura de la página de simulación.
- `rival-simulation-history`: las rutas de los endpoints de sincronización e historial de simulaciones por jornada.
- `coach-dashboard-permission-ui`: la entrada de menú de la competición pasa a llamarse «Pronóstico de partidos», y las rutas nuevas quedan bajo el control de acceso por URL de la funcionalidad de convocatorias (las antiguas redirigen sin saltárselo).

## Impact

- Backend (`Back/ExtractionApi`): renombrado de la carpeta `Features/Coaches/RivalStats/` a `MatchForecast/` y de las rutas `/api/teams/{teamId}/rival-stats/...` a `/api/teams/{teamId}/match-forecast/...` (`RequestRivalStats`, `GetRivalStats`, `GetRivalTeamStats`, `GetRivalSimulation`, `GetRivalSimulationHistory`, `SyncRivalSimulationRounds`); control de rol Coach en `POST .../requests`; título y enlace de `DispatchRivalStatsFinishedAsync` en `WebPushNotificationDispatcher.cs`. Sin cambios de esquema ni migraciones. Subida de versión de la API.
- Frontend (`Front`): carpeta `apps/coach/pages/rivalStats/` a `matchForecast/`, hooks, servicio y tests con el nombre nuevo; `routes.tsx` (rutas nuevas más redirecciones), `teamSections.ts` y `teamNavRoutes.ts`; helper `computeIsCoachRole(roles)` junto a `isPlayerRole.ts`. Subida de versión de la web.
- Tests existentes de frontend y backend que referencian los nombres, textos y rutas antiguos deben actualizarse al nombre nuevo.
- Mobile no usa esta página y no cambia.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/rivalStats/RivalStats.tsx
- Front/src/apps/coach/routes.tsx
- Front/src/apps/coach/navigation/teamSections.ts
- Front/src/apps/coach/navigation/teamNavRoutes.ts
- Front/src/apps/coach/hooks/isPlayerRole.ts
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RequestRivalStats.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notifications/Services/WebPushNotificationDispatcher.cs
- openspec/specs/coach-rival-squad-stats/spec.md
- openspec/specs/rival-match-simulation/spec.md
- openspec/specs/rival-simulation-history/spec.md
- openspec/specs/coach-dashboard-permission-ui/spec.md
- GLOSSARY.md

**External URLs**:
- https://github.com/lhorcajada/RFFM/issues/10

## Additional Notes

- La query string de las rutas del frontend ya lleva el equipo (`?teamId=`, ver `withTeamId` en `teamSections.ts`); el enlace push actual es `/coach/rival-stats?teamId=<id>`. Conservar la query string de la ruta antigua conserva por tanto el equipo.
- Además de «Crear pronóstico» y «Actualizar», la página hoy tiene otros dos controles que llaman al mismo endpoint `POST .../requests`: «Generar estadísticas» (estado vacío) y «Reintentar» (aviso de fallo). Como el endpoint pasa a exigir el rol Coach, los specs los reservan al rol Coach por el mismo motivo (Why del bloque: las acciones que generan o actualizan datos).
- «Crear pronóstico» es un enlace a la página de simulación (hoy «Simulación»); el bloque solo oculta el botón y no pide restringir la ruta `match-forecast/simulation` ni los endpoints de lectura de simulación, que siguen con el acceso actual.
- `RequestRivalStats` hoy usa `RequireAuthorization()` más `IRequireFeaturePermission`/`IRequireTeamMembership`; no hay ningún control por rol Coach en la feature. El mecanismo concreto (política, claim de rol o comprobación en el handler) queda para el diseño.
