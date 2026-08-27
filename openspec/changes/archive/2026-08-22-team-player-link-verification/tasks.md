## 1. Backend — dominio: `TeamPlayer.LinkCode` + `TeamPlayerLinkRequest` (≈2h)

- [x] `Domain/Entities/TeamPlayers/TeamPlayer.cs`: añadir `LinkCode` (nullable) y `GenerateLinkCode()` (`design.md` §1).
- [x] `ValidationConstants.PlayerLinkCodeLength = 8`.
- [x] Nuevo `Domain/Aggregates/UserClubs/TeamPlayerLinkRequest.cs` (`design.md` §2): `Create`/`Approve`/`Reject`, enum `TeamPlayerLinkRequestStatus`.
- [x] Tests (Red primero): `TeamPlayerLinkRequestTests.cs` — `Create` válido/inválido; `Approve`/`Reject` sobre solicitud ya decidida lanza `DomainException` con `ErrorCodes.TeamPlayerLinkRequestAlreadyDecided`.
- [x] Nuevos códigos en `Domain/ErrorCodes.cs`: `PlayerLinkCodeInvalid`, `LinkedPlayerRequestPending`, `TeamPlayerLinkRequestNotFound`, `TeamPlayerLinkRequestAlreadyDecided`.
- Verificar: `dotnet test --filter TeamPlayerLinkRequestTests` ✅ 8/8 pass (verificado directamente)

## 2. Backend — persistencia + migración (≈1.5h)

- [x] `Infrastructure/Persistence/Configuration/.../TeamPlayerEntityConfiguration.cs`: mapear `LinkCode` (`HasMaxLength`, índice no único).
- [x] Nuevo `TeamPlayerLinkRequestEntityConfiguration.cs` (`design.md` §2): FKs a `Team`/`TeamPlayer`/`Membership`, índices `(TeamId, Status)` y `ApplicationUserId`.
- [x] `AppDbContext`: `DbSet<TeamPlayerLinkRequest>`.
- [x] Migración: `.\manage-migrations.ps1 -Action create -MigrationName AddTeamPlayerLinkRequestsAndPlayerLinkCode -Context AppDbContext`.
- Verificar: `dotnet build` ✅ 0 warnings, 0 errors (verificado directamente); SQL generado no toca `identity`/`federation`.

## 3. Backend — `CreateUser.cs`: bifurcación con/sin código (≈2h)

- [x] `Command`: añadir `PlayerLinkCode` (opcional).
- [x] Rama `IsPlayer/IsFamilyMember` (`design.md` §3): comprobación de solicitud Pending duplicada (`LinkedPlayerRequestPending`, solo para `Membership.Player`); validación de `PlayerLinkCode` contra `TeamPlayer.LinkCode` si se aporta.
- [x] Dentro de la transacción: bifurcar `UserTeam` inmediato (código correcto) vs `TeamPlayerLinkRequest` Pending (sin código/código incorrecto ya rechazado antes de llegar aquí).
- [x] `RegistrationStatus`: nuevo valor `PendingPlayerLinkApproval`; `RegisterAccountResponse.TeamPlayerLinkRequestId`.
- [x] `EnsureIdentityRoleAsync`/`SaveUserProfileAsync` solo cuando no queda pendiente (igual que el camino Coach-con-código).
- [x] Notificación al coach del equipo cuando queda pendiente (mismo patrón que `NotifyClubCreatorOfPendingRequestAsync`, resolviendo el creador vía `UserTeams`/`UserClubs` del equipo/club padre).
- [x] Tests (Red primero) en `CreateUserHandlerTests`: sin código → Pending, sin `UserTeam`; con código correcto → `UserTeam` instantáneo (comportamiento actual sin regresión, incluida la actualización del test de regresión existente); código incorrecto → 400 `PlayerLinkCodeInvalid`; segunda solicitud Player mientras hay una Pending → 409 `LinkedPlayerRequestPending`.
- Verificar: `dotnet test --filter CreateUserHandlerTests` ✅ pass (verificado directamente como parte del filtro combinado, 19/19)

## 4. Backend — aprobar/rechazar solicitudes (≈2h)

- [x] Nuevo `Features/Coaches/TeamPlayerLinkRequests/Queries/GetTeamPlayerLinkRequests.cs` (`design.md` §4): `GET api/teams/{teamId}/player-link-requests?status=`, autorizado con `EnsureCreatorAsync(ScopeKinds.Team, teamId)`.
- [x] Nuevo `Commands/ApproveTeamPlayerLinkRequest.cs`: crea `UserTeam` + `LinkPlayer`; captura `DbUpdateException` del índice único → 409 `LinkedPlayerAlreadyClaimed` sin decidir la solicitud.
- [x] Nuevo `Commands/RejectTeamPlayerLinkRequest.cs` (calco de `RejectClubJoinRequest.cs`).
- [x] `CoachFeatureRoutes.TeamPlayerLinkRequests = "/coach/teams/player-link-requests"`.
- [x] Tests (Red primero): listar Pending/Decided; aprobar feliz; no-creador → 403; ya decidida → 409; aprobaciones concurrentes sobre el mismo jugador → la segunda 409, solicitud sigue Pending.
- Verificar: `dotnet test --filter "TeamPlayerLinkRequest"` ✅ pass (verificado directamente, incluido en el filtro combinado 19/19)

