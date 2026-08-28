# Implement — simplify-player-family-registration

Sigue las tareas en orden. Cada tarea es TDD: escribe/edita el test primero (Red), impleméntalo (Green), verifica con el comando indicado. Marca cada checkbox `- [ ]` → `- [x]` en ESTE archivo y en `tasks.md` cuando termines y verifiques la tarea correspondiente. Todos los paths son relativos a `C:\Proyects\MisProyectos\FutbolBase`.

Convenciones: sigue exactamente los patrones de los archivos de referencia citados en cada tarea (mismos usings, mismo estilo, mismo namespace). No inventes convenciones nuevas. Lee `design.md` completo antes de empezar — contiene el razonamiento detrás de cada decisión.

---

## Tarea 1 — Dominio: `TeamPlayer` nuevos métodos de intención (≈1h)

Archivo: `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/TeamPlayer.cs`

Añade, junto a los demás métodos `Set*`:
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

Nuevo archivo de test: `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/TeamPlayerTests.cs` (xUnit puro, sin BD — construye un `TeamPlayer` con `TeamPlayer.Create(...)` usando un `TeamPlayerModel` mínimo válido; mira `TeamPlayerLinkRequestTests.cs` o cualquier test de dominio existente para el estilo de construcción/asserts con FluentAssertions si el repo las usa, si no usa `Assert` de xUnit igual que el resto del archivo):
- `UpdateContactEmail_SetsEmail_PreservingAddressAndPhone`
- `UpdateContactEmail_WithEmptyOrNullEmail_DoesNothing`
- `AddFamilyMemberEmailIfMissing_WhenEmailNotPresent_AddsNewFamilyEntry`
- `AddFamilyMemberEmailIfMissing_WhenEmailAlreadyPresent_CaseInsensitive_DoesNotDuplicate`
- `AddFamilyMemberEmailIfMissing_WithEmptyOrNullEmail_DoesNothingAndReturnsFalse`

Verificar: `dotnet build && dotnet test --filter TeamPlayerTests`

- [x] Hecho

---

## Tarea 2 — `CreateUser.cs`: resolver por código, sin equipo/roster (≈2.5h)

