# Implement — team-player-link-verification

Sigue las tareas en orden. Cada tarea es TDD: escribe/edita el test primero (Red), impleméntalo (Green), verifica con el comando indicado. Marca cada checkbox `- [ ]` → `- [x]` en ESTE archivo y en `tasks.md` cuando termines y verifiques la tarea correspondiente. Todos los paths son relativos a `C:\Proyects\MisProyectos\FutbolBase`.

Convenciones: sigue exactamente los patrones de los archivos de referencia citados en cada tarea (mismos usings, mismo estilo, mismo namespace). No inventes convenciones nuevas.

---

## Tarea 1 — Dominio: `TeamPlayer.LinkCode` (≈30min)

Archivo: `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayer.cs`

Añadir, junto a las demás propiedades:
```csharp
public string? LinkCode { get; private set; }
```

Añadir, junto a los demás métodos `Set*`/`Update*`:
```csharp
public string GenerateLinkCode()
{
    LinkCode = Guid.NewGuid().ToString("N")[..ValidationConstants.PlayerLinkCodeLength].ToUpperInvariant();
    return LinkCode;
}
```

Archivo: `Back/ExtractionApi/src/RFFM.Api/ValidationConstants.cs` — añadir, cerca de `TeamJoinCodeLength`:
```csharp
public const int PlayerLinkCodeLength = 8;
```

Verificar: `dotnet build` (desde `Back/ExtractionApi`).

- [x] Hecho

---

## Tarea 2 — Dominio: `TeamPlayerLinkRequest` + `ErrorCodes` (≈1h)

Nuevo archivo: `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/TeamPlayerLinkRequest.cs`

Copia exacta de la estructura de `Domain/Aggregates/UserClubs/ClubJoinRequest.cs` (léelo primero), pero:
```csharp
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public enum TeamPlayerLinkRequestStatus { Pending = 0, Approved = 1, Rejected = 2, Cancelled = 3 }

    public class TeamPlayerLinkRequest : BaseEntity, IAggregateRoot
    {
        public string ApplicationUserId { get; private set; } = string.Empty;
        public string TeamId { get; private set; } = string.Empty;
        public string TeamPlayerId { get; private set; } = string.Empty;
        public int MembershipId { get; private set; }
        public TeamPlayerLinkRequestStatus Status { get; private set; }
        public DateTime RequestedAt { get; private set; }
        public DateTime? DecidedAt { get; private set; }
        public string? DecidedByUserId { get; private set; }

        public Team Team { get; set; } = null!;
        public TeamPlayer TeamPlayer { get; set; } = null!;
        public Membership Membership { get; set; } = null!;

        private TeamPlayerLinkRequest() { }

        public static TeamPlayerLinkRequest Create(string applicationUserId, string teamId, string teamPlayerId, int membershipId)
        {
            if (string.IsNullOrWhiteSpace(applicationUserId) || string.IsNullOrWhiteSpace(teamId) || string.IsNullOrWhiteSpace(teamPlayerId))
                throw new DomainException("TeamPlayerLinkRequest",
                    "El usuario, el equipo y el jugador son obligatorios.", ErrorCodes.LinkedPlayerRequired);

            return new TeamPlayerLinkRequest
            {
                ApplicationUserId = applicationUserId,
                TeamId = teamId,
                TeamPlayerId = teamPlayerId,
                MembershipId = membershipId,
                Status = TeamPlayerLinkRequestStatus.Pending,
                RequestedAt = DateTime.UtcNow
            };
        }

        public void Approve(string decidedByUserId)
        {
            EnsurePending();
            Status = TeamPlayerLinkRequestStatus.Approved;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = decidedByUserId;
        }

        public void Reject(string decidedByUserId)
        {
            EnsurePending();
            Status = TeamPlayerLinkRequestStatus.Rejected;
            DecidedAt = DateTime.UtcNow;
            DecidedByUserId = decidedByUserId;
        }

        private void EnsurePending()
        {
            if (Status != TeamPlayerLinkRequestStatus.Pending)
                throw new DomainException("TeamPlayerLinkRequest",
                    "La solicitud ya ha sido decidida.", ErrorCodes.TeamPlayerLinkRequestAlreadyDecided);
        }
    }
}
```

Archivo: `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs` — añadir junto a los códigos existentes de `ClubJoinRequest*`:
```csharp
public const string PlayerLinkCodeInvalid = "PlayerLinkCodeInvalid";
public const string LinkedPlayerRequestPending = "LinkedPlayerRequestPending";
public const string TeamPlayerLinkRequestNotFound = "TeamPlayerLinkRequestNotFound";
public const string TeamPlayerLinkRequestAlreadyDecided = "TeamPlayerLinkRequestAlreadyDecided";
```

Nuevo archivo de test: `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/TeamPlayerLinkRequestTests.cs` (xUnit puro, sin BD — es lógica de dominio en memoria, sigue el estilo de cualquier test de entidad de dominio del repo si existe uno para `ClubJoinRequest`; si no existe, usa `[Fact]` simples):
- `Create_WithValidData_Succeeds`
- `Create_WithEmptyApplicationUserId_ThrowsDomainException`
- `Approve_WhenAlreadyDecided_ThrowsDomainException`
- `Reject_WhenAlreadyDecided_ThrowsDomainException`

Verificar: `dotnet build && dotnet test --filter TeamPlayerLinkRequestTests`

- [x] Hecho

---

## Tarea 3 — Persistencia + migración (≈1h)

Archivo: `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/UserClubs/TeamPlayersEntityConfiguration.cs` — dentro de `Configure`, añadir junto a las demás `Property`:
```csharp
builder.Property(tp => tp.LinkCode)
    .IsRequired(false)
    .HasMaxLength(ValidationConstants.PlayerLinkCodeLength);

builder.HasIndex(tp => tp.LinkCode);
```

