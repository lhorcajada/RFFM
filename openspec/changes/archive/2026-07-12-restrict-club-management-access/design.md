## Architecture Decisions

### 1. Distinguir 401 (no autenticado) de 403 (autenticado sin permiso)

Hoy `FeaturePermissionBehavior` lanza `UnauthorizedAccessException` en los 4 casos (no autenticado, sin rol, sin fila `FeaturePermission`, permiso insuficiente), y `ServiceCollectionExtensions.AddCustomProblemDetails` mapea esa excepción a 401. Se separa en dos excepciones:

- `UnauthorizedAccessException` → sigue siendo 401, solo para "no autenticado" / "no se pudo determinar el rol".
- Nueva `RFFM.Api.Domain.ForbiddenAccessException` → 403, para "usuario autenticado pero su rol no tiene el permiso requerido" (incluye tanto "no existe fila `FeaturePermission` para su rol+ruta" como "existe pero el `PermissionType` es insuficiente").

```csharp
// Back/ExtractionApi/src/RFFM.Api/Domain/ForbiddenAccessException.cs
namespace RFFM.Api.Domain
{
    public class ForbiddenAccessException : Exception
    {
        public ForbiddenAccessException(string message) : base(message) { }
    }
}
```

```csharp
// ServiceCollectionExtensions.cs — junto al bloque de UnauthorizedAccessException
setup.Map<RFFM.Api.Domain.ForbiddenAccessException>(exception =>
    new StatusCodeProblemDetails(StatusCodes.Status403Forbidden)
    {
        Title = "Acceso denegado",
        Detail = exception.Message
    });
```

```csharp
// FeaturePermissionBehavior.cs — cambios en los 2 branches de permiso (líneas 53-70 actuales)
if (permission == null)
    throw new ForbiddenAccessException(
        $"El rol '{role}' no tiene acceso a la funcionalidad '{requirement.FeatureRoute}'.");

bool allowed = requirement.RequiredPermission switch { /* sin cambios */ };

if (!allowed)
    throw new ForbiddenAccessException(
        $"El rol '{role}' solo tiene acceso de tipo '{PermissionType.FromId(permission.PermissionTypeId).Name}' " +
        $"a '{requirement.FeatureRoute}', pero se requiere '{requirement.RequiredPermission}'.");
```

Los dos throws de "no autenticado" / "no se pudo determinar el rol" (líneas 37 y 41) se mantienen como `UnauthorizedAccessException`.

### 2. Reusar `FeaturePermission` en vez de crear un permiso nuevo

Se añade una sola fila de seed:

```csharp
// WebApplicationExtensions.cs → SeedFeaturePermissionsAsync, dentro del array `entries`
("ClubManagement", "/coach/clubs", "ClubDirector", 3 /* ReadWrite */, true),
```

No se añade fila para `Coach`: al no existir `FeaturePermission` con `RoleName="Coach"` y `FeatureRoute="/coach/clubs"`, `FeaturePermissionBehavior` entra en la rama `permission == null` y lanza `ForbiddenAccessException` (403) automáticamente — sin necesidad de una entrada de "denegar" explícita. `Administrator` sigue haciendo bypass (línea 44 del behavior, sin cambios).

### 3. Proteger los 3 commands de gestión de club

`CreateClub.cs`, `UpdateClub.cs`, `DeleteClub.cs` implementan `IRequireFeaturePermission`:

```csharp
public class CreateClubCommand : IRequest, IInvalidateCacheRequest, IRequireFeaturePermission
{
    // ...campos existentes sin cambios...
    public string FeatureRoute => "/coach/clubs";
    public string RequiredPermission => "Write";
}
```

Mismo patrón en `UpdateClubCommand` y `DeleteClubCommand`. `RequiredPermission = "Write"` porque la rama `"Write"` de `FeaturePermissionBehavior` acepta tanto `PermissionType.Write` como `PermissionType.ReadWrite` — coherente con el seed `ReadWrite` de `ClubDirector`.

**Gap encontrado que se corrige de paso**: `UpdateClub.cs` y `DeleteClub.cs` no tienen `.RequireAuthorization()` en su `MapPut`/`MapDelete` (a diferencia de `CreateClub.cs`, que sí lo tiene). Sin esa llamada, un usuario ni siquiera autenticado podría llegar al pipeline behavior con `_currentUser.IsAuthenticated = false`, lo cual hoy ya lanzaría `UnauthorizedAccessException` (401) desde `FeaturePermissionBehavior` — pero es más correcto y consistente con el resto del código rechazar en el nivel de endpoint. Se añade `.RequireAuthorization()` a ambos.

**Fuera de alcance (anotado, no se toca en este cambio)**: `CreateClubHandler` (línea 98) asigna `Membership.Coach.Id` al creador del club, incluso cuando quien crea es un `ClubDirector` (el registro de `ClubDirector` no crea `Membership` — `CreateUser.cs:127`). Es una inconsistencia preexistente entre el rol de Identity (`ClubDirector`) y el `Membership` de club (`Coach`), no introducida por este cambio y no bloqueante para los criterios de aceptación (que son sobre visibilidad de la tarjeta y código HTTP, basados en rol de Identity vía `FeaturePermission`, no en `Membership`). Se deja para un cambio futuro si el usuario lo confirma.

