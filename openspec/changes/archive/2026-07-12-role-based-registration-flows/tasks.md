## 1. Backend — `ErrorCodes` catalog + email templates (no behavior change yet)

- [x] 1.1 En `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs`: añadir el bloque nuevo
  "Role-based registration" con las constantes de la tabla de `design.md` § Error Handling:
  `TrialAcceptanceRequired`, `ClubInvitationCodeRequired`, `ClubInvitationCodeInvalid`,
  `ClubInvitationCodeNotAllowedForRole`, `TeamInvitationCodeRequired`, `TeamInvitationCodeInvalid`,
  `TeamInvitationCodeNotAllowedForRole`, `LinkedPlayerRequired`, `LinkedPlayerNotInTeam`,
  `LinkedPlayerAlreadyClaimed`, `ClubJoinRequestNotFound`, `ClubJoinRequestAlreadyDecided`,
  `ClubJoinRequestCancelForbidden`.
- [x] 1.2 Añadir plantillas de email nuevas junto a las existentes (buscar carpeta de
  `ConfirmUserTemplate` para ubicación exacta): `ClubJoinApprovedTemplate`,
  `ClubJoinRejectedTemplate`, `ClubJoinRequestReceivedTemplate`. Cada una recibe alias/nombre del
  destinatario y (para la última) el nombre del club/coach solicitante — mismo patrón de
  interpolación que las plantillas existentes.
- [x] 1.3 Actualizar `Front`-facing i18n **no** aplica aquí (fuera de alcance backend); solo dejar
  nota en el commit de que `errors.json` necesitará las nuevas keys (lo hará el front-specialist).
- **Verify**: `dotnet build` en `Back/ExtractionApi`. Ningún test nuevo requerido en esta tarea
  (solo constantes/plantillas sin lógica), pero confirmar que ningún archivo existente que usaba el
  bloque `AccountTypeRequired` se rompe (`dotnet build` sin warnings de referencia rota).

## 2. Backend — helpers compartidos `ClubInvitationValidation` / `TeamInvitationValidation`

- [x] 2.1 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/ClubInvitationValidationTests.cs`: dado un
  `AppDbContext` in-memory/sqlite con un `Club` + código válido, `Validate(db, code, Membership.Coach)`
  devuelve éxito; con `Membership.Directive` devuelve el error "no permitido para este rol"; con
  código inexistente devuelve "código inválido"; con `Membership.Coach` sobre un código ya usado por
  otro flujo (si aplica) no debe fallar por eso (duplicidad se comprueba en el caller, no aquí).
- [x] 2.2 Test (Red) equivalente en `tests/RFFM.Api.Tests/UnitTests/TeamInvitationValidationTests.cs`
  para `Membership.Player`/`FamilyPlayer` permitidos y `Coach`/`Directive`/`ClubMember` rechazados.
- [x] 2.3 Implementar `Features/Coaches/Invitation/ClubInvitationValidation.cs` (static class,
  `Validate(AppDbContext, string code, Membership requestedKind)` → result record con `Club?`,
  `Membership?`, o error `ProblemDetails`-shaped/`ErrorCodes` constant) extrayendo la lógica hoy
  inline en `Features/Coaches/Invitation/Commands/ValidateInvitationCode.cs`
  (`ValidateClubInvitationHandler`). Mismo para `Features/Coaches/Invitation/TeamInvitationValidation.cs`
  extrayendo de `Features/Coaches/Invitation/Commands/ValidateTeamJoinCode.cs`.
- [x] 2.4 Refactorizar `ValidateClubInvitationHandler` y el handler de `ValidateTeamJoinCode.cs`
  para llamar a los helpers nuevos en vez de repetir las comprobaciones inline. Levantar la
  restricción de `Membership.Coach` **solo** en `ClubInvitationValidation` (mantener el rechazo de
  `Membership.Directive`); `TeamInvitationValidation` no cambia sus roles permitidos.
- **Verify**: `dotnet test --filter "ClubInvitationValidation|TeamInvitationValidation"` en verde;
  `dotnet test --filter ValidateInvitationCode` / filtro equivalente para `ValidateTeamJoinCode` (si
  existen tests previos) siguen en verde tras el refactor — no debe cambiar el comportamiento
  observable de los endpoints autenticados existentes salvo el rol `Coach` ahora permitido.

## 3. Backend — roster de equipo en la respuesta de validación/preview + nuevos endpoints preview

- [x] 3.1 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/GetPlayersByTeamTests.cs` (si no existe ya
  cobertura del query) o directamente en los tests nuevos de preview: extraer el cuerpo de
  `Features/Coaches/Players/Queries/GetPlayersByTeam.cs`'s `PlayersByTeamRequestHandler.Handle` a un
  helper `TeamRosterQueries.GetRoster(AppDbContext, string teamId)` reusable, sin cambiar el
  contrato público de `GetPlayersByTeam`.
