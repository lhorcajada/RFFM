## 1. Backend — dominio: `TeamPlayer` nuevos métodos de intención (~1h)

- [x] `Domain/Entities/TeamPlayers/TeamPlayer.cs`: añadir `UpdateContactEmail(string email)` y `AddFamilyMemberEmailIfMissing(string email)` (`design.md` §2).
- [x] Tests (Red primero): `TeamPlayerTests.cs` — `UpdateContactEmail` reemplaza solo el email preservando `Address`/`Phone`, ignora email vacío/null; `AddFamilyMemberEmailIfMissing` añade cuando no existe (case-insensitive), no duplica si ya existe, ignora email vacío/null.
- Verificar: `dotnet test --filter TeamPlayerTests`

## 2. Backend — `CreateUser.cs`: resolver por código, sin equipo/roster (~2.5h)

- [x] `Command`: eliminar `TeamInvitationCode`, `TeamPlayerId`; `PlayerLinkCode` pasa a campo central del flujo.
- [x] `Validator`: para `IsPlayer`/`IsFamilyMember`, exigir `PlayerLinkCode` (`NotEmpty`) en vez de `TeamInvitationCode`/`TeamPlayerId`.
- [x] Reescribir la rama `IsPlayer(accountType) || IsFamilyMember(accountType)` del `Handler` (`design.md` §1): buscar `TeamPlayer` por `LinkCode` (incluyendo `Team`), 400 `PlayerLinkCodeInvalid` si no existe; comprobación `AlreadyLinked` vía `UserTeams` para rol Player, 409 `LinkedPlayerAlreadyClaimed`.
- [x] Simplificar el bloque transaccional: eliminar `playerLinkCodeMatched` y la rama `TeamPlayerLinkRequest` pendiente; `userTeam.LinkPlayer(resolvedTeamPlayerId)` siempre que se llega a esta rama.
- [x] Dentro de la transacción: `UpdateContactEmail`/`AddFamilyMemberEmailIfMissing` sobre la entidad trackeada según el rol.
- [x] `SaveUserProfileAsync` usa `resolvedTeamPlayerId` en vez de `request.TeamPlayerId!`.
- [x] Eliminar `pendingLinkRequest`, `NotifyTeamCreatorOfPendingLinkRequestAsync`, `RegistrationStatus.PendingPlayerLinkApproval`, `RegisterAccountResponse.TeamPlayerLinkRequestId`.
- [x] Tests (Red primero) en `CreateUserHandlerTests`: código inexistente → 400 `PlayerLinkCodeInvalid`; código válido rol Player → `UserTeam` correcto + `ContactInfo.Email` actualizado; segundo Player mismo código → 409 `LinkedPlayerAlreadyClaimed`; FamilyMember email nuevo → se añade a `FamilyMembers`; FamilyMember email ya existente → no duplica, sí vincula; varios FamilyMember mismo jugador → todos se vinculan.
- Verificar: `dotnet test --filter CreateUserHandlerTests`

## 3. Backend — retirar el feature de aprobación manual (~1h)

- [x] Eliminar `Features/Coaches/TeamPlayerLinkRequests/Queries/GetTeamPlayerLinkRequests.cs`, `Commands/ApproveTeamPlayerLinkRequest.cs`, `Commands/RejectTeamPlayerLinkRequest.cs`.
- [x] Retirar de `Domain/ErrorCodes.cs`: `LinkedPlayerNotInTeam`, `LinkedPlayerRequestPending`, `TeamPlayerLinkRequestNotFound` (comprobado con grep, sin usos fuera de `ErrorCodes.cs` y de los archivos eliminados). `TeamPlayerLinkRequestAlreadyDecided` se mantiene: sigue en uso por la entidad de dominio `TeamPlayerLinkRequest.EnsurePending()`, que se conserva.
- [x] Confirmar que `Domain/Aggregates/UserClubs/TeamPlayerLinkRequest.cs`, su `EntityConfiguration` y el `DbSet` en `AppDbContext` se mantienen intactos (sin migración).
- Verificar: `dotnet build` sin errores/warnings nuevos; `dotnet test` completo sin regresiones.

## 4. Frontend — `Register.tsx`: campo único obligatorio + límite de intentos (~2.5h)

- [x] Test primero (Red): `Register.test.tsx` — rol Player/FamilyMember solo muestra "Código del jugador" (sin selector de equipo/roster); código inválido muestra error y permite reintentar; 3er intento fallido bloquea campo/botón con mensaje de máximo de intentos; `LinkedPlayerAlreadyClaimed` muestra error sin bloquear reintentos; envío exitoso sin rama `PendingPlayerLinkApproval`.
- [x] Implementar: nuevo `RegisterFormState` (`playerLinkCodeAttempts`, `playerLinkCodeLocked`), nuevo bloque JSX único (`design.md` §5), `canSubmit`/`handleSubmit` actualizados, retirar uso de `InvitationCodeField(kind="team")`/`TeamPlayerPicker`/`codeValidation.team` en este flujo.
- [x] `PendingClubApprovalNotice.tsx`: retirar `kind="playerLink"`.
- [x] `shared/types/scope.ts`: `RegisterPayingAccountPayload` sin `teamInvitationCode`/`teamPlayerId`; `RegisterPayingAccountResponse.status` sin `"PendingPlayerLinkApproval"`.
- [x] `shared/i18n/locales/{es,en}/errors.json`: añadir `PlayerLinkCodeInvalid`.
- Verificar: `npm run test -- Register` && `npm run build`

## 5. Frontend — retirar página de aprobación manual (~1h)

- [x] Comprobar que `TeamPlayerPicker.tsx` no se usa en ningún otro flujo antes de borrarlo (junto a su test).
- [x] Eliminar `shared/pages/TeamPlayerLinkRequests/` (carpeta completa), `shared/services/teamPlayerLinkRequests/teamPlayerLinkRequestsApi.ts`.
- [x] Retirar la ruta en `core/router/AppRouter.tsx` y cualquier enlace/badge en `apps/coach/` que apunte a `player-link-requests`.
- Verificar: `npm run build` (sin imports rotos) && `npm run test`

## 6. Verificación final (~45min)

- [x] `dotnet build` completo (backend) — 0 errors (86 warnings preexistentes, ninguno nuevo).
- [x] `dotnet test` completo (backend) — 653/655 pass; los 2 fallos (`AdnLegibleImporterFullDocumentSpotCheckTests`, `GameModelSeederRealDocumentTests`) son preexistentes y no relacionados (subsistema de importación de modelo de juego).
- [x] `npm run test` completo (frontend) — 495/498 pass; los 3 fallos (`TeamRulesEdit.test.tsx`, 2× `SeasonPlanEditor.test.tsx`) son preexistentes y no relacionados.
- [x] `npm run build` (frontend) — build de producción ok.
- [x] Grep de residuos (`TeamPlayerLinkRequestId`, `PendingPlayerLinkApproval`, `teamInvitationCode`, `teamPlayerId`) — solo quedan en tests que aseveran su AUSENCIA (`Register.test.tsx`) y un campo de mock no relacionado en `InvitationCodeField.test.tsx`; sin residuos reales en código de producción.
- [ ] Prueba manual end-to-end (registro Player y FamilyMember con código válido/ inválido/ ya vinculado) — requiere servidor corriendo, fuera del alcance de esta sesión.