### 4. Frontend — ocultar la tarjeta según permiso real

Nuevo servicio que envuelve `GET /api/permissions/me` (primer consumidor de este endpoint en frontend):

```typescript
// Front/src/shared/services/permissions/permissionService.ts
import client from "../../../core/api/client";

export interface FeaturePermissionDto {
  featureName: string;
  featureRoute: string;
  permissionType: "Read" | "Write" | "ReadWrite";
}

export interface MyPermissionsResponse {
  role: string;
  featurePermissions: FeaturePermissionDto[];
  pagePermissions: { pageIdentifier: string; permissionKey: string; permissionType: string }[];
}

export async function getMyPermissions(): Promise<MyPermissionsResponse> {
  const resp = await client.get<MyPermissionsResponse>("/api/permissions/me");
  return resp.data;
}
```

Hook mínimo, sin contexto global (no hay `PermissionProvider` en el código — se evita introducir uno para un único caso de uso; si aparecen más consumidores en el futuro, se puede promover a contexto):

```typescript
// Front/src/shared/hooks/useFeaturePermission.ts
import { useEffect, useState } from "react";
import { getMyPermissions } from "../services/permissions/permissionService";

export function useFeaturePermission(featureRoute: string) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getMyPermissions()
      .then((res) => {
        if (!mounted) return;
        setHasAccess(res.featurePermissions.some((p) => p.featureRoute === featureRoute));
      })
      .catch(() => { if (mounted) setHasAccess(false); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [featureRoute]);

  return { hasAccess, loading };
}
```

`DashboardCards.tsx` (líneas 148-155): la tarjeta "Club" deja de depender de `!isPlayer` y usa el hook:

```tsx
const { hasAccess: canManageClub } = useFeaturePermission("/coach/clubs");
// ...
{canManageClub && (
  <DashboardCard
    title="Club"
    description="Gestión de club."
    icon={<SportsFootballIcon style={{ fontSize: 40 }} />}
    to={clubDashboardRoute}
  />
)}
```

Mientras `loading === true` no se renderiza la tarjeta (evita parpadeo mostrando-y-ocultando).

**Fuera de alcance**: no se protege `apps/coach/components/ProtectedRoute.tsx` a nivel de ruta `/coach/clubs/*` en este cambio (solo se oculta la tarjeta de acceso). Si el usuario quiere que además se bloquee la navegación directa a la URL, es una extensión a confirmar aparte — el backend ya rechaza con 403 cualquier intento de crear/editar/borrar un club sin permiso, que es el criterio de aceptación pedido.

## Files

**Backend** (nuevos):
- `Back/ExtractionApi/src/RFFM.Api/Domain/ForbiddenAccessException.cs`

**Backend** (modificados):
- `Back/ExtractionApi/src/RFFM.Api/Common/Behaviors/FeaturePermissionBehavior.cs`
- `Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs`
- `Back/ExtractionApi/src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Commands/CreateClub.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Commands/UpdateClub.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Commands/DeleteClub.cs`

**Frontend** (nuevos):
- `Front/src/shared/services/permissions/permissionService.ts`
- `Front/src/shared/hooks/useFeaturePermission.ts`

**Frontend** (modificados):
- `Front/src/apps/coach/pages/Dashboard/components/DashboardCards.tsx`

## Tests (TDD — Red → Green → Refactor)

**Backend** (`RFFM.Api.Tests`, xUnit + Moq):
- `FeaturePermissionBehaviorTests`: rol sin fila `FeaturePermission` → `ForbiddenAccessException`; rol con `PermissionType.Read` y `RequiredPermission="Write"` → `ForbiddenAccessException`; rol con `ReadWrite` y `RequiredPermission="Write"` → pasa; `Administrator` bypass sin importar `FeatureRoute`; no autenticado → `UnauthorizedAccessException` (no `ForbiddenAccessException`).
- `CreateClubHandlerTests` / `UpdateClubHandlerTests` / `DeleteClubHandlerTests`: no cambian (el guard es de pipeline, no de handler) — se añade un test de integración ligero (o de comportamiento) verificando que el command implementa `IRequireFeaturePermission` con `FeatureRoute="/coach/clubs"`.
- Test de mapeo: `ForbiddenAccessException` → 403 vía `AddCustomProblemDetails` (test de integración mínima si existe fixture de `ProblemDetails`, si no, test unitario del delegate de mapeo).

**Frontend** (Vitest + Testing Library):
- `useFeaturePermission.test.ts`: devuelve `hasAccess=true` si `featureRoute` está en la respuesta; `false` si no está o si la llamada falla; `loading` pasa a `false` tras resolver.
- `DashboardCards.test.tsx`: no renderiza la tarjeta "Club" mientras `loading`; la renderiza si `useFeaturePermission` devuelve `hasAccess=true`; no la renderiza si `hasAccess=false` (mock del hook).

Coverage objetivo: handlers/behaviors backend ≥80%, componente frontend ≥75% (según CLAUDE.md).