- [x] 3.2 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/PreviewTeamInvitationCodeTests.cs`: código
  válido de tipo `Player`/`FamilyPlayer` devuelve `TeamId, TeamName, ClubId, MembershipKind, Players[]`
  con `Token = null`; cada `TeamRosterPlayerDto.AlreadyLinked` es `true` solo cuando ya existe un
  `UserTeam.LinkedTeamPlayerId` de tipo `Membership.Player` apuntando a ese `TeamPlayer.Id`; código
  inválido devuelve 404 `TeamInvitationCodeInvalid`.
- [x] 3.3 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/PreviewClubInvitationCodeTests.cs`: código
  válido para `Coach`/`ClubMember` devuelve `ClubId, ClubName, MembershipKind` sin roster; código
  para `Directive` devuelve 400 `ClubInvitationCodeNotAllowedForRole`; código inexistente 404
  `ClubInvitationCodeInvalid`.
- [x] 3.4 Implementar `Features/Coaches/Invitation/Commands/PreviewClubInvitationCode.cs`
  (`AllowAnonymous()`, `POST api/invitations/club/preview`) usando `ClubInvitationValidation`, sin
  tocar `_db.UserClubs`/Identity/JWT.
- [x] 3.5 Implementar `Features/Coaches/Invitation/Commands/PreviewTeamInvitationCode.cs`
  (`AllowAnonymous()`, `POST api/invitations/team/preview`) usando `TeamInvitationValidation` +
  `TeamRosterQueries.GetRoster`, devolviendo `PreviewTeamInvitationResponse` con `Players[]` cuando
  `MembershipKind` es `Player`/`FamilyPlayer`.
- [x] 3.6 Añadir `Players[]`/`TeamRosterPlayerDto[]` también a `ValidateTeamInvitationResponse`
  (endpoint autenticado existente en `ValidateTeamJoinCode.cs`), reusando el mismo
  `TeamRosterQueries.GetRoster`, para no bifurcar la forma de la respuesta entre preview y validate.
- **Verify**: `dotnet test --filter "PreviewClubInvitationCode|PreviewTeamInvitationCode"` en verde;
  manual: `curl -X POST https://localhost:7287/api/invitations/team/preview -d '{"code":"<code>"}'`
  sin cabecera `Authorization` devuelve 200 con `Players` poblado (no 401).

## 4. Backend — `UserTeam.LinkedTeamPlayerId` + migración

- [x] 4.1 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/UserTeamTests.cs` (o crear si no existe):
  método de dominio nuevo (`UserTeam.LinkPlayer(teamPlayerId)` o similar) lanza si se llama sobre una
  `Membership` distinta de `Player`/`FamilyPlayer`; asigna `LinkedTeamPlayerId` correctamente en el
  resto de casos.
- [x] 4.2 Añadir `LinkedTeamPlayerId` (string, nullable, FK a `TeamPlayer.Id`) a
  `Domain/Aggregates/UserClubs/UserTeam.cs` + el método de dominio validado del 4.1.
- [x] 4.3 Actualizar `UserTeamEntityConfiguration` (buscar bajo
  `Infrastructure/Persistence/Configuration/Aggregates/UserClubs/`) con la FK a `TeamPlayers` y el
  índice único filtrado `(LinkedTeamPlayerId) WHERE LinkedTeamPlayerId IS NOT NULL AND RoleId = <Player>`
  (usar el id real de `Membership.Player` en el filtro SQL, vía `HasFilter` con el valor concreto).
- **Verify**: `dotnet test --filter UserTeam` en verde; `dotnet build`. La migración EF se genera
  junto con las tareas 5 y 6 en un único `dotnet ef migrations add` (ver tarea 7) — no generar la
  migración todavía si aún faltan `ClubJoinRequest`/`ClubSeatCharge` en el mismo cambio de schema.

## 5. Backend — agregado `ClubJoinRequest` + gestión (list/count/approve/reject/cancel)

- [x] 5.1 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/ClubJoinRequestTests.cs`: `Create` deja
  `Status = Pending`; `Approve`/`Reject`/`Cancel` sobre `Pending` cambian el estado y fijan
  `DecidedAt` (y `DecidedByUserId` salvo en `Cancel`); llamar `Approve`/`Reject`/`Cancel` sobre un
  estado ya decidido lanza `DomainException`.
- [x] 5.2 Implementar `Domain/Aggregates/UserClubs/ClubJoinRequest.cs` (+ enum
  `ClubJoinRequestStatus { Pending, Approved, Rejected, Cancelled }`) exactamente como en
  `design.md` § 5, y su `IEntityTypeConfiguration<ClubJoinRequest>` bajo
  `Infrastructure/Persistence/Configuration/Aggregates/UserClubs/`. Añadir
  `DbSet<ClubJoinRequest> ClubJoinRequests` a `AppDbContext`.
- [x] 5.3 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/GetClubJoinRequestsTests.cs`: `status=pending`
  (default) devuelve solo `Pending`; `status=decided` devuelve `Approved|Rejected|Cancelled`;
  `status=all` devuelve todo; llamada de alguien que no es el creator del club devuelve 403.
- [x] 5.4 Implementar `Features/Coaches/ClubJoinRequests/Queries/GetClubJoinRequests.cs`
  (`GET api/clubs/{clubId}/join-requests?status=`), `IQueryApp<ClubJoinRequestDto[]>`, autorización
  vía `IScopeAuthorizationService.EnsureCreatorAsync`, resolviendo alias del decisor con
  `_userManager.FindByIdAsync(DecidedByUserId)` cuando `status` no es `pending`.
- [x] 5.5 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/GetPendingClubJoinRequestsCountTests.cs`:
  devuelve `PendingCount` correcto; cachea (`ICacheRequest`) y se invalida tras approve/reject/cancel.
