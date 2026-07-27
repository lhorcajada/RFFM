# Implement — add-mobile-app-mvp

Script técnico para el agente `openspec-implementer`. TDD estricto (Red → Green → Refactor) por bloque, en el orden de `tasks.md`. No avanzar de bloque sin que los tests del bloque actual pasen.

Convenciones detectadas en el repo:
- Tests backend en `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/` (xUnit, `#nullable enable`, namespace `RFFM.Api.Tests.UnitTests`). Tests que tocan `AppDbContext` usan `PostgresContainerFixture` real vía `[Collection(PostgresCollection.Name)]` — no InMemory.
- Catálogo de `code` de errores en `Domain/ErrorCodes.cs` — reutilizar `ErrorCodes.TeamAccessDenied` (ya existe) para el nuevo `TeamMembershipBehavior`; no inventar un code nuevo para ese caso.
- SmartEnum pattern de referencia: `Domain/Entities/PermissionType.cs` (Id + Name, lista estática, `FromId`/`FromName`).
- `FeaturePermission` constructor: `(featureName, featureRoute, roleName, PermissionType permissionType, bool isEditable = false)`.

---

## Bloque B1 — `TokenService.GenerateJwtForCredentials`

### Red
Crear/editar `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/TokenServiceTests.cs` (si ya existe uno, añadir ahí; si no, crearlo) con 4 casos contra `GenerateJwtForCredentials(username, password, ct)`:
- Usuario no existe → `DomainException` con code de `CodeMessages.LoginUserNotRegistered`.
- `EmailConfirmed == false` → `DomainException` con code de `CodeMessages.LoginEmailNotConfirmed`.
- Password incorrecta → `DomainException` con code de `CodeMessages.LoginErrorUserOrPassword`.
- Éxito → devuelve un JWT no vacío, decodificable, con claim `username` igual al usuario buscado.

Ejecutar `dotnet test --filter TokenServiceTests` → deben fallar en compilación (`GenerateJwtForCredentials` no existe).

### Green
Editar `Domain/Services/ITokenService.cs`: añadir `Task<string> GenerateJwtForCredentials(string username, string password, CancellationToken cancellationToken);`.

Editar `Domain/Services/TokenService.cs`:
1. Extraer de `GenerateJwtToken` (líneas ~121–153 actuales) un privado:
```csharp
private async Task<ApplicationUser> ValidateCredentialsAsync(string username, string password, CancellationToken cancellationToken)
{
    var normalizedUsername = username.ToUpperInvariant();
    var user = await _applicationDbContext.Users
        .FirstOrDefaultAsync(uc => uc.NormalizedUserName == normalizedUsername, cancellationToken);

    if (user == null)
        throw new DomainException("Generando token", CodeMessages.LoginUserNotRegistered.Message, CodeMessages.LoginUserNotRegistered.Code);

    if (!user.EmailConfirmed)
        throw new DomainException("Generando token", CodeMessages.LoginEmailNotConfirmed.Message, CodeMessages.LoginEmailNotConfirmed.Code);

    if (!VerifyPassword(password, user.PasswordHash ?? throw new InvalidOperationException()))
        throw new DomainException("Generando token", CodeMessages.LoginErrorUserOrPassword.Message, CodeMessages.LoginErrorUserOrPassword.Code);

    return user;
}
```
2. `GenerateJwtToken` (flujo temp-token) llama a `ValidateCredentialsAsync(username, password, cancellationToken)` en vez de repetir la lógica inline, y sigue con la construcción de claims que ya tenía.
3. Nuevo método público:
```csharp
public async Task<string> GenerateJwtForCredentials(string username, string password, CancellationToken cancellationToken)
{
    var user = await ValidateCredentialsAsync(username, password, cancellationToken);
    return await GenerateJwtForUser(user.Id, cancellationToken);
}
```
(`GenerateJwtForUser` ya existe y ya construye claims/roles/permisos — no duplicar esa parte.)

Ejecutar `dotnet test --filter TokenServiceTests` → deben pasar los 4 casos. Ejecutar también los tests preexistentes de `Login`/`TokenService` (si los hay) para confirmar que el refactor de `GenerateJwtToken` no rompió nada.