Archivo: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Users/Commands/CreateUser.cs`

**2.1 — `Command`**: elimina `TeamInvitationCode` y `TeamPlayerId`. `PlayerLinkCode` se mantiene tal cual (`string?`), pero ahora es obligatorio para Player/FamilyMember (lo exige el `Validator`, no el tipo).

**2.2 — `Validator`**: sustituye
```csharp
When(r => IsPlayer(r.AccountType) || IsFamilyMember(r.AccountType), () =>
{
    RuleFor(r => r.TeamInvitationCode).NotEmpty();
    RuleFor(r => r.TeamPlayerId).NotEmpty();
});
```
por
```csharp
When(r => IsPlayer(r.AccountType) || IsFamilyMember(r.AccountType), () =>
{
    RuleFor(r => r.PlayerLinkCode).NotEmpty();
});
```

**2.3 — `Handler.Handle`**: sustituye TODO el bloque `else if (IsPlayer(accountType) || IsFamilyMember(accountType)) { ... }` (líneas ~150-214 del archivo actual) por:
```csharp
else if (IsPlayer(accountType) || IsFamilyMember(accountType))
{
    var wantedMembership = IsPlayer(accountType) ? Membership.Player : Membership.FamilyPlayer;
    var normalizedCode = (request.PlayerLinkCode ?? string.Empty).Trim().ToUpperInvariant();

    var teamPlayerEntity = await _db.TeamPlayers.AsNoTracking()
        .Include(tp => tp.Team)
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

    team = teamPlayerEntity.Team;
    membership = wantedMembership;
    resolvedTeamPlayerId = teamPlayerEntity.Id;
}
```
Declara `string? resolvedTeamPlayerId = null;` junto a las demás variables locales (`Club? club = null;` etc., sección "2. Pre-checks"). Elimina la variable `bool playerLinkCodeMatched = false;` y su declaración (ya no se usa) — revisa que no quede ninguna otra referencia.

**2.4 — Bloque transaccional** (sección "3. Create the Identity user..."): elimina `TeamPlayerLinkRequest? pendingLinkRequest = null;`. Dentro de `strategy.ExecuteAsync`, sustituye las dos ramas actuales:
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
por una única rama:
```csharp
else if (team is not null && membership is not null) // Player/FamilyMember, código ya validado arriba
{
    var userTeam = new UserTeam(user.Id, team.Id, membership.Id);
    userTeam.LinkPlayer(resolvedTeamPlayerId!);
    _db.UserTeams.Add(userTeam);

    if (IsPlayer(accountType))
    {
        var trackedTeamPlayer = await _db.TeamPlayers.FirstAsync(tp => tp.Id == resolvedTeamPlayerId, cancellationToken);
        trackedTeamPlayer.UpdateContactEmail(request.Email);
    }
    else if (IsFamilyMember(accountType))
    {
        var trackedTeamPlayer = await _db.TeamPlayers.FirstAsync(tp => tp.Id == resolvedTeamPlayerId, cancellationToken);
        trackedTeamPlayer.AddFamilyMemberEmailIfMissing(request.Email);
    }
}
```
(el `_db.SaveChangesAsync(cancellationToken)` que ya existe al final del delegate persiste también estos cambios, al estar `trackedTeamPlayer` trackeado por el mismo `_db`).

**2.5 — Después de la transacción**:
- `if (pendingJoinRequest is null && pendingLinkRequest is null)` pasa a `if (pendingJoinRequest is null)` (ya no existe `pendingLinkRequest`).
- El bloque `if (team is not null && pendingLinkRequest is null && (IsPlayer(accountType) || IsFamilyMember(accountType)))` pasa a `if (team is not null && (IsPlayer(accountType) || IsFamilyMember(accountType)))`, y `request.TeamPlayerId!` dentro de `SaveUserProfileAsync(...)` pasa a `resolvedTeamPlayerId!`.
- Elimina por completo el bloque `if (pendingLinkRequest is not null) { await NotifyTeamCreatorOfPendingLinkRequestAsync(...); }` y el método privado `NotifyTeamCreatorOfPendingLinkRequestAsync` entero.
- En el `return Results.Ok(new RegisterAccountResponse { ... })`: `Status` pasa a `pendingJoinRequest is not null ? RegistrationStatus.PendingClubApproval : RegistrationStatus.Active` (elimina la rama `PendingPlayerLinkApproval`); elimina la línea `TeamPlayerLinkRequestId = pendingLinkRequest?.Id`.

**2.6 — `enum RegistrationStatus`**: `public enum RegistrationStatus { Active, PendingClubApproval, PendingPlayerLinkApproval }` pasa a `public enum RegistrationStatus { Active, PendingClubApproval }`.

**2.7 — `RegisterAccountResponse`**: elimina `public string? TeamPlayerLinkRequestId { get; set; }`.

**2.8 — Tests existentes a REVISAR y ACTUALIZAR** en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/CreateUserHandlerTests.cs` y `CreateUserValidatorTests.cs`: lee ambos archivos completos primero. Cualquier test que construya un `Command` con `TeamInvitationCode`/`TeamPlayerId`, o que pase por el flujo Player/FamilyMember pasando por roster/equipo, debe reescribirse para: crear el `TeamPlayer` de prueba, llamar a `teamPlayer.GenerateLinkCode()` y guardar, y pasar `PlayerLinkCode = teamPlayer.LinkCode` en el `Command` en vez de `TeamInvitationCode`/`TeamPlayerId`. Cualquier test que verificaba `RegistrationStatus.PendingPlayerLinkApproval`, `ErrorCodes.LinkedPlayerNotInTeam` o `ErrorCodes.LinkedPlayerRequestPending` debe eliminarse o reescribirse (ese comportamiento ya no existe). Cualquier test que espera `AlreadyLinked`/roster para "jugador ya vinculado" debe adaptarse: crea dos usuarios Player e intenta vincular al mismo `TeamPlayer` por su `LinkCode` en ambos → el segundo debe devolver 409 `LinkedPlayerAlreadyClaimed`.