- [x] 5.6 Implementar `Features/Coaches/ClubJoinRequests/Queries/GetPendingClubJoinRequestsCount.cs`
  (`GET api/clubs/{clubId}/join-requests/count`), `IQueryApp<ClubJoinRequestCountDto>`, creator-only,
  cacheado con el mismo prefix que invalidan approve/reject/cancel.
- **Verify**: `dotnet test --filter "ClubJoinRequest|GetClubJoinRequests|GetPendingClubJoinRequestsCount"` en verde.

## 6. Backend — `ApproveClubJoinRequest` / `RejectClubJoinRequest` / `CancelClubJoinRequest`

- [x] 6.1 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/ApproveClubJoinRequestTests.cs`:
  approve exitoso crea `UserClub` (`IsCreator=false`, `Membership.Coach`), asigna rol Identity
  `AppRoles.Coach`, llama al billing hook (mock de `IClubSeatBillingService.ChargeSeatAsync`),
  envía email best-effort (mock de `EmailService`, un fallo de email no revierte la transacción);
  approve sobre solicitud ya decidida devuelve 409 `ClubJoinRequestAlreadyDecided`; approve por
  alguien que no es el creator del club devuelve 403 (reusa el 403 de `EnsureCreatorAsync`); approve
  de un `requestId` inexistente devuelve 404 `ClubJoinRequestNotFound`.
- [x] 6.2 Implementar `Features/Coaches/ClubJoinRequests/Commands/ApproveClubJoinRequest.cs`
  (`POST api/club-join-requests/{requestId}/approve`), transaccional (Identity role assignment +
  `AppDbContext` writes vía `TransactionScope(TransactionScopeAsyncFlowOption.Enabled)`), billing no
  bloqueante (log-and-continue si falla), email `ClubJoinApprovedTemplate` best-effort.
- [x] 6.3 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/RejectClubJoinRequestTests.cs`: reject exitoso
  no crea `UserClub`/rol/billing, envía `ClubJoinRejectedTemplate`; mismos 403/404/409 que approve.
- [x] 6.4 Implementar `Features/Coaches/ClubJoinRequests/Commands/RejectClubJoinRequest.cs`
  (`POST api/club-join-requests/{requestId}/reject`).
- [x] 6.5 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/CancelClubJoinRequestTests.cs`: cancel exitoso
  solo si el caller es el propio `ApplicationUserId` de la solicitud (403
  `ClubJoinRequestCancelForbidden` si no); no envía email; no crea/borra `UserClub`; cancel sobre
  solicitud ya decidida devuelve 409.
- [x] 6.6 Implementar `Features/Coaches/ClubJoinRequests/Commands/CancelClubJoinRequest.cs`
  (`POST api/club-join-requests/{requestId}/cancel`), autorización por
  `ClaimTypes.NameIdentifier == request.ApplicationUserId` (no `EnsureCreatorAsync`).
- **Verify**: `dotnet test --filter "ApproveClubJoinRequest|RejectClubJoinRequest|CancelClubJoinRequest"` en verde.

## 7. Backend — `ClubSeatCharge` ledger + `IClubSeatBillingService`

- [x] 7.1 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/ClubSeatBillingServiceTests.cs`:
  `ChargeSeatAsync` crea una fila `ClubSeatCharge` con `Status = Pending`, `ChargedUserId`/`ClubId`
  correctos, y crea perezosamente el `PaymentPlan` `"Seat"` (mismo patrón que `"Free"` en
  `CreateFreeTrialSubscriptionAsync`) si aún no existe.
- [x] 7.2 Implementar `Domain/Entities/ClubSeatCharge.cs` (+ enum `ClubSeatChargeStatus { Pending, Waived }`)
  y su `IEntityTypeConfiguration<ClubSeatCharge>`; añadir `DbSet<ClubSeatCharge> ClubSeatCharges` a
  `AppDbContext`. Implementar `IClubSeatBillingService`/`ClubSeatBillingService` bajo `Domain/Services/`,
  registrar en DI junto a `IScopeAuthorizationService`.
- [x] 7.3 Conectar la llamada a `ChargeSeatAsync` dentro de `ApproveClubJoinRequest` (tarea 6.2), tras
  el insert de `UserClub`, sin bloquear la respuesta 200 si falla (log-and-continue, igual que el email).
- **Verify**: `dotnet test --filter ClubSeatBillingService` en verde.

## 8. Backend — migración EF única (`ClubJoinRequests`, `ClubSeatCharges`, `UserTeams.LinkedTeamPlayerId`)