### Refactor
Revisar que `GenerateJwtToken` y `GenerateJwtForCredentials` no dupliquen construcción de claims (ambas deben acabar pasando por el mismo camino que `GenerateJwtForUser`).

---

## Bloque B2 — `POST /api/mobile/login`

### Red
Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/MobileLoginHandlerTests.cs`, mismos 4 casos que B1 pero invocando `MobileLoginHandler.Handle(new MobileLoginCommand(username, password), ct)` con un `ITokenService` real (o fake mínimo que delegue en la lógica ya testeada en B1 — preferir instancia real de `TokenService` contra `PostgresContainerFixture`, igual que el resto de la suite).

Ejecutar `dotnet test --filter MobileLoginHandlerTests` → deben fallar (`MobileLogin.cs` no existe).

### Green
Crear `Back/ExtractionApi/src/RFFM.Api/Features/Mobile/Auth/Commands/MobileLogin.cs`:
```csharp
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Auth.Commands;

namespace RFFM.Api.Features.Mobile.Auth.Commands
{
    public class MobileLogin : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/mobile/login",
                    async (MobileLoginCommand command, IMediator mediator, CancellationToken ct) =>
                        await mediator.Send(command, ct))
                .WithName(nameof(MobileLogin))
                .WithTags(AuthConstants.AuthFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status401Unauthorized);
        }

        public record MobileLoginCommand(string Username, string Password) : IRequest<IResult>;

        public class MobileLoginHandler(ITokenService tokenService) : IRequestHandler<MobileLoginCommand, IResult>
        {
            public async ValueTask<IResult> Handle(MobileLoginCommand request, CancellationToken cancellationToken)
            {
                var token = await tokenService.GenerateJwtForCredentials(request.Username, request.Password, cancellationToken);
                return Results.Ok(token);
            }
        }
    }
}
```
Confirmar que `AuthConstants.AuthFeature` es accesible (mismo namespace/using que `Login.cs`); si es `internal`, ajustar visibilidad o referenciar la constante correcta.

Ejecutar `dotnet test --filter MobileLoginHandlerTests` y `dotnet build`.

### Refactor
Ninguno adicional.

---

## Bloque B3 — `IRequireTeamMembership` + `TeamMembershipBehavior`

### Red
Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/TeamMembershipBehaviorTests.cs`:
- Fake request `record FakeTeamRequest(string TeamId) : IRequest<string>, IRequireTeamMembership;` para el test.
- Caso 1: usuario con rol `Player` sin fila `UserTeam` para ese `TeamId` → `ForbiddenAccessException`.
- Caso 2: usuario con rol `Player` con fila `UserTeam` para ese `TeamId` → pasa (`next` se invoca).
- Caso 3: usuario con rol `Coach` sin fila `UserTeam` → pasa sin comprobación (el behavior no aplica fuera de Player/FamilyMember).
- Usar `PostgresContainerFixture` para sembrar `UserTeam` real, y un `ICurrentUserService` fake/mock (Moq) para simular roles + `UserId`.

Ejecutar `dotnet test --filter TeamMembershipBehaviorTests` → deben fallar en compilación.

### Green
Crear `Back/ExtractionApi/src/RFFM.Api/Common/IRequireTeamMembership.cs`:
```csharp
namespace RFFM.Api.Common
{
    /// <summary>Mark a command/query with this to require the caller to belong to the referenced team (enforced only for Player/FamilyMember roles).</summary>
    public interface IRequireTeamMembership
    {
        string TeamId { get; }
    }
}
```

