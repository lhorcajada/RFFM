## 1. Backend — `TeamEditAuthorization` (≈1h)

- [x] Crear `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Teams/TeamEditAuthorization.cs` con `CanEditAsync` y `CoachTeamIdsAsync` (ver `design.md` §1).
- [x] Tests (Red primero): `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/TeamEditAuthorizationTests.cs` — Coach del equipo, Directive del club, otro rol, Coach de otro equipo del mismo club, sin userId.
- Verificar: `dotnet test --filter TeamEditAuthorizationTests`

## 2. Backend — `UpdateTeam.cs` (≈1h)

- [x] Añadir `UserId` a `UpdateTeamCommand`, resuelto en el endpoint desde `HttpContext` (mismo claim que `GetTeams.cs`).
- [x] Aplicar `TeamEditAuthorization.CanEditAsync` en el handler tras cargar el `team`, antes de mutar; lanzar `ForbiddenAccessException` si no autoriza.
- [x] Tests (Red primero, extender `UpdateTeamHandlerTests.cs`): Coach del equipo → éxito; Directive del club → éxito; sin relación → `ForbiddenAccessException` y sin cambios persistidos.
- Verificar: `dotnet build && dotnet test --filter UpdateTeamHandlerTests`

## 3. Backend — `GetTeams.cs` (≈1h)

- [x] Añadir `CanEdit` a `TeamsResponse`, calculado reutilizando el `userClub` ya cargado (Directive) + `TeamEditAuthorization.CoachTeamIdsAsync` (Coach por equipo) — ver `design.md` §3 sobre materializar antes de calcular `CanEdit`.
- [x] Tests (Red primero): `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetTeamsHandlerTests.cs` (no existe archivo previo para `TeamsRequestHandler`, crear nuevo) — Coach del equipo → `CanEdit=true`; Directive del club → `CanEdit=true` en todos sus equipos; sin relación → `CanEdit=false`.
- Verificar: `dotnet build && dotnet test --filter GetTeamsHandlerTests`

## 4. Frontend — botón "Editar" en `TeamManager.tsx` (≈1h)

- [x] `TeamResponse` (`teamService.ts`) gana `canEdit: boolean`.
- [x] Test primero (Red, extender `TeamManager.test.tsx`): con `canEdit: true` aparece botón "Editar" que navega a `/coach/clubs/{clubId}/teams/{teamId}/edit`; con `canEdit: false` no aparece.
- [x] Implementar: botón/icono "Editar" en tabla y en `SettingsRowCard` (vista compacta), condicionado a `team.canEdit`.
- Verificar: `npm run test -- TeamManager && npm run build`

## 5. Verificación final (≈30min)

- [x] `dotnet test` completo (backend) — 100% pass.
- [x] `npm run test` completo (frontend) — 100% pass.
- [x] `npm run build` sin errores de TypeScript.
- [x] Prueba manual (requiere backend + frontend corriendo, un club con un usuario Coach de un equipo y otro usuario Directive del club): ambos ven "Editar" en su(s) equipo(s); un tercer usuario sin relación no lo ve; intentar `PUT /api/catalog/team/{id}` con el token de ese tercer usuario devuelve `403`.
