# Tasks — restrict-club-management-access

Orden: contrato ya hecho → backend (TDD) → frontend (TDD) → conexión/verificación E2E.

## 1. Contrato (completado)

- [x] 1.1 proposal.md
- [x] 1.2 design.md

## 2. Backend — 401 vs 403 (TDD)

- [ ] 2.1 **Red**: `RFFM.Api.Tests` — test que espera `ForbiddenAccessException` cuando `FeaturePermissionBehavior` no encuentra fila `FeaturePermission` para rol+ruta, y cuando el `PermissionType` es insuficiente; test que espera `UnauthorizedAccessException` cuando no hay usuario autenticado / no hay rol
- [ ] 2.2 **Green**: crear `Domain/ForbiddenAccessException.cs`; actualizar `FeaturePermissionBehavior.cs` (los 2 branches de permiso lanzan `ForbiddenAccessException`, los 2 de autenticación siguen con `UnauthorizedAccessException`)
- [ ] 2.3 **Green**: mapear `ForbiddenAccessException` → 403 en `ServiceCollectionExtensions.AddCustomProblemDetails`
- [ ] 2.4 Verificar: `dotnet test --filter FeaturePermissionBehaviorTests`

## 3. Backend — proteger endpoints de club (TDD)

- [ ] 3.1 **Red**: test que verifica que `CreateClubCommand`, `UpdateClubCommand`, `DeleteClubCommand` implementan `IRequireFeaturePermission` con `FeatureRoute == "/coach/clubs"` y `RequiredPermission == "Write"`
- [ ] 3.2 **Green**: implementar `IRequireFeaturePermission` en los 3 commands (`Features/Coaches/Clubs/Commands/{CreateClub,UpdateClub,DeleteClub}.cs`)
- [ ] 3.3 Añadir `.RequireAuthorization()` a `UpdateClub.cs` y `DeleteClub.cs` (gap encontrado, `CreateClub.cs` ya lo tiene)
- [ ] 3.4 Añadir seed `("ClubManagement", "/coach/clubs", "ClubDirector", 3, true)` en `WebApplicationExtensions.SeedFeaturePermissionsAsync`
- [ ] 3.5 Verificar: `dotnet build` + `dotnet test`

## 4. Frontend — hook de permisos (TDD)

- [ ] 4.1 **Red**: `useFeaturePermission.test.ts` — `hasAccess=true` si la ruta está en `featurePermissions`; `false` si no está o si la petición falla; `loading=false` tras resolver
- [ ] 4.2 **Green**: crear `Front/src/shared/services/permissions/permissionService.ts` (`getMyPermissions` sobre `GET /api/permissions/me`) y `Front/src/shared/hooks/useFeaturePermission.ts`
- [ ] 4.3 Verificar: `npm run test -- useFeaturePermission`

## 5. Frontend — tarjeta "Club" condicionada (TDD)

- [ ] 5.1 **Red**: `DashboardCards.test.tsx` — no renderiza tarjeta "Club" mientras `loading`; la renderiza si `hasAccess=true`; no la renderiza si `hasAccess=false` (mock de `useFeaturePermission`)
- [ ] 5.2 **Green**: `DashboardCards.tsx` — sustituir condición `!isPlayer` de la tarjeta "Club" por `canManageClub` (`useFeaturePermission("/coach/clubs")`)
- [ ] 5.3 **Refactor**: revisar que el resto de tarjetas (`Configuración`, equipos) no se vieron afectadas por el cambio
- [ ] 5.4 Verificar: `npm run test -- DashboardCards` + `npm run build`

## 6. Conexión y verificación E2E

- [ ] 6.1 Manual: login como `Coach` sin club vinculado → dashboard no muestra tarjeta "Club"
- [ ] 6.2 Manual: login como `Coach` → llamar `PUT /api/catalog/club/{id}` directamente (Postman/curl) → 403 ProblemDetails
- [ ] 6.3 Manual: login como `ClubDirector` → dashboard muestra tarjeta "Club" → crear/editar club funciona (200)
- [ ] 6.4 Manual: llamar cualquier endpoint de club sin token → 401 (no 403)
- [ ] 6.5 `dotnet build` + `dotnet test` verdes
- [ ] 6.6 `npm run build` + `npm run test` verdes
- [ ] 6.7 `openspec validate restrict-club-management-access` → OK
- [ ] 6.8 Archivar a `openspec/changes/archive/2026-07-12-restrict-club-management-access/`
