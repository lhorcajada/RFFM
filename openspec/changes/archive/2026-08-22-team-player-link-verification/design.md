## Architecture Decisions

### 0. Lo que ya existe y no hay que tocar

- La unicidad "solo una cuenta `Player` por `TeamPlayer`" **ya está garantizada a nivel de BD**: `UserTeamEntityConfiguration.cs` tiene un índice único parcial (`LinkedTeamPlayerId` único cuando `RoleId = 4`). No se toca.
- `TeamRosterQueries.GetRoster` ya calcula `AlreadyLinked` contra ese mismo índice para prefiltrar el picker. Se mantiene tal cual — solo se añade una comprobación adicional (ver §3) para las solicitudes ya pendientes, que el índice de BD no cubre.
- `Team.JoinCode` (código de equipo) no cambia de significado ni de flujo: sigue siendo obligatorio para elegir el equipo/roster. El `LinkCode` nuevo es un segundo código, específico del `TeamPlayer`, opcional.

### 1. `TeamPlayer.LinkCode` — código propio del jugador

```csharp
// Domain/Entities/TeamPlayers/TeamPlayer.cs
public string? LinkCode { get; private set; }

public string GenerateLinkCode()
{
    LinkCode = Guid.NewGuid().ToString("N")[..ValidationConstants.PlayerLinkCodeLength].ToUpperInvariant();
    return LinkCode;
}
```
`ValidationConstants.PlayerLinkCodeLength = 8` (mismo criterio que `TeamJoinCodeLength`). `LinkCode` es nulo hasta que el coach lo genera por primera vez desde la ficha del jugador — no se genera automáticamente al crear el `TeamPlayer.Create()`, porque la mayoría de fichas no lo necesitarán de inmediato (solo cuando el coach quiera invitar a esa familia).

EF config (`TeamPlayerEntityConfiguration.cs`, existente): añadir
```csharp
builder.Property(tp => tp.LinkCode).IsRequired(false).HasMaxLength(ValidationConstants.PlayerLinkCodeLength);
builder.HasIndex(tp => tp.LinkCode); // lookup por código en el registro
```

### 2. Nueva entidad `TeamPlayerLinkRequest` (mismo patrón que `ClubJoinRequest`)

```csharp
// Domain/Aggregates/UserClubs/TeamPlayerLinkRequest.cs
public enum TeamPlayerLinkRequestStatus { Pending = 0, Approved = 1, Rejected = 2, Cancelled = 3 }

public class TeamPlayerLinkRequest : BaseEntity, IAggregateRoot
{
    public string ApplicationUserId { get; private set; } = string.Empty;
    public string TeamId { get; private set; } = string.Empty;
    public string TeamPlayerId { get; private set; } = string.Empty;
    public int MembershipId { get; private set; } // Player o FamilyPlayer
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
            throw new DomainException("TeamPlayerLinkRequest", "Usuario, equipo y jugador son obligatorios.", ErrorCodes.LinkedPlayerRequired);

        return new TeamPlayerLinkRequest
        {
            ApplicationUserId = applicationUserId, TeamId = teamId, TeamPlayerId = teamPlayerId,
            MembershipId = membershipId, Status = TeamPlayerLinkRequestStatus.Pending, RequestedAt = DateTime.UtcNow
        };
    }

    public void Approve(string decidedByUserId) { EnsurePending(); Status = TeamPlayerLinkRequestStatus.Approved; DecidedAt = DateTime.UtcNow; DecidedByUserId = decidedByUserId; }
    public void Reject(string decidedByUserId) { EnsurePending(); Status = TeamPlayerLinkRequestStatus.Rejected; DecidedAt = DateTime.UtcNow; DecidedByUserId = decidedByUserId; }

    private void EnsurePending()
    {
        if (Status != TeamPlayerLinkRequestStatus.Pending)
            throw new DomainException("TeamPlayerLinkRequest", "La solicitud ya ha sido decidida.", ErrorCodes.TeamPlayerLinkRequestAlreadyDecided);
    }
}
```

EF config nueva (`TeamPlayerLinkRequestEntityConfiguration.cs`), calco de `ClubJoinRequestEntityConfiguration.cs`: FK a `Team`, `TeamPlayer`, `Membership`; índices `(TeamId, Status)` y `ApplicationUserId`.

