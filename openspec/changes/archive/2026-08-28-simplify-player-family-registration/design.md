## Architecture Decisions

### 0. Lo que ya existe y no hay que tocar

- `TeamPlayer.LinkCode` / `GenerateLinkCode()` (`Domain/Entities/TeamPlayers/TeamPlayer.cs`) ya existe — no se toca su generación.
- `Features/Coaches/Players/Commands/RegenerateTeamPlayerLinkCode.cs` y `Features/Coaches/Players/Queries/GetTeamPlayerLinkCode.cs` (el coach genera/consulta el código desde la ficha del jugador) **no cambian**. Ambos usan `CoachFeatureRoutes.TeamPlayerLinkRequests` como `FeatureRoute` — se mantiene esa constante aunque el feature de aprobación que le dio nombre desaparezca, para no romper permisos ya seedeados de estos dos endpoints.
- La unicidad "solo una cuenta `Player` por `TeamPlayer`" sigue garantizada por el índice único parcial de BD sobre `UserTeams.LinkedTeamPlayerId` (`RoleId = Player`) — no se toca.
- `TeamInvitationCode`/`ClubInvitationCode` y sus validaciones (`TeamInvitationValidation`, `ClubInvitationValidation`) no cambian para `Coach`/`ClubMember`; solo se deja de invocar `TeamInvitationValidation` en la rama `Player`/`FamilyMember`.

### 1. `CreateUser.cs` — resolver el `TeamPlayer` directo por `PlayerLinkCode`

`Command` pierde `TeamInvitationCode` y `TeamPlayerId` (solo se usaban en esta rama); `PlayerLinkCode` pasa de opcional a obligatorio:

```csharp
public string? PlayerLinkCode { get; set; } // ahora obligatorio para Player/FamilyMember
```

Nueva rama en el `Handler` (sustituye por completo la actual líneas 150-214):

```csharp
else if (IsPlayer(accountType) || IsFamilyMember(accountType))
{
    var wantedMembership = IsPlayer(accountType) ? Membership.Player : Membership.FamilyPlayer;
    var normalizedCode = (request.PlayerLinkCode ?? string.Empty).Trim().ToUpperInvariant();

    var teamPlayerEntity = await _db.TeamPlayers.AsNoTracking()
        .FirstOrDefaultAsync(tp => tp.LinkCode != null && tp.LinkCode.ToUpper() == normalizedCode, cancellationToken);

    if (teamPlayerEntity is null)
    {
        return Results.BadRequest(new ProblemDetails
        {
            Title = "Código de jugador inválido",
            Detail = "El código introducido no corresponde a ningún jugador.",
            Extensions = { ["code"] = ErrorCodes.PlayerLinkCodeInvalid }
        });
    }

    if (wantedMembership.Key == Membership.Player.Key)
    {
        var alreadyLinked = await _db.UserTeams.AsNoTracking().AnyAsync(ut =>
            ut.RoleId == Membership.Player.Id && ut.LinkedTeamPlayerId == teamPlayerEntity.Id, cancellationToken);
        if (alreadyLinked)
        {
            return Results.Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Jugador ya vinculado",
                Detail = "Este jugador ya tiene una cuenta de tipo Player vinculada.",
                Extensions = { ["code"] = ErrorCodes.LinkedPlayerAlreadyClaimed }
            });
        }
    }

    team = teamPlayerEntity.Team; // requiere Include(tp => tp.Team) en la query de arriba
    membership = wantedMembership;
    resolvedTeamPlayerId = teamPlayerEntity.Id; // nueva variable local, sustituye a request.TeamPlayerId
}
```

`playerLinkCodeMatched` deja de existir como variable (ya no hay bifurcación "con/sin código": con código obligatorio y válido siempre se vincula al instante). El bloque transaccional se simplifica: la rama `team is not null && membership is not null && playerLinkCodeMatched` pasa a ser simplemente `team is not null && membership is not null` (Player/FamilyMember), y se **elimina** la rama `else if (team is not null && membership is not null)` que creaba `TeamPlayerLinkRequest` pendiente. `userTeam.LinkPlayer(resolvedTeamPlayerId)` sustituye a `userTeam.LinkPlayer(request.TeamPlayerId!)`.

