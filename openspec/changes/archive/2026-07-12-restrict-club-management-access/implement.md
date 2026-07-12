# Implement — restrict-club-management-access

Script técnico para el agente `openspec-implementer`. Sigue TDD estricto (Red → Green → Refactor) en cada bloque. No avances al siguiente bloque sin que los tests del bloque actual pasen.

Convenciones detectadas en el repo a respetar:
- Tests backend en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/`, xUnit, `#nullable enable`, namespace `RFFM.Api.Tests.UnitTests`.
- Tests que necesitan `AppDbContext` usan `PostgresContainerFixture` real (colección `PostgresCollection.Name`), no InMemory provider — ver `TeamInvitationValidationTests.cs`.
- Tests frontend co-ubicados en `__tests__/` junto al archivo, Vitest + Testing Library, `vi.mock(...)` para servicios — ver `usePlayerAutoLoad.test.tsx`.

---

## Bloque 1 — Backend: 401 vs 403

### 1.1 Red ✓

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/FeaturePermissionBehaviorTests.cs`:

```csharp
#nullable enable
using Mediator;
using Moq;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class FeaturePermissionBehaviorTests
    {
        private readonly PostgresContainerFixture _fixture;

        public FeaturePermissionBehaviorTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        public record TestRequest : IRequest<Unit>, IRequireFeaturePermission
        {
            public string FeatureRoute => "/coach/clubs";
            public string RequiredPermission => "Write";
        }

        private static ValueTask<Unit> Next(TestRequest r, CancellationToken ct) => ValueTask.FromResult(Unit.Value);

        [Fact]
        public async Task Handle_NotAuthenticated_ThrowsUnauthorizedAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(false);

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);

            await Assert.ThrowsAsync<UnauthorizedAccessException>(
                async () => await behavior.Handle(new TestRequest(), Next, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_AuthenticatedNoFeaturePermissionRow_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns($"Coach-{Guid.NewGuid():N}"); // rol único, sin fila seed

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await behavior.Handle(new TestRequest(), Next, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_InsufficientPermissionType_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var role = $"RoleReadOnly-{Guid.NewGuid():N}";
            db.FeaturePermissions.Add(new FeaturePermission("ClubManagement", "/coach/clubs", role, PermissionType.Read, true));
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(role);

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await behavior.Handle(new TestRequest(), Next, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_SufficientReadWritePermission_CallsNext()
        {
            await using var db = _fixture.CreateDbContext();
            var role = $"RoleReadWrite-{Guid.NewGuid():N}";
            db.FeaturePermissions.Add(new FeaturePermission("ClubManagement", "/coach/clubs", role, PermissionType.ReadWrite, true));
            await db.SaveChangesAsync();

            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(role);

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);
            var result = await behavior.Handle(new TestRequest(), Next, CancellationToken.None);

            Assert.Equal(Unit.Value, result);
        }

        [Fact]
        public async Task Handle_AdministratorRole_BypassesEvenWithoutFeaturePermissionRow()
        {
            await using var db = _fixture.CreateDbContext();
            var currentUser = new Mock<ICurrentUserService>();
            currentUser.Setup(c => c.IsAuthenticated).Returns(true);
            currentUser.Setup(c => c.Role).Returns(AppRoles.Administrator.Name);

            var behavior = new FeaturePermissionBehavior<TestRequest, Unit>(currentUser.Object, db);
            var result = await behavior.Handle(new TestRequest(), Next, CancellationToken.None);

            Assert.Equal(Unit.Value, result);
        }
    }
}
```

Ejecutar `dotnet test --filter FeaturePermissionBehaviorTests` → deben fallar (no compila: `ForbiddenAccessException` no existe todavía).

### 1.2 Green ✓

Crear `Back/ExtractionApi/src/RFFM.Api/Domain/ForbiddenAccessException.cs`:

```csharp
namespace RFFM.Api.Domain
{
    public class ForbiddenAccessException : Exception
    {
        public ForbiddenAccessException(string message) : base(message) { }
    }
}
```

Editar `Back/ExtractionApi/src/RFFM.Api/Common/Behaviors/FeaturePermissionBehavior.cs`:
- Añadir `using RFFM.Api.Domain;` si no está.
- Cambiar el throw de la rama `permission == null` (línea ~53-55) de `UnauthorizedAccessException` a `ForbiddenAccessException`.
- Cambiar el throw de la rama `!allowed` (línea ~67-70) de `UnauthorizedAccessException` a `ForbiddenAccessException`.
- Los throws de "no autenticado" (línea 37) y "no se pudo determinar el rol" (línea 41) **no se tocan** — siguen siendo `UnauthorizedAccessException`.

Editar `Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs`, dentro de `AddCustomProblemDetails`, justo después del bloque `setup.Map<UnauthorizedAccessException>(...)` (línea ~172-177):

```csharp
setup.Map<RFFM.Api.Domain.ForbiddenAccessException>(exception =>
    new StatusCodeProblemDetails(StatusCodes.Status403Forbidden)
    {
        Title = "Acceso denegado",
        Detail = exception.Message
    });
```

Ejecutar `dotnet test --filter FeaturePermissionBehaviorTests` → deben pasar los 5 tests.

### 1.3 Refactor ✓

Revisar que no queden `using` sin usar y que el orden de `setup.Map<...>` en `ServiceCollectionExtensions.cs` sea coherente (errores de autenticación/autorización agrupados).

---

## Bloque 2 — Backend: proteger commands de club ✓

### 2.1 Red ✓

Añadir al mismo archivo `FeaturePermissionBehaviorTests.cs` (o crear `ClubCommandsPermissionTests.cs` si se prefiere separar) tests que verifiquen que los 3 commands implementan la interfaz:

```csharp
[Fact]
public void CreateClubCommand_ImplementsIRequireFeaturePermission_WithClubsRoute()
{
    var command = new RFFM.Api.Features.Coaches.Clubs.Commands.CreateClubCommand();
    var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
    Assert.Equal("/coach/clubs", requirement.FeatureRoute);
    Assert.Equal("Write", requirement.RequiredPermission);
}

[Fact]
public void UpdateClubCommand_ImplementsIRequireFeaturePermission_WithClubsRoute()
{
    var command = new RFFM.Api.Features.Coaches.Clubs.Commands.UpdateClubCommand();
    var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
    Assert.Equal("/coach/clubs", requirement.FeatureRoute);
    Assert.Equal("Write", requirement.RequiredPermission);
}

[Fact]
public void DeleteClubCommand_ImplementsIRequireFeaturePermission_WithClubsRoute()
{
    var command = new RFFM.Api.Features.Coaches.Clubs.Commands.DeleteClubCommand();
    var requirement = Assert.IsAssignableFrom<IRequireFeaturePermission>(command);
    Assert.Equal("/coach/clubs", requirement.FeatureRoute);
    Assert.Equal("Write", requirement.RequiredPermission);
}
```

Deben fallar en compilación (los commands no implementan la interfaz todavía).

### 2.2 Green ✓

En `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Commands/CreateClub.cs`:
- Añadir `using RFFM.Api.Common;` si no está.
- Cambiar `public class CreateClubCommand : IRequest, IInvalidateCacheRequest` → `public class CreateClubCommand : IRequest, IInvalidateCacheRequest, IRequireFeaturePermission` y añadir dentro de la clase:
  ```csharp
  public string FeatureRoute => "/coach/clubs";
  public string RequiredPermission => "Write";
  ```

En `UpdateClub.cs`: mismo patrón en `UpdateClubCommand`, y añadir `.RequireAuthorization()` a la cadena de `MapPut` (antes de `.DisableAntiforgery()`), igual que en `CreateClub.cs`.

En `DeleteClub.cs`: mismo patrón en `DeleteClubCommand`, y añadir `.RequireAuthorization()` a la cadena de `MapDelete`.

### 2.3 Seed ✓

En `Back/ExtractionApi/src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`, dentro de `SeedFeaturePermissionsAsync`, añadir al array `entries` (sección `// ClubDirector`, junto a las entradas existentes de `Dashboard`/`Roster`):

```csharp
("ClubManagement", "/coach/clubs", "ClubDirector", 3, true),
```

No añadir fila para `Coach` (la ausencia de fila ya produce 403 vía el comportamiento del Bloque 1).

### 2.4 Verificar ✓

```bash
cd Back/ExtractionApi
dotnet build
dotnet test
```

Todos los tests deben pasar, incluidos los 3 nuevos y los 5 de `FeaturePermissionBehaviorTests`. ✓ 53/53 tests passed

---

## Bloque 3 — Frontend: hook de permisos

### 3.1 Red

Crear `Front/src/shared/hooks/__tests__/useFeaturePermission.test.ts`:

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetMyPermissions = vi.fn();

vi.mock("../../services/permissions/permissionService", () => ({
  getMyPermissions: () => mockGetMyPermissions(),
}));

import { useFeaturePermission } from "../useFeaturePermission";

describe("useFeaturePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns hasAccess=true when the route is present in featurePermissions", async () => {
    mockGetMyPermissions.mockResolvedValue({
      role: "ClubDirector",
      featurePermissions: [{ featureName: "ClubManagement", featureRoute: "/coach/clubs", permissionType: "ReadWrite" }],
      pagePermissions: [],
    });

    const { result } = renderHook(() => useFeaturePermission("/coach/clubs"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAccess).toBe(true);
  });

  it("returns hasAccess=false when the route is absent", async () => {
    mockGetMyPermissions.mockResolvedValue({
      role: "Coach",
      featurePermissions: [{ featureName: "Dashboard", featureRoute: "/coach/dashboard", permissionType: "Read" }],
      pagePermissions: [],
    });

    const { result } = renderHook(() => useFeaturePermission("/coach/clubs"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAccess).toBe(false);
  });

  it("returns hasAccess=false when the request fails", async () => {
    mockGetMyPermissions.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useFeaturePermission("/coach/clubs"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasAccess).toBe(false);
  });
});
```

Ejecutar `npm run test -- useFeaturePermission` → debe fallar (módulos no existen).

### 3.2 Green

Crear `Front/src/shared/services/permissions/permissionService.ts`:

```typescript
import client from "../../../core/api/client";

export interface FeaturePermissionDto {
  featureName: string;
  featureRoute: string;
  permissionType: "Read" | "Write" | "ReadWrite";
}

export interface PagePermissionDto {
  pageIdentifier: string;
  permissionKey: string;
  permissionType: "Read" | "Write" | "ReadWrite";
}

export interface MyPermissionsResponse {
  role: string;
  featurePermissions: FeaturePermissionDto[];
  pagePermissions: PagePermissionDto[];
}

export async function getMyPermissions(): Promise<MyPermissionsResponse> {
  const resp = await client.get<MyPermissionsResponse>("/api/permissions/me");
  return resp.data;
}
```

Crear `Front/src/shared/hooks/useFeaturePermission.ts`:

```typescript
import { useEffect, useState } from "react";
import { getMyPermissions } from "../services/permissions/permissionService";

export function useFeaturePermission(featureRoute: string) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getMyPermissions()
      .then((res) => {
        if (!mounted) return;
        setHasAccess(res.featurePermissions.some((p) => p.featureRoute === featureRoute));
      })
      .catch(() => {
        if (mounted) setHasAccess(false);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [featureRoute]);

  return { hasAccess, loading };
}
```

Ejecutar `npm run test -- useFeaturePermission` → deben pasar los 3 tests.

---

## Bloque 4 — Frontend: tarjeta "Club" condicionada ✓

### 4.1 Red ✓

Crear `Front/src/apps/coach/pages/Dashboard/components/__tests__/DashboardCards.clubCard.test.tsx`:

```tsx
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUseFeaturePermission = vi.fn();
vi.mock("../../../../../shared/hooks/useFeaturePermission", () => ({
  useFeaturePermission: (route: string) => mockUseFeaturePermission(route),
}));

vi.mock("../../../services/configurationCoachService", () => ({ default: {} }));
vi.mock("../../hooks/useUserTeams", () => ({ useUserTeams: () => ({ teams: [], loading: false }) }));
vi.mock("../../../../../shared/services/imageService", () => ({ fetchImage: vi.fn() }));
vi.mock("../../../services/teamService", () => ({ default: {} }));
vi.mock("../../../services/clubService", () => ({ default: {} }));

import DashboardCards from "../DashboardCards";

describe("DashboardCards — tarjeta Club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no renderiza la tarjeta Club mientras loading=true", () => {
    mockUseFeaturePermission.mockReturnValue({ hasAccess: false, loading: true });
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    expect(screen.queryByText("Club")).not.toBeInTheDocument();
  });

  it("renderiza la tarjeta Club si hasAccess=true", async () => {
    mockUseFeaturePermission.mockReturnValue({ hasAccess: true, loading: false });
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Club")).toBeInTheDocument());
  });

  it("no renderiza la tarjeta Club si hasAccess=false", () => {
    mockUseFeaturePermission.mockReturnValue({ hasAccess: false, loading: false });
    render(<MemoryRouter><DashboardCards selectedSeason="" /></MemoryRouter>);
    expect(screen.queryByText("Club")).not.toBeInTheDocument();
  });
});
```

Nota para el implementer: revisar los mocks de servicios contra las dependencias reales que importa `DashboardCards.tsx` (líneas 1-13) y ajustarlos si alguno tiene una forma de export distinta (default vs named) — el objetivo del test es aislar `useFeaturePermission`, no re-testear `useUserTeams` ni los servicios de datos.

Ejecutar `npm run test -- DashboardCards.clubCard` → debe fallar (el hook no se usa todavía en el componente).

### 4.2 Green ✓

Editar `Front/src/apps/coach/pages/Dashboard/components/DashboardCards.tsx`:
- Añadir import: `import { useFeaturePermission } from "../../../../../shared/hooks/useFeaturePermission";`
- Dentro del componente, junto a los demás hooks: `const { hasAccess: canManageClub } = useFeaturePermission("/coach/clubs");`
- Sustituir la condición de la tarjeta "Club" (líneas 148-155): cambiar `{!isPlayer && (` por `{canManageClub && (` en ese bloque específico (el de `title="Club"`). **No tocar** la condición `!isPlayer` de la tarjeta "Configuración" (líneas 140-147), que no cambia.

### 4.3 Refactor ✓

Confirmar que el resto de tarjetas del dashboard no cambiaron de comportamiento. Ejecutar la suite completa de `DashboardCards`/`Dashboard` para detectar regresiones:

```bash
cd Front
npm run test -- Dashboard
npm run build
```

✓ All Dashboard tests pass (9/9). Build successful.

---

## Bloque 5 — Verificación final

```bash
# Backend
cd Back/ExtractionApi
dotnet build
dotnet test

# Frontend
cd Front
npm run build
npm run test
```

Manual (requiere backend + frontend corriendo):
1. Login como `Coach` sin `ClubDirector` → dashboard no debe mostrar la tarjeta "Club".
2. Con el token de ese `Coach`, `PUT https://localhost:7287/api/catalog/club/{id}` (Postman/curl) → 403 `ProblemDetails` con `title: "Acceso denegado"`.
3. Sin token, cualquier endpoint de club → 401.
4. Login como `ClubDirector` → dashboard muestra la tarjeta "Club"; crear/editar club funciona (200).

Si todo pasa: `openspec validate restrict-club-management-access` y mover la carpeta a `openspec/changes/archive/2026-07-12-restrict-club-management-access/`.