Crear `Back/ExtractionApi/src/RFFM.Api/Common/Behaviors/TeamMembershipBehavior.cs`:
```csharp
using Mediator;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Common.Behaviors
{
    public class TeamMembershipBehavior<TRequest, TResponse>(ICurrentUserService currentUser, AppDbContext db)
        : IPipelineBehavior<TRequest, TResponse>
        where TRequest : IRequest<TResponse>
    {
        private static readonly string[] RestrictedRoles = { "Player", "FamilyMember" };

        public async ValueTask<TResponse> Handle(
            TRequest message, MessageHandlerDelegate<TRequest, TResponse> next, CancellationToken cancellationToken)
        {
            if (message is not IRequireTeamMembership requirement)
                return await next(message, cancellationToken);

            var roles = (currentUser.Roles ?? []).ToArray();
            if (!roles.Any(r => RestrictedRoles.Contains(r, StringComparer.OrdinalIgnoreCase)))
                return await next(message, cancellationToken);

            if (!currentUser.IsAuthenticated || string.IsNullOrEmpty(currentUser.UserId))
                throw new UnauthorizedAccessException("No autenticado.");

            var belongs = await db.Set<RFFM.Api.Domain.Aggregates.UserClubs.UserTeam>()
                .AsNoTracking()
                .AnyAsync(ut => ut.ApplicationUserId == currentUser.UserId && ut.TeamId == requirement.TeamId, cancellationToken);

            if (!belongs)
                throw new DomainException("Autorización de equipo", "No tienes acceso a este equipo.", ErrorCodes.TeamAccessDenied);

            return await next(message, cancellationToken);
        }
    }
}
```
Nota: usar `DomainException` con `ErrorCodes.TeamAccessDenied` en vez de `ForbiddenAccessException` si el test de B3 (ya escrito en Red) esperaba `ForbiddenAccessException` — **decidir un único tipo de excepción y ajustar el test si hace falta**; revisar cómo se mapea cada una en `AddCustomProblemDetails()` (`ServiceCollectionExtensions.cs`) para no introducir un status code inconsistente con `FeaturePermissionBehavior` (que usa `ForbiddenAccessException`, mapeado a 403). Preferir `ForbiddenAccessException` con `ErrorCodes.TeamAccessDenied` como mensaje/code, por consistencia con `FeaturePermissionBehavior`.

Registrar el behavior en `DependencyInjection/ServiceCollectionExtensions.cs`, inmediatamente después del registro de `FeaturePermissionBehavior<,>`.

Ejecutar `dotnet test --filter TeamMembershipBehaviorTests`.

### Refactor
Confirmar orden del pipeline coincide con CLAUDE.md: Logging → Timing → Validation → FeaturePermission → TeamMembership → Caching → Cache Invalidation.

---

## Bloque B4 — Aplicar `IRequireTeamMembership` a queries existentes

### Red
Añadir a los tests existentes de `GetSportEvents`/`GetEventConvocations`/`GetMatchParticipation`/`GetEventPlayers` (o crear los archivos de test si no existen) un caso: usuario `Player` sin `UserTeam` para el `TeamId` solicitado → excepción de autorización.

### Green
- `Features/Coaches/SportEvents/Queries/GetSportEvents.cs`: `SportEventsQuery` ya tiene `TeamId` → añadir `: IRequireTeamMembership` a la lista de interfaces (ya implementa `IQueryApp<...>, IRequireFeaturePermission`).
- `Features/Coaches/Convocations/GetEventConvocations.cs`, `GetMatchParticipation.cs`, `GetEventPlayers.cs`: revisar si sus queries exponen `TeamId` directamente o solo `EventId`. **Si solo tienen `EventId`**: el query necesita resolver `TeamId` antes de que el behavior lo evalúe — como los `IPipelineBehavior` corren antes del handler y no pueden hacer una consulta intermedia fácilmente sin acoplarse al dominio de eventos, la opción más simple es que el propio record exponga `TeamId` como propiedad calculada tras un lookup ligero en el endpoint (en el lambda de `AddRoutes`, igual que ya se hace para resolver otros datos derivados antes de mandar el mediator), o cargar el `SportEvent.TeamId` en el propio handler y lanzar el check de pertenencia ahí mismo con `ClubInvitationCodeVisibility`-style helper reutilizando `TeamMembershipBehavior`'s DB check as a static method. Confirmar con el diseño real de cada archivo antes de decidir; documentar la decisión final en el PR/commit.

Ejecutar `dotnet test --filter GetSportEventsTests|EventConvocationsTests|MatchParticipationTests|EventPlayersTests`.

### Refactor
Ninguno adicional.

---

## Bloque B5 — Seed `FeaturePermission` para `FamilyMember` + ruta de asistencia