**2.9 — Tests NUEVOS** en `CreateUserHandlerTests.cs`, junto a los existentes de Player/FamilyMember:
- `Handle_Player_WithNonExistentLinkCode_ReturnsBadRequestWithPlayerLinkCodeInvalidCode`.
- `Handle_Player_WithValidLinkCode_LinksInstantlyAndUpdatesTeamPlayerContactEmail`: verifica `UserTeam.LinkedTeamPlayerId` correcto y que, tras recargar el `TeamPlayer` desde BD, `ContactInfo.Email == request.Email` (y que `Address`/`Phone` previos, si el `TeamPlayer` de prueba los tenía, se conservan).
- `Handle_FamilyMember_WithNewEmail_AddsFamilyMemberEntry`: verifica que `TeamPlayer.FamilyMembers` (recargado de BD) contiene una entrada con `Email == request.Email`.
- `Handle_FamilyMember_WithEmailAlreadyInFamilyMembers_DoesNotDuplicate_ButStillLinksUser`: pre-siembra un `Family` con ese email en el `TeamPlayer` antes de registrar; tras el registro, `FamilyMembers.Count` no ha cambiado, pero sí existe el `UserTeam` del nuevo usuario.
- `Handle_MultipleFamilyMembers_ForSameTeamPlayer_AllLinkSuccessfully`: dos registros `FamilyMember` distintos sobre el mismo `LinkCode` → ambos `UserTeam` creados, ninguno da 409.

Verificar: `dotnet build && dotnet test --filter CreateUserHandlerTests && dotnet test --filter CreateUserValidatorTests`

- [x] Hecho

---

## Tarea 3 — Retirar el feature de aprobación manual (backend) (≈1h)

Elimina estos archivos:
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/TeamPlayerLinkRequests/Queries/GetTeamPlayerLinkRequests.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/TeamPlayerLinkRequests/Commands/ApproveTeamPlayerLinkRequest.cs`
- `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/TeamPlayerLinkRequests/Commands/RejectTeamPlayerLinkRequest.cs`
- Si la carpeta `Features/Coaches/TeamPlayerLinkRequests/` queda vacía tras esto, elimínala.
- Sus tests correspondientes en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/` (busca `GetTeamPlayerLinkRequestsHandlerTests.cs`, `ApproveTeamPlayerLinkRequestHandlerTests.cs`, `RejectTeamPlayerLinkRequestHandlerTests.cs`; si no existen con esos nombres exactos, búscalos por contenido: `grep -r "TeamPlayerLinkRequestsQuery\|ApproveTeamPlayerLinkRequestCommand\|RejectTeamPlayerLinkRequestCommand"`).

Archivo: `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs` — elimina `LinkedPlayerNotInTeam`, `LinkedPlayerRequestPending`, `TeamPlayerLinkRequestNotFound`, `TeamPlayerLinkRequestAlreadyDecided`. **Antes de borrar cada uno**, comprueba con grep que ningún otro archivo del repo (backend) los sigue usando (p. ej. `TeamPlayerLinkRequest.cs` domain entity usa `ErrorCodes.LinkedPlayerRequired`/`TeamPlayerLinkRequestAlreadyDecided` en su propio `Create`/`EnsurePending` — si los sigue usando la entidad de dominio que se mantiene, NO borres ese código, solo los que quedan sin ningún uso).

Deja intactos (no tocar): `Domain/Aggregates/UserClubs/TeamPlayerLinkRequest.cs`, su `EntityConfiguration`, el `DbSet<TeamPlayerLinkRequest>` en `AppDbContext`, y `Features/Coaches/Players/Commands/RegenerateTeamPlayerLinkCode.cs` + `Features/Coaches/Players/Queries/GetTeamPlayerLinkCode.cs` (y sus tests) — estos siguen en uso desde la ficha del jugador.

Verificar: `dotnet build` (0 errores, sin referencias rotas a los tipos eliminados) `&& dotnet test` completo.

