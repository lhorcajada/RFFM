## Why

Hoy `POST /api/register` (`CreateUser.cs`) solo acepta `AccountType` `Coach` o `Directive` (líneas 71-82); cualquier otro valor devuelve 400 `AccountTypeRequired`. El formulario de registro (`Front/src/shared/pages/auth/register/Register.tsx`, líneas 146-166) refleja esa limitación: el `RadioGroup` solo renderiza "Entrenador" y "Directivo", aunque el catálogo de roles completo ya existe en ambos lados (`AppRoles.cs` backend, `UserTypeDialog.tsx` frontend: `Coach, ClubDirector, Player, FamilyMember, Fan, ClubMember`).

Además, el registro trata a todos los roles igual (alias + email + password + trial de 7 días), cuando el negocio necesita 5 flujos distintos según el rol:
- Directivo siempre paga tras 7 días de prueba (comportamiento actual, sin cambios).
- Entrenador puede entrar gratis con prueba de 7 días **o** vincularse a un club mediante código de invitación, quedando pendiente de aceptación por el club (sin trial, pero también sin acceso hasta que el club apruebe y pague la cuota).
- Jugador y Familiar de jugador necesitan un código de equipo/club (`ValidateTeamJoinCode`/`ValidateInvitationCode`, ya implementados) y deben elegir a qué jugador del equipo quedan enlazados.
- Miembro de club necesita el código de invitación de club existente (`ValidateInvitationCode.cs`) y queda asociado a ese club sin pasos adicionales.
- Seguidor se registra sin código ni trial, con acceso limitado a la app de Federación (gating ya existente en `AppSelector.tsx`).

`ValidateInvitationCode.cs` ya rechaza explícitamente códigos para `Coach`/`Directive` ("requieren cuenta pagadora, no código de invitación", líneas 104-113), lo que hoy hace imposible que un Coach con código de club se registre sin pagar — es una restricción a levantar como parte de este cambio.

**Hallazgo importante que cambia el diseño**: `ValidateInvitationCode` (`api/invitations/club/validate`) y `ValidateTeamJoinCode` (`api/invitations/team/validate`) tienen `.RequireAuthorization()` — solo se pueden llamar con un JWT válido, es decir hoy están pensados para un usuario **ya registrado y autenticado** que se une a un club/equipo después, no para validar un código durante el propio registro (anónimo). Además `ValidateTeamInvitationResponse` no devuelve ninguna lista de jugadores del equipo (solo `TeamId, TeamName, ClubId, MembershipKind, Token`). Por tanto, "reutilizar el sistema existente" (confirmado por el usuario) no es un simple reuso: `design.md` debe decidir entre (a) exponer una validación anónima de código previa al alta (preview, sin efectos secundarios) que se invoque desde el formulario de registro antes de crear la cuenta, con el join real ocurriendo en `CreateUser`, o (b) un registro en dos fases (crear cuenta base sin rol → autenticar → invocar el endpoint existente para unirse), y en cualquier caso añadir la lista de jugadores del equipo a la respuesta de validación de código de equipo.

**Nota de nomenclatura a respetar en el diseño**: existen dos vocabularios de rol distintos que hay que mapear con cuidado. El frontend (`UserTypeDialog.tsx`) y `AppRoles.cs` (Identity) usan `FamilyMember`/`Fan`; el dominio de membresía de club/equipo (`Membership.cs`, y por tanto el campo `MembershipKind` que esperan `ValidateInvitationCode`/`ValidateTeamJoinCode`) usa `FamilyPlayer`/`Follower` para los mismos roles. Ya existe `MembershipIdentityRoles.cs` para traducir entre ambos; el nuevo código de registro debe reutilizar ese mapeo en vez de inventar uno nuevo o mezclar las cadenas.

## What Changes

