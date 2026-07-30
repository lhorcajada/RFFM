## Architecture Decisions

### 1. Regla de autorización compartida: `TeamEditAuthorization`

**Corrección post-implementación (verificado en pruebas manuales):** el rol "Coach" del mundo
real se asigna **a nivel de club**, no de equipo — `CreateClub.cs:111` da al creador del club
`UserClub.RoleId == Membership.Coach.Id`. `UserTeam` solo se puebla vía
`ValidateTeamJoinCode.cs`/`CreateUser.cs`, para jugadores/familiares que se unen con código de
equipo — nunca para el coach que crea el equipo. Un diseño inicial que solo miraba
`UserClub.RoleId == Directive` dejaba sin acceso a cualquier coach real, porque su rol vive en
`UserClub` con `RoleId == Coach`, no en `UserTeam`.

Un usuario puede editar un equipo si, para el club de ese equipo, tiene
`UserClub.RoleId == Membership.Coach.Id` **o** `UserClub.RoleId == Membership.Directive.Id`
— igual patrón de "rol scoped a la entidad concreta, no rol global de Identity" ya usado en
`ClubInvitationCodeVisibility.CanViewAsync` (`Features/Coaches/Clubs/ClubInvitationCodeVisibility.cs`)
para el caso análogo de `ClubDirector`. Se mantiene además el chequeo `UserTeam.RoleId == Coach`
para ese `TeamId` concreto como vía adicional (defensa en profundidad / futuro-proof si algún día
se asigna un coach a nivel de equipo), aunque hoy no está poblado por ningún flujo.

Nueva clase estática, mismo patrón:

```csharp
// Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/TeamEditAuthorization.cs
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams
{
    public static class TeamEditAuthorization
    {
        public static async Task<bool> CanEditAsync(
            AppDbContext db, string? userId, string teamId, string clubId, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(userId))
                return false;

            var isClubManager = await db.UserClubs.AnyAsync(uc =>
                uc.ApplicationUserId == userId &&
                uc.ClubId == clubId &&
                (uc.RoleId == Membership.Directive.Id || uc.RoleId == Membership.Coach.Id),
                cancellationToken);
            if (isClubManager)
                return true;

            return await db.UserTeams.AnyAsync(ut =>
                ut.ApplicationUserId == userId &&
                ut.TeamId == teamId &&
                ut.RoleId == Membership.Coach.Id,
                cancellationToken);
        }

        // Para GetTeams: evita N consultas, una sola query para todos los equipos del usuario
        public static async Task<HashSet<string>> CoachTeamIdsAsync(
            AppDbContext db, string? userId, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(userId))
                return new HashSet<string>();

            var teamIds = await db.UserTeams
                .Where(ut => ut.ApplicationUserId == userId && ut.RoleId == Membership.Coach.Id)
                .Select(ut => ut.TeamId)
                .ToListAsync(cancellationToken);

            return teamIds.ToHashSet();
        }
    }
}
```

### 2. `UpdateTeam.cs` — aplicar el check

`UpdateTeamCommand` gana `UserId` (no lo manda el cliente; se resuelve en el endpoint desde
`HttpContext`, mismo claim que ya usa `GetTeams.cs`:
`"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"`):

```csharp
app.MapPut("api/catalog/team/{id}",
        async (string id, UpdateTeamCommand command, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
        {
            command.TeamModel.Id = id;
            command.UserId = httpContext.User.Claims.FirstOrDefault(c =>
                c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
            await mediator.Send(command, cancellationToken);
            return Results.Ok();
        })
```

```csharp
public class UpdateTeamCommand : IRequest, IInvalidateCacheRequest, IRequireFeaturePermission
{
    public TeamModel TeamModel { get; set; }
    public string? UserId { get; set; }
    // ... resto sin cambios
}
```

En el handler, el check va **después** de cargar el `team` existente (usa `team.ClubId` actual de
BD, no el del payload — así un cliente no puede eludir el check mandando un `ClubId` distinto en
`TeamModel.ClubId`) y **antes** de aplicar ninguna mutación:

```csharp
public async ValueTask<Unit> Handle(UpdateTeamCommand request, CancellationToken cancellationToken)
{
    var team = await _catalogDbContext.Teams
        .FirstOrDefaultAsync(c => c.Id == request.TeamModel.Id, cancellationToken: cancellationToken);
    if (team == null)
        throw new KeyNotFoundException($"Team '{request.TeamModel.Id}' Not Found");

    var canEdit = await TeamEditAuthorization.CanEditAsync(
        _catalogDbContext, request.UserId, team.Id, team.ClubId, cancellationToken);
    if (!canEdit)
        throw new ForbiddenAccessException("No tienes permiso para editar este equipo.");

    team.UpdateName(request.TeamModel.Name);
    // ... resto sin cambios
}
```

`ForbiddenAccessException` (`Domain/ForbiddenAccessException.cs`) ya existe y ya se usa en
`TeamMembershipBehavior` — se asume que el middleware global de excepciones ya la mapea a
`403 ProblemDetails` (mismo mecanismo que usa esa clase hoy); no se toca el middleware en este
cambio.