- [x] 8.1 Con las tareas 4, 5 y 7 ya compiladas (config de entidades lista), generar una única
  migración: `cd Back/ExtractionApi && .\manage-migrations.ps1` (o `dotnet ef migrations add
  RoleBasedRegistrationFlows --project src/RFFM.Api --startup-project src/RFFM.Host --context AppDbContext`
  si el script no cubre el nombre) cubriendo: tabla `ClubJoinRequests` (FKs a `Clubs`, `Memberships`),
  tabla `ClubSeatCharges` (FK a `Clubs`, sin FK a `identity.AspNetUsers` para `ChargedUserId`),
  columna `UserTeams.LinkedTeamPlayerId` + FK a `TeamPlayers` + índice único filtrado.
- [x] 8.2 Revisar el archivo de migración generado a mano: confirmar que no toca `IdentityDbContext`
  ni `FederationDbContext`, y que el índice filtrado usa el `WHERE` correcto (valor real del id de
  `Membership.Player`, no un placeholder).
- **Verify**: aplicar la migración contra la BD de desarrollo (`dotnet ef database update` o el flujo
  que use `manage-migrations.ps1`) y confirmar sin errores; `dotnet build` completo del solution.

## 9. Backend — `CreateUser` command/handler/validator rework (rol table completa)

- [x] 9.1 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/CreateUserHandlerTests.cs` (archivo ya
  existente — extenderlo, no crear uno nuevo): un caso por fila de la tabla de `design.md` § 3:
  `ClubDirector` sin `TrialAccepted` → 400 `TrialAcceptanceRequired`; `Coach` sin código y sin
  `TrialAccepted` → mismo error; `Coach` con `ClubInvitationCode` válido → crea `ClubJoinRequest`
  `Pending`, **no** crea `UserClub`, **no** asigna rol Identity todavía, `Status = PendingClubApproval`
  en la respuesta, envía `ClubJoinRequestReceivedTemplate` al creator (best-effort); `Coach` con
  código para un club de `Membership.Directive`-only o código inexistente → 404/400 según
  corresponda; `ClubMember` con código válido → crea `UserClub` activo + rol, sin trial; `Player`/
  `FamilyMember` con `TeamInvitationCode` + `TeamPlayerId` válidos → crea `UserTeam` con
  `LinkedTeamPlayerId` + rol; `TeamPlayerId` fuera del roster → 400 `LinkedPlayerNotInTeam`;
  `TeamPlayerId` ya reclamado por otro `Membership.Player` → 409 `LinkedPlayerAlreadyClaimed` (no
  aplica para `FamilyMember`, que puede compartir jugador); `Fan` → sin trial, sin código, activo
  inmediato. Incluir también el caso ya existente de email/alias duplicados para confirmar que sigue
  funcionando tras el refactor.
- [x] 9.2 Test (Red) en `tests/RFFM.Api.Tests/UnitTests/CreateUserValidatorTests.cs` (crear si no
  existe): shape-only rules del `Validator` nuevo — `TrialAccepted` requerido cuando aplica,
  `ClubInvitationCode` requerido cuando aplica, `TeamInvitationCode` + `TeamPlayerId` requeridos
  juntos cuando aplica, `AccountType` desconocido o `Administrator`/`Federation` rechazado.
- [x] 9.3 Reescribir `Command` en `Features/Coaches/Users/Commands/CreateUser.cs` con la forma de
  `design.md` § 2 (`TrialAccepted`, `ClubInvitationCode`, `TeamInvitationCode`, `TeamPlayerId`
  añadidos a los campos existentes `Alias`, `Email`, `Password`, `AccountType`). Renombrar
  `RegisterPayingAccountResponse` → `RegisterAccountResponse` (añadir `Status` de tipo
  `RegistrationStatus { Active, PendingClubApproval }` y `ClubJoinRequestId`), actualizar el
  atributo `.Produces<RegisterAccountResponse>` de la ruta.
- [x] 9.4 Reescribir el `Validator` con las reglas condicionales `When(...)` de `design.md` § 2.
- [x] 9.5 Reescribir `Handler.Handle` con la tabla de branches de `design.md` § 3: pre-checks vía
  `ClubInvitationValidation`/`TeamInvitationValidation` (tareas 2/3) **antes** de `CreateAsync`;
  comprobación de unicidad de `TeamPlayerId` (además del índice único filtrado de la tarea 4, hacer
  también el check aplicativo para devolver 409 con mensaje claro en vez de una excepción SQL cruda);
  todo el cuerpo envuelto en `TransactionScope(TransactionScopeAsyncFlowOption.Enabled)` cubriendo
  Identity (`UserManager.CreateAsync`, `AddToRoleAsync`) + `AppDbContext` (`UserClub`/`UserTeam`/
  `ClubJoinRequest`/`Subscription` inserts) — sin volver al patrón "swallow and log" para estas
  operaciones (solo subscripción/email de confirmación siguen siendo best-effort, sin cambios).
  Levantar la restricción de `Coach` en el club-code path reusando el helper de la tarea 2 (no
  reintroducir el chequeo inline).
- **Verify**: `dotnet test --filter CreateUser` (Handler + Validator) en verde, cubriendo las 7 filas
  de la tabla; `dotnet build`. Manual: `curl -X POST https://localhost:7287/api/register` con un
  payload `Coach` + `ClubInvitationCode` válido y confirmar respuesta `200` con
  `Status: "PendingClubApproval"` y `ClubJoinRequestId` no nulo, y que **no** se puede hacer login
  con scope activo hasta aprobar (verificar `GetUserClubs`/scope vacío para ese usuario).