Nuevo archivo: `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/Configuration/Aggregates/UserClubs/TeamPlayerLinkRequestEntityConfiguration.cs` — copia la estructura exacta de `ClubJoinRequestEntityConfiguration.cs` (léelo primero) adaptada:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Aggregates.UserClubs
{
    internal class TeamPlayerLinkRequestEntityConfiguration : IEntityTypeConfiguration<TeamPlayerLinkRequest>
    {
        public void Configure(EntityTypeBuilder<TeamPlayerLinkRequest> builder)
        {
            builder.ToTable("TeamPlayerLinkRequests");
            builder.HasKey(r => r.Id);

            builder.Property(r => r.ApplicationUserId)
                .IsRequired()
                .HasMaxLength(ValidationConstants.ApplicationUserIdMaxLength);

            builder.Property(r => r.TeamId).IsRequired();
            builder.Property(r => r.TeamPlayerId).IsRequired();
            builder.Property(r => r.MembershipId).IsRequired();
            builder.Property(r => r.Status).IsRequired();
            builder.Property(r => r.RequestedAt).IsRequired();
            builder.Property(r => r.DecidedAt).IsRequired(false);
            builder.Property(r => r.DecidedByUserId)
                .IsRequired(false)
                .HasMaxLength(ValidationConstants.ApplicationUserIdMaxLength);

            builder.HasOne(r => r.Team)
                .WithMany()
                .HasForeignKey(r => r.TeamId);

            builder.HasOne(r => r.TeamPlayer)
                .WithMany()
                .HasForeignKey(r => r.TeamPlayerId);

            builder.HasOne(r => r.Membership)
                .WithMany()
                .HasForeignKey(r => r.MembershipId);

            builder.HasIndex(r => new { r.TeamId, r.Status });
            builder.HasIndex(r => r.TeamPlayerId);
            builder.HasIndex(r => r.ApplicationUserId);
        }
    }
}
```

Archivo: `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/AppDbContext.cs` — añadir junto a `public DbSet<ClubJoinRequest> ClubJoinRequests { get; set; }`:
```csharp
public DbSet<TeamPlayerLinkRequest> TeamPlayerLinkRequests { get; set; }
```
(el `using RFFM.Api.Domain.Aggregates.UserClubs;` ya existe en el archivo, `TeamPlayerLinkRequest` vive en ese mismo namespace, no hace falta using nuevo).

Migración (desde `Back/ExtractionApi`):
```
.\manage-migrations.ps1 -Action create -MigrationName AddTeamPlayerLinkRequestsAndPlayerLinkCode -Context AppDbContext
```

Verificar: `dotnet build`. Revisa el archivo de migración generado en `Infrastructure/Migrations/`: debe crear la tabla `TeamPlayerLinkRequests` y añadir la columna `LinkCode` (+ índice) a `TeamPlayers`, sin tocar ninguna otra tabla.

- [x] Hecho

---

## Tarea 4 — `CreateUser.cs`: bifurcación con/sin código (≈2h)

Archivo: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Users/Commands/CreateUser.cs`

**4.1 — `Command`**: añadir propiedad:
```csharp
public string? PlayerLinkCode { get; set; }
```

**4.2 — Rama `IsPlayer(accountType) || IsFamilyMember(accountType)`** (dentro del bloque `Handle`, sección "2. Pre-checks"): después del bloque que ya existe (resolver `team`, `roster`, `chosen`, comprobar `AlreadyLinked`), añade una variable local `bool playerLinkCodeMatched = false;` declarada ANTES del `if (IsClubDirector...) else if...` (junto a `Club? club = null;` etc.) y, dentro de la rama Player/FamilyMember, tras el bloque `if (wantedMembership.Key == Membership.Player.Key && chosen.AlreadyLinked) { ... }` existente:

```csharp
if (wantedMembership.Key == Membership.Player.Key)
{
    var alreadyPending = await _db.TeamPlayerLinkRequests.AsNoTracking().AnyAsync(r =>
        r.TeamPlayerId == request.TeamPlayerId
        && r.MembershipId == Membership.Player.Id
        && r.Status == TeamPlayerLinkRequestStatus.Pending, cancellationToken);
    if (alreadyPending)
    {
        return Results.Conflict(new ProblemDetails
        {
            Status = StatusCodes.Status409Conflict,
            Title = "Solicitud ya en curso",
            Detail = "Ya hay una solicitud pendiente para vincularse a este jugador.",
            Extensions = { ["code"] = ErrorCodes.LinkedPlayerRequestPending }
        });
    }
}

if (!string.IsNullOrWhiteSpace(request.PlayerLinkCode))
{
    var normalizedPlayerCode = request.PlayerLinkCode.Trim().ToUpperInvariant();
    var teamPlayerEntity = await _db.TeamPlayers.AsNoTracking()
        .FirstOrDefaultAsync(tp => tp.Id == request.TeamPlayerId, cancellationToken);
    if (teamPlayerEntity?.LinkCode is null || teamPlayerEntity.LinkCode.ToUpperInvariant() != normalizedPlayerCode)
    {
        return Results.BadRequest(new ProblemDetails
        {
            Title = "Código de jugador inválido",
            Detail = "El código introducido no corresponde a este jugador.",
            Extensions = { ["code"] = ErrorCodes.PlayerLinkCodeInvalid }
        });
    }
    playerLinkCodeMatched = true;
}
```

**4.3 — Transacción** (sección "3. Create the Identity user..."): añade `TeamPlayerLinkRequest? pendingLinkRequest = null;` junto a `ClubJoinRequest? pendingJoinRequest = null;`. Dentro del `strategy.ExecuteAsync` delegate, reemplaza:
```csharp
else if (team is not null && membership is not null) // Player/FamilyMember
{
    var userTeam = new UserTeam(user.Id, team.Id, membership.Id);
    userTeam.LinkPlayer(request.TeamPlayerId!);
    _db.UserTeams.Add(userTeam);
}
```
por:
```csharp
else if (team is not null && membership is not null && playerLinkCodeMatched) // Player/FamilyMember con código correcto
{
    var userTeam = new UserTeam(user.Id, team.Id, membership.Id);
    userTeam.LinkPlayer(request.TeamPlayerId!);
    _db.UserTeams.Add(userTeam);
}
else if (team is not null && membership is not null) // Player/FamilyMember sin código válido -> pendiente
{
    pendingLinkRequest = TeamPlayerLinkRequest.Create(user.Id, team.Id, request.TeamPlayerId!, membership.Id);
    _db.TeamPlayerLinkRequests.Add(pendingLinkRequest);
}
```