`SaveUserProfileAsync(user.Id, identityRoleName, request.TeamPlayerId!, team.Id, ...)` pasa a usar `resolvedTeamPlayerId`. `pendingLinkRequest`, `NotifyTeamCreatorOfPendingLinkRequestAsync`, `RegistrationStatus.PendingPlayerLinkApproval` y `RegisterAccountResponse.TeamPlayerLinkRequestId` se eliminan (ya no hay rama pendiente para este flujo).

**Actualizar el email de la ficha del jugador** (dentro de la misma rama transaccional, antes de `SaveChangesAsync`):

```csharp
if (IsPlayer(accountType))
{
    var trackedTeamPlayer = await _db.TeamPlayers.FirstAsync(tp => tp.Id == teamPlayerEntity.Id, cancellationToken);
    trackedTeamPlayer.UpdateContactEmail(request.Email);
}
else if (IsFamilyMember(accountType))
{
    var trackedTeamPlayer = await _db.TeamPlayers.FirstAsync(tp => tp.Id == teamPlayerEntity.Id, cancellationToken);
    trackedTeamPlayer.AddFamilyMemberEmailIfMissing(request.Email);
}
```

(Se recarga trackeado porque la búsqueda inicial es `AsNoTracking()`; evita mezclar la entidad no-trackeada con `SaveChangesAsync`.)

### 2. `TeamPlayer.cs` — nuevos métodos de intención

```csharp
public void UpdateContactEmail(string email)
{
    if (string.IsNullOrWhiteSpace(email))
        return;
    var current = ContactInfo;
    ContactInfo = new PlayerContactInfo(current?.Address, current?.Phone, email);
}

public bool AddFamilyMemberEmailIfMissing(string email)
{
    if (string.IsNullOrWhiteSpace(email))
        return false;
    var exists = FamilyMembers.Any(f => string.Equals(f.Email, email, StringComparison.OrdinalIgnoreCase));
    if (exists)
        return false;
    FamilyMembers.Add(new Family(address: null, phone: null, email: email, name: null, familyMember: null));
    return true;
}
```

`UpdateContactEmail` preserva `Address`/`Phone` existentes — no reemplaza `PlayerContactInfo` entero como hace `SetContactInfo` (pensado para la ficha completa desde el coach). `AddFamilyMemberEmailIfMissing` añade directamente a la colección (a diferencia de `SetFamily`, que solo actualiza in-place cuando el tamaño no cambia) — es el único caso de "añadir un familiar nuevo" fuera de la edición completa de ficha, así que necesita su propio método explícito.

### 3. Errores y limpieza (`Domain/ErrorCodes.cs`)

- Se reutiliza `PlayerLinkCodeInvalid` (ya existe) para "código no encontrado" — mismo mensaje que "código incorrecto", no hace falta un código nuevo.
- Se reutiliza `LinkedPlayerAlreadyClaimed` (ya existe).
- Se retiran (quedan sin referencias tras este cambio, pero no hace falta borrarlos de `ErrorCodes.cs` salvo limpieza): `LinkedPlayerNotInTeam`, `LinkedPlayerRequestPending`, `TeamPlayerLinkRequestNotFound`, `TeamPlayerLinkRequestAlreadyDecided` — se eliminan del archivo ya que solo los usaban `CreateUser.cs` (rama vieja) y el feature de aprobación que desaparece.

### 4. Retirada del feature de aprobación manual

Se eliminan por completo (código, no datos):
- `Features/Coaches/TeamPlayerLinkRequests/Queries/GetTeamPlayerLinkRequests.cs`
- `Features/Coaches/TeamPlayerLinkRequests/Commands/ApproveTeamPlayerLinkRequest.cs`
- `Features/Coaches/TeamPlayerLinkRequests/Commands/RejectTeamPlayerLinkRequest.cs`
- `NotifyTeamCreatorOfPendingLinkRequestAsync` en `CreateUser.cs`

