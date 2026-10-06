## Context

- **Identity (`IdentityDbContext`)**: el usuario Identity guarda `UserName` (el alias, que se usa para el
  login) y `Email`. El registro (`CreateUser.cs`) no pide nombre ni apellidos.
- **`UserProfile` (`AppDbContext`)**: rol del onboarding y jugador/equipo. Solo existe para jugadores y
  familiares. `GET /api/users/me/profile` (`GetMyProfile.cs`) devuelve `204` si no hay registro.
  - La web lee `teamId`/`playerId` de esa respuesta en `usePlayerAutoLoad`, `MyDocuments`, `Squad`,
    `Sanctions`, `AttendanceTabs`, `useTeamFundBalance` y `useMyPendingSanctionsCount`.
  - Por eso **no** se reutiliza `UserProfile` para los datos personales (D1).
- **Vinculaciones**:
  - `UserClub` (`ClubId`, `RoleId`, `Club`) y `UserTeam` (`TeamId`, `RoleId`, `LinkedTeamPlayerId`,
    `Team`, `TeamPlayer`);
  - el rol es `Membership.GetById(RoleId).Key`: `Directive`, `Coach`, `ClubMember`, `Player`,
    `FamilyPlayer` o `Follower`;
  - `Team` tiene `Name`, `ClubId` y `SeasonId`.
- **Almacenamiento**: `IStorageService.UploadAsync(bucket, path, IFormFile, ct)` / `DeleteAsync`. Patrón en
  `UploadPlayerPhoto.cs`.
- **Errores**: `DomainException(título, mensaje, código)` → `400`; `NotFoundException` → `404`. Los códigos
  van en `Domain/ErrorCodes.cs`, y la web los traduce en `src/shared/i18n/locales/{es,en}/errors.json`.
- **Tests backend**: `tests/RFFM.Api.Tests/UnitTests/`, con `PostgresContainerFixture` (Testcontainers)
  y `UserManager` mockeado con Moq (`DeleteTeamUserAccountHandlerTests`).
- **Web**:
  - `AppHeader.tsx` contiene el menú del avatar. El avatar sale de `useUser().user.avatar`, y las
    iniciales, de `username`.
  - `UserContext` persiste `rffm_user` en `localStorage`.
  - Las páginas compartidas con auth (`ScopeMembers`) cuelgan de `AppRouter.tsx` con `<RequireAuth>`
    y usan `BaseLayout` + `ContentLayout`.
  - Destinos de los enlaces:
    - panel de equipo: `/coach/team-dashboard?teamId=…`;
    - página de club: `/coach/clubs/dashboard/:id`, protegida por
      `RequireFeaturePermission(COACH_FEATURE_ROUTES.ClubManagement)`.

## Decisions

### D1 · Dominio: `UserPersonalData` (`Domain/Entities/UserPersonalData.cs`)

```csharp
public class UserPersonalData : BaseEntity
{
    public static class Rules
    {
        public const int NameMaxLength = 50;
        public const int PhoneMaxLength = 20;
        public const int AvatarUrlMaxLength = 500;
    }

    public string ApplicationUserId { get; private set; }
    public string FirstName { get; private set; }
    public string LastName { get; private set; }
    public string? SecondLastName { get; private set; }
    public string? PhoneNumber { get; private set; }
    public string? AvatarUrl { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private UserPersonalData() { }

    public static UserPersonalData Create(string applicationUserId, string firstName, string lastName,
        string? secondLastName, string? phoneNumber);
    public void Update(string firstName, string lastName, string? secondLastName, string? phoneNumber);
    public void SetAvatar(string url);
    public string? RemoveAvatar();   // devuelve la URL anterior para borrarla del storage
}
```

- **Invariantes**:
  - si el usuario, el nombre o el primer apellido están vacíos, se lanza `DomainException` con
    `PersonalDataNameRequired` o `MissingRequiredArgument`;
  - todo se guarda con `Trim()`, y los opcionales vacíos se guardan como `null`;
  - `UpdatedAt` se actualiza en cada cambio.
- El teléfono se guarda aquí y no en `IdentityUser.PhoneNumber`. Así cada comando escribe en un solo
  DbContext (`AppDbContext`).

### D2 · Persistencia

- `Infrastructure/Persistence/Configurations/UserPersonalDataConfiguration.cs`:
  - tabla `UserPersonalData` en el esquema `app`;
  - índice único en `ApplicationUserId`;
  - longitudes de `Rules`.
- `DbSet<UserPersonalData> UserPersonalData` en `AppDbContext`.
- Migración `AddUserPersonalData`, en su propio commit.