**4.4 — Después de la transacción**: la línea
```csharp
if (pendingJoinRequest is null) // ClubDirector, ClubMember, Player/FamilyMember, Coach-no-code, Fan
{
    await EnsureIdentityRoleAsync(user, identityRoleName);
}
```
pasa a:
```csharp
if (pendingJoinRequest is null && pendingLinkRequest is null)
{
    await EnsureIdentityRoleAsync(user, identityRoleName);
}
```

El bloque:
```csharp
if (team is not null && (IsPlayer(accountType) || IsFamilyMember(accountType)))
{
    await SaveUserProfileAsync(user.Id, identityRoleName, request.TeamPlayerId!, team.Id, cancellationToken);
}
```
pasa a:
```csharp
if (team is not null && pendingLinkRequest is null && (IsPlayer(accountType) || IsFamilyMember(accountType)))
{
    await SaveUserProfileAsync(user.Id, identityRoleName, request.TeamPlayerId!, team.Id, cancellationToken);
}
```

Después del bloque `if (pendingJoinRequest is not null) { await NotifyClubCreatorOfPendingRequestAsync(...); }`, añade:
```csharp
if (pendingLinkRequest is not null)
{
    await NotifyTeamCreatorOfPendingLinkRequestAsync(pendingLinkRequest, cancellationToken);
}
```

**4.5 — Respuesta**: el `return Results.Ok(new RegisterAccountResponse { ... })` cambia:
```csharp
Status = pendingJoinRequest is not null
    ? RegistrationStatus.PendingClubApproval
    : pendingLinkRequest is not null
        ? RegistrationStatus.PendingPlayerLinkApproval
        : RegistrationStatus.Active,
```
y añade al final del inicializador:
```csharp
TeamPlayerLinkRequestId = pendingLinkRequest?.Id
```

**4.6 — Nuevo método privado** `NotifyTeamCreatorOfPendingLinkRequestAsync`, calco de `NotifyClubCreatorOfPendingRequestAsync` pero resolviendo el creador vía `UserTeams` (o el club padre si el equipo no tiene creador propio, mismo patrón que `ScopeAuthorizationService.ResolveCreatorUserIdAsync`):
```csharp
private async Task NotifyTeamCreatorOfPendingLinkRequestAsync(TeamPlayerLinkRequest linkRequest, CancellationToken cancellationToken)
{
    try
    {
        var creator = await _db.UserTeams
            .AsNoTracking()
            .Where(ut => ut.TeamId == linkRequest.TeamId && ut.IsCreator)
            .Select(ut => ut.ApplicationUserId)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrEmpty(creator))
        {
            var team = await _db.Teams.AsNoTracking().FirstOrDefaultAsync(t => t.Id == linkRequest.TeamId, cancellationToken);
            if (team is not null)
            {
                creator = await _db.UserClubs
                    .AsNoTracking()
                    .Where(uc => uc.ClubId == team.ClubId && uc.IsCreator)
                    .Select(uc => uc.ApplicationUserId)
                    .FirstOrDefaultAsync(cancellationToken);
            }
        }

        if (string.IsNullOrEmpty(creator)) return;

        var creatorUser = await _userManager.FindByIdAsync(creator);
        if (creatorUser?.Email == null) return;

        var applicant = await _userManager.FindByIdAsync(linkRequest.ApplicationUserId);
        var teamPlayer = await _db.TeamPlayers.AsNoTracking()
            .Include(tp => tp.Player)
            .FirstOrDefaultAsync(tp => tp.Id == linkRequest.TeamPlayerId, cancellationToken);

        if (applicant == null || teamPlayer == null) return;

        var placeholders = new Dictionary<string, string>
        {
            ["CoachName"] = creatorUser.UserName ?? string.Empty,
            ["ApplicantAlias"] = applicant.UserName ?? string.Empty,
            ["PlayerName"] = $"{teamPlayer.Player.Name} {teamPlayer.Player.LastName}".Trim()
        };

        var subject = "Nueva solicitud de vinculación a jugador - Futbol Base";
        await _emailService.SendEmailAsync(creatorUser.Email, subject, "TeamPlayerLinkRequestReceivedTemplate", placeholders);
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "CreateUser: could not send team player link request notification for request {RequestId}", linkRequest.Id);
    }
}
```
Si la plantilla `TeamPlayerLinkRequestReceivedTemplate` no existe en `Infrastructure/Services/Email/Templates/`, créala copiando `ClubJoinRequestReceivedTemplate.html` y adaptando el texto ("Un usuario solicita vincularse como familiar/jugador de {{PlayerName}}...").

**4.7 — `enum RegistrationStatus`**: añade `PendingPlayerLinkApproval`:
```csharp
public enum RegistrationStatus { Active, PendingClubApproval, PendingPlayerLinkApproval }
```

**4.8 — `RegisterAccountResponse`**: añade:
```csharp
public string? TeamPlayerLinkRequestId { get; set; }
```