Editar `Back/ExtractionApi/src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`, dentro de `SeedFeaturePermissionsAsync`, añadir a la lista `entries`:
```csharp
("Squad", CoachFeatureRoutes.Squad, "FamilyMember", 1, false),
("Events", CoachFeatureRoutes.Events, "FamilyMember", 1, false),
("Convocations", CoachFeatureRoutes.Convocations, "FamilyMember", 1, false),
("News", CoachFeatureRoutes.News, "FamilyMember", 1, false),
("AttendanceConfirmation", CoachFeatureRoutes.AttendanceConfirmation, "Player", 3, false),
("AttendanceConfirmation", CoachFeatureRoutes.AttendanceConfirmation, "FamilyMember", 3, false),
```
Añadir en `Domain/Entities/CoachFeatureRoutes.cs`:
```csharp
public const string AttendanceConfirmation = "/mobile/attendance";
```
No hay test unitario aislado para el seed (es infraestructura de arranque) — verificar manualmente: arrancar la API, comprobar log `"✓ Permissions seeding finished"` sin errores, y `SELECT * FROM app."FeaturePermissions" WHERE "RoleName" = 'FamilyMember'` devuelve 4 filas.

---

## Bloque B6 — Entidad + migración `EventAttendanceConfirmation`

Crear `Domain/Entities/AttendanceStatus.cs` (SmartEnum, mismo patrón que `PermissionType`): `Pending (0)`, `Going (1)`, `NotGoing (2)`.

Crear `Domain/Entities/EventAttendanceConfirmation.cs` (`BaseEntity`, campos `SportEventId`, `TeamPlayerId`, `ConfirmedByApplicationUserId`, `AttendanceStatusId`, `RespondedAt`), constructor que valida campos no vacíos igual que otras entidades del dominio (ver `UserTeam.cs` como referencia de estilo de validación con `DomainException`).

Crear `Infrastructure/Persistence/Configuration/Entities/EventAttendanceConfirmationEntityConfiguration.cs` siguiendo el patrón de `FeaturePermissionEntityConfiguration.cs` (tabla, PK, índices — añadir índice único sobre `(SportEventId, TeamPlayerId)` para evitar duplicados). Registrar `DbSet<EventAttendanceConfirmation> EventAttendanceConfirmations` en `AppDbContext.cs`.

Ejecutar `.\manage-migrations.ps1` (nombre `AddEventAttendanceConfirmation`) — **revisar el script generado antes de aplicarlo** (comprobar que no toca tablas no relacionadas). `dotnet build` debe pasar.

---

## Bloque B7 — Comando `ConfirmAttendance`