### D3 · Endpoints (`Features/Coaches/Users/`, un `IFeatureModule` por archivo, todos `RequireAuthorization()`)

El `userId` se obtiene de `ClaimTypes.NameIdentifier ?? "sub"`, como en `GetMyProfile`.

| Archivo | Ruta | Request → Response |
|---|---|---|
| `Queries/GetMyAccount.cs` | `GET api/users/me/account` | → `200 MyAccountResponse(alias, email, firstName?, lastName?, secondLastName?, phoneNumber?, avatarUrl?)`; los datos personales son `null` si aún no hay registro |
| `Commands/UpdateMyPersonalData.cs` | `PUT api/users/me/personal-data` | `{ firstName, lastName, secondLastName?, phoneNumber? }` → `200 MyAccountResponse`; crea el registro si no existe (upsert) |
| `Commands/UploadMyAvatar.cs` | `POST api/users/me/avatar` (multipart `file`) | → `200 { avatarUrl }`; borra la foto anterior (best effort) |
| `Commands/DeleteMyAvatar.cs` | `DELETE api/users/me/avatar` | → `204`; idempotente si no hay foto |
| `Commands/ChangeMyPassword.cs` | `PUT api/users/me/password` | `{ currentPassword, newPassword }` → `204` |
| `Queries/GetMyMemberships.cs` | `GET api/users/me/memberships` | → `200 { clubs: [{ clubId, clubName, role }], teams: [{ teamId, teamName, clubId, clubName, role, linkedPlayerName? }] }` |

- **Validadores** (FluentValidation, anidados en cada archivo):
  - `UpdateMyPersonalData`:
    - nombre y primer apellido: `NotEmpty` y longitud máxima de 50;
    - segundo apellido: longitud máxima de 50;
    - teléfono: opcional, `^\+?[0-9 ]{9,20}$`.
  - `UploadMyAvatar`: archivo no vacío, de 2 MB como máximo y de tipo `image/jpeg`, `image/png` o
    `image/webp`.
  - `ChangeMyPassword`:
    - las dos contraseñas `NotEmpty`;
    - la nueva distinta de la actual.
- **Reglas en el handler**:
  - `UploadMyAvatar` sin `UserPersonalData` lanza `DomainException` con `PersonalDataRequired`. La foto
    exige haber guardado antes nombre y apellido.
  - Si `ChangeMyPassword` recibe `false` de `CheckPasswordAsync`, lanza `DomainException` con
    `CurrentPasswordIncorrect`.
  - Si `ChangePasswordAsync` falla (política de Identity), lanza `DomainException` con
    `PasswordChangeFailed` y la primera descripción de Identity como mensaje.
- **Almacenamiento del avatar**:
  - bucket `UserConstants.AvatarsContainerName = "avatars"`;
  - ruta `{userId}/{Guid}{ext}`.
- **`GetMyMemberships`**:
  - dos consultas `AsNoTracking()`, a `UserClub` (con `Club`) y a `UserTeam` (con `Team`, el `Club`
    del equipo y `TeamPlayer`→`Player` para el nombre del jugador vinculado);
  - `role` es `Membership.GetById(RoleId).Key`;
  - orden por nombre.
- Sin caché, porque son datos del propio usuario y cambian con sus acciones.
- **Nuevos `ErrorCodes`**:
  - `PersonalDataNameRequired`;
  - `PersonalDataRequired`;
  - `CurrentPasswordIncorrect`;
  - `PasswordChangeFailed`.

### D4 · Web: servicio y contexto

- `src/shared/services/profile/profileService.ts`, hermano de `scopes/scopesApi.ts`:
  - tipos `MyAccount`, `UpdatePersonalDataRequest`, `MyMemberships` (`type`, no `interface`);
  - funciones `getMyAccount`, `updatePersonalData`, `uploadAvatar(file)`, `deleteAvatar`,
    `changePassword` y `getMyMemberships`;
  - todas usan el cliente único `core/api/client.ts`.
- `UserContext`:
  - `User` gana `firstName?` y `lastName?`;
  - nueva acción `refreshAccount()`: llama a `getMyAccount()` y fusiona `avatar`, `firstName` y
    `lastName` en `user` y `rffm_user`;
  - el `UserProvider` la llama al montarse si hay token y al recibir `rffm.coach_token_updated`;
  - los errores se ignoran: la cabecera cae a las iniciales del alias.
- `AppHeader`:
  - `handleProfile` hace `navigate("/profile")`;
  - las iniciales salen de `firstName[0] + lastName[0]` si existen, y si no, de `username[0]`.

### D5 · Web: página `/profile`