**4.9 — Test existente a ACTUALIZAR** (no romper, adaptar a la nueva regla): `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/CreateUserHandlerTests.cs`, método `Handle_FamilyMember_WithValidInvitationAndTeamPlayer_CreatesUserProfileSoLoginDoesNotReAskForPlayer` (línea ~379). Este test registra un `FamilyMember` SIN código de jugador y hoy espera `RegistrationStatus.Active` — con el nuevo comportamiento eso ya no es correcto (debe quedar `PendingPlayerLinkApproval`). Actualízalo así:
- Después de crear `teamPlayer` y antes de construir el `command`, genera el código: `teamPlayer.GenerateLinkCode(); await setupDb.SaveChangesAsync();` (usa `setupDb`, el mismo `DbContext` con el que se creó `teamPlayer`).
- Añade al `command`: `PlayerLinkCode = teamPlayer.LinkCode`.
- El resto del test (aserciones sobre `RegistrationStatus.Active` y `UserProfile`) se mantiene igual — así seguís cubriendo el camino "código correcto = igual que antes".

**4.10 — Tests NUEVOS** en el mismo archivo, junto al anterior:
- `Handle_FamilyMember_WithoutPlayerLinkCode_CreatesPendingLinkRequest_AndDoesNotCreateUserTeamOrProfile`: mismo setup que el test anterior pero SIN `PlayerLinkCode` en el `command`. Verifica: `result` es `Ok<RegisterAccountResponse>` con `Status == RegistrationStatus.PendingPlayerLinkApproval` y `TeamPlayerLinkRequestId` no nulo; `assertDb.UserTeams` no contiene fila para ese usuario; `assertDb.UserProfiles` no contiene fila para ese usuario; `assertDb.TeamPlayerLinkRequests` contiene una fila `Pending` con `TeamPlayerId == teamPlayer.Id` y `MembershipId == Membership.FamilyPlayer.Id`.
- `Handle_Player_WithWrongPlayerLinkCode_ReturnsBadRequestWithPlayerLinkCodeInvalidCode`: setup similar con `AccountType = AppRoles.Player.Name`, `PlayerLinkCode = "WRONGCODE"` (el `teamPlayer` real tiene otro código o ninguno). Verifica 400 + `ErrorCodes.PlayerLinkCodeInvalid`.
- `Handle_Player_WithExistingPendingRequestForSameTeamPlayer_ReturnsConflictWithLinkedPlayerRequestPendingCode`: crea primero una `TeamPlayerLinkRequest` Pending para ese `teamPlayer` con `Membership.Player.Id` (insertada directamente en `setupDb`), luego intenta registrar un segundo usuario `Player` para el mismo `teamPlayer` sin código. Verifica 409 + `ErrorCodes.LinkedPlayerRequestPending`.

Verificar: `dotnet build && dotnet test --filter CreateUserHandlerTests`

- [x] Hecho

---

## Tarea 5 — Aprobar/rechazar solicitudes (backend) (≈2h)

Nuevo archivo: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/TeamPlayerLinkRequests/Queries/GetTeamPlayerLinkRequests.cs` — copia la estructura de `Features/Coaches/ClubJoinRequests/Queries/GetClubJoinRequests.cs` (léelo primero) adaptada:
- Ruta: `GET api/teams/{teamId}/player-link-requests`, query param `status`.
- Autorización: `_scopeAuth.EnsureCreatorAsync(userId, ScopeKinds.Team, teamId, cancellationToken)` (en vez de `ScopeKinds.Club`).
- `TeamPlayerLinkRequestsQuery : IRequest<IResult>, IRequireFeaturePermission` con `FeatureRoute => CoachFeatureRoutes.TeamPlayerLinkRequests`, `RequiredPermission => "Read"`.
- DTO `TeamPlayerLinkRequestDto` con: `Id`, `ApplicationUserId`, `ApplicantAlias`, `ApplicantEmail`, `TeamPlayerId`, `PlayerName` (de `TeamPlayer.Player.Name` + `LastName`), `MembershipKey` (de `Membership.Key`, para distinguir Player/FamilyPlayer en la UI), `Status`, `RequestedAt`, `DecidedAt`, `DecidedByAlias`.
- Query EF: `_db.TeamPlayerLinkRequests.AsNoTracking().Include(r => r.TeamPlayer).ThenInclude(tp => tp.Player).Where(r => r.TeamId == request.TeamId)`, mismo filtro `pending`/`decided`/`all` que `GetClubJoinRequests`.

Nuevo archivo: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/TeamPlayerLinkRequests/Commands/ApproveTeamPlayerLinkRequest.cs` — copia la estructura de `Commands/ApproveClubJoinRequest.cs` (léelo primero) adaptada:
- Ruta: `POST api/team-player-link-requests/{requestId}/approve`.
- `FeatureRoute => CoachFeatureRoutes.TeamPlayerLinkRequests`, `RequiredPermission => "ReadWrite"`.
- Busca `_db.TeamPlayerLinkRequests.FirstOrDefaultAsync(r => r.Id == request.RequestId, ...)`; 404 con `ErrorCodes.TeamPlayerLinkRequestNotFound` si no existe.
- Autoriza con `_scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Team, linkRequest.TeamId, cancellationToken)`.
- 409 con `ErrorCodes.TeamPlayerLinkRequestAlreadyDecided` si `Status != Pending`.
- Dentro de la transacción (mismo patrón `CreateExecutionStrategy`/`BeginTransactionAsync` que `ApproveClubJoinRequest.cs`): `linkRequest.Approve(callerUserId)`; crea `var userTeam = new UserTeam(linkRequest.ApplicationUserId, linkRequest.TeamId, linkRequest.MembershipId); userTeam.LinkPlayer(linkRequest.TeamPlayerId); _db.UserTeams.Add(userTeam);`.
- **Concurrencia**: envuelve el `await strategy.ExecuteAsync(...)` en `try { ... } catch (DbUpdateException) { return Results.Conflict(new ProblemDetails { Status = 409, Title = "Jugador ya vinculado", Detail = "Este jugador ya tiene una cuenta de tipo Player vinculada.", Extensions = { ["code"] = ErrorCodes.LinkedPlayerAlreadyClaimed } }); }` — esto captura la violación del índice único de `UserTeams` cuando dos aprobaciones concurrentes compiten por el mismo `TeamPlayer` con rol Player. La solicitud NO se marca como decidida en ese caso (el `SaveChangesAsync` de toda la transacción falla y hace rollback).
- Tras el `try/catch` (fuera de la transacción, best-effort): asigna el rol de Identity (`EnsureIdentityRoleAsync`-equivalente inline, usando `membershipKey` → nombre de rol: `Membership.Player.Key` → `AppRoles.Player.Name`, `Membership.FamilyPlayer.Key` → `AppRoles.FamilyMember.Name`); llama a `SaveUserProfileAsync`-equivalente (reutiliza el mismo patrón que `CreateUser.Handler.SaveUserProfileAsync`, puedes duplicar el método privado aquí — no lo extraigas a un servicio compartido, mantén el diff mínimo); envía email de aprobación (best-effort, log warning si falla, sin plantilla nueva obligatoria — reutiliza `ClubJoinApprovedTemplate` adaptando el texto si quieres, o omite el email si no hay tiempo, no es crítico para los tests).

