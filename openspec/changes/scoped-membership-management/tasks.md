# Tasks — scoped-membership-management

Orden: contrato (spec) ya hecho → front mockeado → back → conexión.

## 1. Contrato (completado)

- [x] 1.1 proposal.md
- [x] 1.2 specs/scoped-membership-management/spec.md (contrato API + tipos)
- [x] 1.3 design.md

## 2. Front — tipos y servicios (mockeado)

- [x] 2.1 Crear `Front/src/shared/types/scope.ts` con `MembershipKind`, `ScopeMember`, `ActiveScope`, `InvitationCode`, `RegisterPayingAccountPayload`, `ValidateCodePayload` según la spec
- [x] 2.2 Crear `Front/src/shared/services/scopes/scopesApi.ts` con `listScopeMembers`, `removeScopeMember`, `leaveScope`, `regenerateInvitation`
- [x] 2.3 Crear `Front/src/shared/services/invitations/invitationsApi.ts` con `validateClubCode`, `validateTeamCode`
- [x] 2.4 Añadir flag `VITE_USE_MOCK` y fixtures (`__mocks__/scope.ts`) con los mismos tipos
- [x] 2.5 Ajustar `registerPayingAccount` (extender payload de `/register` con `accountType`)

## 3. Front — UI

- [x] 3.1 Ajustar `AppSelector`/`useTeamAppEntry` para distinguir alta pagador (sin código) vs. invitado (con código: club o equipo)
- [x] 3.2 Ajustar `Register.tsx` para capturar `accountType: "Coach"|"Directive"` cuando no hay código
- [x] 3.3 Crear página `Front/src/shared/pages/ScopeMembers/ScopeMembers.tsx` (código actual + botón rotar + tabla de miembros)
- [x] 3.4 Diálogo de confirmación de desvinculación llamando a `removeScopeMember`
- [x] 3.5 Botón "Rotar código" con confirmación llamando a `regenerateInvitation`
- [x] 3.6 Snackbars de error leyendo `ProblemDetails` (400/402/403/409)
- [x] 3.7 Registrar ruta `/scope/members` protegida para pagadores (`IsCreator` + suscripción activa)

## 4. Back — dominio y feature

- [x] 4.1 Revisar `TeamPlayer`: ¿soporta `FamilyPlayer`/`Follower`, o hace falta `UserTeam`? Decidir y, si hace falta, crear entidad + migración mínima
- [x] 4.2 `Domain/Aggregates/UserClubs/UserClub.cs`: `UpdateRoleId` admite toda `Membership` (quitar restricción `Coach|Directive`)
- [x] 4.3 Refactor `Features/Coaches/Invitation/Commands/ValidateInvitationCode.cs` → `POST /api/invitations/club/validate` (misma lógica + `membershipKind` + validación "un solo espacio activo" + JWT actualizado)
- [x] 4.4 Crear `Features/Coaches/Invitation/Commands/ValidateTeamJoinCode.cs` → `POST /api/invitations/team/validate` (contra `Team.JoinCode`)
- [x] 4.5 Ajustar `Features/Coaches/Users/Commands/CreateUser.cs`: no forzar `Federation`; ramificar por `accountType` (`Coach`/`Directive`) y crear `Subscription`; `400` si no hay `accountType`
- [x] 4.6 Crear `Features/Scopes/Queries/GetScopeMembers.cs` (`GET /api/scopes/members?clubId=|teamId=`) con autorización `IsCreator` + `Subscription.Active`
- [x] 4.7 Crear `Features/Scopes/Commands/RemoveScopeMember.cs` (`DELETE /api/scopes/members/{membershipId}`) con validaciones (no a creador, no a sí mismo, scope ajeno 403)
- [x] 4.8 Crear `Features/Scopes/Commands/LeaveScope.cs` (`POST /api/scopes/members/leave`) para invitados
- [x] 4.9 Crear `Features/Scopes/Commands/RegenerateInvitation.cs` (`POST /api/scopes/invitations/regenerate`) para rotar `Club.InvitationCode` o `Team.JoinCode`
- [x] 4.10 Implementar helper de autorización por scope (`IsCreator` + `Subscription.Active`) reutilizable por los handlers
- [x] 4.11 Implementar desvinculación automática al caducar suscripción: helper que, al detectar `Subscription.Status != Active` o `EndDate < now`, elimine todos los `UserClub`/vínculos `IsCreator=false` del scope antes de devolver `402`
- [x] 4.12 (Opcional v1) Job/consulta programada de revisión de suscripciones caducadas que dispare la desvinculación automática proactiva

## 5. Conexión y verificación

- [x] 5.1 Apagar el mock por defecto y apuntar `scopesApi`/`invitationsApi` al back real
- [ ] 5.2 Probar E2E a mano: registro entrenador → crea club/equipo → rota código → invita jugador con código → jugador entra → entrenador lista/desvincula → jugador abandona
- [ ] 5.3 Verificar escenarios de error: 409 un solo espacio activo, 403 scope ajeno, 402 sin suscripción, 400 membership no permitida, 400 desvincular a creador/sí mismo
- [x] 5.4 `dotnet build` + `npm run build` + `npm run lint`/`typecheck` verdes
- [x] 5.5a `openspec validate scoped-membership-management` → OK
- [ ] 5.5b Archivar (pendiente de 5.2/5.3 manuales)
