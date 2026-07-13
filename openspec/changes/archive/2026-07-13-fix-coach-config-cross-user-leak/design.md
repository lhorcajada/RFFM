## Architecture Decisions

### 1. Scoping por usuario vía `ICurrentUserService` (no parseo manual de claims en la ruta)

El repo tiene dos patrones para obtener el usuario autenticado:
- Manual en la ruta (`GetUserClubs.cs`, `GetMyPermissions.cs`): `httpContext.User.Claims.FirstOrDefault(...)`.
- Inyectado por DI (`GetMyPermissionsHandler`, `SeasonAccess/*.cs`): `ICurrentUserService.UserId` dentro del handler.

Se usa el segundo patrón (`ICurrentUserService`) porque es más reciente, evita repetir el parseo de claims en cada endpoint, y mantiene el handler testeable con `Mock<ICurrentUserService>` (ya usado en `FeaturePermissionBehaviorTests`). El `MapGet/MapPost/MapPut/MapDelete` solo añade `.RequireAuthorization()`; no necesita leer `HttpContext` ni pasar `userId` como parámetro del command/query — el handler lo obtiene de `_currentUser.UserId`.

### 2. `GetConfigQuery` — filtrar por `CoachId`

```csharp
// ConfigurationCoach.cs
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

`MapGet` añade `.RequireAuthorization()`. En la práctica devuelve como mucho 1 fila (un coach tiene una sola configuración), pero se mantiene `ConfigDto[]` para no romper el contrato existente del frontend.

### 3. `CreateConfigCommand` — ignorar `CoachId` del body, usar el del token

Hoy `ConfigRequest.CoachId` viene del cliente sin validar — un coach podría enviar el `CoachId` de otro y crear/asociar una fila a su nombre. Se cambia el handler para descartar `request.Request.CoachId` y usar siempre `_currentUser.UserId`:

```csharp
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
```

`ConfigRequest.CoachId` se mantiene en el DTO por compatibilidad con el frontend actual (que sigue enviándolo), simplemente se ignora en el handler. No se toca el frontend en este punto — no es necesario cambiar el payload que envía, solo dejar de confiar en él en el backend.

### 4. `UpdateConfigCommand`/`DeleteConfigCommand` — verificar propiedad antes de modificar

```csharp
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
```

Mismo patrón (`if (entity.CoachId != userId) throw new ForbiddenAccessException(...)`) en `DeleteConfigHandler`, antes de `_db.Remove(entity)`. `ForbiddenAccessException` ya existe y ya está mapeada a 403 (`ServiceCollectionExtensions.cs`, de un cambio previo) — no requiere infraestructura nueva.

**Fuera de alcance**: `KeyNotFoundException` en este archivo no está mapeada explícitamente en `AddCustomProblemDetails` (cae al catch-all `Exception` → 500). Es un comportamiento preexistente en los 2 handlers y no forma parte de los criterios de aceptación de este cambio (que son sobre fuga de datos entre coaches, no sobre el código HTTP de "no encontrado"). No se toca.

### 5. Todos los `MapGet/MapPost/MapPut/MapDelete` requieren autenticación

```csharp
app.MapGet("/api/coaches/configuration", ...).RequireAuthorization();
app.MapPost("/api/coaches/configuration", ...).RequireAuthorization();
app.MapPut("/api/coaches/configuration/{id}", ...).RequireAuthorization();
app.MapDelete("/api/coaches/configuration/{id}", ...).RequireAuthorization();
```

### 6. Frontend — quitar el fallback a `configs[0]`

`Front/src/apps/coach/services/configurationCoachService.ts`, `getCurrent()`: como el backend ahora solo devuelve fila(s) del coach autenticado, la búsqueda por `coachId` ya no aporta nada (todo lo que devuelve `getAll()` es del coach actual) y el fallback a "cualquier fila" es justo el bug. Se simplifica a:

```typescript
const getCurrent = async (): Promise<ConfigurationCoachDto | null> => {
  const configs = await getAll();
  return configs[0] ?? null;
};
```

Se elimina el import de `coachAuthService` en este archivo si `getUserId()` no se usa en ningún otro punto del mismo (verificar antes de borrar el import).

No se toca `Settings.tsx` ni `SeasonOption`/`SeasonManager` — su lógica de "sin `clubId` → sin temporadas" ya es correcta; el bug estaba enteramente en el origen del `preferredClubId` cruzado.

### 7. Verificación del flujo "crear temporada nueva sin ninguna existente"

El usuario confirma que la opción de crear temporada ya existe (`SeasonManager.tsx` / `SeasonOption`). No se toca código: se verifica manualmente en el bloque de verificación final (ver `tasks.md`) que un coach nuevo, tras el fix, puede pulsar "crear temporada" desde Configuración → Temporadas y que la temporada creada queda asociada a su propio club, sin ver ni afectar a las de otros coaches.

## Files

**Backend** (modificados):
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Settings/ConfigurationCoach.cs` (los 4 endpoints + los 4 handlers)

**Frontend** (modificados):
- `Front/src/apps/coach/services/configurationCoachService.ts` (`getCurrent()`)

**Backend** (sin cambios, reutilizados):
- `Back/ExtractionApi/src/RFFM.Api/Domain/Services/ICurrentUserService.cs`
- `Back/ExtractionApi/src/RFFM.Api/Domain/ForbiddenAccessException.cs`

## Tests (TDD — Red → Green → Refactor)

**Backend** (`RFFM.Api.Tests`, xUnit + Moq, patrón `PostgresContainerFixture` como en `FeaturePermissionBehaviorTests`):
- `GetConfigHandlerTests`: dado que existen filas `ConfigurationCoach` de 2 coaches distintos en la BD, `Handle` con `ICurrentUserService.UserId = coachA` devuelve **solo** la fila de `coachA` (nunca la de `coachB`); si `coachA` no tiene fila, devuelve array vacío (nunca la de otro coach).
- `CreateConfigHandlerTests`: si `request.Request.CoachId` viene con un id distinto al de `_currentUser.UserId`, la entidad creada usa `_currentUser.UserId` (el del token), no el del body.
- `UpdateConfigHandlerTests`: actualizar una fila que pertenece a otro coach → `ForbiddenAccessException`; actualizar la fila propia → éxito.
- `DeleteConfigHandlerTests`: borrar una fila que pertenece a otro coach → `ForbiddenAccessException`; borrar la fila propia → éxito.

**Frontend** (Vitest + Testing Library):
- `configurationCoachService.test.ts`: `getCurrent()` devuelve `configs[0]` cuando `getAll()` devuelve 1 fila; devuelve `null` cuando `getAll()` devuelve `[]` (caso coach nuevo); no existe ya ningún camino que devuelva una fila cuyo `coachId` no coincida con el usuario actual.

Coverage objetivo: handlers backend ≥80% (según CLAUDE.md, lógica de autorización por propietario).
