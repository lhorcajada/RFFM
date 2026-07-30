## Architecture Decisions

### 1. Cómo determinar si el usuario puede ver el `invitationCode`

Dos condiciones (OR), evaluadas por request en el handler:

1. **Rol global de Identity `Administrator`**: `httpContext.User.IsInRole(AppRoles.Administrator.Name)`.
2. **`ClubDirector` de ese club concreto**: se consulta `UserClubs` (igual patrón que `GetUserClub.cs`) filtrando por `ApplicationUserId == userId && ClubId == request.ClubId && RoleId == Membership.Directive.Id`.

Se usa `UserClubs.RoleId` (Membership por club) y no el rol global de Identity `ClubDirector`, porque el rol de Identity no está necesariamente scoped a un club concreto (un usuario podría ser `ClubDirector` de un club A pero solo `Coach` en un club B); `UserClubs` es la fuente de verdad ya usada en el resto de la feature de invitaciones (`MembershipIdentityRoles.cs`, `GetUserClub.cs`).

Función compartida para evitar duplicar la lógica entre `GetClub` y `GetClubs`:

```csharp
// Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/ClubInvitationCodeVisibility.cs
namespace RFFM.Api.Features.Coaches.Clubs
{
    public static class ClubInvitationCodeVisibility
    {
        public static async Task<bool> CanViewAsync(
            AppDbContext db, ClaimsPrincipal user, string clubId, CancellationToken cancellationToken)
        {
            if (user.IsInRole(AppRoles.Administrator.Name))
                return true;

            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                          ?? user.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId))
                return false;

            return await db.UserClubs.AnyAsync(uc =>
                uc.ApplicationUserId == userId &&
                uc.ClubId == clubId &&
                uc.RoleId == Membership.Directive.Id,
                cancellationToken);
        }

        // Para GetClubs: evita N consultas, una sola query para todos los clubs del usuario
        public static async Task<HashSet<string>> DirectorClubIdsAsync(
            AppDbContext db, ClaimsPrincipal user, CancellationToken cancellationToken)
        {
            var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                         ?? user.FindFirst("sub")?.Value;
            if (string.IsNullOrEmpty(userId))
                return new HashSet<string>();

            return (await db.UserClubs
                .Where(uc => uc.ApplicationUserId == userId && uc.RoleId == Membership.Directive.Id)
                .Select(uc => uc.ClubId)
                .ToListAsync(cancellationToken))
                .ToHashSet();
        }
    }
}
```

Usuario no autenticado (`httpContext.User` sin claims — ambos endpoints son hoy anónimos, sin `.RequireAuthorization()`) → `userId` vacío → `CanViewAsync` devuelve `false` → `invitationCode = null`. Coherente con el criterio de aceptación ("cualquier rol salvo Administrator/ClubDirector recibe null"); no se añade `.RequireAuthorization()` a estos endpoints en este cambio (fuera de alcance, no lo pidió el usuario).

### 2. `GetClub.cs` — inyectar `HttpContext` y aplicar la regla

```csharp
app.MapGet("/api/catalog/club/{id}",
    async (string id, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
    {
        var canViewCode = await ClubInvitationCodeVisibility.CanViewAsync(/* ... */); // ver nota cache abajo
        var query = new GetClubQueryApp { ClubId = id, CanViewInvitationCode = canViewCode };
        return await mediator.Send(query, cancellationToken);
    })
```

`GetClubQueryApp` gana un campo `CanViewInvitationCode` (bool, no viene del cliente, se calcula en el endpoint) que:
- Se usa en el handler para devolver `club.InvitationCode` o `null`.
- Forma parte de `CacheKey` (ver punto 3).

```csharp
public record GetClubQueryApp : Common.IQueryApp<GetClubResponse>, ICacheRequest
{
    public string ClubId { get; set; }
    public bool CanViewInvitationCode { get; set; }
    public string CacheKey => $"{ClubConstants.CachePrefix}:{ClubId}:{(CanViewInvitationCode ? "priv" : "pub")}";
    public DateTime? AbsoluteExpirationRelativeToNow { get; }
}
```

Handler: `return new GetClubResponse(..., CanViewInvitationCode ? club.InvitationCode : null);`

### 3. Por qué hay que tocar el `CacheKey` (bug de caché pre-existente que este cambio expone)

`GetClub`/`GetClubs` usan `EasyCaching.InMemory` (`ICacheRequest`, 1h) con una clave que **no distingue por usuario/rol**: `GetClub` cachea por `ClubId` únicamente, `GetClubs` cachea con una clave global fija. Si no se corrige, el primer usuario que pide un club queda "grabado" en caché para todos los demás durante 1h — hoy es solo un desperdicio de cache-hit (todos ven el mismo `invitationCode` real, sin problema porque hoy es público), pero en cuanto el campo depende del rol del caller se convertiría en una fuga de datos (un `ClubDirector` consulta primero → todos ven el código real durante 1h) o en una regresión funcional (un no-privilegiado consulta primero → el propio director ve `null` hasta que expire la caché).

