Cada bloque sigue TDD (Red -> Green -> Refactor). "Verify" es el comando a ejecutar al terminar el bloque.

## Backend

### B1. `TokenService.GenerateJwtForCredentials` + refactor de validación de credenciales
- Extraer `ValidateCredentialsAsync(username, password, ct)` de `TokenService.GenerateJwtToken` (búsqueda por `NormalizedUserName`, `EmailConfirmed`, `VerifyPassword`, mismos `DomainException`).
- Añadir `GenerateJwtForCredentials(username, password, ct)` a `ITokenService`/`TokenService`, reutilizando `ValidateCredentialsAsync` + el bloque de construcción de claims ya usado por `GenerateJwtForUser`.
- Tests primero: `TokenServiceTests` — casos usuario no existe / email no confirmado / password incorrecta / éxito (reutilizar mocks ya existentes para `TokenServiceTests` si el archivo ya existe, si no crearlo junto a `TokenService.cs`).
- Verify: `dotnet test --filter FullyQualifiedName~TokenServiceTests`

### B2. Endpoint `POST /api/mobile/login`
- Archivo: `Features/Mobile/Auth/Commands/MobileLogin.cs` (`IFeatureModule`, `MobileLoginCommand`, `MobileLoginHandler`).
- Tests primero: `MobileLoginHandlerTests.cs` junto al feature — mismos 4 casos que B1 pero a través del handler completo.
- Verify: `dotnet build` + `dotnet test --filter FullyQualifiedName~MobileLoginHandlerTests`

### B3. `IRequireTeamMembership` + `TeamMembershipBehavior`
- Archivos: `Common/IRequireTeamMembership.cs`, `Common/Behaviors/TeamMembershipBehavior.cs`.
- Registrar el behavior en el pipeline (`DependencyInjection/ServiceCollectionExtensions.cs`, después de `FeaturePermissionBehavior`).
- Tests primero: `TeamMembershipBehaviorTests.cs` (Player de otro equipo -> `ForbiddenAccessException`; Player de su equipo -> pasa; Coach no afectado).
- Verify: `dotnet test --filter FullyQualifiedName~TeamMembershipBehaviorTests`

### B4. Aplicar `IRequireTeamMembership` a queries de lectura existentes
- Marcar `SportEventsQuery` (`GetSportEvents.cs`), `EventConvocationsQuery`/`MatchParticipationQuery`/`EventPlayersQuery` (`Features/Coaches/Convocations/*.cs`) con `IRequireTeamMembership { TeamId => TeamId }` (o el campo equivalente de cada query — revisar si alguna usa `EventId` en vez de `TeamId` directamente, en cuyo caso el handler debe resolver el `TeamId` del evento antes del behavior, o el query debe incluir `TeamId` como parámetro).
- Tests: actualizar/añadir tests de estos handlers para el caso "usuario sin membership en el team -> 403".
- Verify: `dotnet test --filter FullyQualifiedName~GetSportEventsTests|EventConvocationsTests`

### B5. Seed de `FeaturePermission` para `FamilyMember`
- En `WebApplicationExtensions.SeedFeaturePermissionsAsync`: añadir filas `FamilyMember` (Read) para `Squad`, `Events`, `Convocations`, `News` (mismas rutas ya seedeadas para `Player`).
- Añadir `CoachFeatureRoutes.AttendanceConfirmation = "/mobile/attendance"` + seed `ReadWrite` para `Player` y `FamilyMember`.
- Verify: arrancar la API en local y comprobar log `"✓ Permissions seeding finished"`; test manual: `GET /api/coaches/permissions/me` (`GetMyPermissions.cs`) autenticado como usuario `FamilyMember` de prueba.

### B6. Entidad + migración `EventAttendanceConfirmation`
- `Domain/Entities/EventAttendanceConfirmation.cs` + SmartEnum de estado (`Going`/`NotGoing`/`Pending`).
- `Infrastructure/Persistence/Configuration/Entities/EventAttendanceConfirmationEntityConfiguration.cs`, registrar `DbSet` en `AppDbContext`.
- Migración: `.\manage-migrations.ps1` (nombre `AddEventAttendanceConfirmation`).
- Verify: `dotnet build`; revisar migración generada antes de aplicarla.

