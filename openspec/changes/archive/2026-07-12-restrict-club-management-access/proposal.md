## Why

Hoy la tarjeta "Club" ("Gestión de club.") del dashboard del Coach (`Front/src/apps/coach/pages/Dashboard/components/DashboardCards.tsx`, líneas 148-155) se muestra **incondicionalmente** a cualquier usuario que no sea `Player` (`!isPlayer`), incluidos los entrenadores (`Coach`). Un entrenador no debe poder gestionar un club — esa capacidad es de los directivos (`ClubDirector`, ya existente como rol en `AppRoles.cs` y `userTypes.ts`).

El backend tampoco protege esta capacidad: `UpdateClub.cs`, `CreateClub.cs` y `DeleteClub.cs` (`Features/Coaches/Clubs/Commands/`) no implementan ninguna verificación de rol — cualquier usuario autenticado puede invocarlos directamente vía API, aunque la tarjeta esté oculta en frontend.

El proyecto ya tiene el mecanismo genérico para esto y sin usar todavía: `IRequireFeaturePermission` + `FeaturePermissionBehavior` (pipeline behavior que valida `RoleName` + `FeatureRoute` contra la tabla `FeaturePermissions`), pero **no hay ninguna fila seedeada** para la ruta de gestión de club ni ningún command que implemente la interfaz. Se reutiliza esta infraestructura en vez de crear un sistema de permisos nuevo.

**Hallazgo que afecta al diseño**: `FeaturePermissionBehavior` mapea los fallos de permiso a `UnauthorizedAccessException`, que el `ProblemDetails` handler global (`ServiceCollectionExtensions.cs:172`) traduce a **401**, no a 403. El criterio de aceptación pide explícitamente 403 para un Coach sin permiso. `design.md` debe decidir cómo distinguir "no autenticado" (401) de "autenticado pero sin permiso" (403) — probablemente una excepción nueva (`ForbiddenAccessException` o similar) mapeada a 403, usada por `FeaturePermissionBehavior` cuando el usuario está autenticado pero el rol no tiene el permiso requerido.

## What Changes

- **Backend**: seed de `FeaturePermission` para la ruta de gestión de club (p.ej. `FeatureRoute="/coach/clubs"`, `RoleName="ClubDirector"`, `PermissionType=ReadWrite`) en el seeding existente (`RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`). `CreateClub`, `UpdateClub`, `DeleteClub` implementan `IRequireFeaturePermission` con esa ruta. `FeaturePermissionBehavior` distingue no-autenticado (401) de autenticado-sin-permiso (403) mediante una nueva excepción mapeada en `AddCustomProblemDetails`.
- **Frontend**: `DashboardCards.tsx` deja de mostrar la tarjeta "Club" con `!isPlayer`; pasa a mostrarse solo si el usuario tiene el permiso correspondiente, consultado vía `GET /api/permissions/me` (`GetMyPermissions.cs`, ya existente — devuelve `FeaturePermissions` por rol). Se crea un guard/hook mínimo reutilizable (p.ej. `useFeaturePermission(route)`) que consulta esa respuesta.

## Capabilities

### New Capabilities
- `restrict-club-management-access`: permiso de gestión de club restringido a `ClubDirector`, aplicado en backend (403) y ocultado en frontend.

### Modified Capabilities
- Ninguna capability existente formalizada se modifica (los endpoints de club no tenían protección de permisos previa).

## Impact

- **Back**: `Features/Coaches/Clubs/Commands/{CreateClub,UpdateClub,DeleteClub}.cs` (implementar `IRequireFeaturePermission`), `Common/Behaviors/FeaturePermissionBehavior.cs` (distinguir 401/403), `DependencyInjection/ServiceCollectionExtensions.cs` (mapear nueva excepción a 403), `RFFM.Host/DependencyInjection/WebApplicationExtensions.cs` (seed de `FeaturePermission` para `ClubDirector`). Requiere migración EF si el seed se aplica vía migración (a confirmar en `design.md`).
- **Front**: `apps/coach/pages/Dashboard/components/DashboardCards.tsx` (condicionar tarjeta "Club"), nuevo hook `useFeaturePermission` (ubicación a definir en `design.md`, probablemente `shared/hooks/`), posible extensión de `apps/coach/components/ProtectedRoute.tsx` para proteger también la ruta `/coach/clubs` directamente (no solo ocultar la tarjeta).
