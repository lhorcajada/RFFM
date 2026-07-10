## Why

La app es multi-tenant por cuenta pagadora: cada entrenador o directivo que paga administra su propio espacio (sus equipos / su club) y no ve los datos de otros espacios, aunque los clubs se llamen igual. Hoy esta separación no funciona fino: el registro fuerza el rol `Federation`, los códigos de equipo (`Team.JoinCode`) no se validan en ningún endpoint, `UserClub.UpdateRoleId` solo permite `Coach`/`Directive` (no jugador/padre/seguidor), y el pagador no tiene ninguna UI para gestionar los miembros invitados a su espacio. Sin esto, un entrenador no puede invitar a su equipo ni un directivo gestionar su club, que es el núcleo del producto.

## What Changes

- Nuevo flujo de **alta por tipo de cuenta** que sustituye al `Federation` por defecto: al registrarse sin código, el usuario elige `Coach` o `Directive` e inicia su suscripción; al registrarse/entrar con código, queda como miembro invitado (`Player`, `FamilyPlayer`, `Follower`, `ClubMember`) del espacio del pagador.
- Nuevos endpoints de **validación de códigos**: `POST /api/invitations/club/validate` (refactor del `ValidateInvitationCode` actual) y `POST /api/invitations/team/validate` (nuevo, contra `Team.JoinCode`).
- **BREAKING**: `UserClub.UpdateRoleId` admite cualquier `Membership` (no solo `Coach`/`Directive`), para que jugadores/padres/seguidores/miembros puedan vincularse a un club vía código.
- Nuevos endpoints de **gestión de miembros por scope** (solo para el pagador `IsCreator` + `Subscription.Active` del scope):
  - `GET /api/scopes/members?clubId=...` para directivo (lista miembros de su club).
  - `GET /api/scopes/members?teamId=...` para entrenador (lista miembros de su equipo).
  - `DELETE /api/scopes/members/{membershipId}` para desvincular a un invitado de su scope.
  - `POST /api/scopes/invitations/regenerate` para rotar el código de club o equipo.
- **Validación "un solo espacio activo"** para invitados: al aceptar un código, si el usuario ya pertenece a otro espacio activo, se rechaza con un mensaje claro (debe abandonar el anterior primero). Nuevo endpoint `POST /api/scopes/members/leave` para que el invitado abandone su espacio actual.
- **Autorización por scope**, no por rol global: el pagador solo puede tocar miembros de su propio scope (validación contra `UserClub.IsCreator` + `Subscription.Active` del usuario autenticado).
- Nuevas páginas front: `/scope/members` (gestión de miembros para el pagador, con tabla, desvinculación y rotación de código) y ajuste del `AppSelector`/registro para distinguir pagador vs. invitado con/sin código.

## Capabilities

### New Capabilities
- `scoped-membership-management`: Alta por tipo de cuenta (pagador vs. invitado con código), validación de códigos de club y equipo, gestión de miembros del scope por el pagador, y restricción de un solo espacio activo para invitados. Contrato API compartido entre back (.NET + Identity + AppDbContext) y front (React/MUI).

### Modified Capabilities
<!-- No existen specs previas en openspec/specs. -->

## Impact

- **Back**:
  - `Features/Coaches/Users/Commands/CreateUser.cs`: dejar de forzar `Federation`; ramificar según tipo de cuenta y crear `UserClub` con `IsCreator=true` para pagadores.
  - `Features/Coaches/Invitation/Commands/ValidateInvitationCode.cs`: refactor + nuevo `ValidateTeamJoinCode` contra `Team.JoinCode`.
  - `Domain/Aggregates/UserClubs/UserClub.cs`: `UpdateRoleId` admite toda `Membership`.
  - Nueva feature `Features/Scopes` (o `Features/Coaches/Scopes`) con queries/commands de miembros y leave/regenerate.
  - Validación de "un solo espacio activo" en `AppDbContext` (consulta `UserClub`/`TeamPlayer` existentes del usuario).
  - Sin migraciones de esquema nuevas (campos ya existen: `IsCreator`, `InvitationCode`, `JoinCode`, `Subscription`).
- **Front**:
  - Ajuste de `AppSelector`/`useTeamAppEntry` para distinguir alta pagador vs. invitado.
  - Nueva página `/scope/members` con tabla de miembros, diálogo de confirmación de desvinculación y botón de rotar código.
  - Nuevo servicio `scopesApi` + tipos `ScopeMember`, `InvitationCode`, `MembershipKind` alineados con el contrato.
- **Contrato API**: definido en `specs/scoped-membership-management/spec.md` como fuente única; front se implementará primero mockeado contra ese contrato y el back después.
- **Seguridad**: autorización por `IsCreator` + `Subscription.Active` del scope; un pagador nunca puede tocar miembros de un scope ajeno; un invitado solo puede abandonar su propio espacio.
