## Backend (`Back/ExtractionApi`)

### 1. Auth: login JWT directo (sin temp-token)

Hoy `POST /api/login` (`Features/Coaches/Auth/Commands/Login.cs`) recibe un `Token` HS256 firmado con `Authentication:FrontendSecret` que envuelve `username`+`password`; `TokenService.GenerateJwtToken` lo decodifica, valida credenciales y emite el JWT final. Poner ese mismo secreto dentro del bundle de una app móvil es un riesgo innecesario (se puede extraer del binario).

Nuevo feature `Features/Mobile/Auth/Commands/MobileLogin.cs`:

```csharp
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
            .Produces<ProblemDetails>(StatusCodes.Status401Unauthorized);
    }

    public record MobileLoginCommand(string Username, string Password) : IRequest<IResult>;

    public class MobileLoginHandler(ITokenService tokenService) : IRequestHandler<MobileLoginCommand, IResult>
    {
        public async ValueTask<IResult> Handle(MobileLoginCommand request, CancellationToken ct)
        {
            var token = await tokenService.GenerateJwtForCredentials(request.Username, request.Password, ct);
            return Results.Ok(token);
        }
    }
}
```

`ITokenService` gana un método nuevo, `GenerateJwtForCredentials(username, password, ct)`, que reutiliza — sin duplicar — la parte de `GenerateJwtToken` posterior a la validación del temp-token: búsqueda de usuario por `NormalizedUserName`, comprobación `EmailConfirmed`, `VerifyPassword`, y el bloque de construcción de claims/roles/permisos (hoy ya extraído en `GenerateJwtForUser` para el `sub`→JWT; aquí se necesita el tramo de validación de credenciales que hoy solo vive dentro de `GenerateJwtToken`). Refactor: extraer un privado `ValidateCredentialsAsync(username, password, ct) -> ApplicationUser` reusado por ambos flujos (temp-token y móvil), y que ambos acaben llamando a la construcción de claims ya existente en `GenerateJwtForUser`. Mismos `DomainException` (`LoginUserNotRegistered`, `LoginEmailNotConfirmed`, `LoginErrorUserOrPassword`) para no romper contratos de error ya probados.

**Tests (Red primero)**: `MobileLoginHandlerTests` (usuario no existe, email no confirmado, password incorrecto, éxito) — mismo patrón que los tests ya existentes para `TokenService`/`Login`.

### 2. Gap de autorización por equipo (bloqueante antes de exponer nada a Player/FamilyMember desde fuera de la web)

Consultas como `GetSportEvents` (`Features/Coaches/SportEvents/Queries/GetSportEvents.cs:89`) y `GetEventConvocations`/`GetMatchParticipation`/`GetEventPlayers` (`Features/Coaches/Convocations/*.cs`) reciben `teamId` desde la ruta y solo pasan por `FeaturePermissionBehavior`, que comprueba **rol** (¿el rol tiene permiso sobre `/coach/attendance`?) pero no comprueba que el usuario autenticado **pertenezca a ese equipo concreto**. En la app Coach web esto no era explotable en la práctica porque solo entrenador/directiva navegaban esas pantallas dentro de clubes a los que ya tenían acceso por otras vías. Para Player/FamilyMember en móvil sí es explotable: conociendo un `teamId` ajeno, cualquier jugador podría leer convocatorias/eventos de otro equipo.

Se añade un nuevo pipeline behavior, `TeamMembershipBehavior<TRequest,TResponse>`, y una interfaz marcador:

```csharp
public interface IRequireTeamMembership
{
    string TeamId { get; }
}
```

El behavior solo actúa si el request implementa `IRequireTeamMembership` **y** el usuario tiene el rol `Player` o `FamilyMember` (Administrator/Coach/ClubDirector no se ven afectados, ya tienen otras comprobaciones de club). Verifica `AppDbContext.UserTeams.Any(ut => ut.ApplicationUserId == currentUser.UserId && ut.TeamId == request.TeamId)`; si no, `ForbiddenAccessException`. Se aplica marcando `SportEventsQuery`, `EventConvocationsQuery`, etc. con la nueva interfaz (además de `IRequireFeaturePermission`, que ya tienen). Se registra en el pipeline **después** de `FeaturePermissionBehavior` (mismo orden que describe el CLAUDE.md: Logging → Timing → Validation → FeaturePermission/TeamMembership → Caching → Cache Invalidation).

**Tests**: `TeamMembershipBehaviorTests` (Player de otro equipo → 403; Player de su equipo → pasa; Coach → no se ve afectado).

### 3. Nuevas rutas lógicas (`FeaturePermission.FeatureRoute`)

`CoachFeatureRoutes` ya tiene, y ya está seedeado para `Player` (Read): `Squad`, `Events`, `Convocations`, `News`. Faltan:

- Seed de las mismas 4 rutas para el rol **`FamilyMember`** (Read) en `SeedFeaturePermissionsAsync` (`WebApplicationExtensions.cs`) — hoy solo existen filas para `Player`.
- Nueva ruta lógica para la escritura de asistencia: `CoachFeatureRoutes.AttendanceConfirmation = "/mobile/attendance"`, seedeada como `ReadWrite` para `Player` y `FamilyMember`.