### Red
Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/ConfirmAttendanceHandlerTests.cs`:
- Player confirma su propio `TeamPlayerId` (vinculado vía su propia fila `UserTeam`/`TeamPlayer.ApplicationUserId` — confirmar en el dominio real cuál es el vínculo Player↔TeamPlayer antes de escribir el test) → OK, fila creada/actualizada.
- FamilyMember confirma el `TeamPlayerId` igual a su `UserTeam.LinkedTeamPlayerId` → OK.
- FamilyMember intenta confirmar un `TeamPlayerId` distinto de su `LinkedTeamPlayerId` → `ForbiddenAccessException`.
- Validator: `Status` fuera del rango del SmartEnum → falla FluentValidation.

### Green
Crear `Features/Mobile/Attendance/Commands/ConfirmAttendance.cs`:
```csharp
public class ConfirmAttendance : IFeatureModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/mobile/events/{eventId}/attendance",
                async (string eventId, ConfirmAttendanceRequest body, IMediator mediator, CancellationToken ct) =>
                {
                    var command = new ConfirmAttendanceCommand
                    {
                        SportEventId = eventId,
                        TeamId = body.TeamId,
                        TeamPlayerId = body.TeamPlayerId,
                        Status = body.Status
                    };
                    await mediator.Send(command, ct);
                    return Results.NoContent();
                })
            .WithTags("Attendance")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
            .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
    }

    public record ConfirmAttendanceRequest(string TeamId, string TeamPlayerId, string Status);

    public record ConfirmAttendanceCommand : ICommand, IRequireFeaturePermission, IRequireTeamMembership
    {
        public string SportEventId { get; set; } = null!;
        public string TeamId { get; set; } = null!;
        public string TeamPlayerId { get; set; } = null!;
        public string Status { get; set; } = null!;

        public string FeatureRoute => CoachFeatureRoutes.AttendanceConfirmation;
        public string RequiredPermission => "Write";
    }

    public class Validator : AbstractValidator<ConfirmAttendanceCommand>
    {
        public Validator()
        {
            RuleFor(x => x.TeamPlayerId).NotEmpty();
            RuleFor(x => x.Status).Must(s => AttendanceStatus.List().Any(a => a.Name == s));
        }
    }

    public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<ConfirmAttendanceCommand>
    {
        public async ValueTask<Unit> Handle(ConfirmAttendanceCommand request, CancellationToken cancellationToken)
        {
            var isOwnPlayer = await db.Set<UserTeam>().AnyAsync(ut =>
                ut.ApplicationUserId == currentUser.UserId &&
                ut.TeamId == request.TeamId &&
                (ut.TeamPlayer != null && ut.TeamPlayer.Id == request.TeamPlayerId
                 || ut.LinkedTeamPlayerId == request.TeamPlayerId),
                cancellationToken);

            if (!isOwnPlayer)
                throw new ForbiddenAccessException("No puedes confirmar la asistencia de un jugador que no es el tuyo ni el de tu hijo vinculado.");

            // upsert EventAttendanceConfirmation ...
            return Unit.Value;
        }
    }
}
```
**Nota para el implementer**: confirmar contra el dominio real cómo se relaciona un `UserTeam` con rol `Player` con "su propio" `TeamPlayer` (puede ser directamente `TeamPlayer.ApplicationUserId`, o requerir el mismo `LinkedTeamPlayerId` que `FamilyPlayer`) antes de fijar la condición `isOwnPlayer` — no asumir, verificar en `Domain/Entities/TeamPlayers/TeamPlayer.cs` y ajustar el test de Red en consecuencia si el vínculo es distinto al descrito aquí.

Ejecutar `dotnet test --filter ConfirmAttendanceHandlerTests`.

### Refactor
Extraer el upsert a un método privado si crece; mantener el handler enfocado en una responsabilidad.

---

## Bloque B8 — `GET /api/mobile/me/teams`

### Red
Crear `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetMyTeamsHandlerTests.cs`: usuario con 0/1/2 `UserTeam` → array vacío / 1 elemento / 2 elementos, cada uno con `TeamId`, `TeamName`, `RoleId`, `LinkedTeamPlayerId`.

### Green
Crear `Features/Mobile/Teams/Queries/GetMyTeams.cs` (sin `IRequireFeaturePermission`, es autodescubrimiento): endpoint `GET /api/mobile/me/teams`, query lee `currentUser.UserId`, join `UserTeams`+`Team`.

Ejecutar `dotnet test --filter GetMyTeamsHandlerTests`.

---

## Bloque B9 (condicional) — `GetNews`

Antes de escribir código: `grep`/buscar en `Domain/Entities` si existe algo tipo `News`/`Announcement`/`Comunicado`. Si no existe ninguna entidad de dominio para esto, **no crear una nueva sin confirmarlo con el usuario** — dejar `NewsScreen` (M7) como placeholder y documentarlo como seguimiento fuera de este MVP. Si existe, replicar el patrón de `GetSportEvents.cs` con `FeatureRoute => CoachFeatureRoutes.News`.

---

## Bloque M1 — Scaffolding Expo

```bash
cd Mobile 2>/dev/null || (mkdir Mobile && cd Mobile)
npx create-expo-app@latest . --template blank-typescript
npx expo install expo-secure-store
npm install --save-dev jest-expo @testing-library/react-native @testing-library/jest-native
```
Configurar `package.json` `"test": "jest"` + `jest-expo` preset (`jest.config.js`: `preset: "jest-expo"`). Crear `tsconfig.json` con `"strict": true` (extender el que genera Expo).

Verify: `npx expo start --non-interactive` arranca sin error de config; `npm test` (sin tests todavía) no falla por config.

## Bloque M2 — `api/client.ts` + `auth/secureStore.ts` + `auth/AuthContext.tsx`

`src/api/client.ts`: instancia Axios, `baseURL` desde `Constants.expoConfig?.extra?.apiBaseUrl` (definido en `app.config.ts` desde variable de entorno `.env` vía `dotenv` + `app.config.ts`), interceptor de request que añade `Authorization: Bearer <token>` leyendo del contexto de auth (inyectar el getter, no importar el contexto directamente en el cliente para evitar dependencia circular — mismo problema que ya resuelve `Front/src/core/api/client.ts`, revisarlo como referencia de patrón aunque el código se duplique).

`src/auth/secureStore.ts`: wrapper fino sobre `expo-secure-store` (`saveToken`, `getToken`, `deleteToken`).

`src/auth/AuthContext.tsx`: `login(username, password)` llama `POST /api/mobile/login`, guarda token; `logout()` borra token; expone `token`, `isAuthenticated`.

### Red primero
`src/auth/__tests__/AuthContext.test.tsx`: mockear `api/client` y `expo-secure-store`; casos: login éxito guarda token y `isAuthenticated=true`; login fallo (401) no guarda nada y expone error; logout borra token y `isAuthenticated=false`.

Verify: `npm test -- AuthContext`

## Bloque M3 — `LoginScreen`

Formulario controlado (usuario, contraseña), botón deshabilitado si algún campo vacío, llama a `AuthContext.login`.

### Red primero
`src/screens/__tests__/LoginScreen.test.tsx` (Testing Library): botón deshabilitado con campos vacíos; envío exitoso invoca `login` y navega; error de credenciales muestra mensaje visible.

Verify: `npm test -- LoginScreen`

## Bloque M4 — `TeamSwitcherScreen` + `RootNavigator`

`GET /api/mobile/me/teams` al autenticarse. Navegación (React Navigation: `@react-navigation/native` + `@react-navigation/native-stack` + `@react-navigation/bottom-tabs`) — instalar y configurar `RootNavigator.tsx`: stack `Login → (0 equipos: EmptyState | 1 equipo: skip a Tabs | 2+: TeamSwitcher → Tabs)`.

### Red primero
Tests de `TeamSwitcherScreen` para los 3 casos (0/1/2+ equipos), mockeando la llamada API.

Verify: `npm test -- TeamSwitcher`

## Bloque M5 — `CalendarScreen`

`GET /api/sport-events/{teamId}`. Lista con `FlatList`, pull-to-refresh, estados: cargando / vacío / error de red / lista con eventos.

### Red primero
Tests: lista vacía, lista con eventos (nombre, fecha, rival), error de red muestra retry.

Verify: `npm test -- CalendarScreen`

## Bloque M6 — `EventDetailScreen`

Lee convocatoria (`GetEventConvocations`/equivalente) + botón "Voy" / "No voy" → `POST /api/mobile/events/{eventId}/attendance`. Si el usuario es `FamilyMember`, mostrar el nombre del jugador vinculado (de `GetMyTeams`/`LinkedTeamPlayerId`) en vez de "Yo".

### Red primero
Tests: mostrar convocatoria, confirmar éxito actualiza UI (botón pasa a estado "confirmado"), error 403 muestra mensaje, FamilyMember ve nombre del hijo.

Verify: `npm test -- EventDetailScreen`

## Bloque M7 (condicional) — `NewsScreen`

Solo si B9 se implementó. Si no, placeholder "Próximamente" con test mínimo de render.

## Bloque M8 — Verificación end-to-end manual

```bash
# Backend
cd Back/ExtractionApi && dotnet build && dotnet test

# Mobile
cd Mobile && npm test && npx expo start
```
Recorrido manual con Expo Go apuntando a `https://localhost:7287` (dev), usuarios de prueba `Player` y `FamilyMember` ya vinculados a un equipo real: login → selector de equipo (si aplica) → calendario → detalle de evento → confirmar asistencia → logout. Sin 401/403 inesperados en la consola de Metro.

Si todo pasa: `openspec validate add-mobile-app-mvp` y mover la carpeta a `openspec/changes/archive/2026-07-27-add-mobile-app-mvp/`.