Se **mantienen** (sin migración destructiva, ver Non-Goals): la entidad `Domain/Aggregates/UserClubs/TeamPlayerLinkRequest.cs`, su `EntityConfiguration` y el `DbSet<TeamPlayerLinkRequest>` en `AppDbContext` — quedan sin productores nuevos pero preservan filas históricas y evitan una migración de borrado de tabla/FKs con datos en producción.

### 5. Frontend — `Register.tsx`

- `RegisterFormState` pierde `selectedTeamPlayerId` y el uso de `codeValidation.team`/`InvitationCodeField(kind="team")`/`TeamPlayerPicker` para este flujo; gana `playerLinkCodeAttempts: number` (contador de intentos fallidos, máx. 3) y `playerLinkCodeLocked: boolean`.
- Nuevo bloque único para `isTeamCodeRole(state.role)`:
  ```tsx
  {isTeamCodeRole(state.role) && (
    <TextField
      label="Código del jugador"
      variant="outlined"
      fullWidth
      required
      helperText={
        state.playerLinkCodeLocked
          ? "Has alcanzado el número máximo de intentos. Contacta con tu entrenador para obtener el código correcto."
          : "Introduce el código que te ha dado tu entrenador para este jugador."
      }
      error={!!state.playerLinkCodeError}
      disabled={state.playerLinkCodeLocked}
      value={state.playerLinkCode}
      onChange={(e) => dispatch({ type: "SET_PLAYER_LINK_CODE", value: e.target.value })}
    />
  )}
  ```
- `canSubmit` para estos roles pasa a `!!state.playerLinkCode.trim() && !state.playerLinkCodeLocked` (ya no depende de `codeValidation`/`selectedTeamPlayerId`).
- `handleSubmit`: el payload para estos roles pasa a `{ ...base, playerLinkCode: state.playerLinkCode.trim() }` (sin `teamInvitationCode`/`teamPlayerId`).
- Manejo de error: en el `catch`, si el código de error es `PlayerLinkCodeInvalid`, incrementa `playerLinkCodeAttempts`; al llegar a 3 intentos fallidos, `dispatch({ type: "LOCK_PLAYER_LINK_CODE" })` bloquea el campo/envío. Si el código es `LinkedPlayerAlreadyClaimed`, se muestra igual que hoy vía `mapApiErrorToMessage` (ya mapeado en `errors.json`), sin afectar al contador de intentos.
- Se retira el `else if (result.status === "PendingPlayerLinkApproval")` de `handleSubmit` — ya no lo devuelve el backend; el único caso "pendiente" que puede llegar para estos roles ya no existe (queda solo el genérico `Active`, que muestra el mensaje de éxito normal — la activación por admin es un paso posterior fuera de este flujo, sin cambios).
- `PendingClubApprovalNotice` pierde el `kind="playerLink"` (queda solo `"club"`).
- `shared/types/scope.ts`: `RegisterPayingAccountPayload` pierde `teamInvitationCode`/`teamPlayerId`; `playerLinkCode` pasa a obligatorio para el caso de uso (sigue opcional a nivel de tipo TS ya que el payload es compartido entre roles). `RegisterPayingAccountResponse.status` pierde el valor `"PendingPlayerLinkApproval"`.
- `TeamPlayerPicker.tsx` deja de importarse en `Register.tsx`; si no lo usa nada más, se elimina el archivo (comprobar antes de borrar).

### 6. Frontend — retirada de la página de aprobación

Se eliminan: `shared/pages/TeamPlayerLinkRequests/TeamPlayerLinkRequests.tsx` (+ `.test.tsx`, `.module.css` si existe), `shared/services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi.ts`, la ruta correspondiente en `core/router/AppRouter.tsx` y cualquier enlace/badge que apunte a ella (buscar por `player-link-requests` en `apps/coach/`).

