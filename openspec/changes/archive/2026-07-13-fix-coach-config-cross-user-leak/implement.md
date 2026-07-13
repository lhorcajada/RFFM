# Implement — fix-coach-config-cross-user-leak

Script técnico para el agente `openspec-implementer`. Sigue TDD estricto (Red → Green → Refactor) en cada bloque. No avances al siguiente bloque sin que los tests del bloque actual pasen.

Convenciones detectadas en el repo a respetar:
- Tests backend en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/`, xUnit, `#nullable enable`, namespace `RFFM.Api.Tests.UnitTests`.
- Tests que necesitan `AppDbContext` usan `PostgresContainerFixture` real (colección `PostgresCollection.Name`), no InMemory — ver `CreateUserHandlerTests.cs` y `FeaturePermissionBehaviorTests.cs`.
- Tests frontend co-ubicados en `__tests__/` junto al archivo, Vitest + Testing Library, `vi.mock(...)` para servicios.
- Entidad: `RFFM.Api.Domain.Entities.Coaches.ConfigurationCoach { int Id; string CoachId; string? PreferredClubId; string? PreferredTeamId; }`.
- `ICurrentUserService` (`RFFM.Api.Domain.Services`) expone `UserId`, `Role`, `IsAuthenticated`; se mockea con `Moq` (`Mock<ICurrentUserService>`).
- `ForbiddenAccessException` (`RFFM.Api.Domain`) ya existe y ya está mapeada a 403 en `ServiceCollectionExtensions.AddCustomProblemDetails` — no crear nada nuevo, solo lanzarla.

---

## Bloque 1 — Backend: `GetConfigHandler` filtra por usuario

### 1.1 Red

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/ConfigurationCoachHandlerTests.cs`:

```csharp
#nullable enable
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Coaches;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Settings;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class ConfigurationCoachHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public ConfigurationCoachHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<ICurrentUserService> CurrentUser(string userId)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(userId);
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            return mock;
        }

        [Fact]
        public async Task GetConfig_ReturnsOnlyOwnRow_NeverAnotherCoachsRow()
        {
            await using var db = _fixture.CreateDbContext();
            var coachA = $"coachA-{Guid.NewGuid():N}";
            var coachB = $"coachB-{Guid.NewGuid():N}";
            db.Set<ConfigurationCoach>().Add(new ConfigurationCoach { CoachId = coachA, PreferredClubId = "club-A" });
            db.Set<ConfigurationCoach>().Add(new ConfigurationCoach { CoachId = coachB, PreferredClubId = "club-B" });
            await db.SaveChangesAsync();

            var handler = new ConfigurationCoachModule.GetConfigHandler(db, CurrentUser(coachA).Object);
            var result = await handler.Handle(new ConfigurationCoachModule.GetConfigQuery(), CancellationToken.None);

            Assert.Single(result);
            Assert.Equal(coachA, result[0].CoachId);
            Assert.Equal("club-A", result[0].PreferredClubId);
        }

        [Fact]
        public async Task GetConfig_NewCoachWithoutOwnRow_ReturnsEmptyArray()
        {
            await using var db = _fixture.CreateDbContext();
            var otherCoach = $"other-{Guid.NewGuid():N}";
            db.Set<ConfigurationCoach>().Add(new ConfigurationCoach { CoachId = otherCoach, PreferredClubId = "club-X" });
            await db.SaveChangesAsync();

            var newCoach = $"new-{Guid.NewGuid():N}";
            var handler = new ConfigurationCoachModule.GetConfigHandler(db, CurrentUser(newCoach).Object);
            var result = await handler.Handle(new ConfigurationCoachModule.GetConfigQuery(), CancellationToken.None);

            Assert.Empty(result);
        }

        [Fact]
        public async Task CreateConfig_IgnoresCoachIdFromBody_UsesTokenUserId()
        {
            await using var db = _fixture.CreateDbContext();
            var tokenUserId = $"token-{Guid.NewGuid():N}";
            var spoofedCoachId = $"spoofed-{Guid.NewGuid():N}";

            var handler = new ConfigurationCoachModule.CreateConfigHandler(db, CurrentUser(tokenUserId).Object);
            var request = new ConfigurationCoachModule.ConfigRequest(spoofedCoachId, "club-1", null);
            var result = await handler.Handle(new ConfigurationCoachModule.CreateConfigCommand(request), CancellationToken.None);

            Assert.Equal(tokenUserId, result.CoachId);
            Assert.NotEqual(spoofedCoachId, result.CoachId);
        }

        [Fact]
        public async Task UpdateConfig_OnAnotherCoachsRow_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var owner = $"owner-{Guid.NewGuid():N}";
            var attacker = $"attacker-{Guid.NewGuid():N}";
            var entity = new ConfigurationCoach { CoachId = owner, PreferredClubId = "club-owner" };
            db.Set<ConfigurationCoach>().Add(entity);
            await db.SaveChangesAsync();

            var handler = new ConfigurationCoachModule.UpdateConfigHandler(db, CurrentUser(attacker).Object);
            var request = new ConfigurationCoachModule.ConfigRequest(attacker, "club-attacker", null);

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(new ConfigurationCoachModule.UpdateConfigCommand(entity.Id, request), CancellationToken.None));
        }

        [Fact]
        public async Task UpdateConfig_OnOwnRow_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var owner = $"owner-{Guid.NewGuid():N}";
            var entity = new ConfigurationCoach { CoachId = owner, PreferredClubId = "club-old" };
            db.Set<ConfigurationCoach>().Add(entity);
            await db.SaveChangesAsync();

            var handler = new ConfigurationCoachModule.UpdateConfigHandler(db, CurrentUser(owner).Object);
            var request = new ConfigurationCoachModule.ConfigRequest(owner, "club-new", null);
            var result = await handler.Handle(new ConfigurationCoachModule.UpdateConfigCommand(entity.Id, request), CancellationToken.None);

            Assert.Equal("club-new", result.PreferredClubId);
        }

        [Fact]
        public async Task DeleteConfig_OnAnotherCoachsRow_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var owner = $"owner-{Guid.NewGuid():N}";
            var attacker = $"attacker-{Guid.NewGuid():N}";
            var entity = new ConfigurationCoach { CoachId = owner, PreferredClubId = "club-owner" };
            db.Set<ConfigurationCoach>().Add(entity);
            await db.SaveChangesAsync();

            var handler = new ConfigurationCoachModule.DeleteConfigHandler(db, CurrentUser(attacker).Object);

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(new ConfigurationCoachModule.DeleteConfigCommand(entity.Id), CancellationToken.None));
        }

        [Fact]
        public async Task DeleteConfig_OnOwnRow_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var owner = $"owner-{Guid.NewGuid():N}";
            var entity = new ConfigurationCoach { CoachId = owner, PreferredClubId = "club-owner" };
            db.Set<ConfigurationCoach>().Add(entity);
            await db.SaveChangesAsync();

            var handler = new ConfigurationCoachModule.DeleteConfigHandler(db, CurrentUser(owner).Object);
            var result = await handler.Handle(new ConfigurationCoachModule.DeleteConfigCommand(entity.Id), CancellationToken.None);

            Assert.Equal(entity.Id, result.Id);
        }
    }
}
```

Ejecutar `dotnet test --filter ConfigurationCoachHandlerTests` → deben fallar en compilación (los handlers actuales no tienen constructor con `ICurrentUserService`, y `GetConfigHandler` no filtra).

### 1.2 Green

Editar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Settings/ConfigurationCoach.cs`:

1. Añadir `using RFFM.Api.Domain;` y `using RFFM.Api.Domain.Services;` en la cabecera.
2. En `AddRoutes`, añadir `.RequireAuthorization()` a los 4 endpoints (`MapGet`, `MapPost`, `MapPut`, `MapDelete`), encadenado tras `.WithTags("Coaches")`.
3. `GetConfigHandler`:
   ```csharp
   public class GetConfigHandler : IRequestHandler<GetConfigQuery, ConfigDto[]>
   {
       private readonly AppDbContext _db;
       private readonly ICurrentUserService _currentUser;

       public GetConfigHandler(AppDbContext db, ICurrentUserService currentUser)
       {
           _db = db;
           _currentUser = currentUser;
       }

       public async ValueTask<ConfigDto[]> Handle(GetConfigQuery request, CancellationToken cancellationToken = default)
       {
           var userId = _currentUser.UserId ?? string.Empty;
           var items = await _db.Set<RFFM.Api.Domain.Entities.Coaches.ConfigurationCoach>()
               .AsNoTracking()
               .Where(c => c.CoachId == userId)
               .ToListAsync(cancellationToken);
           return items.Select(i => new ConfigDto(i.Id, i.CoachId, i.PreferredClubId, i.PreferredTeamId)).ToArray();
       }
   }
   ```
4. `CreateConfigHandler`:
   ```csharp
   public class CreateConfigHandler : IRequestHandler<CreateConfigCommand, ConfigDto>
   {
       private readonly AppDbContext _db;
       private readonly ICurrentUserService _currentUser;

       public CreateConfigHandler(AppDbContext db, ICurrentUserService currentUser)
       {
           _db = db;
           _currentUser = currentUser;
       }

       public async ValueTask<ConfigDto> Handle(CreateConfigCommand request, CancellationToken cancellationToken = default)
       {
           var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException();
           var entity = new RFFM.Api.Domain.Entities.Coaches.ConfigurationCoach
           {
               CoachId = userId,
               PreferredClubId = request.Request.PreferredClubId,
               PreferredTeamId = request.Request.PreferredTeamId
           };
           _db.Add(entity);
           await _db.SaveChangesAsync(cancellationToken);
           return new ConfigDto(entity.Id, entity.CoachId, entity.PreferredClubId, entity.PreferredTeamId);
       }
   }
   ```
