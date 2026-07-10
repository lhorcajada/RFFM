## ADDED Requirements

### Requirement: Alta de cuenta pagadora (sin código)
El sistema SHALL permitir que un usuario se registre sin código como `Coach` o `Directive`, cree su espacio y quede como administrador del mismo.

#### Scenario: Registro de entrenador pagador
- **WHEN** un usuario se registra sin código y selecciona tipo `Coach`
- **THEN** el sistema crea el `IdentityUser`, le asigna el rol Identity `Coach`, crea una `Subscription` (plan Free/trial), y NO crea aún `UserClub` (lo creará al dar de alta su primer club/equipo)
- **AND** responde `200` con `{ "userId": string, "roles": ["Coach"], "subscription": { "plan": "Free", "status": "Active", "endDate": string } }`

#### Scenario: Registro de directivo pagador
- **WHEN** un usuario se registra sin código y selecciona tipo `Directive`
- **THEN** el sistema crea el `IdentityUser`, le asigna el rol Identity `Directive`, crea una `Subscription` y responde con la misma forma que el escenario anterior con `roles: ["Directive"]`

#### Scenario: No se fuerza Federation por defecto
- **WHEN** un usuario se registra sin indicar tipo de cuenta
- **THEN** el sistema responde `400` indicando que debe seleccionar `Coach` o `Directive`, y NO crea el usuario

#### Scenario: Alias duplicado
- **WHEN** el alias ya existe
- **THEN** responde `409` con `ProblemDetails`

### Requirement: Validación de código de club
El sistema SHALL exponer `POST /api/invitations/club/validate` para que un usuario autenticado se vincule a un club existente usando su `InvitationCode`.

#### Scenario: Código válido y usuario sin espacio activo
- **WHEN** un usuario autenticado envía `{ "code": string, "membershipKind": "Player|FamilyPlayer|Follower|ClubMember" }` con un `InvitationCode` existente y el usuario no pertenece a otro espacio activo
- **THEN** el sistema crea un `UserClub` con la `Membership` indicada, `IsCreator=false`, responde `200` con `{ "clubId": string, "clubName": string, "membershipKind": string }` y devuelve un JWT actualizado con los roles Identity correspondientes al `membershipKind`

#### Scenario: Usuario ya en ese club
- **WHEN** el usuario ya tiene un `UserClub` para ese club
- **THEN** responde `400` indicando "Ya perteneces a este club"

#### Scenario: Usuario con otro espacio activo
- **WHEN** el usuario ya pertenece a otro espacio activo (otro `UserClub` o `TeamPlayer` vigente)
- **THEN** responde `409` con `{ "message": "Ya perteneces a otro espacio. Abandónalo antes de unirte a uno nuevo.", "activeScope": { "kind": "club|team", "id": string, "name": string } }`

#### Scenario: Código inexistente
- **WHEN** el `code` no corresponde a ningún `Club.InvitationCode`
- **THEN** responde `404`

#### Scenario: Membership no permitida con código de club
- **WHEN** el `membershipKind` es `Coach` o `Directive`
- **THEN** responde `400` indicando que esos roles requieren cuenta pagadora, no código

### Requirement: Validación de código de equipo
El sistema SHALL exponer `POST /api/invitations/team/validate` para que un usuario autenticado se vincule a un equipo existente usando su `JoinCode`.

#### Scenario: Código válido y usuario sin espacio activo
- **WHEN** un usuario autenticado envía `{ "code": string, "membershipKind": "Player|FamilyPlayer|Follower" }` con un `Team.JoinCode` existente y el usuario no pertenece a otro espacio activo
- **THEN** el sistema vincula al usuario al equipo (vía `TeamPlayer` o la entidad de membresía de equipo que aplique) con la `Membership` indicada, responde `200` con `{ "teamId": string, "teamName": string, "clubId": string, "membershipKind": string }` y devuelve un JWT actualizado

#### Scenario: Usuario ya en ese equipo
- **WHEN** el usuario ya está vinculado a ese equipo
- **THEN** responde `400` indicando "Ya perteneces a este equipo"

#### Scenario: Usuario con otro espacio activo
- **WHEN** el usuario ya pertenece a otro espacio activo
- **THEN** responde `409` con el mismo formato que el escenario equivalente de club