Migración: `dotnet ef migrations add AddTeamPlayerLinkRequestsAndPlayerLinkCode --project src\RFFM.Api --startup-project src\RFFM.Host` (vía `manage-migrations.ps1 -Action create -Context AppDbContext`).

### 3. `CreateUser.cs` — rama Player/FamilyMember

Se añade `PlayerLinkCode` (opcional) al `Command`. La lógica existente (validar `TeamInvitationCode`, resolver roster, comprobar `AlreadyLinked`) no cambia; se inserta después:

```csharp
else if (IsPlayer(accountType) || IsFamilyMember(accountType))
{
    // ...igual que hoy hasta obtener `chosen`...

    // NUEVO: no se puede solicitar dos veces el mismo TeamPlayer como Player mientras
    // haya una solicitud pendiente (el índice único de BD solo protege UserTeams ya
    // aprobados, no evita dos TeamPlayerLinkRequest Pending simultáneas).
    if (wantedMembership.Key == Membership.Player.Key)
    {
        var alreadyPending = await _db.TeamPlayerLinkRequests.AsNoTracking().AnyAsync(r =>
            r.TeamPlayerId == request.TeamPlayerId
            && r.MembershipId == Membership.Player.Id
            && r.Status == TeamPlayerLinkRequestStatus.Pending, cancellationToken);
        if (alreadyPending)
            return Results.Conflict(new ProblemDetails { Status = 409, Title = "Solicitud ya en curso",
                Detail = "Ya hay una solicitud pendiente para vincularse a este jugador.",
                Extensions = { ["code"] = ErrorCodes.LinkedPlayerRequestPending } });
    }

    // NUEVO: código propio del jugador, opcional
    if (!string.IsNullOrWhiteSpace(request.PlayerLinkCode))
    {
        var normalized = request.PlayerLinkCode.Trim().ToUpperInvariant();
        var teamPlayerEntity = await _db.TeamPlayers.AsNoTracking()
            .FirstOrDefaultAsync(tp => tp.Id == request.TeamPlayerId, cancellationToken);
        if (teamPlayerEntity?.LinkCode is null || teamPlayerEntity.LinkCode.ToUpperInvariant() != normalized)
        {
            return Results.BadRequest(new ProblemDetails { Title = "Código de jugador inválido",
                Detail = "El código introducido no corresponde a este jugador.",
                Extensions = { ["code"] = ErrorCodes.PlayerLinkCodeInvalid } });
        }
        playerLinkCodeMatched = true; // variable local, ver flujo transaccional abajo
    }
}
```

Dentro de la transacción existente (mismo `strategy.ExecuteAsync`), la rama `team is not null && membership is not null` se divide en dos casos:

```csharp
else if (team is not null && membership is not null && playerLinkCodeMatched) // código de jugador correcto
{
    var userTeam = new UserTeam(user.Id, team.Id, membership.Id);
    userTeam.LinkPlayer(request.TeamPlayerId!);
    _db.UserTeams.Add(userTeam); // idéntico al comportamiento actual
}
else if (team is not null && membership is not null) // sin código válido → pendiente de aprobación del coach
{
    pendingLinkRequest = TeamPlayerLinkRequest.Create(user.Id, team.Id, request.TeamPlayerId!, membership.Id);
    _db.TeamPlayerLinkRequests.Add(pendingLinkRequest);
}
```

`EnsureIdentityRoleAsync` y `SaveUserProfileAsync` (que hoy siempre corren para Player/FamilyMember) solo deben ejecutarse cuando **no** queda pendiente — igual que ya ocurre para el camino de Coach-con-código (`pendingJoinRequest is null`). `RegistrationStatus` gana un tercer valor `PendingPlayerLinkApproval`, y `RegisterAccountResponse` un campo `TeamPlayerLinkRequestId`. Se envía un email al coach del equipo (mismo patrón que `NotifyClubCreatorOfPendingRequestAsync`, pero resolviendo el creador vía `UserTeams`/`UserClubs` del equipo).

### 4. Nuevo feature `Features/Coaches/TeamPlayerLinkRequests/` — aprobar/rechazar

Calco exacto de `Features/Coaches/ClubJoinRequests/`:

- `Queries/GetTeamPlayerLinkRequests.cs`: `GET api/teams/{teamId}/player-link-requests?status=`, autorizado con `_scopeAuth.EnsureCreatorAsync(callerUserId, ScopeKinds.Team, teamId, ct)` (ya soporta `Team`, incluye "creador del club padre" — ver `ScopeAuthorizationService.cs`). DTO añade `PlayerName`/`TeamPlayerId` respecto a `ClubJoinRequestDto`.
- `Commands/ApproveTeamPlayerLinkRequest.cs`: `POST api/team-player-link-requests/{requestId}/approve`. Igual que `ApproveClubJoinRequest.cs` pero, dentro de la transacción, crea `UserTeam` + `LinkPlayer(request.TeamPlayerId)` en vez de `UserClub`. **Concurrencia**: si dos solicitudes Pending para el mismo `TeamPlayer`+`Player` llegan a aprobarse casi a la vez, el índice único de `UserTeams` (§0) hace fallar el `SaveChangesAsync` de la segunda con `DbUpdateException` → se captura y se devuelve `409 LinkedPlayerAlreadyClaimed` sin decidir la solicitud (queda Pending para que el coach la rechace manualmente al ver el conflicto).
- `Commands/RejectTeamPlayerLinkRequest.cs`: igual que `RejectClubJoinRequest.cs`.

Nueva ruta lógica `CoachFeatureRoutes.TeamPlayerLinkRequests = "/coach/teams/player-link-requests"` para `IRequireFeaturePermission.FeatureRoute` (mismo mecanismo que `ClubRegistrations`).

### 5. Generar/consultar el `LinkCode` de un jugador

- `Commands/RegenerateTeamPlayerLinkCode.cs` (en `Features/Coaches/Players/Commands/`): `POST api/team-players/{teamPlayerId}/link-code/regenerate`. Resuelve el `TeamId` del `TeamPlayer`, autoriza con `EnsureCreatorAsync(ScopeKinds.Team, teamId)`, llama `teamPlayer.GenerateLinkCode()`, guarda y devuelve el código.
- `Queries/GetTeamPlayerLinkCode.cs`: `GET api/team-players/{teamPlayerId}/link-code`, misma autorización; si `LinkCode` es `null` lo genera de forma perezosa (evita un paso extra en la UI: "ver código" siempre funciona). Solo lo ve el coach/creador — no se expone en `TeamRosterQueries` (que también usan cuentas `Player` para ver el roster vía `CoachFeatureRoutes.Squad`), evitando el mismo error que motivó `2026-07-30-restrict-club-invitation-code-visibility`.

### 6. Errores nuevos (`Domain/ErrorCodes.cs`)

```csharp
public const string PlayerLinkCodeInvalid = "PlayerLinkCodeInvalid";
public const string LinkedPlayerRequestPending = "LinkedPlayerRequestPending";
public const string TeamPlayerLinkRequestNotFound = "TeamPlayerLinkRequestNotFound";
public const string TeamPlayerLinkRequestAlreadyDecided = "TeamPlayerLinkRequestAlreadyDecided";
```

### 7. Frontend

- **`Register.tsx`**: nuevo campo opcional "Código del jugador (si lo tienes)" bajo el `RosterPlayerPicker`, reutilizando `InvitationCodeField` (sin validación en vivo — a diferencia del código de equipo/club, este no tiene endpoint de *preview* porque validarlo antes de tiempo revelaría si un código es correcto sin haberlo "gastado"; se valida solo al enviar `POST /api/register`). El payload gana `playerLinkCode?: string`. El manejo de respuesta añade el caso `status === "PendingPlayerLinkApproval"` (mismo componente de aviso que ya existe para `PendingClubApproval`, texto adaptado: "Tu solicitud de vinculación quedará pendiente de aprobación del entrenador").
- **Nueva página `TeamPlayerLinkRequests.tsx`** (`Front/src/shared/pages/TeamPlayerLinkRequests/`), calco de `ClubJoinRequests.tsx`: mismas tabs Pendientes/Decididas, misma tabla/tarjeta, mismo `ConfirmDialog`; añade columna "Jugador". Nuevo servicio `shared/services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi.ts` (calco de `clubJoinRequestsApi.ts`). Ruta nueva en `AppRouter.tsx` (`/coach/teams/player-link-requests?teamId=`), enlazada desde donde hoy vive el acceso a "Solicitudes de club" en el coach (junto a `ClubRegistrations`).
- **`PlayerDetail.tsx`** (`apps/coach/pages/player/`): nueva sección/tarjeta "Código de vinculación" con el código actual (u opción de generarlo si no existe), botón copiar y botón regenerar (con `ConfirmDialog`, ya que invalida el código anterior), consumiendo los dos endpoints de §5.