5. `UpdateConfigHandler`:
   ```csharp
   public class UpdateConfigHandler : IRequestHandler<UpdateConfigCommand, ConfigDto>
   {
       private readonly AppDbContext _db;
       private readonly ICurrentUserService _currentUser;

       public UpdateConfigHandler(AppDbContext db, ICurrentUserService currentUser)
       {
           _db = db;
           _currentUser = currentUser;
       }

       public async ValueTask<ConfigDto> Handle(UpdateConfigCommand request, CancellationToken cancellationToken = default)
       {
           var userId = _currentUser.UserId ?? throw new UnauthorizedAccessException();
           var entity = await _db.Set<RFFM.Api.Domain.Entities.Coaches.ConfigurationCoach>()
               .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);
           if (entity == null) throw new KeyNotFoundException();
           if (entity.CoachId != userId) throw new ForbiddenAccessException("No puedes modificar la configuración de otro entrenador.");

           entity.PreferredClubId = request.Request.PreferredClubId;
           entity.PreferredTeamId = request.Request.PreferredTeamId;
           await _db.SaveChangesAsync(cancellationToken);
           return new ConfigDto(entity.Id, entity.CoachId, entity.PreferredClubId, entity.PreferredTeamId);
       }
   }
   ```
6. `DeleteConfigHandler`: mismo patrón que `UpdateConfigHandler` (inyectar `ICurrentUserService`, comprobar `entity.CoachId != userId` antes de `_db.Remove(entity)` y lanzar `ForbiddenAccessException` si no coincide).

Ejecutar `dotnet test --filter ConfigurationCoachHandlerTests` → deben pasar los 7 tests.

### 1.3 Refactor

Revisar que no queden `using` sin usar. Confirmar que `Mediator`/DI resuelve `ICurrentUserService` para estos handlers sin registro adicional (ya está registrado globalmente, usado por `GetMyPermissionsHandler` y `FeaturePermissionBehavior`).

Ejecutar suite completa:
```bash
cd Back/ExtractionApi
dotnet build
dotnet test
```

---

## Bloque 2 — Frontend: quitar fallback cruzado

### 2.1 Red

Crear `Front/src/apps/coach/services/__tests__/configurationCoachService.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

import configurationCoachService from "../configurationCoachService";

describe("configurationCoachService.getCurrent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the coach's own row when getAll() returns exactly one row", async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 1, coachId: "coach-A", preferredClubId: "club-A", preferredTeamId: null }],
    });

    const result = await configurationCoachService.getCurrent();

    expect(result).toEqual({ id: 1, coachId: "coach-A", preferredClubId: "club-A", preferredTeamId: null });
  });

  it("returns null when getAll() returns no rows (new coach)", async () => {
    mockGet.mockResolvedValue({ data: [] });

    const result = await configurationCoachService.getCurrent();

    expect(result).toBeNull();
  });
});
```

Ajustar la ruta del `vi.mock` del cliente Axios (`../../../../core/api/client`) al import real usado por `configurationCoachService.ts` (verificar el número de `../` según la profundidad del nuevo archivo `__tests__/`).

Ejecutar `npm run test -- configurationCoachService` → el primer caso pasará ya con el código actual (porque hay 1 sola fila propia); el segundo caso (`getAll()` vacío) también pasa hoy porque `configs[0] ?? null` con array vacío ya da `null`. **Nota para el implementer**: el test no puede "fallar" de forma determinista contra el bug (que requiere 2 coaches reales en BD, no mockeable a este nivel de unidad); su propósito es fijar el contrato de `getCurrent()` antes de simplificar el código y evitar una regresión futura. Confirmar que pasa igual antes y después del cambio 2.2 (Green es una refactorización seguidoa, no una corrección de un test rojo en este bloque frontend).

### 2.2 Green

Editar `Front/src/apps/coach/services/configurationCoachService.ts`:
- Eliminar el import `import { coachAuthService } from "./authService";` (confirmado que no se usa en ningún otro punto del archivo).
- Simplificar `getCurrent()`:
  ```typescript
  const getCurrent = async (): Promise<ConfigurationCoachDto | null> => {
    const configs = await getAll();
    return configs[0] ?? null;
  };
  ```

### 2.3 Verificar

```bash
cd Front
npm run test -- configurationCoachService
npm run build
```

---

## Bloque 3 — Verificación final

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

Manual (requiere backend + frontend corriendo, y 2 cuentas Coach reales):
1. Login como Coach A (con club/temporada ya configurados) → Configuración → ve su propia temporada.
2. Registrar un Coach B nuevo → login → Configuración → Temporadas → lista vacía (no ve la de Coach A).
3. Con el token de Coach B, `PUT https://localhost:7287/api/coaches/configuration/{idDeConfigDeCoachA}` → 403 `ProblemDetails`.
4. Sin token, `GET https://localhost:7287/api/coaches/configuration` → 401.
5. Coach B: usar el flujo existente "crear temporada" desde Configuración → Temporadas → confirmar que la temporada se crea y queda asociada a su propio club.

Si todo pasa: `openspec validate fix-coach-config-cross-user-leak` y mover la carpeta a `openspec/changes/archive/2026-07-13-fix-coach-config-cross-user-leak/`.