## 10. Backend — integración transaccional y cierre

- [x] 10.1 Test de integración (Red) en `tests/RFFM.Api.Tests/IntegrationTests/` (nombre sugerido
  `CreateUserTransactionRollbackTests.cs`): forzar una excepción **después** del insert de
  `UserClub`/`UserTeam`/`ClubJoinRequest` pero antes del commit (mock/fake que lanza tras el insert) y
  assertar que **no** queda un `IdentityUser` huérfano (ni fila en `AppDbContext`) — prueba concreta
  del riesgo de "Cross-DbContext transaction" listado en `design.md` § Risks.
- [x] 10.2 Ejecutar la suite completa de integración/unit existente para confirmar que ningún
  endpoint autenticado existente (`ValidateInvitationCode`, `ValidateTeamJoinCode`, `GetPlayersByTeam`,
  flujos de `RemoveScopeMember`) cambió de comportamiento fuera de lo documentado en `design.md`.
- [x] 10.3 Actualizar `openspec/specs/spec.md` (si el repo lo usa como spec global) añadiendo la
  capability `role-based-registration-flows` y las capabilities modificadas de invitaciones, según
  la sección `## Capabilities` de `proposal.md`.
- **Verify**: `dotnet build && dotnet test` completo del proyecto backend en verde antes de pasar el
  cambio a verificación (`openspec-verify-change`).

## 11. Frontend — piezas compartidas: `userTypes.ts`, `TrialConfirmDialog`, `invitationsApi` preview, i18n

- [x] 11.1 Crear `Front/src/shared/constants/userTypes.ts` exportando `UserType` (union) y
  `USER_TYPE_OPTIONS` (label array), extraídos tal cual del `const` privado hoy dentro de
  `Front/src/shared/pages/AppSelector/components/UserTypeDialog.tsx`. Actualizar
  `UserTypeDialog.tsx` para importar desde el nuevo módulo en vez de declarar su propia copia
  (sin cambio de comportamiento — mismo array, mismas etiquetas en español).
- **Verify**: `npm run build` (Front) sin errores de tipos; `npm run test -- UserTypeDialog` en
  verde (test existente no debe romperse tras el refactor de import).
- [x] 11.2 Test (Red) en `Front/src/shared/components/TrialConfirmDialog.test.tsx`: mover/renombrar
  el test existente de `CoachTrialDialog` (si existe, buscar bajo
  `Front/src/apps/coach/pages/AppSelector/components/CoachTrialDialog.test.tsx` o ruta equivalente)
  ajustando solo el import/nombre del componente — mismas aserciones (`onAccept` al confirmar,
  `onClose` al cancelar, botones deshabilitados con `isProcessing`).
- [x] 11.3 Relocar `CoachTrialDialog.tsx` → `Front/src/shared/components/TrialConfirmDialog.tsx`
  (+ `TrialConfirmDialog.module.css`), mismas props (`open`, `isProcessing`, `onClose`, `onAccept`),
  mismo copy de los 7 días de prueba. Actualizar el call site en `AppSelector` para importar desde
  la nueva ruta; borrar los archivos antiguos (`CoachTrialDialog.tsx`/`.module.css`/test) una vez
  movidos.
- **Verify**: `npm run test -- TrialConfirmDialog` en verde; `npm run test -- AppSelector` (o el
  test existente que cubra el flujo post-login) sigue en verde sin cambios de comportamiento.
- [x] 11.4 Añadir `PreviewClubCodeResponse`/`PreviewTeamCodeResponse`/`TeamRosterPlayer` a
  `Front/src/shared/types/scope.ts` (sibling de `ValidateClubCodeResponse`/`ValidateTeamCodeResponse`
  existentes, sin refactorizarlos) según las formas de `design.md` (frontend) § Live Code
  Validation Flow (`TeamRosterPlayer = { teamPlayerId, playerId, name, lastName, urlPhoto, dorsal,
  alreadyLinked }`). Añadir también `ClubJoinRequestDto` (sibling de `ScopeMember`) con la forma de
  `design.md` § Club Join Requests Management.
- [x] 11.5 Test (Red) en `Front/src/shared/services/invitations/invitationsApi.test.ts` (extender si
  existe, crear si no): `previewClubCode(code)` llama `POST /api/invitations/club/preview` sin
  cabecera de auth añadida manualmente (usa el cliente Axios compartido tal cual) y devuelve
  `PreviewClubCodeResponse`; `previewTeamCode(code)` llama `POST /api/invitations/team/preview` y
  devuelve `PreviewTeamCodeResponse` con `players[]`; ambos respetan el `VITE_USE_MOCK` existente
  (mock devuelto sin llamar a Axios cuando el flag está activo, igual que `validateClubCode`/
  `validateTeamCode`).
- [x] 11.6 Implementar `previewClubCode`/`previewTeamCode` en
  `Front/src/shared/services/invitations/invitationsApi.ts` (mismo archivo, mismo patrón de mock
  que los métodos autenticados existentes — no crear un servicio nuevo).