#### Scenario: Código inexistente
- **WHEN** el `code` no corresponde a ningún `Team.JoinCode`
- **THEN** responde `404`

#### Scenario: Membership no permitida con código de equipo
- **WHEN** el `membershipKind` es `Coach`, `Directive` o `ClubMember`
- **THEN** responde `400` indicando que ese rol no aplica a un equipo

### Requirement: Listar miembros del scope
El sistema SHALL exponer `GET /api/scopes/members` para que el pagador vea los miembros de su scope (club o equipo).

#### Scenario: Directivo lista miembros de su club
- **WHEN** un `Directive` con `UserClub.IsCreator=true` y `Subscription.Status=Active` llama `GET /api/scopes/members?clubId={id}` donde `{id}` es su club
- **THEN** responde `200` con `ScopeMember[]` donde `ScopeMember` = `{ "membershipId": string, "userId": string, "alias": string, "email": string, "membershipKind": string, "joinedAt": string, "isCreator": boolean }`

#### Scenario: Entrenador lista miembros de su equipo
- **WHEN** un `Coach` pagador llama `GET /api/scopes/members?teamId={id}` donde `{id}` es un equipo que pertenece a un club suyo (`IsCreator=true`)
- **THEN** responde `200` con los miembros de ese equipo con la misma forma

#### Scenario: Pagador consulta scope ajeno
- **WHEN** un pagador llama con un `clubId`/`teamId` de un scope que no le pertenece (`IsCreator=false` o no es su club)
- **THEN** responde `403`

#### Scenario: Sin suscripción activa
- **WHEN** el pagador no tiene `Subscription.Status=Active`
- **THEN** responde `402` con `ProblemDetails` indicando "Suscripción inactiva"

#### Scenario: No pagador
- **WHEN** un usuario invitado (no `IsCreator`) llama al endpoint
- **THEN** responde `403`

### Requirement: Desvinculación automática al caducar la suscripción
El sistema SHALL desvincular automáticamente a todos los invitados de un scope cuando la suscripción del pagador deja de estar activa (`Expired`, `Cancelled` o `EndDate` pasada sin renovación).

#### Scenario: Suscripción caducada detectada al gestionar
- **WHEN** un pagador con `Subscription.Status != Active` (o `EndDate < now`) llama a `GET /api/scopes/members` o cualquier endpoint de gestión
- **THEN** el sistema, antes de responder `402`, desvincula a todos los miembros `IsCreator=false` de su scope y responde `402` con `ProblemDetails` indicando "Suscripción inactiva. Se han desvinculado N miembros de tu espacio."

#### Scenario: Detección proactiva por job/consulta
- **WHEN** se ejecuta una pasada de revisión de suscripciones (job programado o consulta bajo demanda) y encuentra un scope cuyo pagador tiene `Subscription` caducada
- **THEN** el sistema desvincula a todos los miembros `IsCreator=false` de ese scope y marca el evento en logs

#### Scenario: Pagador no se desvincula a sí mismo
- **WHEN** se ejecuta la desvinculación automática
- **THEN** el `UserClub`/vínculo del pagador (`IsCreator=true`) se conserva (no se desvincula a sí mismo)

#### Scenario: Invitado desvinculado intenta entrar
- **WHEN** un invitado desvinculado automáticamente intenta acceder a su antiguo scope
- **THEN** responde `403`/`404` según corresponda y el front le ofrece unirse a un nuevo espacio vía código

### Requirement: Desvincular miembro del scope
El sistema SHALL exponer `DELETE /api/scopes/members/{membershipId}` para que el pagador desvincule a un invitado de su scope.

#### Scenario: Desvinculación válida
- **WHEN** un pagador llama `DELETE /api/scopes/members/{membershipId}` donde el `membershipId` pertenece a un miembro de su scope y no es él mismo
- **THEN** el sistema elimina el `UserClub`/vínculo de equipo, responde `204` y libera al invitado para unirse a otro espacio

#### Scenario: Desvincular a otro pagador
- **WHEN** el `membershipId` corresponde a un `IsCreator=true`
- **THEN** responde `400` indicando que no se puede desvincular a un creador

#### Scenario: Desvincular a sí mismo
- **WHEN** el pagador intenta desvincular su propio `membershipId`
- **THEN** responde `400` indicando que no puede desvincularse a sí mismo