- [x] Hecho (nota: `TeamPlayerLinkRequestAlreadyDecided` se mantuvo en `ErrorCodes.cs` — sigue en uso por la entidad de dominio `TeamPlayerLinkRequest.EnsurePending()`, que se conserva; ver comentario añadido en el archivo)

---

## Tarea 4 — Frontend: tipos (≈20min)

Archivo: `Front/src/shared/types/scope.ts`:
- `RegisterPayingAccountPayload`: elimina `teamInvitationCode?`/`teamPlayerId?` si existen como campos propios (mira su definición exacta primero); `playerLinkCode?: string` se mantiene.
- El tipo de `status` en `RegisterPayingAccountResponse` (o el tipo `RegistrationStatus` si está separado): elimina el literal `"PendingPlayerLinkApproval"`.
- Elimina `teamPlayerLinkRequestId` de `RegisterPayingAccountResponse` si existe como campo.

- [x] Hecho

---

## Tarea 5 — Frontend: `Register.tsx` — campo único obligatorio + límite de intentos (≈2.5h)

Lee `Front/src/shared/pages/auth/register/Register.tsx` y su test `Register.test.tsx` completos primero (ya los tienes citados en `design.md` §5).

**5.1 — Test primero (Red)**: en `Register.test.tsx`, para los casos de rol Player/FamilyMember:
- El formulario muestra un único campo "Código del jugador" (sin `InvitationCodeField(kind="team")` ni `TeamPlayerPicker`).
- El botón de envío está deshabilitado hasta que el campo tiene contenido.
- Si `registerPayingAccount` rechaza con `{ response: { data: { code: "PlayerLinkCodeInvalid" } } }`, se muestra el error bajo/junto al campo y el formulario sigue siendo enviable (intento 1 y 2).
- Al tercer rechazo consecutivo con ese mismo código de error, el campo y el botón quedan deshabilitados y se muestra el mensaje de máximo de intentos.
- Si rechaza con `{ response: { data: { code: "LinkedPlayerAlreadyClaimed" } } }`, se muestra el error de formulario correspondiente y NO cuenta como intento fallido de código (el contador de intentos solo sube con `PlayerLinkCodeInvalid`).
- Envío exitoso (`status: "Active"`) navega/muestra el mensaje de éxito igual que hoy; no debe quedar ninguna aserción sobre `"PendingPlayerLinkApproval"`.

**5.2 — Implementación** (`design.md` §5):
- `RegisterFormState`: elimina `selectedTeamPlayerId`; añade `playerLinkCodeAttempts: number` (inicial `0`) y `playerLinkCodeLocked: boolean` (inicial `false`).
- `Action`: elimina `SET_SELECTED_TEAM_PLAYER`; añade `{ type: "PLAYER_LINK_CODE_FAILED" }` y `{ type: "LOCK_PLAYER_LINK_CODE" }` (o combina ambos en un solo action que incrementa y bloquea al llegar a 3 — tu elección, mantenlo simple).
- `reducer`: al recibir el fallo, incrementa `playerLinkCodeAttempts`; si tras incrementar `>= 3`, pon `playerLinkCodeLocked: true`.
- Elimina el bloque JSX actual `{(isTeamCodeRole(state.role)) && (<> <InvitationCodeField kind="team" .../> {state.codeValidation.status === "valid" && ... <TeamPlayerPicker .../> <TextField label="Código del jugador (opcional)" .../> } </>)}` y sustitúyelo por el bloque único de `design.md` §5 (campo obligatorio, `disabled={state.playerLinkCodeLocked}`, `helperText` condicional).
- `canSubmit`: la condición `(isTeamCodeRole(state.role) && state.codeValidation.status === "valid" && !!state.selectedTeamPlayerId)` pasa a `(isTeamCodeRole(state.role) && !!state.playerLinkCode.trim() && !state.playerLinkCodeLocked)`.
- `handleSubmit`: el bloque `if (isTeamCodeRole(state.role)) { payload.teamInvitationCode = ...; payload.teamPlayerId = ...; if (state.playerLinkCode.trim()) payload.playerLinkCode = ...; }` pasa a `if (isTeamCodeRole(state.role)) { payload.playerLinkCode = state.playerLinkCode.trim(); }`.
- En el `catch (error)`: antes de `dispatch({ type: "SUBMIT_ERROR", message: errorMessage })`, si `isTeamCodeRole(state.role)` y el código de error extraído (usa la misma utilidad que ya use `mapApiErrorToMessage`/`getErrorMessage` para leer `error.response?.data?.code`) es `"PlayerLinkCodeInvalid"`, despacha primero el action de fallo de intento.
- Elimina el `else if (result.status === "PendingPlayerLinkApproval")` en el `try` de `handleSubmit`.
- `PendingClubApprovalNotice`: quita el prop `kind="playerLink"` de sus usos (el componente pasa a aceptar solo `"club"`, o se simplifica sin prop `kind` — decide según cuánto más código toque; lo mínimo es dejar de pasarle `"playerLink"` en algún sitio, que ya no ocurrirá tras este cambio).