Nuevo archivo: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/TeamPlayerLinkRequests/Commands/RejectTeamPlayerLinkRequest.cs` — copia exacta de la estructura de `Commands/RejectClubJoinRequest.cs` adaptada de la misma forma (sin transacción especial, `linkRequest.Reject(callerUserId); await _db.SaveChangesAsync(...)`, email best-effort opcional).

Archivo: `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/CoachFeatureRoutes.cs` — añade junto a `ClubRegistrations`:
```csharp
public const string TeamPlayerLinkRequests = "/coach/teams/player-link-requests";
```

Tests nuevos en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/`:
- `GetTeamPlayerLinkRequestsHandlerTests.cs`, `ApproveTeamPlayerLinkRequestHandlerTests.cs`, `RejectTeamPlayerLinkRequestHandlerTests.cs` — sigue el estilo de los tests equivalentes de `ClubJoinRequests` si existen en el repo (búscalos primero con el mismo nombre patrón `*ClubJoinRequest*HandlerTests.cs`; si no existen, sigue el estilo de `CreateUserHandlerTests.cs`: `PostgresContainerFixture`, mocks de `UserManager`/`RoleManager`).
- Casos mínimos: aprobación feliz crea `UserTeam` con `LinkedTeamPlayerId` correcto; no-creador del equipo → 403; solicitud ya decidida → 409 `TeamPlayerLinkRequestAlreadyDecided`; dos aprobaciones concurrentes sobre el mismo `TeamPlayer`+Player → la segunda 409 `LinkedPlayerAlreadyClaimed`, la solicitud sigue Pending tras el intento fallido.

Verificar: `dotnet build && dotnet test --filter "TeamPlayerLinkRequest"`

- [x] Hecho

---

## Tarea 6 — Código del jugador: generar/consultar (backend) (≈1h)

Nuevo archivo: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/RegenerateTeamPlayerLinkCode.cs`:
```csharp
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Scopes;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class RegenerateTeamPlayerLinkCode : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/team-players/{teamPlayerId}/link-code/regenerate",
                    async (string teamPlayerId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        return await mediator.Send(new RegenerateTeamPlayerLinkCodeCommand
                        {
                            TeamPlayerId = teamPlayerId,
                            CallerUserId = userId
                        }, cancellationToken);
                    })
                .WithName(nameof(RegenerateTeamPlayerLinkCode))
                .WithTags("TeamPlayerLinkRequestsFeature")
                .RequireAuthorization()
                .Produces<TeamPlayerLinkCodeResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class RegenerateTeamPlayerLinkCodeCommand : IRequest<IResult>, IRequireFeaturePermission
    {
        public string TeamPlayerId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.TeamPlayerLinkRequests;
        public string RequiredPermission => "ReadWrite";
    }

    public class TeamPlayerLinkCodeResponse
    {
        public string TeamPlayerId { get; set; } = string.Empty;
        public string LinkCode { get; set; } = string.Empty;
    }

    public class RegenerateTeamPlayerLinkCodeHandler : IRequestHandler<RegenerateTeamPlayerLinkCodeCommand, IResult>
    {
        private readonly AppDbContext _db;
        private readonly IScopeAuthorizationService _scopeAuth;

        public RegenerateTeamPlayerLinkCodeHandler(AppDbContext db, IScopeAuthorizationService scopeAuth)
        {
            _db = db; _scopeAuth = scopeAuth;
        }

        public async ValueTask<IResult> Handle(RegenerateTeamPlayerLinkCodeCommand request, CancellationToken cancellationToken)
        {
            var teamPlayer = await _db.TeamPlayers.FirstOrDefaultAsync(tp => tp.Id == request.TeamPlayerId, cancellationToken);
            if (teamPlayer is null)
            {
                return Results.NotFound(new ProblemDetails
                {
                    Title = "Jugador no encontrado",
                    Detail = "No existe el jugador indicado."
                });
            }

            var auth = await _scopeAuth.EnsureCreatorAsync(request.CallerUserId, ScopeKinds.Team, teamPlayer.TeamId, cancellationToken);
            if (!auth.Authorized)
            {
                return Results.Problem(statusCode: auth.Status, title: auth.Title, detail: auth.Detail);
            }

            var code = teamPlayer.GenerateLinkCode();
            await _db.SaveChangesAsync(cancellationToken);

            return Results.Ok(new TeamPlayerLinkCodeResponse { TeamPlayerId = teamPlayer.Id, LinkCode = code });
        }
    }
}
```

Nuevo archivo: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetTeamPlayerLinkCode.cs` — mismo patrón (`GET api/team-players/{teamPlayerId}/link-code`, `RequiredPermission => "Read"`), pero en el handler: si `teamPlayer.LinkCode is null`, llama a `teamPlayer.GenerateLinkCode()` y `SaveChangesAsync` antes de devolver (generación perezosa), si no, devuelve el existente. Reutiliza `TeamPlayerLinkCodeResponse`.

