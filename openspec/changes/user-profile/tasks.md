## 1. Dominio y persistencia (~1,5h)

- [x] Red: `UserPersonalDataTests`:
  - crear con datos válidos (trim, opcionales vacíos → `null`);
  - nombre o primer apellido vacío → `DomainException` con `PersonalDataNameRequired`;
  - `Update` cambia los campos y `UpdatedAt`;
  - `SetAvatar` / `RemoveAvatar` (que devuelve la URL anterior).
- [x] Green: `Domain/Entities/UserPersonalData.cs` y los `ErrorCodes` nuevos (design D1, D3).
- [x] Configuración EF y `DbSet` (D2).
- [x] Migración `AddUserPersonalData` (`.\manage-migrations.ps1`), en su propio commit.
- **Verify**:
  - `dotnet test --filter UserPersonalDataTests`;
  - `dotnet build`.

## 2. Endpoints de cuenta y datos personales (~2h)

- [x] Red: `UpdateMyPersonalDataValidatorTests`:
  - campos obligatorios;
  - longitudes;
  - formato del teléfono.
- [x] Red: `UpdateMyPersonalDataHandlerTests` (Postgres):
  - crea el registro la primera vez;
  - actualiza el existente sin duplicarlo.
- [x] Red: `GetMyAccountHandlerTests` (Postgres + `UserManager` mock):
  - sin registro devuelve el alias y el email con los datos personales a `null`;
  - con registro devuelve todo.
- [x] Green: `Queries/GetMyAccount.cs`, `Commands/UpdateMyPersonalData.cs` (D3).
- **Verify**: `dotnet test --filter "MyPersonalData|GetMyAccount"`.

## 3. Avatar y contraseña (~2h)

- [x] Red: `UploadMyAvatarValidatorTests`:
  - archivo vacío;
  - archivo de más de 2 MB;
  - tipo no permitido.
- [x] Red: `UploadMyAvatarHandlerTests` (`IStorageService` mock):
  - sin datos personales → `PersonalDataRequired`;
  - sube a `avatars/{userId}/…` y guarda la URL;
  - borra la foto anterior.
- [x] Red: `DeleteMyAvatarHandlerTests`:
  - borra la URL y llama a `DeleteAsync`;
  - sin foto no falla.
- [x] Red: `ChangeMyPasswordValidatorTests`: la nueva contraseña es igual a la actual.
- [x] Red: `ChangeMyPasswordHandlerTests` (`UserManager` mock):
  - la contraseña actual es incorrecta → `CurrentPasswordIncorrect`;
  - Identity falla → `PasswordChangeFailed`;
  - éxito.
- [x] Green: `UploadMyAvatar.cs`, `DeleteMyAvatar.cs`, `ChangeMyPassword.cs`,
  `UserConstants.AvatarsContainerName`.
- **Verify**: `dotnet test --filter "MyAvatar|ChangeMyPassword"`.

## 4. Vinculaciones (~1h)

- [x] Red: `GetMyMembershipsHandlerTests` (Postgres):
  - clubes y equipos del usuario con la clave del rol;
  - el equipo incluye el club y el jugador vinculado;
  - no aparecen los de otros usuarios;
  - sin vinculaciones devuelve listas vacías.
- [x] Green: `Queries/GetMyMemberships.cs`.
- [x] Subir la versión de la API a `1.14.0` (`Directory.Build.props`).
- **Verify**:
  - `dotnet build`;
  - `dotnet test` (suite completa).

## 5. Web: servicio, contexto y cabecera (~1,5h)

- [x] Red: `profileService.test.ts`: cada función llama a la ruta y el verbo correctos (cliente mockeado).
- [x] Green: `src/shared/services/profile/profileService.ts` (D4).
- [x] Red: `UserContext.refreshAccount.test.tsx`:
  - fusiona el avatar y el nombre en `user` y en `rffm_user`;
  - un error no rompe nada.
- [x] Red: `AppHeader.profile.test.tsx`:
  - «Perfil» navega a `/profile`;
  - las iniciales salen del nombre y el primer apellido;
  - sin nombre, salen del alias.
- [x] Green: `UserContext.tsx`, `AppHeader.tsx`.
- **Verify**: `npm run test -- profileService UserContext AppHeader`.

## 6. Web: página de perfil (~2h)

- [x] Red: tests en `src/shared/pages/Profile/__tests__/`:
  - `Profile.test.tsx`: carga → tarjetas; error → «Reintentar».
  - `PersonalDataCard.test.tsx`:
    - el alias y el email son de solo lectura;
    - «Guardar» se deshabilita si faltan el nombre o el primer apellido;
    - guarda y avisa;
    - sin datos, muestra el aviso «Completa tu nombre y apellido».
  - `AvatarCard.test.tsx`:
    - se deshabilita sin datos personales;
    - sube la foto;
    - quitar la foto pasa por `ConfirmDialog`.
  - `ChangePasswordCard.test.tsx`:
    - si las nuevas no coinciden, muestra error en cliente;
    - el error `CurrentPasswordIncorrect` se traduce;
    - al terminar bien, vacía el formulario.
  - `MembershipsCard.test.tsx`:
    - el equipo enlaza a `/coach/team-dashboard?teamId=…`;
    - el club enlaza a `/coach/clubs/dashboard/{id}` con `ClubManagement`;
    - sin `ClubManagement`, el club enlaza a su primer equipo o se muestra como texto;
    - roles en español;
    - estado vacío.
- [x] Green: `Profile.tsx`, los componentes, `membershipRoleLabels.ts`, sus CSS Modules y la ruta
  `/profile` en `AppRouter.tsx` (D5).
- [x] Añadir los cuatro códigos nuevos a `errors.json` (es/en).
- [ ] Revisión visual a 375 px y en escritorio, en el tema de Coach y en el de Federación.
- [x] Subir la versión web a `1.21.0`.
- **Verify**:
  - `npm run test`;
  - `npm run build`.

## 7. Cierre

- [x] `openspec validate user-profile --strict`.
- [ ] Confirmación del usuario antes de cada commit:
  - migración;
  - `feat(mcp-api)`;
  - `feat(front)`.