## 5. Backend — código del jugador: generar/consultar (≈1h)

- [x] Nuevo `Features/Coaches/Players/Commands/RegenerateTeamPlayerLinkCode.cs`: `POST api/team-players/{teamPlayerId}/link-code/regenerate`, autorizado vía `EnsureCreatorAsync(ScopeKinds.Team, teamId-del-TeamPlayer)`.
- [x] Nuevo `Features/Coaches/Players/Queries/GetTeamPlayerLinkCode.cs`: `GET api/team-players/{teamPlayerId}/link-code`, genera perezosamente si `LinkCode` es `null`. No se expone en `TeamRosterQueries` (cuentas `Player` no deben verlo).
- [x] Tests (Red primero): solo coach/creador puede generar o leer; lectura sin código previo lo genera; cuenta `Player` del mismo equipo → 403.
- Verificar: `dotnet test --filter TeamPlayerLinkCode` ✅ pass (verificado directamente, incluido en el filtro combinado 19/19)

## 6. Frontend — `Register.tsx`: campo opcional + estado pendiente (≈2h)

- [x] Test primero (Red): `Register.test.tsx` — envío sin `playerLinkCode` muestra aviso "pendiente de aprobación del entrenador"; con código válido no muestra aviso (flujo actual sin regresión); error `PlayerLinkCodeInvalid` se muestra bajo el campo.
- [x] Implementar: nuevo campo opcional (TextField simple, SIN reutilizar `InvitationCodeField` — sin *preview* en vivo, corregido respecto a la redacción original de esta tarea, ver nota en `implement.md` tarea 9); reducer + payload `playerLinkCode?`; manejo de `status === "PendingPlayerLinkApproval"` vía `pendingReason` en `PendingClubApprovalNotice`.
- Verificar: `npm run test -- Register` && `npm run build` ✅ pass (verificado directamente)

## 7. Frontend — pantalla de solicitudes para el coach (≈2h)

- [x] Nuevo servicio `shared/services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi.ts` (calco de `clubJoinRequestsApi.ts`).
- [x] Test primero (Red): `TeamPlayerLinkRequests.test.tsx` — listar, aprobar/rechazar con `ConfirmDialog`, tabs Pendientes/Decididas, columna "Jugador".
- [x] Implementar: `shared/pages/TeamPlayerLinkRequests/TeamPlayerLinkRequests.tsx` (+ `.module.css`), calco de `ClubJoinRequests.tsx`.
- [x] Ruta en `core/router/AppRouter.tsx` (`/coach/teams/player-link-requests?teamId=`) + enlace/badge junto al acceso existente a "Solicitudes de club".
- Verificar: `npm run test -- TeamPlayerLinkRequests` && `npm run build`

## 8. Frontend — ficha del jugador: ver/generar código (≈1.5h)

- [x] Test primero (Red): `PlayerLinkCode.test.tsx` — 6/6 tests pass (tras corregir en revisión manual: mock de `ConfirmDialog` con ruta relativa incorrecta, `aria-label` puesto en el `Tooltip` en vez del `IconButton`, y timing del stub de `navigator.clipboard` respecto al montaje).
- [x] Implementar: sección "Código de vinculación" en `apps/coach/pages/player/PlayerDetail.tsx`, consumiendo los endpoints de la tarea 5 (copiar al portapapeles + regenerar).
- Verificar: `npm run test -- PlayerLinkCode` && `npm run build` ✅ 6/6 pass, build ok (verificado directamente)

## 9. Verificación final (≈45min)

- [x] `dotnet build` completo (backend) — 0 warnings, 0 errors (verificado directamente).
- [x] `dotnet test` completo (backend) — 620/622 pass; los 2 fallos son preexistentes y no relacionados (`AdnLegibleImporter`/`GameModelSeeder`, importación de documento de modelo de juego) — verificado directamente.
- [x] `npm run test` completo (frontend) — 422/446 pass en la corrida completa; los 24 fallos son preexistentes/no relacionados (timeouts en `SeasonManager`, `SeasonClubField`, `SportEventDialog`, `GameModelFormEditor`, `TeamRulesEdit`, etc., por contención de recursos en la suite completa) — verificado directamente. Los tests propios de esta feature (`Register`, `TeamPlayerLinkRequests`, `PlayerLinkCode`) pasan 100% en ejecución aislada.
- [x] `npm run build` (frontend) — build de producción ok, sin errores (verificado directamente).
- [ ] Prueba manual end-to-end: requiere servidor corriendo (fuera del alcance del agente/esta sesión).