El permiso de feature genérico (`IRequireFeaturePermission`, `FeatureRoute =
CoachFeatureRoutes.ClubTeams`) se mantiene sin cambios como primera capa (defensa en profundidad);
el nuevo check es una segunda capa más específica.

### 3. `GetTeams.cs` — exponer `CanEdit` por equipo, reutilizando el `userClub` ya cargado

`TeamsRequestHandler.Handle` ya carga `userClub` (una única fila `UserClub` para
`request.UserId`+`request.ClubId`) para el chequeo de acceso existente — se reutiliza
directamente para saber si el usuario es `Coach` o `Directive` de ese club, sin consulta
adicional:

```csharp
var isClubManager = userClub.RoleId == Membership.Directive.Id || userClub.RoleId == Membership.Coach.Id;
var coachTeamIds = await TeamEditAuthorization.CoachTeamIdsAsync(_db, request.UserId, cancellationToken);
```

`TeamsResponse` gana un campo `CanEdit`:

```csharp
public record TeamsResponse(string Id,
    string Name,
    CategoryResponse Category,
    LeagueResponse League,
    GetClubResponse Club,
    string? UrlPhoto,
    string? JoinCode,
    bool CanEdit);
```

Y el `.Select(...)` calcula `CanEdit = isClubManager || coachTeamIds.Contains(t.Id)` por cada
equipo (el `.Select` de EF Core se traduce a SQL sobre columnas, así que `coachTeamIds` —
`HashSet<string>` en memoria — no puede referenciarse dentro del `Select` traducido a SQL;
solución: materializar primero con `.ToArrayAsync()` como ya hace hoy y añadir `CanEdit` en un
`.Select()` **después**, en memoria, sobre el array ya materializado, o construir el
`TeamsResponse` con un segundo `.Select(t => ...)` en LINQ-to-Objects tras el `ToArrayAsync`
existente).

### 4. Frontend — botón "Editar" en `TeamManager.tsx`

- `TeamResponse` (`Front/src/apps/coach/services/teamService.ts`) gana `canEdit: boolean`.
- `TeamManager.tsx`: nueva columna/acción "Editar" (tabla) y campo de acción en
  `SettingsRowCard` (vista compacta), visible solo si `team.canEdit`, navegando a
  `/coach/clubs/${clubId}/teams/${team.id}/edit` (ruta ya registrada en `routes.tsx`, mismo
  destino que usa el botón de editar de `ClubTeams.tsx`).
- Botón deshabilitado/oculto (no solo deshabilitado) cuando `!team.canEdit` — igual criterio que
  "Mis clubes" oculta la columna de código de invitación cuando no aplica: no mostrar UI que el
  usuario no puede usar, en vez de mostrarla deshabilitada con tooltip.
- No se construye ningún formulario nuevo: se navega al `EditTeam.tsx` ya existente y probado
  (fuera de alcance de este cambio, no se toca).

## Files

**Backend** (nuevos):
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/TeamEditAuthorization.cs`

**Backend** (modificados):
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Commands/UpdateTeam.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/Queries/GetTeams.cs`

**Frontend** (modificados):
- `Front/src/apps/coach/services/teamService.ts` (tipo `TeamResponse`)
- `Front/src/apps/coach/pages/settings/components/MyTeams/TeamManager.tsx`

## Tests (TDD — Red → Green → Refactor)

**Backend** (`RFFM.Api.Tests`, xUnit, `PostgresContainerFixture` real — mismo patrón que
`UpdateTeamHandlerTests.cs`/`TeamMembershipBehaviorTests.cs`, no InMemory):
- `TeamEditAuthorizationTests`: Coach del equipo → `true`; Directive del club → `true`; otro rol
  (`ClubMember`, `Player`) sin ninguna de las dos condiciones → `false`; Coach de **otro** equipo
  del mismo club → `false` (a menos que también sea Directive); usuario sin `userId` → `false`.
- `UpdateTeamHandlerTests` (extender el archivo existente): usuario Coach del equipo → éxito
  (persiste cambios, igual que los tests actuales); usuario Directive del club → éxito; usuario
  sin relación con el equipo/club → `ForbiddenAccessException`, y los datos del equipo en BD
  **no** cambian (verificar tras la excepción que el nombre sigue siendo el original).
- `GetTeamsHandlerTests` (o extender el test existente de `GetTeams` si ya existe uno con ese
  nombre — comprobar antes de crear un archivo nuevo): equipo del que el usuario es Coach →
  `CanEdit = true`; equipo de un club donde el usuario es Directive → `CanEdit = true` para
  **todos** los equipos de ese club; equipo sin relación → `CanEdit = false`.

**Frontend** (Vitest + Testing Library, extendiendo
`TeamManager.test.tsx`):
- Con `canEdit: true` en un equipo → aparece un botón/icono "Editar" en su fila/tarjeta; al
  hacer click, `mockNavigate` se llama con `/coach/clubs/club-1/teams/team-1/edit`.
- Con `canEdit: false` → no aparece el botón "Editar" para ese equipo (ni en tabla ni en tarjeta
  compacta).

Coverage objetivo: handlers backend ≥80%, componente frontend ≥75% (según `CLAUDE.md`).