### 7. i18n

Añadir en `shared/i18n/locales/{es,en}/errors.json`:
```json
"PlayerLinkCodeInvalid": "El código introducido no corresponde a ningún jugador." / "The code you entered does not match any player."
```

## Files

**Backend** (modificados):
- `Features/Coaches/Users/Commands/CreateUser.cs`
- `Domain/Entities/TeamPlayers/TeamPlayer.cs` (+ `UpdateContactEmail`, `AddFamilyMemberEmailIfMissing`)
- `Domain/ErrorCodes.cs` (retirar 4 códigos obsoletos)

**Backend** (eliminados):
- `Features/Coaches/TeamPlayerLinkRequests/Queries/GetTeamPlayerLinkRequests.cs`
- `Features/Coaches/TeamPlayerLinkRequests/Commands/ApproveTeamPlayerLinkRequest.cs`
- `Features/Coaches/TeamPlayerLinkRequests/Commands/RejectTeamPlayerLinkRequest.cs`

**Frontend** (modificados):
- `shared/pages/auth/register/Register.tsx`
- `shared/pages/auth/register/components/PendingClubApprovalNotice.tsx` (retirar `kind="playerLink"`)
- `shared/types/scope.ts`
- `apps/coach/services/authService.ts` (si tipa el payload explícitamente)
- `core/router/AppRouter.tsx`
- `shared/i18n/locales/es/errors.json`, `shared/i18n/locales/en/errors.json`

**Frontend** (eliminados, tras confirmar que no se usan en otro sitio):
- `shared/pages/TeamPlayerLinkRequests/` (carpeta completa)
- `shared/services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi.ts`
- `shared/pages/auth/register/components/TeamPlayerPicker.tsx` (+ su test) si no se reutiliza en otro flujo

## Tests (TDD — Red → Green → Refactor)

**Backend** (xUnit + Moq / InMemory-Sqlite `AppDbContext`):
- `TeamPlayerTests` (dominio): `UpdateContactEmail` reemplaza solo el email preservando `Address`/`Phone`; `AddFamilyMemberEmailIfMissing` añade cuando no existe, no duplica cuando ya existe (comparación case-insensitive), ignora email vacío/null.
- `CreateUserHandlerTests`: código inexistente → 400 `PlayerLinkCodeInvalid`, sin crear usuario en BD huérfano (o si se crea el `IdentityUser`, verificar que no queda `UserTeam`); código válido, rol Player → `UserTeam` con `LinkedTeamPlayerId` correcto, `TeamPlayer.ContactInfo.Email` actualizado; segundo registro Player sobre el mismo código → 409 `LinkedPlayerAlreadyClaimed`; FamilyMember con email nuevo → se añade a `TeamPlayer.FamilyMembers`; FamilyMember con email ya existente en `FamilyMembers` → no duplica, sí crea el `UserTeam`; múltiples FamilyMember sobre el mismo jugador → todos se vinculan sin error.
- Verificar que las rutas de `TeamPlayerLinkRequests` (approve/reject/list) ya no están registradas (test de smoke sobre `WebApplicationExtensions`/`MapFeatures`, o simplemente que el `.cs` no compila más porque no existe).

**Frontend** (Vitest + Testing Library):
- `Register.test.tsx`: rol Player/FamilyMember solo muestra el campo "Código del jugador" (no aparece selector de equipo ni de roster); envío con código inválido muestra error bajo el campo y permite reintentar; al tercer intento fallido consecutivo, el campo/botón quedan deshabilitados con el mensaje de "máximo de intentos"; envío con `LinkedPlayerAlreadyClaimed` muestra el error de formulario correspondiente sin bloquear reintentos; envío exitoso navega/muestra éxito igual que hoy (sin rama `PendingPlayerLinkApproval`).

Coverage objetivo: handlers backend ≥80%, dominio ≥85%, componentes frontend ≥75% (CLAUDE.md).
