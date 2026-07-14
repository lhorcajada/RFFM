# Implement — restrict-club-invitation-code-visibility

Script técnico para el agente `openspec-implementer`. TDD estricto (Red → Green → Refactor) por bloque. No avances al siguiente bloque sin que los tests del bloque actual pasen.

Convenciones detectadas en el repo:
- Tests backend en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/`, xUnit, `#nullable enable`, namespace `RFFM.Api.Tests.UnitTests`.
- Tests que necesitan `AppDbContext` usan `PostgresContainerFixture` real (`[Collection(PostgresCollection.Name)]`), no InMemory — ver `TeamInvitationValidationTests.cs`. País id `1` y `Category.NationalCategory` ya están seedeados por la migración inicial.
- Tests frontend co-ubicados en `__tests__/` junto al archivo, Vitest + Testing Library.

---

## Bloque 1 — Backend: `ClubInvitationCodeVisibility` ✅

### 1.1 Red ✅

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/ClubInvitationCodeVisibilityTests.cs`:

```csharp
#nullable enable
using System.Security.Claims;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Clubs;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class ClubInvitationCodeVisibilityTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubInvitationCodeVisibilityTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static ClaimsPrincipal PrincipalFor(string userId, params string[] roles)
        {
            var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId) };
            claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
            var identity = new ClaimsIdentity(claims, "TestAuth", ClaimTypes.Name, ClaimTypes.Role);
            return new ClaimsPrincipal(identity);
        }

        private static async Task<Club> SeedClubAsync(RFFM.Api.Infrastructure.Persistence.AppDbContext db, string name)
        {
            var club = Club.Create(name, SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();
            return club;
        }

        [Fact]
        public async Task CanViewAsync_Administrator_ReturnsTrueWithoutClubMembership()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Admin Test");
            var user = PrincipalFor(Guid.NewGuid().ToString(), AppRoles.Administrator.Name);

            var result = await ClubInvitationCodeVisibility.CanViewAsync(db, user, club.Id, CancellationToken.None);

            Assert.True(result);
        }

        [Fact]
        public async Task CanViewAsync_ClubDirectorOfThatClub_ReturnsTrue()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Director Test");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Directive.Id));
            await db.SaveChangesAsync();
            var user = PrincipalFor(userId);

            var result = await ClubInvitationCodeVisibility.CanViewAsync(db, user, club.Id, CancellationToken.None);

            Assert.True(result);
        }

        [Fact]
        public async Task CanViewAsync_CoachMembershipOfThatClub_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Coach Test");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var user = PrincipalFor(userId);

            var result = await ClubInvitationCodeVisibility.CanViewAsync(db, user, club.Id, CancellationToken.None);

            Assert.False(result);
        }

        [Fact]
        public async Task CanViewAsync_ClubDirectorOfAnotherClub_ReturnsFalseForRequestedClub()
        {
            await using var db = _fixture.CreateDbContext();
            var ownClub = await SeedClubAsync(db, "Club Own");
            var otherClub = await SeedClubAsync(db, "Club Other");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, ownClub.Id, Membership.Directive.Id));
            await db.SaveChangesAsync();
            var user = PrincipalFor(userId);

            var result = await ClubInvitationCodeVisibility.CanViewAsync(db, user, otherClub.Id, CancellationToken.None);

            Assert.False(result);
        }

        [Fact]
        public async Task CanViewAsync_NotAuthenticated_ReturnsFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Anon Test");
            var anonymous = new ClaimsPrincipal(new ClaimsIdentity());

            var result = await ClubInvitationCodeVisibility.CanViewAsync(db, anonymous, club.Id, CancellationToken.None);

            Assert.False(result);
        }

        [Fact]
        public async Task DirectorClubIdsAsync_ReturnsOnlyClubsWhereUserIsDirective()
        {
            await using var db = _fixture.CreateDbContext();
            var directedClub = await SeedClubAsync(db, "Club Directed");
            var coachClub = await SeedClubAsync(db, "Club Coach Only");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, directedClub.Id, Membership.Directive.Id));
            db.UserClubs.Add(new UserClub(userId, coachClub.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var user = PrincipalFor(userId);

            var result = await ClubInvitationCodeVisibility.DirectorClubIdsAsync(db, user, CancellationToken.None);

            Assert.Contains(directedClub.Id, result);
            Assert.DoesNotContain(coachClub.Id, result);
        }
    }
}
```

Ejecutar `dotnet test --filter ClubInvitationCodeVisibilityTests` → deben fallar en compilación (`ClubInvitationCodeVisibility` no existe).

### 1.2 Green ✅

Crear `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/ClubInvitationCodeVisibility.cs`:

```csharp
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Clubs
{
    public static class ClubInvitationCodeVisibility
    {
        public static async Task<bool> CanViewAsync(
            AppDbContext db, ClaimsPrincipal user, string clubId, CancellationToken cancellationToken)
        {
            if (user.IsInRole(AppRoles.Administrator.Name))
                return true;

            var userId = GetUserId(user);
            if (string.IsNullOrEmpty(userId))
                return false;

            return await db.UserClubs.AnyAsync(uc =>
                uc.ApplicationUserId == userId &&
                uc.ClubId == clubId &&
                uc.RoleId == Membership.Directive.Id,
                cancellationToken);
        }

        public static async Task<HashSet<string>> DirectorClubIdsAsync(
            AppDbContext db, ClaimsPrincipal user, CancellationToken cancellationToken)
        {
            var userId = GetUserId(user);
            if (string.IsNullOrEmpty(userId))
                return new HashSet<string>();

            var clubIds = await db.UserClubs
                .Where(uc => uc.ApplicationUserId == userId && uc.RoleId == Membership.Directive.Id)
                .Select(uc => uc.ClubId)
                .ToListAsync(cancellationToken);

            return clubIds.ToHashSet();
        }

        private static string? GetUserId(ClaimsPrincipal user) =>
            user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
    }
}
```

Ejecutar `dotnet test --filter ClubInvitationCodeVisibilityTests` → deben pasar los 6 tests.

### 1.3 Refactor ✅

Revisar `using` sobrantes. Sin más cambios.

---

## Bloque 2 — Backend: `GetClub.cs` ✅

### 2.1 Red ✅

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetClubHandlerTests.cs`:

