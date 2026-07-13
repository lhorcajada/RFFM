## Why

Un entrenador (`Coach`) que se acaba de dar de alta y entra en Configuración ve la temporada de **otro** entrenador, en vez de no ver ninguna. Causa raíz confirmada:

`GET /api/coaches/configuration` (`Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Settings/ConfigurationCoach.cs`, `GetConfigHandler.Handle`, línea 49) no filtra por usuario — devuelve **todas** las filas `ConfigurationCoach` de **todos** los coaches, y el endpoint ni siquiera tiene `.RequireAuthorization()` ni lee `HttpContext.User` (a diferencia de `GetUserClubs.cs`, que sí sigue el patrón correcto de extraer el `userId` del claim `nameidentifier` y filtrar por él).

El frontend agrava el problema: `configurationCoachService.getCurrent()` (`Front/src/apps/coach/services/configurationCoachService.ts`, líneas 24-33) llama a `getAll()` (que hoy trae la tabla completa), busca la fila del coach actual y, si no existe (caso normal para un coach recién registrado, que aún no tiene configuración propia), hace **fallback a `configs[0]`** — una fila de un coach arbitrario. `Settings.tsx` usa ese `preferredClubId` ajeno para pedir las temporadas de ese club, y el entrenador nuevo ve datos que no le pertenecen.

El mismo endpoint tiene un problema relacionado (IDOR): `UpdateConfigCommand`/`DeleteConfigCommand` reciben solo un `Id` de fila sin verificar que pertenezca al coach autenticado, y `CreateConfigCommand` confía en el `CoachId` que envía el cliente en el body en vez de derivarlo del token. Se corrige a la vez por ser la misma causa raíz (endpoint sin autenticación/autorización por propietario).

## What Changes

- **Backend**: `ConfigurationCoachModule` (los 4 endpoints) pasa a requerir autenticación (`.RequireAuthorization()`) y a derivar el `coachId` del claim `nameidentifier` del usuario autenticado (mismo patrón que `GetUserClubs.cs`):
  - `GetConfigQuery` se filtra por `CoachId == userId` (devuelve como mucho la fila propia del coach, nunca las de otros).
  - `CreateConfigCommand` ignora el `CoachId` del body y usa el del token.
  - `UpdateConfigCommand`/`DeleteConfigCommand` verifican que la fila (`Id`) pertenezca al `userId` del token antes de modificar/borrar; si no, `ForbiddenAccessException`/404 (a decidir en `design.md`).
- **Frontend**: `configurationCoachService.getCurrent()` deja de hacer fallback a `configs[0]`. Como el backend ya solo devuelve la(s) fila(s) del coach autenticado, `getCurrent()` se simplifica a devolver la primera fila propia o `null` si no hay ninguna (sin buscar coincidencia por `coachId`, que ya no aporta nada tras el scoping del backend).
- **Verificación manual** (sin cambio de código, ya existe): confirmar que un entrenador puede crear una temporada nueva desde Configuración cuando no tiene ninguna (el flujo de creación de temporada ya existe — solo se valida que funciona tras el fix de scoping).

## Capabilities

### New Capabilities
Ninguna — es una corrección de aislamiento de datos sobre una capability existente.

### Modified Capabilities
- `coach-configuration`: el endpoint de configuración del coach pasa a estar scoped por usuario autenticado (antes no tenía ningún control de acceso).

## Impact

- **Back**: `Features/Coaches/Settings/ConfigurationCoach.cs` (los 4 endpoints + `GetConfigHandler`, `CreateConfigHandler`, `UpdateConfigHandler`, `DeleteConfigHandler`).
- **Front**: `apps/coach/services/configurationCoachService.ts` (`getCurrent()`). Posible ajuste menor en `Settings.tsx` si el contrato de `getCurrent()` cambia de forma (a confirmar en `design.md`, probablemente no requiere cambios).
- Sin migración EF (no se toca el esquema, solo el filtrado de queries y la autorización).