### B7. Comando `ConfirmAttendance`
- Archivo: `Features/Mobile/Attendance/Commands/ConfirmAttendance.cs` (`IFeatureModule`, `ConfirmAttendanceCommand : ICommand, IRequireFeaturePermission, IRequireTeamMembership`, `Validator`, `Handler`).
- Lógica de vínculo jugador-usuario en el handler (Player: propio `TeamPlayerId`; FamilyMember: `UserTeam.LinkedTeamPlayerId`).
- Tests primero: `ConfirmAttendanceHandlerTests.cs` — Player confirma la suya (OK), FamilyMember confirma la de su hijo vinculado (OK), FamilyMember intenta con jugador no vinculado (403), validator rechaza status inválido.
- Verify: `dotnet test --filter FullyQualifiedName~ConfirmAttendanceHandlerTests`

### B8. `GET /api/mobile/me/teams`
- Nuevo query de lectura simple sobre `UserTeams` del usuario autenticado (`TeamId`, `TeamName`, `RoleId`, `LinkedTeamPlayerId`), sin `IRequireFeaturePermission` (es autodescubrimiento de acceso, no una feature protegida).
- Tests primero: usuario con 1 equipo, usuario con 2 equipos, usuario sin equipos (array vacío).
- Verify: `dotnet test --filter FullyQualifiedName~GetMyTeamsTests`

### B9. (Condicional) `GetNews` si no existe query real detrás de `CoachFeatureRoutes.News`
- Confirmar primero si existe entidad `News`/`Announcement` en el dominio; si no existe, este bloque queda fuera de este MVP y se documenta como seguimiento (no inventar entidad de dominio nueva sin validarlo con el usuario).
- Si existe: `Features/Coaches/News/Queries/GetNews.cs` siguiendo el mismo patrón que `GetSportEvents.cs`.
- Verify: `dotnet test --filter FullyQualifiedName~GetNewsTests` (si aplica).

## Mobile (`Mobile/`)

### M1. Scaffolding Expo
- `npx create-expo-app Mobile --template expo-template-blank-typescript` (o equivalente), configurar `tsconfig.json` (strict), ESLint/Prettier básico, Jest + `@testing-library/react-native` + `jest-expo` preset.
- `expo-secure-store` como dependencia.
- Verify: `npx expo start` levanta el bundler sin errores; `npm test` (suite vacía) pasa.

### M2. `api/client.ts` + `auth/secureStore.ts` + `auth/AuthContext.tsx`
- Instancia Axios con `baseURL` desde variable de entorno (`app.config.ts` + `.env`), interceptor que añade `Authorization: Bearer`.
- Tests primero: `AuthContext.test.tsx` (login éxito guarda token, login fallo no guarda nada, logout borra token de secure-store — mockear `expo-secure-store` y el cliente Axios).
- Verify: `npm test -- AuthContext`

### M3. `LoginScreen`
- Formulario usuario/contraseña -> `POST /api/mobile/login` vía `AuthContext`.
- Tests primero (Testing Library): render, envío con credenciales vacías (bloqueado), envío exitoso navega a Home/TeamSwitcher, error de credenciales muestra mensaje.
- Verify: `npm test -- LoginScreen`

### M4. `TeamSwitcherScreen` + `RootNavigator`
- `GET /api/mobile/me/teams`; si longitud 1, navega directo; si >1, lista para elegir.
- Tests: 0 equipos (mensaje "sin acceso"), 1 equipo (skip automático), 2+ equipos (lista navegable).
- Verify: `npm test -- TeamSwitcher`

### M5. `CalendarScreen`
- `GET /api/sport-events/{teamId}` (paginado, orden por fecha).
- Tests: lista vacía, lista con eventos, error de red muestra estado de error.
- Verify: `npm test -- CalendarScreen`

### M6. `EventDetailScreen` (convocatoria + confirmar asistencia)
- `GET` convocatoria/participación del evento + `POST /api/mobile/events/{eventId}/attendance`.
- Tests: mostrar convocatoria, confirmar asistencia éxito actualiza UI, confirmar asistencia error (403/400) muestra mensaje, FamilyMember ve el nombre de su hijo vinculado en vez de "Yo".
- Verify: `npm test -- EventDetailScreen`

### M7. `NewsScreen` (condicional a B9)
- Solo si B9 expone datos reales; si no, placeholder simple "Próximamente" documentado como seguimiento.
- Verify: `npm test -- NewsScreen` (si aplica)

### M8. Build de verificación end-to-end manual
- Levantar backend local + `Mobile/` en Expo Go contra `https://localhost:7287` (dev), recorrer: login -> selector de equipo -> calendario -> detalle de evento -> confirmar asistencia -> logout.
- Verify: recorrido manual sin errores en consola de Metro ni 401/403 inesperados.

## Orden recomendado

B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → (B9 si aplica) → M1 → M2 → M3 → M4 → M5 → M6 → (M7 si aplica) → M8.