```csharp
#nullable enable
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Clubs.Queries.GetClub;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetClubHandlerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public GetClubHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<Club> SeedClubAsync(RFFM.Api.Infrastructure.Persistence.AppDbContext db, string name)
        {
            var club = Club.Create(name, SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();
            return club;
        }

        [Fact]
        public async Task Handle_CanViewInvitationCodeTrue_ReturnsRealCode()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Visible Code");
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new GetClubQueryApp { ClubId = club.Id, CanViewInvitationCode = true },
                CancellationToken.None);

            Assert.Equal(club.InvitationCode, result.invitationCode);
            Assert.NotNull(result.invitationCode);
        }

        [Fact]
        public async Task Handle_CanViewInvitationCodeFalse_ReturnsNull()
        {
            await using var db = _fixture.CreateDbContext();
            var club = await SeedClubAsync(db, "Club Hidden Code");
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new GetClubQueryApp { ClubId = club.Id, CanViewInvitationCode = false },
                CancellationToken.None);

            Assert.Null(result.invitationCode);
        }

        [Fact]
        public void CacheKey_DiffersBetweenCanViewInvitationCodeTrueAndFalse()
        {
            var privileged = new GetClubQueryApp { ClubId = "club-1", CanViewInvitationCode = true };
            var unprivileged = new GetClubQueryApp { ClubId = "club-1", CanViewInvitationCode = false };

            Assert.NotEqual(privileged.CacheKey, unprivileged.CacheKey);
            Assert.StartsWith(RFFM.Api.Features.Coaches.Clubs.ClubConstants.CachePrefix, privileged.CacheKey);
            Assert.StartsWith(RFFM.Api.Features.Coaches.Clubs.ClubConstants.CachePrefix, unprivileged.CacheKey);
        }
    }
}
```

Ejecutar `dotnet test --filter GetClubHandlerTests` → deben fallar en compilación (`CanViewInvitationCode` no existe todavía en `GetClubQueryApp`).

### 2.2 Green ✅

Editar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Queries/GetClub.cs`:

- Cambiar la firma del endpoint para inyectar `HttpContext` y `AppDbContext`, y calcular `CanViewInvitationCode` antes de enviar el `IMediator`:

```csharp
app.MapGet("/api/catalog/club/{id}",
        async (string id, HttpContext httpContext, IMediator mediator, AppDbContext db, CancellationToken cancellationToken) =>
        {
            var canViewInvitationCode = await ClubInvitationCodeVisibility.CanViewAsync(db, httpContext.User, id, cancellationToken);
            var query = new GetClubQueryApp
            {
                ClubId = id,
                CanViewInvitationCode = canViewInvitationCode
            };
            return await mediator.Send(query, cancellationToken);
        })