- **Verify**: `npm run test -- invitationsApi` en verde.
- [x] 11.7 Añadir las claves nuevas a `Front/src/shared/i18n/locales/es/errors.json` y
  `locales/en/errors.json`: `TrialAcceptanceRequired`, `ClubInvitationCodeRequired`,
  `ClubInvitationCodeInvalid`, `ClubInvitationCodeNotAllowedForRole`, `TeamInvitationCodeRequired`,
  `TeamInvitationCodeInvalid`, `TeamInvitationCodeNotAllowedForRole`, `LinkedPlayerRequired`,
  `LinkedPlayerNotInTeam`, `LinkedPlayerAlreadyClaimed`, `ClubJoinRequestNotFound`,
  `ClubJoinRequestAlreadyDecided` (mismas keys que el bloque 1.1 del backend). No tocar
  `errorMessages.ts` — el lookup genérico ya existe.
- **Verify**: manual — abrir `errors.json` (es/en) y confirmar que las 12 keys nuevas están
  presentes en ambos idiomas con texto no vacío; `npm run build` sin errores (el JSON es válido).

## 12. Frontend — `Register.tsx` rework: estado, `RoleSelector`, gating condicional

- [x] 12.1 Test (Red) en `Front/src/shared/pages/auth/register/components/RoleSelector.test.tsx`:
  renderiza las 6 opciones de rol con las labels de `userTypes.ts`; `onChange` se dispara con el
  `UserType` correcto al seleccionar una opción; `RadioGroup` no usa `row` (layout apilado).
- [x] 12.2 Implementar `Front/src/shared/pages/auth/register/components/RoleSelector.tsx` (+
  `RoleSelector.module.css`): wrapper fino sobre `USER_TYPE_OPTIONS` de `userTypes.ts`, `RadioGroup`
  vertical (sin `row`), props `value`/`onChange`.
- **Verify**: `npm run test -- RoleSelector` en verde.
- [x] 12.3 Test (Red, extendiendo `Front/src/shared/pages/auth/register/Register.test.tsx`
  existente): seleccionar `Fan` habilita el submit solo con alias/email/password (sin diálogo, sin
  campo de código); seleccionar `ClubDirector` abre `TrialConfirmDialog`; cancelar resetea el rol a
  no-seleccionado y mantiene el submit deshabilitado; aceptar cierra el diálogo y habilita el
  submit (con alias/email/password rellenos).
- [x] 12.4 Reescribir `Front/src/shared/pages/auth/register/Register.tsx` con `useReducer` (forma
  `RegisterFormState` de `design.md` § State Management: `alias`, `email`, `password`, `role`,
  `trialAccepted`, `trialDialogOpen`, `coachHasClubCode`, `invitationCode`, `codeValidation`,
  `selectedTeamPlayerId`, `isSubmitting`, `formError`, `successMessage`), acción `SET_ROLE` que
  resetea atómicamente todos los campos específicos de rol. Renderizar `RoleSelector` en lugar del
  `RadioGroup` de 2 opciones actual. Calcular `canSubmit` como booleano derivado (no almacenado) por
  la fórmula de `design.md`.
- [x] 12.5 Test (Red, mismo archivo): seleccionar `Coach` muestra la pregunta "¿tienes código de
  invitación de club?" (`RadioGroup` Sí/No); responder "No" activa el gate de trial idéntico a
  `ClubDirector`; responder "Sí" nunca abre `TrialConfirmDialog` y muestra el campo de código en su
  lugar.
- [x] 12.6 Implementar el sub-branch `coachHasClubCode` en `Register.tsx` (RadioGroup Sí/No,
  condicional a `role === "Coach"`) controlando qué sección se muestra debajo.
- **Verify**: `npm run test -- Register` en verde (casos de 12.3 y 12.5).

## 13. Frontend — `InvitationCodeField.tsx` con validación live debounced

- [x] 13.1 Test (Red) en
  `Front/src/shared/pages/auth/register/components/InvitationCodeField.test.tsx`: muestra spinner
  mientras la llamada (mockeada) a preview está en curso; muestra affordance de válido y llama
  `onValid(response)` en éxito; muestra el mensaje de error mapeado por i18n y llama `onInvalid` en
  fallo; usa fake timers para confirmar que varias pulsaciones rápidas emiten una sola llamada de
  red (debounce ~500ms).
- [x] 13.2 Implementar
  `Front/src/shared/pages/auth/register/components/InvitationCodeField.tsx` (+ `.module.css`):
  `TextField` parametrizado por `kind: "club" | "team"`, debounce local (`useEffect` + `setTimeout`,
  sin hook compartido — ver `design.md` § Risks), llama `previewClubCode`/`previewTeamCode` según
  `kind`, usa `getErrorMessage(errorCode)` (no `mapApiErrorToMessage`) para el mensaje de error,
  adornment de check verde en éxito.
- **Verify**: `npm run test -- InvitationCodeField` en verde.
- [x] 13.3 Test (Red, extendiendo `Register.test.tsx`): `Coach` con "Sí código" — código inválido
  (mock de rechazo) muestra error inline y mantiene submit deshabilitado; código válido habilita
  submit; el submit real postea `AccountType: "Coach"` + `ClubInvitationCode` (sin `TrialAccepted`)
  y, en éxito, renderiza `PendingClubApprovalNotice` en lugar del mensaje de éxito genérico.
  `ClubMember` replica el mismo gate de código, sin roster, sin trial.