Solución: la dimensión "¿puede ver el código?" (`priv`/`pub`) se añade como sufijo del `CacheKey`, de forma que existen como máximo 2 entradas cacheadas por club/lista — una para viewers privilegiados y otra para el resto — y ambas se siguen invalidando correctamente porque el prefijo (`ClubConstants.CachePrefix`) no cambia y `CreateClub`/`UpdateClub`/`DeleteClub` invalidan por prefijo (`IInvalidateCacheRequest.PrefixCacheKey`), no por clave exacta.

### 4. `GetClubs.cs` — mismo patrón, resuelto en una sola query

```csharp
app.MapGet("/api/catalog/clubs",
    async (HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
    {
        // el propio handler resuelve DirectorClubIdsAsync + IsInRole Administrator vía inyección de HttpContext,
        // igual que GetClub, para no duplicar la resolución en el endpoint
        return await mediator.Send(new ClubsQueryApp { CanViewAllInvitationCodes = httpContext.User.IsInRole(AppRoles.Administrator.Name) }, cancellationToken);
    })
```

En el handler: si `CanViewAllInvitationCodes` es `true`, todos los clubs devuelven su `invitationCode` real; si no, se resuelve `DirectorClubIdsAsync` (una query) y solo los clubs cuyo `Id` esté en ese set devuelven el código real, el resto `null`. `CacheKey` gana el mismo sufijo `:priv`/`:pub`, pero como "administrador ve todo" y "no-admin ve solo lo suyo" son respuestas *distintas por usuario* incluso dentro de "pub" (dos directores de clubes distintos verían códigos distintos), cachear esta lista por el sufijo binario **no es correcto de forma general**. Dado que hoy `GetClubs` (plural) no tiene ningún consumidor en frontend (solo `GetClub` singular se usa, desde `ClubSelector.tsx`), se resuelve quitando `ICacheRequest` de `ClubsQueryApp` en este cambio en vez de diseñar un esquema de cache por-usuario — evita cachear datos incorrectos por usuario sin complejizar la solución para un endpoint sin tráfico real. Si en el futuro se usa desde frontend con volumen, se puede revisar cache por-usuario aparte.

### 5. Frontend — ocultar la columna cuando el valor es `null`

`ClubSelector.tsx` ya recibe `club.invitationCode` como `string | null`. Cambios:

- Tabla (desktop): la celda deja de renderizar `club.invitationCode ?? "-"` (línea 427) — si **todos** los clubs cargados tienen `invitationCode === null` (usuario sin privilegio en ninguno), la columna `<TableCell>Código de invitación</TableCell>` del `<TableHead>` (línea 406) tampoco se renderiza. Se calcula `const anyClubHasInvitationCode = clubs.some(c => c.invitationCode != null);` y se usa para condicionar tanto el `<TableHead>` como cada `<TableCell>` de la fila.
- Tarjeta compacta (`SettingsRowCard`, `fields` array, línea 367): el objeto `{ label: "Código de invitación", value: ... }` se omite del array cuando `club.invitationCode == null`, en vez de mostrar `"-"`.

No hace falta ningún permiso/hook nuevo en frontend — el campo ya viene resuelto (`null` o el código real) desde la API.

## Files

**Backend** (nuevos):
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/ClubInvitationCodeVisibility.cs`

**Backend** (modificados):
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Queries/GetClub.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Queries/GetClubs.cs`

**Frontend** (modificados):
- `Front/src/apps/coach/pages/settings/components/ClubSelector/ClubSelector.tsx`

## Tests (TDD — Red → Green → Refactor)

**Backend** (`RFFM.Api.Tests`, xUnit + Moq, InMemory/Sqlite `AppDbContext` para las queries EF):
- `ClubInvitationCodeVisibilityTests`: `Administrator` → `true` sin consultar `UserClubs`; `ClubDirector` (RoleId=Directive) del club solicitado → `true`; usuario con otra membership (`Coach`, `ClubMember`, etc.) en ese club → `false`; `ClubDirector` de **otro** club → `false` para el club solicitado; sin `userId` (no autenticado) → `false`.
- `GetClubHandlerTests`: `CanViewInvitationCode = true` → `GetClubResponse.invitationCode` = valor real; `false` → `null`.
- `GetClubsHandlerTests`: admin ve `invitationCode` real en todos los elementos; no-admin ve `null` salvo en los clubs donde es `Directive`.
- Test de `CacheKey`: distinto para `CanViewInvitationCode=true` vs `false` sobre el mismo `ClubId` (evita el bug de fuga descrito en el punto 3).

**Frontend** (Vitest + Testing Library):
- `ClubSelector.test.tsx`: con `invitationCode: null` en todos los clubs, la columna/campo "Código de invitación" no aparece en el DOM (ni en tabla ni en vista compacta); con al menos un club con código no nulo, la columna aparece y muestra el valor solo para ese club (los `null` se ven vacíos/omitidos en su fila, no la columna entera).

Coverage objetivo: handlers backend ≥80%, componente frontend ≥75% (según CLAUDE.md).