```

- Añadir `using RFFM.Api.Features.Coaches.Clubs;` (namespace de `ClubInvitationCodeVisibility`, ya implícito porque `GetClub` vive en `RFFM.Api.Features.Coaches.Clubs.Queries` — confirmar si hace falta el `using` explícito o basta con el namespace padre; si el compilador no lo resuelve, añadir `using RFFM.Api.Features.Coaches.Clubs;`).

- Modificar el record:

```csharp
public record GetClubQueryApp : Common.IQueryApp<GetClubResponse>, ICacheRequest
{
    public string ClubId { get; set; }
    public bool CanViewInvitationCode { get; set; }
    public string CacheKey => $"{ClubConstants.CachePrefix}:{ClubId}:{(CanViewInvitationCode ? "priv" : "pub")}";
    public DateTime? AbsoluteExpirationRelativeToNow { get; }
}
```

- Modificar el handler para nulear el código:

```csharp
public async ValueTask<GetClubResponse> Handle(GetClubQueryApp request, CancellationToken cancellationToken = default)
{
    var club = await _db.Clubs
        .Include(c => c.Country)
        .FirstOrDefaultAsync(c => c.Id == request.ClubId, cancellationToken);
    if (club == null)
        throw new KeyNotFoundException($"Club '{request.ClubId}' Not Found");

    return new GetClubResponse(club.Id, club.Name,
        new CountriesResponse(club.CountryId, club.Country.Name, club.Country.Code),
        club.ShieldUrl,
        request.CanViewInvitationCode ? club.InvitationCode : null);
}
```

Ejecutar `dotnet test --filter GetClubHandlerTests` → deben pasar los 3 tests.

### 2.3 Refactor ✅

Sin cambios estructurales adicionales.

---

## Bloque 3 — Backend: `GetClubs.cs` ✅

### 3.1 Red ✅

Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetClubsHandlerTests.cs`:

```csharp
#nullable enable
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Clubs.Queries.GetClubs;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetClubsHandlerTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public GetClubsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<Club> SeedClubAsync(RFFM.Api.Infrastructure.Persistence.AppDbContext db, string name)
        {
            var club = Club.Create(name, SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();
            return club;
        }

        [Fact]
        public async Task Handle_AdministratorSeesAllInvitationCodes()
        {
            await using var db = _fixture.CreateDbContext();
            await SeedClubAsync(db, "Club Admin View 1");
            await SeedClubAsync(db, "Club Admin View 2");
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new ClubsQueryApp { CanViewAllInvitationCodes = true },
                CancellationToken.None);

            Assert.All(result, c => Assert.NotNull(c.invitationCode));
        }

        [Fact]
        public async Task Handle_NonAdministratorSeesOnlyOwnDirectedClubsCode()
        {
            await using var db = _fixture.CreateDbContext();
            var directedClub = await SeedClubAsync(db, "Club Directed By Me");
            var otherClub = await SeedClubAsync(db, "Club Not Mine");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, directedClub.Id, Membership.Directive.Id));
            await db.SaveChangesAsync();
            var handler = new ClubsRequestHandler(db);

            var result = await handler.Handle(
                new ClubsQueryApp { CanViewAllInvitationCodes = false, RequestingUserId = userId },
                CancellationToken.None);

            var directed = result.Single(c => c.Id == directedClub.Id);
            var other = result.Single(c => c.Id == otherClub.Id);
            Assert.NotNull(directed.invitationCode);
            Assert.Null(other.invitationCode);
        }
    }
}
```

Ejecutar `dotnet test --filter GetClubsHandlerTests` → deben fallar en compilación.

### 3.2 Green ✅

Editar `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Clubs/Queries/GetClubs.cs`:

```csharp
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.Countries.Queries.GetCountries;

namespace RFFM.Api.Features.Coaches.Clubs.Queries
{
    public class GetClubs : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/clubs",
                    async (HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var isAdministrator = httpContext.User.IsInRole(AppRoles.Administrator.Name);
                        var userId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        return await mediator.Send(
                            new ClubsQueryApp { CanViewAllInvitationCodes = isAdministrator, RequestingUserId = userId },
                            cancellationToken);
                    })
                .WithName(nameof(GetClubs))
                .WithTags(ClubConstants.ClubFeature)
                .Produces<ClubsResponse[]>();
        }

        // Ya no implementa ICacheRequest — ver design.md §4: cachear esta lista por-usuario
        // no es correcto de forma general y hoy no tiene consumidores en frontend.
        public record ClubsQueryApp : Common.IQueryApp<ClubsResponse[]>
        {
            public bool CanViewAllInvitationCodes { get; set; }
            public string? RequestingUserId { get; set; }
        }

        public record ClubsResponse(string Id, string Name, CountriesResponse Country, string? shieldUrl, string? invitationCode);

        public class ClubsRequestHandler : IRequestHandler<ClubsQueryApp, ClubsResponse[]>
        {
            private readonly AppDbContext _db;

            public ClubsRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<ClubsResponse[]> Handle(ClubsQueryApp request, CancellationToken cancellationToken = default)
            {
                var directorClubIds = request.CanViewAllInvitationCodes
                    ? null
                    : await ClubInvitationCodeVisibility.DirectorClubIdsAsync(_db, request.RequestingUserId, cancellationToken);

                var clubs = await _db.Clubs
                    .Include(c => c.Country)
                    .ToListAsync(cancellationToken);

                return clubs.Select(club => new ClubsResponse(
                        club.Id,
                        club.Name,
                        new CountriesResponse(club.CountryId, club.Country.Name, club.Country.Code),
                        club.ShieldUrl,
                        request.CanViewAllInvitationCodes || (directorClubIds?.Contains(club.Id) ?? false)
                            ? club.InvitationCode
                            : null))
                    .ToArray();
            }
        }
    }
}
```

**Nota importante para el implementer**: `ClubInvitationCodeVisibility.DirectorClubIdsAsync` definido en el Bloque 1 recibe un `ClaimsPrincipal`, pero aquí solo tenemos `RequestingUserId` (string) porque el test de este bloque construye la query directamente sin `ClaimsPrincipal`. Añadir un **overload** en `ClubInvitationCodeVisibility` (mismo archivo del Bloque 1) que acepte `string? userId` directamente:

```csharp
public static async Task<HashSet<string>> DirectorClubIdsAsync(
    AppDbContext db, string? userId, CancellationToken cancellationToken)
{
    if (string.IsNullOrEmpty(userId))
        return new HashSet<string>();

    var clubIds = await db.UserClubs
        .Where(uc => uc.ApplicationUserId == userId && uc.RoleId == Membership.Directive.Id)
        .Select(uc => uc.ClubId)
        .ToListAsync(cancellationToken);

    return clubIds.ToHashSet();
}

// El overload existente delega en este:
public static Task<HashSet<string>> DirectorClubIdsAsync(
    AppDbContext db, ClaimsPrincipal user, CancellationToken cancellationToken) =>
    DirectorClubIdsAsync(db, GetUserId(user), cancellationToken);
```

Ejecutar `dotnet test --filter GetClubsHandlerTests` → deben pasar los 2 tests. Ejecutar también `dotnet test --filter ClubInvitationCodeVisibilityTests` para confirmar que el overload no rompió los tests del Bloque 1.

### 3.3 Refactor ✅

Confirmar que ningún otro `IFeatureModule`/handler dependía de `ClubsQueryApp` implementando `ICacheRequest` (buscar referencias a `ClubConstants.CachePrefix` fuera de `GetClub.cs`/`GetClubs.cs`/los 3 commands — no deberían verse afectadas, siguen invalidando por prefijo igual).

---

## Bloque 4 — Frontend: `ClubSelector.tsx` ✅

### 4.1 Red ✅

Revisar primero `Front/src/apps/coach/pages/settings/components/ClubSelector/__tests__/ClubSelector.test.tsx` existente para reutilizar sus mocks de `clubService`/`countryService` (usa `invitationCode: "ABC123"` en el club mockeado, línea ~44). Añadir en ese mismo archivo (o crear `ClubSelector.invitationCode.test.tsx` si el archivo existente es muy largo/frágil de tocar) dos tests nuevos:

```tsx
it("no muestra la columna Código de invitación cuando ningún club tiene código visible", async () => {
  // mockear clubService.getUserClubs / getClubById para que devuelvan invitationCode: null en todos los clubs
  // (seguir el patrón de mocks del test existente en este archivo)
  render(<ClubSelector value={null} onChange={vi.fn()} />);
  await waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument());
  expect(screen.queryByText("Código de invitación")).not.toBeInTheDocument();
});

it("muestra la columna Código de invitación cuando al menos un club tiene código visible", async () => {
  // mockear un club con invitationCode: "ABC123" y otro con invitationCode: null
  render(<ClubSelector value={null} onChange={vi.fn()} />);
  await waitFor(() => expect(screen.getByText("Código de invitación")).toBeInTheDocument());
  expect(screen.getByText("ABC123")).toBeInTheDocument();
});
```

**Nota para el implementer**: adaptar los mocks exactos a la forma real de `clubService.getUserClubs`/`getClubById` usada en el test existente de este archivo — no reinventar el setup de mocks, copiar el patrón ya presente y solo variar `invitationCode`.

Ejecutar `npm run test -- ClubSelector` → los 2 tests nuevos deben fallar (la columna se muestra siempre hoy).

### 4.2 Green ✅

Editar `Front/src/apps/coach/pages/settings/components/ClubSelector/ClubSelector.tsx`:

- Antes del `return` del render (o donde ya se calculan variables derivadas), añadir:

```tsx
const anyClubHasInvitationCode = clubs.some((club) => club.invitationCode != null);
```

- Vista compacta (`fields` array, alrededor de la línea 367): el campo se añade condicionalmente en vez de siempre con fallback `"-"`:

```tsx
fields={[
  { label: "País", value: club.country },
  {
    label: "Escudo",
    value: club.shieldUrl ? (
      <img src={club.shieldUrl} alt={`Escudo ${club.name}`} className={styles.shieldImage} />
    ) : (
      "-"
    ),
  },
  ...(club.invitationCode != null
    ? [{ label: "Código de invitación", value: club.invitationCode }]
    : []),
  {
    label: "Preferido",
    value: (/* Switch existente, sin cambios */),
  },
]}
```

- Tabla (alrededor de la línea 406 para el header y 427 para la celda):

```tsx
<TableHead>
  <TableRow>
    <TableCell>Nombre</TableCell>
    <TableCell>País</TableCell>
    <TableCell>Escudo</TableCell>
    {anyClubHasInvitationCode && <TableCell>Código de invitación</TableCell>}
    <TableCell>Preferido</TableCell>
    <TableCell>Acciones</TableCell>
  </TableRow>
</TableHead>
<TableBody>
  {clubs.map((club) => (
    <TableRow key={club.id} hover>
      <TableCell>{club.name}</TableCell>
      <TableCell>{club.country}</TableCell>
      <TableCell>{/* escudo, sin cambios */}</TableCell>
      {anyClubHasInvitationCode && (
        <TableCell>{club.invitationCode ?? "-"}</TableCell>
      )}
      <TableCell>{/* Switch, sin cambios */}</TableCell>
      {/* ... */}
    </TableRow>
  ))}
</TableBody>
```

Ejecutar `npm run test -- ClubSelector` → deben pasar todos los tests del archivo (los nuevos y los preexistentes).

### 4.3 Refactor ✅

Confirmar que `npm run build` no tiene errores de TypeScript (el array `fields` mezcla objetos condicionales — verificar que el tipo inferido sigue siendo compatible con la prop `fields` de `SettingsRowCard`).

---

## Bloque 5 — Verificación final ✅

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

Manual (requiere backend + frontend corriendo, con al menos un club con un usuario `ClubDirector` y otro usuario `Coach` en el mismo club):
1. Login como `ClubDirector` de un club → Ajustes → Mis clubes muestra la columna "Código de invitación" con el valor real.
2. Login como `Coach` del mismo club → Ajustes → Mis clubes NO muestra esa columna.
3. `GET /api/catalog/club/{id}` con el token del `Coach` → `invitationCode: null` en el JSON de respuesta.
4. `GET /api/catalog/club/{id}` con el token del `ClubDirector` → `invitationCode` con el valor real.

Si todo pasa: `openspec validate restrict-club-invitation-code-visibility` y mover la carpeta a `openspec/changes/archive/2026-07-14-restrict-club-invitation-code-visibility/`.