- **Backend — `CreateUser` (`POST /api/register`)**: aceptar los 6 `AccountType`/roles en vez de solo 2. El comando gana campos condicionales: `TrialAccepted` (bool, Directivo/Coach sin código), `ClubInvitationCode` (Coach con código, ClubMember), `TeamInvitationCode` (Player/FamilyMember) y `LinkedPlayerId` (Player/FamilyMember, tras elegir jugador de la lista). Reglas por rol:
  - `ClubDirector`: requiere `TrialAccepted = true`; si no, 400 (registro cancelado en frontend, sin llamar al endpoint o devolviendo error explícito).
  - `Coach` sin `ClubInvitationCode`: igual que Directivo (`TrialAccepted` obligatorio).
  - `Coach` con `ClubInvitationCode`: valida contra `ValidateInvitationCode`, no crea `Subscription`/trial; crea el usuario en estado **pendiente de aceptación por el club** (nuevo estado, a definir en `design.md`); no se activa hasta que el club apruebe.
  - `Player`/`FamilyMember`: requieren `TeamInvitationCode` válido y `LinkedPlayerId` perteneciente a la lista de jugadores del equipo (lista hoy inexistente en `ValidateTeamInvitationResponse`, hay que añadirla). `design.md` decide si la validación de código ocurre de forma anónima antes de crear la cuenta o si el registro crea primero la cuenta base y luego reutiliza `ValidateTeamJoinCode` autenticado para el join — ver hallazgo en `## Why`.
  - `ClubMember`: requiere `ClubInvitationCode` válido, sin trial. Misma decisión pendiente de `design.md` sobre anónimo-antes-vs-autenticado-después que para Player/FamilyMember.
  - `Fan`: sin campos adicionales, sin trial, sin código.
  - Se levanta la restricción actual que bloquea códigos de club para `Coach`/`Directive` en `ValidateInvitationCode.cs`, pero solo para `Coach` (Directivo sigue sin código).
- **Backend — nuevo flujo de aceptación de club para Coach con código**: al menos un endpoint para que el club (Directivo) apruebe/rechace la solicitud pendiente del entrenador, y lógica de cuota (billing) por entrenador/miembro aceptado. Alcance exacto (modelo de datos, estados, quién paga y cómo) se define en `design.md`.
- **Frontend — `Register.tsx`**: selector de rol con los 6 roles. Por rol seleccionado, se muestran pasos condicionales: diálogo de aceptación de 7 días (Directivo, Coach sin código) con opción de cancelar; input de código con validación en vivo y mensaje de error (Coach con código, ClubMember, Player/FamilyMember); para Player/FamilyMember, tras validar el código, lista seleccionable de jugadores del equipo devuelta por la validación. Todo el flujo responsive (mobile-first, ya que hoy el formulario no se ha verificado en breakpoints pequeños).
- **Frontend — servicios**: extender `invitationsApi.ts` para exponer el listado de jugadores del equipo asociado a un código válido, ya que `ValidateTeamJoinCode` no lo devuelve hoy (ver hallazgo en `## Why`).

## Capabilities

### New Capabilities
- `role-based-registration-flows`: registro multi-rol con validación condicional de trial/código/vínculo de jugador, y flujo de aceptación de club para entrenadores invitados.

### Modified Capabilities
- Invitaciones de club/equipo (`ValidateInvitationCode`, `ValidateTeamJoinCode`): se amplía su uso a un nuevo caller (registro) y se ajusta la restricción de roles permitidos para código.

## Impact

- **Back**: `Features/Coaches/Users/Commands/CreateUser.cs` (Command, Handler, Validator), `Features/Coaches/Invitation/Commands/ValidateInvitationCode.cs` (restricción de roles **y posible cambio de `RequireAuthorization()`** si se opta por validación anónima pre-registro), `Features/Coaches/Invitation/Commands/ValidateTeamJoinCode.cs` (idem, más añadir lista de jugadores a `ValidateTeamInvitationResponse`), `Domain/Entities/AppRoles.cs` / `Domain/Aggregates/UserClubs/Membership.cs` (sin cambio de forma, se usan tal cual), nuevo modelo/estado para "coach pendiente de aceptación por club" y lógica de cuota — a detallar en `design.md`. Requiere migración EF si se añade estado/entidad nueva.
- **Front**: `Front/src/shared/pages/auth/register/Register.tsx` (rediseño del formulario con pasos condicionales), `Front/src/shared/services/invitations/invitationsApi.ts` (posible extensión), nuevos componentes de diálogo/lista responsive, `Front/src/shared/pages/AppSelector/components/UserTypeDialog.tsx` como referencia de labels de roles ya existentes.
- **Sin cambios** en `CoachTrialDialog.tsx` (se mantiene el mensaje post-login existente) salvo que el diseño decida moverlo al registro.