Tests nuevos: `RegenerateTeamPlayerLinkCodeHandlerTests.cs`, `GetTeamPlayerLinkCodeHandlerTests.cs` — casos: creador del equipo/club puede generar/leer; usuario sin ser creador → 403; lectura sin código previo lo genera y lo persiste.

Verificar: `dotnet build && dotnet test --filter TeamPlayerLinkCode`

- [x] Hecho

---

## Tarea 7 — Backend: verificación completa (≈15min)

- [x] `dotnet build` desde `Back/ExtractionApi` sin errores ni warnings nuevos.
- [x] `dotnet test` completo — 620/622 pass. Los 2 fallos (`AdnLegibleImporterFullDocumentSpotCheckTests`, `GameModelSeederRealDocumentTests`) son preexistentes y no relacionados con este cambio (parsing de documento de modelo de juego).

---

## Tarea 8 — Frontend: tipos + payload de registro (≈30min)

Archivo: `Front/src/shared/types/scope.ts`:
- `RegisterPayingAccountPayload`: añade `playerLinkCode?: string;`.
- `RegistrationStatus`: cambia a `"Active" | "PendingClubApproval" | "PendingPlayerLinkApproval";`.
- `RegisterPayingAccountResponse`: añade `teamPlayerLinkRequestId: string | null;`.
- Nuevo tipo, junto a `ClubJoinRequestDto`:
```ts
export type TeamPlayerLinkRequestStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface TeamPlayerLinkRequestDto {
  id: string;
  applicationUserId: string;
  applicantAlias: string | null;
  applicantEmail: string | null;
  teamPlayerId: string;
  playerName: string;
  membershipKey: "Player" | "FamilyPlayer";
  status: TeamPlayerLinkRequestStatus;
  requestedAt: string;
  decidedAt: string | null;
  decidedByAlias: string | null;
}
```

- [x] Hecho

---

## Tarea 9 — Frontend: `Register.tsx` (≈2h)

**Importante**: NO reutilices `InvitationCodeField` para este campo — ese componente SIEMPRE hace una llamada de *preview* en vivo a `invitationsApi.previewClubCode`/`previewTeamCode`, que no existe para el código de jugador (validarlo antes de enviarlo revelaría si es correcto sin "gastarlo", y no hay endpoint de preview para esto). Usa un `TextField` de MUI normal, sin validación en vivo — el error solo llega al hacer submit.

**9.1 — Test primero (Red)**: `Front/src/shared/pages/auth/register/Register.test.tsx` (léelo primero para seguir su estilo de mocks/render). Añade:
- Caso: al rellenar el formulario como `Player` (o `FamilyMember`) con código de equipo válido y jugador seleccionado, SIN código de jugador, y el mock de `coachAuthService.registerPayingAccount` devuelve `{ status: "PendingPlayerLinkApproval", ... }` → tras el submit se muestra un mensaje de "pendiente de aprobación del entrenador" (usa el mismo componente `PendingClubApprovalNotice` con un nuevo prop, ver 9.2).
- Caso: con código de jugador relleno, el payload enviado a `registerPayingAccount` incluye `playerLinkCode` con el valor introducido.
- Caso: si el mock rechaza con `{ response: { data: { code: "PlayerLinkCodeInvalid", detail: "..." } } }`, el mensaje de error se muestra (usa `mapApiErrorToMessage`, mismo patrón que los demás errores del formulario — no hace falta un manejo especial por campo).

**9.2 — `PendingClubApprovalNotice.tsx`**: generalízalo para aceptar un `kind` opcional:
```tsx
import { Alert, Typography } from "@mui/material";
import styles from "./PendingClubApprovalNotice.module.css";

interface Props {
  kind?: "club" | "playerLink";
}

const MESSAGES: Record<"club" | "playerLink", string> = {
  club: "Tu solicitud de club ha sido enviada. Un director del club deberá aprobarla antes de que puedas acceder. Te avisaremos por correo cuando se resuelva.",
  playerLink: "Tu solicitud de vinculación ha sido enviada. El entrenador del equipo deberá aprobarla antes de que puedas acceder a los datos del jugador. Te avisaremos por correo cuando se resuelva.",
};

export default function PendingClubApprovalNotice({ kind = "club" }: Props) {
  return (
    <Alert severity="info" className={styles.notice}>
      <Typography variant="body1">{MESSAGES[kind]}</Typography>
    </Alert>
  );
}
```

**9.3 — `Register.tsx`**:
- `RegisterFormState`: añade `playerLinkCode: string;` y `pendingReason: "club" | "playerLink" | null;` (reemplaza `registeredPendingApproval: boolean` por `pendingReason`, ajusta todos sus usos).
- `initialState`: `playerLinkCode: ""`, `pendingReason: null`.
- `Action`: añade `{ type: "SET_PLAYER_LINK_CODE"; value: string }`; cambia `SUBMIT_SUCCESS_PENDING` a `{ type: "SUBMIT_SUCCESS_PENDING"; reason: "club" | "playerLink" }`.
- `reducer`: añade el caso `SET_PLAYER_LINK_CODE` (`return { ...state, playerLinkCode: action.value }`); `SUBMIT_SUCCESS_PENDING` pasa a `return { ...state, isSubmitting: false, pendingReason: action.reason };`.
- En `handleSubmit`, dentro de `if (isTeamCodeRole(state.role))`, añade:
  ```ts
  if (state.playerLinkCode.trim()) {
    payload.playerLinkCode = state.playerLinkCode.trim();
  }
  ```
- El `if (result.status === "PendingClubApproval")` pasa a:
  ```ts
  if (result.status === "PendingClubApproval") {
    dispatch({ type: "SUBMIT_SUCCESS_PENDING", reason: "club" });
  } else if (result.status === "PendingPlayerLinkApproval") {
    dispatch({ type: "SUBMIT_SUCCESS_PENDING", reason: "playerLink" });
  } else {
  ```