**5.3 — i18n**. Archivos `Front/src/shared/i18n/locales/es/errors.json` y `.../en/errors.json`: añade
```json
"PlayerLinkCodeInvalid": "El código introducido no corresponde a ningún jugador."
```
(y en inglés: `"The code you entered does not match any player."`).

Verificar: `npm run test -- Register && npm run build`

- [x] Hecho

---

## Tarea 6 — Frontend: retirar página de aprobación manual (≈1h)

- Comprueba con grep (`grep -r "TeamPlayerPicker" Front/src`) si `shared/pages/auth/register/components/TeamPlayerPicker.tsx` se usa en algún otro sitio aparte de `Register.tsx`. Si no, elimínalo junto a su test.
- Elimina la carpeta `Front/src/shared/pages/TeamPlayerLinkRequests/` completa (componente + test + CSS module).
- Elimina `Front/src/shared/services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi.ts`.
- Archivo `Front/src/core/router/AppRouter.tsx`: elimina el `lazy` import y la `<Route>` de `TeamPlayerLinkRequests` (busca `team-player-link-requests`).
- Busca en `Front/src/apps/coach/` (grep `player-link-requests`) cualquier `Button`/`Link` que apunte a esa ruta (p. ej. en `ScopeMembers.tsx`) y elimínalo.
- Tipos en `shared/types/scope.ts` que solo servían a esta página (`TeamPlayerLinkRequestDto`, `TeamPlayerLinkRequestStatus`, etc., si existen) — elimínalos si no los usa nada más.

Verificar: `npm run build` (sin imports rotos) `&& npm run test`

- [x] Hecho

---

## Tarea 7 — Verificación final (≈45min)

- [ ] `dotnet build` completo (backend) — 0 warnings, 0 errors.
- [ ] `dotnet test` completo (backend) — compara contra el recuento de tests antes de empezar; cualquier fallo debe ser preexistente y no relacionado (documenta cuáles si los hay).
- [ ] `npm run test` completo (frontend) — mismo criterio.
- [ ] `npm run build` (frontend) — build de producción ok.
- [ ] Grep final de residuos: `grep -rn "TeamPlayerLinkRequestId\|PendingPlayerLinkApproval\|teamInvitationCode\|teamPlayerId" Back/ExtractionApi/src Front/src` — revisa cada resultado; los que queden deben ser de otros flujos legítimos (p. ej. `ClubInvitationCode` no es esto), no restos de este.
- [ ] Prueba manual end-to-end (registro Player y FamilyMember con código válido/inválido/ya vinculado) — requiere servidor corriendo, fuera del alcance del agente si no hay entorno disponible; déjalo sin marcar y anótalo.

---

## Verification (resumen de comandos)

Backend (desde `Back/ExtractionApi`):
```
dotnet build
dotnet test --filter TeamPlayerTests
dotnet test --filter CreateUserHandlerTests
dotnet test --filter CreateUserValidatorTests
dotnet test
```

Frontend (desde `Front`):
```
npm run test -- Register
npm run build
npm run test
```