### 4. Confirmación de asistencia (nuevo, no existe hoy)

No hay tabla ni comando de confirmación de asistencia — es la única pieza de escritura del MVP. Nueva entidad `EventAttendanceConfirmation` (`Domain/Entities/EventAttendanceConfirmation.cs`): `Id`, `SportEventId`, `TeamPlayerId`, `ConfirmedByApplicationUserId`, `Status` (SmartEnum `Going`/`NotGoing`/`Pending`), `RespondedAt`. Migración nueva vía `.\manage-migrations.ps1`.

Nuevo feature `Features/Mobile/Attendance/Commands/ConfirmAttendance.cs`:
- `POST /api/mobile/events/{eventId}/attendance` con body `{ teamPlayerId, status }`.
- `ConfirmAttendanceCommand : ICommand, IRequireFeaturePermission, IRequireTeamMembership`.
- Validator (FluentValidation): `Status` es uno de los valores del SmartEnum; `TeamPlayerId` no vacío.
- Handler: además de las comprobaciones de pipeline, valida que `teamPlayerId` corresponde al propio usuario (rol `Player`: `TeamPlayer.ApplicationUserId == currentUser.UserId` si existe ese vínculo directo, o vía `UserTeam.LinkedTeamPlayerId`) o a un hijo vinculado (rol `FamilyMember`: `UserTeam.LinkedTeamPlayerId == teamPlayerId` para ese `ApplicationUserId`) — si no, `ForbiddenAccessException`. Esto evita que un padre confirme asistencia de un jugador que no es el suyo.

**Tests**: `ConfirmAttendanceHandlerTests` (Player confirma su propia asistencia → OK; FamilyMember confirma la de su hijo vinculado → OK; FamilyMember intenta confirmar la de un jugador no vinculado → 403; validator rechaza status inválido).

### 5. Endpoints de lectura reutilizados sin cambios de contrato

`GetSportEvents`, `GetEventConvocations`, `GetMatchParticipation` se reutilizan tal cual desde la app móvil (mismo contrato JSON) — solo ganan `IRequireTeamMembership` como se describe en el punto 2. `GetPlayersByTeam`/`GetTeamPlayer` (ruta `Squad`) igual. Si al implementar se detecta que "Comunicados" (`CoachFeatureRoutes.News`) no tiene todavía ningún query real detrás (solo la constante de ruta seedeada), se crea `Features/Coaches/News/Queries/GetNews.cs` como nuevo query de lectura simple — a confirmar en `tasks.md` tras revisar si existe entidad `News`/`Announcement` en el dominio.

---

## Mobile (`Mobile/`, nuevo)

Proyecto Expo (managed) + TypeScript, independiente de `Front/` (sin npm workspaces, tipos duplicados por ahora).

```
Mobile/
  app.json
  package.json
  tsconfig.json
  babel.config.js
  App.tsx
  src/
    api/
      client.ts            # instancia Axios propia (equivalente a Front/src/core/api/client.ts)
      types.ts             # DTOs duplicados manualmente desde los contratos del backend (SportEventResponse, etc.)
    auth/
      AuthContext.tsx       # login, logout, token en memoria + persistencia
      secureStore.ts        # wrapper sobre expo-secure-store (guardar/leer/borrar JWT)
    navigation/
      RootNavigator.tsx     # stack: Login -> (Tabs: Calendario | Convocatorias | Noticias)
    screens/
      LoginScreen.tsx
      CalendarScreen.tsx        # GET /api/sport-events/{teamId}
      EventDetailScreen.tsx     # GET /api/convocations/... + POST /api/mobile/events/{id}/attendance
      NewsScreen.tsx
      TeamSwitcherScreen.tsx    # si el usuario tiene UserTeam en más de un equipo
    theme/
      colors.ts             # paleta propia (no reutiliza el ThemeProvider de MUI, es React Native puro)
  __tests__/
    ...                     # Jest + @testing-library/react-native
```

Decisiones:
- **Navegación**: React Navigation (stack + bottom tabs) en vez de Expo Router — para un MVP de 3-4 pantallas, el árbol de rutas explícito es más simple de razonar que la convención de archivos de Expo Router.
- **Auth**: `AuthContext` llama a `POST /api/mobile/login`, guarda el JWT en `expo-secure-store`, lo inyecta como header `Authorization: Bearer` en el interceptor de `api/client.ts` (mismo patrón que el interceptor de `Front/src/core/api/client.ts`, pero sin el evento `rffm.auth_expired` del bus de eventos del navegador — en su lugar, un callback de contexto que redirige a `LoginScreen`).
- **Selector de equipo**: si `GET /api/mobile/me/teams` (nuevo, lectura simple sobre `UserTeams` del usuario autenticado) devuelve más de un equipo, se muestra `TeamSwitcherScreen`; si es uno solo, se salta directo al calendario de ese equipo.
- **Testing**: Jest + `@testing-library/react-native`, seed de tests primero (TDD) igual que en `Front/`.

---

## No se toca en este cambio

- `Front/` (web) no se modifica salvo, si se detecta necesario al implementar, exponer la misma info de "mis equipos" que ya podría existir para Coach.
- `PagePermission` sigue sin consumidores.
- Sin npm workspaces ni paquete de tipos compartido.