- El render `{state.registeredPendingApproval ? (<PendingClubApprovalNotice />) : ...}` pasa a `{state.pendingReason ? (<PendingClubApprovalNotice kind={state.pendingReason} />) : ...}`.
- Dentro del bloque `{(isTeamCodeRole(state.role)) && (<> ... <TeamPlayerPicker .../> </>)}`, después del `<TeamPlayerPicker />` (dentro del mismo `{state.codeValidation.status === "valid" && state.codeValidation.team && (...)}`), añade:
  ```tsx
  <TextField
    label="Código del jugador (opcional)"
    variant="outlined"
    fullWidth
    helperText="Si el entrenador te ha dado un código para este jugador, introdúcelo para vincularte al instante. Si no lo tienes, tu solicitud quedará pendiente de aprobación."
    value={state.playerLinkCode}
    onChange={(e) => dispatch({ type: "SET_PLAYER_LINK_CODE", value: e.target.value })}
  />
  ```
  (`TextField` ya está importado en el archivo).

Verificar: `npm run test -- Register` (desde `Front/`) && `npm run build`

- [x] Hecho

---

## Tarea 10 — Frontend: servicio + página de solicitudes para el coach (≈2h)

**10.1 — Servicio**. Nuevo archivo `Front/src/shared/services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi.ts`, calco exacto de `Front/src/shared/services/clubJoinRequests/clubJoinRequestsApi.ts` (léelo primero) pero SIN mock (no crees `__mocks__/`, usa directamente `client`):
```ts
import { client } from "../../../core/api/client";
import type { TeamPlayerLinkRequestDto } from "../../types/scope";

export type TeamPlayerLinkRequestStatusFilter = "pending" | "decided" | "all";

export class TeamPlayerLinkRequestsApi {
  async list(teamId: string, status: TeamPlayerLinkRequestStatusFilter): Promise<TeamPlayerLinkRequestDto[]> {
    const res = await client.get(`/api/teams/${encodeURIComponent(teamId)}/player-link-requests`, {
      params: { status },
    });
    return res.data as TeamPlayerLinkRequestDto[];
  }

  async approve(requestId: string): Promise<void> {
    await client.post(`/api/team-player-link-requests/${encodeURIComponent(requestId)}/approve`);
  }

  async reject(requestId: string): Promise<void> {
    await client.post(`/api/team-player-link-requests/${encodeURIComponent(requestId)}/reject`);
  }
}

export const teamPlayerLinkRequestsApi = new TeamPlayerLinkRequestsApi();
```

**10.2 — Test primero (Red)**: nuevo `Front/src/shared/pages/TeamPlayerLinkRequests/TeamPlayerLinkRequests.test.tsx`, calco del test de `ClubJoinRequests` si existe (busca `Front/src/shared/pages/ClubJoinRequests/ClubJoinRequests.test.tsx`; si no existe, escribe el test desde cero siguiendo el propio componente): listado inicial vacío muestra "No hay solicitudes pendientes."; con filas, aprobar/rechazar abre `ConfirmDialog` y llama al servicio correcto; cambiar de tab a "Decididas" llama a `list(teamId, "decided")`.

**10.3 — Página**. Nuevo archivo `Front/src/shared/pages/TeamPlayerLinkRequests/TeamPlayerLinkRequests.tsx` (+ `TeamPlayerLinkRequests.module.css`, copia el CSS de `ClubJoinRequests.module.css` tal cual). Calco estructural exacto de `Front/src/shared/pages/ClubJoinRequests/ClubJoinRequests.tsx` (léelo primero) con estas diferencias:
- Lee `teamId` de `useSearchParams()` en vez de `clubId`.
- Usa `teamPlayerLinkRequestsApi` en vez de `clubJoinRequestsApi` (sin `getPendingCount` — omite esa llamada y el estado `pendingCount`, no existe endpoint de conteo para esto; deja las tabs sin badge de conteo).
- Título: `"Solicitudes de vinculación a jugadores"`.
- Añade una columna `TableCell` "Jugador" (`{r.playerName}`) entre "Email" y las columnas de fecha/acciones, en ambas vistas (tabla y tarjeta).
- Textos de `ConfirmDialog` adaptados: aprobar → `` `¿Vincular a ${row.applicantAlias} (${row.applicantEmail}) con ${row.playerName}? Se le concederá acceso a los datos de ese jugador.` ``; rechazar → `` `¿Rechazar la solicitud de ${row.applicantAlias} para vincularse con ${row.playerName}?` ``.

**10.4 — Ruta**. Archivo `Front/src/core/router/AppRouter.tsx`: añade el `lazy` import junto al de `ClubJoinRequests` y una nueva `<Route>` análoga:
```tsx
const TeamPlayerLinkRequests = lazy(
  () => import("../../shared/pages/TeamPlayerLinkRequests/TeamPlayerLinkRequests")
);
```
```tsx
<Route
  path="/team-player-link-requests"
  element={
    <RequireAuth>
      <TeamPlayerLinkRequests />
    </RequireAuth>
  }
/>
```
(colócala junto a la ruta `/club-join-requests` existente).

**10.5 — Enlace de navegación**. Archivo `Front/src/shared/pages/ScopeMembers/ScopeMembers.tsx`: junto al bloque `{scopeKind === "club" && (<Badge>...<Button to="/club-join-requests?clubId=...">Solicitudes de entrenadores</Button></Badge>)}` (línea ~196-212), añade un bloque análogo para equipo (sin badge de conteo, ya que no hay endpoint de conteo — usa un `Button` simple):
```tsx
{scopeKind === "team" && (
  <Button
    variant="outlined"
    color="primary"
    component={RouterLink}
    to={`/team-player-link-requests?teamId=${encodeURIComponent(scopeId)}`}
    startIcon={<GroupAddIcon />}
  >
    Solicitudes de vinculación a jugadores
  </Button>
)}
```
(`GroupAddIcon`, `Button`, `RouterLink` ya están importados en el archivo).

Verificar: `npm run test -- TeamPlayerLinkRequests` && `npm run build`

