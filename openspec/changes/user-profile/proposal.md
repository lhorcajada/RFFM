## Why

En la web, la opción «Perfil» del menú del avatar (`AppHeader.tsx`) solo muestra el aviso «Perfil no
disponible todavía». El usuario no puede consultar ni corregir sus datos, poner una foto, cambiar la
contraseña sin pasar por «He olvidado mi contraseña», ni ver de un vistazo con qué clubes y equipos
está vinculado. Hoy la cuenta solo guarda el alias y el email (Identity), y `UserProfile` guarda el rol
elegido en el onboarding de jugadores y familiares.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Nueva entidad `UserPersonalData` (AppDbContext), una por usuario, con:
    - nombre y primer apellido (obligatorios);
    - segundo apellido y teléfono (opcionales);
    - URL del avatar.
  - `UserProfile` no cambia. `GET /api/users/me/profile` sigue devolviendo `204` a quien no hizo el
    onboarding, y la web depende de ello.
  - Migración `AddUserPersonalData`.
  - Endpoints del usuario autenticado bajo `/api/users/me/...`:
    - `GET account`: alias y email (solo lectura) más los datos personales.
    - `PUT personal-data`: crea o actualiza los datos personales.
    - `POST avatar` y `DELETE avatar`: con `IStorageService`, como `UploadPlayerPhoto`.
    - `PUT password`: contraseña actual y nueva, con `UserManager.ChangePasswordAsync`.
    - `GET memberships`: clubes y equipos del usuario con su rol en cada uno y el jugador vinculado.
  - Validadores FluentValidation, códigos en `ErrorCodes` y errores como `ProblemDetails`.
  - **Versión**: API minor.
- **Frontend (`Front`)**:
  - Página lazy compartida `/profile` (`src/shared/pages/Profile/`) con `BaseLayout`, alcanzable desde
    «Perfil» en Federación y en Coach.
  - Tarjetas mobile-first, sin tablas:
    - Datos personales;
    - Foto;
    - Contraseña;
    - Mis clubes y equipos: cada equipo enlaza a su panel y cada club a su página.
  - El avatar de la cabecera muestra la foto subida, y si no hay foto, las iniciales del nombre y el
    primer apellido.
  - Un `profileService.ts`, traducciones de los nuevos códigos de error y avisos por
    `rffm.show_snackbar`.
  - **Versión**: Web minor.

## Capabilities

### New Capabilities
- `user-profile`: el usuario consulta y edita sus datos personales y su avatar, cambia su contraseña y ve
  sus vinculaciones con clubes y equipos.

## Impact

- `Back/ExtractionApi`:
  - `Domain/Entities/UserPersonalData.cs`, su configuración EF, el `DbSet` y la migración;
  - `ErrorCodes`;
  - en `Features/Coaches/Users/`, los slices `GetMyAccount`, `UpdateMyPersonalData`, `UploadMyAvatar`,
    `DeleteMyAvatar`, `ChangeMyPassword` y `GetMyMemberships`;
  - tests.
- `Front`:
  - `AppHeader.tsx`, `UserContext` (avatar y nombre) y `AppRouter.tsx`;
  - la nueva página, sus componentes y su servicio;
  - `errors.json` (es/en);
  - tests.
- **Fuera de alcance**:
  - Mobile (cambio posterior);
  - cambiar el alias o el email (el login depende del alias);
  - abandonar un equipo desde el perfil;
  - las preferencias de notificaciones;
  - borrar la cuenta;
  - los roles globales de Identity: solo se muestra el rol en cada club o equipo.