## Files

**Backend** (nuevos):
- `Domain/Aggregates/UserClubs/TeamPlayerLinkRequest.cs`
- `Infrastructure/Persistence/Configuration/Aggregates/UserClubs/TeamPlayerLinkRequestEntityConfiguration.cs`
- `Features/Coaches/TeamPlayerLinkRequests/Queries/GetTeamPlayerLinkRequests.cs`
- `Features/Coaches/TeamPlayerLinkRequests/Commands/ApproveTeamPlayerLinkRequest.cs`
- `Features/Coaches/TeamPlayerLinkRequests/Commands/RejectTeamPlayerLinkRequest.cs`
- `Features/Coaches/Players/Commands/RegenerateTeamPlayerLinkCode.cs`
- `Features/Coaches/Players/Queries/GetTeamPlayerLinkCode.cs`
- Migración EF (`AddTeamPlayerLinkRequestsAndPlayerLinkCode`)

**Backend** (modificados):
- `Domain/Entities/TeamPlayers/TeamPlayer.cs` (+ `LinkCode`, `GenerateLinkCode()`)
- `Infrastructure/Persistence/Configuration/.../TeamPlayerEntityConfiguration.cs`
- `Features/Coaches/Users/Commands/CreateUser.cs`
- `Domain/ErrorCodes.cs`
- `Domain/Entities/CoachFeatureRoutes.cs` (+ `TeamPlayerLinkRequests`)

**Frontend** (nuevos):
- `shared/pages/TeamPlayerLinkRequests/TeamPlayerLinkRequests.tsx` (+ `.module.css`)
- `shared/services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi.ts`

**Frontend** (modificados):
- `shared/pages/auth/register/Register.tsx` (+ componentes/reducer asociados)
- `apps/coach/pages/player/PlayerDetail.tsx`
- `core/router/AppRouter.tsx`

## Tests (TDD — Red → Green → Refactor)

**Backend** (xUnit + Moq / InMemory-Sqlite `AppDbContext`):
- `TeamPlayerLinkRequestTests` (dominio): `Create` con datos válidos/incompletos; `Approve`/`Reject` sobre solicitud ya decidida lanza `DomainException`.
- `CreateUserHandlerTests`: Player/FamilyMember sin `PlayerLinkCode` → crea `TeamPlayerLinkRequest` Pending, no crea `UserTeam`, `Status = PendingPlayerLinkApproval`; con `PlayerLinkCode` correcto → crea `UserTeam` al instante como hoy; con código incorrecto → 400 `PlayerLinkCodeInvalid`; segunda solicitud Player mientras hay una Pending → 409 `LinkedPlayerRequestPending`; FamilyMember sin límite (dos solicitudes Pending simultáneas para el mismo jugador no chocan).
- `ApproveTeamPlayerLinkRequestHandlerTests`: aprobación feliz crea `UserTeam` con `LinkedTeamPlayerId`; no-creador del equipo/club → 403; solicitud ya decidida → 409; dos aprobaciones concurrentes para el mismo `TeamPlayer`+Player (violación del índice único) → la segunda devuelve 409 y la solicitud sigue Pending.
- `RegenerateTeamPlayerLinkCodeHandlerTests` / `GetTeamPlayerLinkCodeHandlerTests`: solo el creador del equipo/club puede generar o leer el código; lectura sin código previo lo genera.

**Frontend** (Vitest + Testing Library):
- `Register.test.tsx`: envío sin `playerLinkCode` muestra el aviso de "pendiente de aprobación"; envío con código válido no muestra aviso y navega como hoy; error `PlayerLinkCodeInvalid` se muestra bajo el campo.
- `TeamPlayerLinkRequests.test.tsx`: listado, aprobar/rechazar con `ConfirmDialog`, tabs Pendientes/Decididas — mismos casos que `ClubJoinRequests.test.tsx` si existe, adaptados.
- `PlayerDetail.test.tsx`: muestra el código existente; botón "Generar código" cuando no hay código; regenerar pide confirmación.

Coverage objetivo: handlers backend ≥80%, dominio ≥85%, componentes frontend ≥75% (CLAUDE.md).