- [x] 13.4 Cablear `InvitationCodeField kind="club"` en `Register.tsx` para `Coach` (con código) y
  `ClubMember`; construir `Front/src/shared/pages/auth/register/components/PendingClubApprovalNotice.tsx`
  (+ `.module.css`) como componente solo-de-copy (sin polling, per `design.md` Non-Goals) mostrado
  tras un submit exitoso de `Coach` con código.
- **Verify**: `npm run test -- Register` en verde (casos 13.3); manual en navegador (`npm run dev`):
  seleccionar Coach → Sí código → introducir un código válido/existente de prueba y confirmar el
  affordance verde y que el submit se habilita.

## 14. Frontend — `TeamPlayerPicker.tsx` roster picker responsive

- [x] 14.1 Test (Red) en
  `Front/src/shared/pages/auth/register/components/TeamPlayerPicker.test.tsx`: renderiza una fila
  por jugador; rol `Player` deshabilita filas `alreadyLinked` (no seleccionables, con caption "Ya
  vinculado" y `aria-disabled`); rol `FamilyMember` renderiza las mismas filas habilitadas
  (`alreadyLinked` ignorado); seleccionar una fila llama `onSelect(teamPlayerId)`; array vacío
  renderiza `Alert severity="warning"` en vez de una lista vacía.
- [x] 14.2 Implementar
  `Front/src/shared/pages/auth/register/components/TeamPlayerPicker.tsx` (+ `.module.css`): MUI
  `List`/`ListItemButton` de una sola columna (sin `Table`), `Avatar` con fallback a iniciales,
  nombre + dorsal, contenedor con `maxHeight` + `overflowY: auto` para rosters largos,
  `text-overflow: ellipsis` para nombres largos.
- **Verify**: `npm run test -- TeamPlayerPicker` en verde.
- [x] 14.3 Test (Red, extendiendo `Register.test.tsx`): seleccionar `Player` — código de equipo
  inválido bloquea el submit; código válido revela el roster; una fila `alreadyLinked` es
  imposible de seleccionar; el submit permanece bloqueado hasta elegir una fila no vinculada;
  submit exitoso postea `AccountType: "Player"` + `TeamInvitationCode` + `TeamPlayerId`. Un
  `ProblemDetails` con `Extensions.code === "LinkedPlayerAlreadyClaimed"` devuelto por el submit
  real (no el preview) renderiza el mensaje i18n correspondiente como `formError` (verifica el
  camino de re-chequeo TOCTOU, no solo el preview).
- [x] 14.4 Cablear `InvitationCodeField kind="team"` + `TeamPlayerPicker` en `Register.tsx` para
  `Player`/`FamilyMember`; el submit handler trata `ClubInvitationCodeInvalid`/
  `TeamInvitationCodeInvalid`/`LinkedPlayerAlreadyClaimed` devueltos por `POST /api/register` como
  fallo válido (no reintento silencioso), mapeado con `getErrorMessage` a `formError`.
- **Verify**: `npm run test -- Register` en verde (casos 14.3).

## 15. Frontend — integración completa de los 6 roles + tipos de servicio

- [x] 15.1 Actualizar `Front/src/shared/types/scope.ts`: `RegisterPayingAccountPayload.accountType`
  pasa de `"Coach" | "Directive"` a la unión `UserType` completa (6 valores, usando
  `"ClubDirector"` en vez de `"Directive"`); añadir campos opcionales `trialAccepted`,
  `clubInvitationCode`, `teamInvitationCode`, `teamPlayerId` al payload. Renombrar/ajustar el tipo
  de respuesta para reflejar `RegisterAccountResponse` del backend (`Status:
  "Active" | "PendingClubApproval"`, `ClubJoinRequestId`).
- [x] 15.2 Actualizar `Front/src/shared/services/auth/coachAuthService.ts` (o ruta equivalente,
  confirmar nombre exacto del archivo) para enviar los campos condicionales nuevos en el payload de
  `registerPayingAccount`/su renombre, según el rol seleccionado en `Register.tsx`.
- [x] 15.3 Test (Red, extendiendo `Register.test.tsx`): recorrido completo de los 6 roles en un solo
  archivo de test (`Fan`, `ClubDirector`, `Coach` sin código, `Coach` con código, `ClubMember`,
  `Player`/`FamilyMember`) confirmando para cada uno: qué secciones se muestran, qué payload exacto
  se postea, y qué pantalla de éxito se renderiza — consolidando los casos ya escritos en las
  tareas 12–14 en una suite única y legible (no duplicar aserciones, solo asegurar que las 6 filas
  están cubiertas en el mismo archivo final).
- **Verify**: `npm run test -- Register` en verde cubriendo las 6 filas; `npm run build` sin errores
  de tipos (confirma que `scope.ts` y `coachAuthService.ts` están alineados con los componentes).

## 16. Frontend — página de gestión de solicitudes de club (`ClubJoinRequests`)

- [x] 16.1 Test (Red) en
  `Front/src/shared/services/clubJoinRequests/clubJoinRequestsApi.test.ts`: `list(clubId, status)`
  llama `GET api/clubs/{clubId}/join-requests?status=`; `getPendingCount(clubId)` llama `GET
  api/clubs/{clubId}/join-requests/count`; `approve(requestId)`/`reject(requestId)` llaman sus
  endpoints `POST`; cobertura de la rama `USE_MOCK` igual que `scopesApi.ts`.
- [x] 16.2 Implementar `Front/src/shared/services/clubJoinRequests/clubJoinRequestsApi.ts` (clase +
  export singleton, mismo patrón que `scopesApi.ts`) y
  `Front/src/shared/services/clubJoinRequests/__mocks__/clubJoinRequestsMock.ts`.
- **Verify**: `npm run test -- clubJoinRequestsApi` en verde.
- [x] 16.3 Test (Red) en `Front/src/shared/pages/ClubJoinRequests/ClubJoinRequests.test.tsx`:
  estado de carga inicial; lista de pendientes en la pestaña por defecto; estado vacío cuando la
  API mockeada devuelve `[]`; flujo de aprobar abre `ConfirmDialog`, confirmar llama
  `clubJoinRequestsApi.approve(requestId)` y refetch de lista+contador (fila desaparece, `Snackbar`
  de éxito); flujo de rechazar equivalente; un fallo de API al confirmar mantiene el diálogo abierto
  y muestra `Snackbar` de error; cambiar a la pestaña "Decididas" llama `list(clubId, "decided")` y
  renderiza `Chip`s de estado sin acciones de fila; viewport móvil (mock de `matchMedia` o
  aserción de clase CSS-module, siguiendo la convención ya usada en tests responsive existentes —
  revisar `ScopeMembers.test.tsx` u otro sibling antes de inventar una nueva) renderiza el layout de
  tarjetas en vez de la tabla.
- [x] 16.4 Implementar `Front/src/shared/pages/ClubJoinRequests/ClubJoinRequests.tsx` (+
  `.module.css`): `BaseLayout` > `ContentLayout`, `Tabs` Pendientes/Decididas (estado local, sin
  query param), `Table` desktop / `Card` list mobile vía clases CSS Module con media query
  (`.tableView`/`.cardView`), `ConfirmDialog` compartido para aprobar/rechazar con copy específico
  por acción, `Snackbar`+`problemMessage` para feedback, refetch de lista y contador tras cada
  decisión.
- [x] 16.5 Registrar la ruta `/club-join-requests` en `Front/src/core/router/AppRouter.tsx` (lazy
  `React.lazy`, sibling de la ruta de `ScopeMembers`), leyendo `clubId` de query string.
- **Verify**: `npm run test -- ClubJoinRequests` en verde; `npm run build` sin errores.
- [x] 16.6 Test (Red, extendiendo `Front/src/shared/pages/ScopeMembers/ScopeMembers.test.tsx`):
  cuando `scopeKind === "club"`, el botón "Solicitudes de entrenadores" con `Badge` muestra el
  `pendingCount` mockeado y queda oculto (`invisible`) cuando es `0`; hacer click navega a
  `/club-join-requests?clubId=...`.
- [x] 16.7 Añadir a `Front/src/shared/pages/ScopeMembers/ScopeMembers.tsx`: tercera llamada paralela
  en `loadAll()` a `clubJoinRequestsApi.getPendingCount(scopeId)` solo cuando `scopeKind ===
  "club"`; botón + `Badge` (`color="error"`) junto al botón "Rotar código" existente, enlazando a
  `/club-join-requests?clubId={scopeId}`.
- **Verify**: `npm run test -- ScopeMembers` en verde (no rompe los tests existentes de la página,
  añade los nuevos de 16.6).

## 17. Frontend — verificación responsive final y cierre

- [ ] 17.1 Verificación manual/Playwright en viewport 360×740 (móvil pequeño, el flag explícito de
  `design.md` § Responsive Notes) para `Register.tsx`: confirmar que `RoleSelector` (apilado),
  `InvitationCodeField`, y `TeamPlayerPicker` (lista de una columna con scroll propio) caben sin
  overflow horizontal ni recortes en los 6 roles.
- [ ] 17.2 Verificación manual/Playwright en el mismo viewport 360×740 para
  `Front/src/shared/pages/ClubJoinRequests/ClubJoinRequests.tsx`: confirmar el swap a layout de
  tarjetas (`.cardView`) en ambas pestañas, sin scroll horizontal, y que los botones de
  aprobar/rechazar son accesibles con el pulgar (no recortados).
- [x] 17.3 Ejecutar la suite completa: `npm run test` (Front) en verde sin tests omitidos; revisar
  que ningún test de `AppSelector`/`UserTypeDialog`/`ScopeMembers` quedó roto por las relocaciones
  de las tareas 11 y 16.
- **Verify**: `npm run build && npm run test` (Front) en verde completo antes de pasar el cambio a
  verificación (`openspec-verify-change`). Si hay Playwright configurado para estas páginas,
  `npx playwright test` también en verde, cubriendo al menos un caso por viewport móvil de 17.1/17.2.