#### Scenario: Miembro de scope ajeno
- **WHEN** el `membershipId` pertenece a un scope que no es del pagador
- **THEN** responde `403`

### Requirement: Abandonar espacio (invitado)
El sistema SHALL exponer `POST /api/scopes/members/leave` para que un invitado abandone su espacio activo por su cuenta.

#### Scenario: Invitado abandona su espacio
- **WHEN** un usuario invitado (`IsCreator=false`) llama `POST /api/scopes/members/leave` sin cuerpo
- **THEN** el sistema elimina su `UserClub`/vínculo de equipo vigente, responde `200` con `{ "leftScope": { "kind": "club|team", "id": string, "name": string } }` y el usuario queda libre para unirse a otro

#### Scenario: Pagador intenta abandonar
- **WHEN** un usuario pagador (`IsCreator=true`) llama al endpoint
- **THEN** responde `400` indicando que un creador no puede abandonar su espacio; debe cancelar su suscripción o transferir ownership (futuro)

#### Scenario: Sin espacio activo
- **WHEN** el usuario no tiene ningún `UserClub`/vínculo vigente
- **THEN** responde `404` indicando "No perteneces a ningún espacio"

### Requirement: Rotar código de invitación
El sistema SHALL exponer `POST /api/scopes/invitations/regenerate` para que el pagador rote el código de su club o equipo.

#### Scenario: Rotar código de club
- **WHEN** un `Directive` pagador envía `{ "scopeKind": "club", "scopeId": "{id}" }` con su club
- **THEN** el sistema genera un nuevo `Club.InvitationCode`, responde `200` con `{ "scopeKind": "club", "scopeId": string, "newCode": string }` e invalida el anterior

#### Scenario: Rotar código de equipo
- **WHEN** un `Coach` pagador envía `{ "scopeKind": "team", "scopeId": "{id}" }` con un equipo suyo
- **THEN** el sistema genera un nuevo `Team.JoinCode`, responde `200` con la misma forma y invalida el anterior

#### Scenario: Scope ajeno
- **WHEN** el pagador envía un `scopeId` que no le pertenece
- **THEN** responde `403`

### Requirement: Tipos compartidos del contrato
El front y el back SHALL usar exactamente los mismos tipos para el contrato. Esta spec es la fuente única de verdad.

#### Scenario: Tipos front
- **WHEN** se implemente `scopesApi` e `invitationsApi` en el front
- **THEN** los tipos `ScopeMember`, `InvitationCode`, `MembershipKind` (`"Coach"|"Directive"|"Player"|"FamilyPlayer"|"Follower"|"ClubMember"`), `ActiveScope`, y los payloads de cada endpoint coinciden campo a campo con los definidos en esta spec

#### Scenario: Endpoints front
- **WHEN** se implemente el front
- **THEN** expone `registerPayingAccount(payload)`, `validateClubCode(payload)`, `validateTeamCode(payload)`, `listScopeMembers(params)`, `removeScopeMember(membershipId)`, `leaveScope()`, `regenerateInvitation(payload)` contra las rutas definidas en esta spec

### Requirement: Página de gestión de miembros
El front SHALL proveer una página `/scope/members` accesible para pagadores (`IsCreator` + suscripción activa).

#### Scenario: Acceso de pagador
- **WHEN** un pagador navega a `/scope/members`
- **THEN** el front renderiza el código de invitación actual de su scope, un botón para rotarlo, y una tabla de miembros con alias, email, `membershipKind`, fecha de alta y acción de desvincular

#### Scenario: Acceso de invitado
- **WHEN** un usuario invitado (no pagador) intenta acceder a `/scope/members`
- **THEN** el front redirige a `/appSelector` con un snackbar de advertencia

#### Scenario: Rotar código desde la UI
- **WHEN** el pagador pulsa "Rotar código" y confirma
- **THEN** el front llama a `regenerateInvitation` y muestra el nuevo código

#### Scenario: Desvincular desde la UI
- **WHEN** el pagador pulsa desvincular en un miembro y confirma
- **THEN** el front llama a `removeScopeMember` y refresca la tabla

#### Scenario: Manejo de errores de contrato
- **WHEN** una llamada devuelve `400`/`403`/`409`
- **THEN** el front muestra el mensaje de `ProblemDetails` en un snackbar y mantiene el estado previo