- **Ruta**: `AppRouter.tsx` con `<Route path="/profile" element={<RequireAuth><Profile/></RequireAuth>} />` y
  `lazy(() => import("../../shared/pages/Profile/Profile"))`.
- **`src/shared/pages/Profile/Profile.tsx` (+ `.module.css`)**:
  - `BaseLayout` + `ContentLayout` con el título «Mi perfil»;
  - `BaseLayout hideFooterMenu`: el menú inferior de `Footer` es el de Federación en cualquier ruta que no
    sea `/coach`, y llevaría a un entrenador a la otra app;
  - botón «Volver» en el `actionBar`: `AppHeader` navega con `state: { from: pathname + search }` y
    «Volver» lleva a esa ruta, o a `/appSelector` si se entró por URL o se recargó;
  - una columna de tarjetas (`Paper`) en móvil y dos columnas desde `md` (`Grid` de MUI);
  - carga `getMyAccount` y `getMyMemberships` en paralelo y muestra los estados de carga, error con
    «Reintentar» y datos.
- **Componentes** en `src/shared/pages/Profile/components/`, cada uno con su `.module.css`:
  - `PersonalDataCard`:
    - formulario con el alias y el email deshabilitados, el nombre\* y el primer apellido\*, el
      segundo apellido y el teléfono;
    - «Guardar» se deshabilita mientras falten los campos obligatorios o no haya cambios;
    - si el usuario aún no tiene datos, un aviso «Completa tu nombre y apellido».
  - `AvatarCard`:
    - muestra un `Avatar` grande con la foto o las iniciales;
    - «Cambiar foto» abre un `input type=file accept="image/*"`, y «Quitar foto» pide confirmación con
      `ConfirmDialog`;
    - ambos se deshabilitan con el texto «Guarda primero tus datos personales» si aún no hay datos.
  - `ChangePasswordCard`:
    - campos: contraseña actual, nueva y repetir nueva;
    - comprueba en cliente que las dos nuevas coinciden;
    - al terminar bien, vacía el formulario y muestra un snackbar.
  - `MembershipsCard`:
    - dos listas (`List`/`ListItem`, sin tablas): «Clubes» y «Equipos»;
    - cada fila muestra el nombre y un `Chip` con el rol en español;
    - si no hay vinculaciones, muestra «No estás vinculado a ningún club ni equipo».
- **Destinos de los enlaces de `MembershipsCard`** (`RouterLink`):
  - equipo: `/coach/team-dashboard?teamId={teamId}`. La fila muestra también el club y, si lo hay,
    «Jugador: {linkedPlayerName}».
  - club: `/coach/clubs/dashboard/{clubId}`.
    - La página de club exige `ClubManagement`. Si el usuario no lo tiene
      (`useFeaturePermission(COACH_FEATURE_ROUTES.ClubManagement)`), el club se enlaza a su primer
      equipo del listado.
    - Si el usuario no tiene ningún equipo de ese club, el club se muestra como texto sin enlace, para
      no llevarlo a una pantalla de acceso denegado.
- **Rol en español** (`src/shared/pages/Profile/membershipRoleLabels.ts`):

  | Clave | Etiqueta |
  |---|---|
  | `Directive` | Directiva |
  | `Coach` | Entrenador |
  | `ClubMember` | Miembro del club |
  | `Player` | Jugador |
  | `FamilyPlayer` | Familiar |
  | `Follower` | Seguidor |

- **Avisos**:
  - con `rffm.show_snackbar`;
  - los errores se traducen con `errorMessages.ts` a partir del `code` del `ProblemDetails`;
  - los cuatro códigos nuevos se añaden a `errors.json` (es/en).
- Tras guardar los datos o cambiar la foto, la página llama a `refreshAccount()` para actualizar la
  cabecera.

### D6 · Versionado

- API: `1.13.0` → `1.14.0` (`Directory.Build.props`), en el commit `feat(mcp-api)`.
- Web: `1.20.1` → `1.21.0` (`npm version 1.21.0 --no-git-tag-version`), en el commit `feat(front)`.

## Risks / Trade-offs

- **Dos fuentes de «perfil»** (`UserProfile` para el onboarding y `UserPersonalData` para los datos
  personales): se acepta para no alterar el contrato de `GET /me/profile` del que depende la web. Se
  pueden unificar en otro cambio.
- **Foto sin datos personales**: se rechaza (`PersonalDataRequired`) en lugar de crear un registro con el
  nombre vacío, para mantener las invariantes de la entidad.
- **Foto antigua huérfana**: si falla el borrado en el storage, se registra un warning y no se falla la
  petición.
- **Enlace de club sin permiso**: se degrada al primer equipo del club o a texto sin enlace (D5).