- [x] Hecho

---

## Tarea 11 — Frontend: ficha del jugador — ver/generar código (≈1.5h)

**11.1 — Test primero (Red)**: nuevo `Front/src/apps/coach/pages/player/components/__tests__/PlayerLinkCode.test.tsx` (sigue el patrón de mocks de otro componente hermano en esa misma carpeta `components/`, p.ej. `ContactInfo` o `FamilyMembers` si tienen test — si no, monta el componente directo con Testing Library): muestra "Cargando..." y luego el código tras `GET /api/team-players/{id}/link-code`; botón "Regenerar código" abre `ConfirmDialog`, al confirmar llama a `POST .../link-code/regenerate` y actualiza el código mostrado; botón "Copiar" llama a `navigator.clipboard.writeText` con el código actual (mockea `navigator.clipboard`).

**11.2 — Servicio**. Archivo `Front/src/apps/coach/services/teamplayerService.ts` (léelo primero para seguir su estilo/exports): añade dos funciones siguiendo el mismo patrón que las existentes:
```ts
export async function getTeamPlayerLinkCode(teamPlayerId: string): Promise<{ teamPlayerId: string; linkCode: string }> {
  const res = await api.get(`/api/team-players/${encodeURIComponent(teamPlayerId)}/link-code`);
  return res.data;
}

export async function regenerateTeamPlayerLinkCode(teamPlayerId: string): Promise<{ teamPlayerId: string; linkCode: string }> {
  const res = await api.post(`/api/team-players/${encodeURIComponent(teamPlayerId)}/link-code/regenerate`);
  return res.data;
}
```
(usa el mismo import de cliente Axios — `api` o el nombre que use ese archivo — y el mismo manejo de tipos que las funciones vecinas).

**11.3 — Componente**. Nuevo archivo `Front/src/apps/coach/pages/player/components/PlayerLinkCode.tsx` (+ `.module.css` mínimo si el resto de componentes hermanos lo usan — mira `ContactInfo.module.css` como referencia de estilo de tarjeta): recibe `teamPlayerId: string` como prop; al montar llama a `getTeamPlayerLinkCode`; muestra el código en un `Paper`/`Box` con botón "Copiar" (icono `ContentCopyIcon`) y botón "Regenerar" (icono `RefreshIcon`) que abre `ConfirmDialog` ("¿Regenerar el código? El código anterior dejará de funcionar.") antes de llamar a `regenerateTeamPlayerLinkCode`; maneja loading/error igual que los componentes hermanos de esa carpeta (mismo patrón `useState`/`useEffect`/`try-catch` que `ContactInfo.tsx` o similar — léelo primero).

**11.4 — Integración**. Archivo `Front/src/apps/coach/pages/player/PlayerDetail.tsx`: importa `PlayerLinkCode` junto a los demás imports de `./components/*`, y renderízalo junto a `<ContactInfo .../>`/`<FamilyMembers .../>` (mismo nivel, pasando el `teamPlayerId` que ya tiene disponible el componente — busca cómo `FamilyMembers` recibe su id de jugador y replica el mismo patrón de prop).

Verificar: `npm run test -- PlayerLinkCode` && `npm run build`

- [x] Hecho

---

## Tarea 12 — Verificación final end-to-end (≈30min)

- [x] `dotnet build` (Back/ExtractionApi) sin errores (0 warnings, 0 errors) — verificado directamente por el coordinador.
- [x] `dotnet test` (Back/ExtractionApi) — 620/622 pass; 2 fallos preexistentes no relacionados (`AdnLegibleImporter`/`GameModelSeeder`) — verificado directamente.
- [x] `npm run build` (Front) — build de producción ok — verificado directamente.
- [x] `npm run test` (Front) — Register, TeamPlayerLinkRequests, PlayerLinkCode: 100% pass en ejecución aislada (27 + 6 tests). Full suite: 422/446 pass, 24 fallos preexistentes/no relacionados por timeouts bajo carga (SeasonManager, SeasonClubField, SportEventDialog, GameModelFormEditor, TeamRulesEdit, etc.) — verificado directamente.
- [x] Revisa que ningún archivo de `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Migrations/` fuera del nuevo (`AddTeamPlayerLinkRequestsAndPlayerLinkCode*`) haya sido modificado.
- [x] Checkboxes de `tasks.md` (1 a 9) actualizados a `[x]` según lo verificado; la nota de "Prueba manual end-to-end" queda sin marcar (requiere servidor corriendo).

**Nota de revisión manual del coordinador**: `PlayerLinkCode.test.tsx` tenía 3/6 tests fallando al terminar el agente. Causas y fix aplicados directamente: (1) el mock de `ConfirmDialog` usaba una ruta relativa con un `../` de menos (el test vive en `components/__tests__/`, un nivel más profundo que el componente); (2) el `aria-label` de los botones "Copiar código"/"Regenerar código" quedaba en el `<span>` que envuelve el `Tooltip`, no en el `IconButton`, así que `getByLabelText` no encontraba el botón real — se añadió `aria-label` explícito al `IconButton` y los tests se cambiaron a `getByRole("button", { name })`; (3) `navigator.clipboard` debe stubearse **después** del `render()` inicial (antes del click), no antes, porque el montaje dispara un acceso a `navigator.clipboard` que revierte un stub definido pre-render. También se quitó el `startIcon` inválido (prop de `Button`, no de `IconButton`) del botón de regenerar.

---

## Verification (resumen de comandos)

Backend (desde `Back/ExtractionApi`):
```
dotnet build
dotnet test --filter TeamPlayerLinkRequestTests
dotnet test --filter CreateUserHandlerTests
dotnet test --filter "TeamPlayerLinkRequest"
dotnet test --filter TeamPlayerLinkCode
dotnet test
```

Frontend (desde `Front`):
```
npm run test -- Register
npm run test -- TeamPlayerLinkRequests
npm run test -- PlayerLinkCode
npm run build
npm run test
```
