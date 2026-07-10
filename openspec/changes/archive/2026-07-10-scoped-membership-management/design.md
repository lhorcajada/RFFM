## Context

RFFM es multi-tenant por cuenta pagadora. Hoy hay:
- `IdentityUser`/`IdentityRole` con JWT (claim `roles`), roles sembrados (`Federation`, `Coach`, `Administrator`).
- `AppRoles` (type-safe enum, 8 roles) y `UserRoles` (dominio) — dos fuentes paralelas de roles.
- `UserClub` (aggregate root) con `ApplicationUserId`, `ClubId`, `RoleId` (`Membership`), `IsCreator`. `UpdateRoleId` solo permite `Coach`/`Directive`.
- `Club.InvitationCode` (8 chars) y `Team.JoinCode` (8 chars) — ambos autogenerados, pero solo el de club se valida (`ValidateInvitationCode`).
- `Subscription` por `UserId` con `PaymentPlan` (`AllowedClubs`, `AllowedTeams`, `AllowedUsers`).
- `AcquireCoachTrial` crea plan Free 1/1/1 y suscripción 7 días.
- Front: `AppSelector` dispatcha por rol Identity; `RequireAuth` con `requiredRole`; `coachAuthService.hasRole`.

El flujo de membresía hoy no funciona fino: registro fuerza `Federation`, no hay validación de código de equipo, no se puede invitar/desvincular miembros, y "un solo espacio activo" no se valida.

## Goals / Non-Goals

**Goals:**
- Definir un contrato API único (`specs/scoped-membership-management/spec.md`) para alta pagador/invitado, validación de códigos club+equipo, gestión de miembros del scope, y abandono de espacio.
- El pagador (`IsCreator` + `Subscription.Active`) es el admin de su scope y solo ve/modifica su scope.
- Invitados: un solo espacio activo, con mecanismo de abandono.
- Front implementable primero contra mocks del contrato.

**Non-Goals:**
- Fusión de clubs con nombres parecidos (futuro).
- Transfer de ownership de un scope a otro usuario (futuro).
- Billing/webhooks de pago real (la suscripción se asume activa/vencida por `Subscription.Status`).
- Catálogo de permisos finos por plan/tipo (qué funcionalidades puede usar cada rol — spec separada).
- CRUD de clubs/equipos (ya existe; aquí solo gestionamos miembros y códigos).
- Refactor de `AppRoles` vs `UserRoles` vs `Membership` (se trabaja con lo que hay).

## Decisions

### 1. Dos fuentes de roles: Identity (`AppRoles`) para navegación, `Membership` para scoped
`Membership` (Directive/Coach/ClubMember/Player/FamilyPlayer/Follower) modela la relación usuario↔club. Los roles Identity (`Coach`/`Directive`) se usan para `RequireAuth`/`hasRole` en el front (navegación por app). Al validar un código, se asigna **ambos**: el `Membership` en `UserClub`/vínculo de equipo y el rol Identity correspondiente para que el JWT refleje el `membershipKind`. **Por qué:** reutiliza el mecanismo que el front ya usa (`hasRole("Player")`, etc. en `AppSelector`). **Alternativa:** solo `Membership` y leerla por API en cada navegación — descartada por latencia y por romper `RequireAuth`.

### 2. `UserClub.UpdateRoleId` admite toda `Membership`
**BREAKING** del dominio: quitar la restricción `Coach|Directive` para que jugador/padre/seguidor/miembro puedan vincularse vía código. **Por qué:** hoy no hay forma de que esos roles existan en `UserClub`. **Alternativa:** tabla nueva `UserClubMember` para no-creators — descartada por duplicar modelo; `UserClub` ya es el vínculo usuario↔club.

### 3. Vínculo de equipo: reusar `TeamPlayer` o `UserClub`?
Jugadores/padres/seguidores de un equipo se vinculan con el código de equipo. Decisión: crear un vínculo equivalente a `UserClub` pero a nivel equipo. Revisar si `TeamPlayer` cubre el caso (jugador sí) o hace falta `UserTeam` (para padre/seguidor que no son jugadores). **Tentativo:** extender `TeamPlayer` con `Membership` para jugador, y crear `UserTeam` para padre/seguidor. **Open question** (ver abajo) — se resuelve en implementación del back revisando `TeamPlayer`.

### 4. "Un solo espacio activo" se valida en alta por código
Al validar un código (club o equipo), se consulta si el usuario tiene algún `UserClub`/vínculo de equipo vigente. Si sí, `409` con `activeScope`. El abandono es explícito vía `POST /api/scopes/members/leave`. **Por qué:** decisión de producto del usuario. **Alternativa:** auto-abandono silencioso — descartada por sorpresa al usuario.

### 5. Scope del entrenador: equipos de sus clubs
Un `Coach` pagador puede tener varios clubs (`PaymentPlan.AllowedClubs`) con varios equipos cada uno. "Su scope" al listar/desvincular miembros es **un equipo concreto** (`?teamId=`), validando que el equipo pertenezca a un club donde el usuario es `IsCreator=true`. El directivo gestiona a nivel **club** (`?clubId=`). **Por qué:** refleja el alcance funcional acordado (entrenador→equipos, directivo→club).

### 6. Autorización por `IsCreator` + `Subscription.Active`
Cada endpoint de gestión valida: el usuario autenticado es `IsCreator` del scope consultado Y tiene `Subscription.Status=Active`. Si no es creador → `403`; si no hay suscripción activa → `402`. **Por qué:** el "admin" es el pagador, no un rol global. **Alternativa:** policy de Identity por rol `Administrator` — descartada porque no refleja el scope (un `Administrator` global podría tocar cualquier club).

### 7. Refactor de `ValidateInvitationCode` → dos endpoints
El endpoint actual `POST /api/invitation/validate` se refactoriza a `POST /api/invitations/club/validate` (mismo handler, nueva ruta) y se añade `POST /api/invitations/team/validate` (nuevo). **Por qué:** separar club vs. equipo es más claro y permite `membershipKind` distintos por código.

### 8. Front mockeado primero
`scopesApi`/`invitationsApi` con flag `VITE_USE_MOCK` sirviendo fixtures (`ScopeMember[]`, `ActiveScope`, etc.) con los mismos tipos del contrato. **Por qué:** desacopla front y back.

## Risks / Trade-offs

- [`UserClub.UpdateRoleId` BREAKING] → código existente que asumía solo `Coach`/`Directive` puede romper; mitigación: auditar usos de `UpdateRoleId` (pocos, en commands de creación); el cambio es aditivo (permite más valores, no menos).
- [Vínculo de equipo no modelado] → si `TeamPlayer` no cubre padre/seguidor, hace falta `UserTeam` (nueva entidad/migración); riesgo de scope creep. Mitigación: revisar `TeamPlayer` primero en la tarea 4.1; si no sirve, migración mínima.
- ["Un solo espacio activo" impide jugadores con dos equipos] → decisión de producto del usuario; trade-off aceptado. Futuro: permitir multi-espacio si cambia el requisito.
- [Dos fuentes de roles sincronizadas] → `Membership` + rol Identity pueden desincronizarse; mitigación: asignar ambos atómicamente en el handler y generar JWT nuevo en la respuesta.
- [Pagador sin suscripción pero con datos] → al caducar la suscripción, se desvinculan automáticamente todos los invitados (`IsCreator=false`) del scope; el pagador conserva su vínculo pero recibe `402` al gestionar. Mitigación: la desvinculación ocurre lazily en los endpoints de gestión (antes del `402`) y proactivamente en un job/consulta de revisión de suscripciones.

## Migration Plan

1. **Back**: refactor `UpdateRoleId` + `ValidateInvitationCode` → `club/validate`; añadir `team/validate`; nueva feature `Scopes`. Deploy trasero (endpoints nuevos y refactor de ruta; el `/register` se ajusta para no forzar `Federation`).
2. **Front**: ajustar `AppSelector`/registro (pagador vs. invitado) y nueva página `/scope/members`. Deploy frontal.
3. **Sincronización**: pagadores existentes (con `IsCreator=true`) siguen funcionando; invitados existentes con `UserClub` de `Coach`/`Directive` se mantienen; nuevos invitados entran con `membershipKind` correcto.
4. **Rollback**: revertir front (página/rutas nuevas) y/o back (feature nueva + refactor de `UpdateRoleId`). El refactor de `UpdateRoleId` es el único que toca dominio; revertir restaura la restricción. Sin migraciones de esquema obligatorias (salvo que el vínculo de equipo requiera `UserTeam`).

## Open Questions

- ¿`TeamPlayer` soporta `FamilyPlayer`/`Follower`, o hace falta `UserTeam`? Resolver en tarea 4.1 revisando `TeamPlayer`.
- ¿`POST /api/scopes/members/leave` debe devolver JWT actualizado (sin el rol del scope abandonado)? Tentativo: sí.
- ¿`registerPayingAccount` es un nuevo endpoint o se extiende `/register` con `accountType`? Tentativo: extender `/register` con campo `accountType: "Coach"|"Directive"`.

## Open Questions — resolved

### 4.1 — `TeamPlayer` vs. `UserTeam`
**Decisión:** crear la nueva entidad `UserTeam`. `TeamPlayer` vincula un `Player` del catálogo (no un `IdentityUser`) con un equipo, con dorsal, demarcation, contacto, family members, lesiones, etc. No tiene `ApplicationUserId` ni `Membership`: es un vínculo deportivo, no de membresía de cuenta. Para que un usuario autenticado entre a un equipo por `JoinCode` como `Player`/`FamilyPlayer`/`Follower` (con impacto en su JWT e "un solo espacio activo") se necesita una entidad de membresía paralela a `UserClub` pero a nivel equipo.

**Implementación:**
- `Domain/Aggregates/UserClubs/UserTeam.cs` (aggregate root): `ApplicationUserId`, `TeamId`, `RoleId` (`Membership`), `IsCreator`, `JoinedAt`; métodos `UpdateRoleId` / `UpdateApplicationUserId` / `UpdateTeamId` / `MarkAsCreator` / `MarkAsJoined` con invariantes análogos a `UserClub`.
- `Infrastructure/Persistence/Configuration/Aggregates/UserClubs/UserTeamEntityConfiguration.cs` (tabla `app."UserTeams"`, FK a `Teams` con `CASCADE` y FK a `Memberships`, índices por `ApplicationUserId+TeamId` y `ApplicationUserId`).
- `DbSet<UserTeam> UserTeams` añadido a `AppDbContext`.
- Migración `20260709120000_AddUserTeam` (SQL `CREATE TABLE IF NOT EXISTS app."UserTeams" ...`).
- `Membership.GetAll()` reutilizado para mapear `membershipKind` string ↔ `Membership`.

### 4.1-complemento — Rol Identity de `leave`
`leave` regenera el JWT del usuario (sin el rol del scope abandonado, ya que el rol Identity se sigue conservando salvo que el usuario reasigne — el rol Identity NO se elimina en v1; solo se quita el vínculo `UserClub`/`UserTeam` y se reemite el JWT con los roles restantes). Tentativa confirmada en v1.

### 4.1-complemento — `registerPayingAccount`
`/register` extendido con campo `AccountType`. Si no se indica o no es `"Coach"`/`"Directive"` (o alias `"ClubDirector"`) → `400`. Se asigna el rol Identity correspondiente y se crea `Subscription` (plan `Free` trial 7 días). Respuesta `{ userId, roles, subscription: { plan, status, endDate } }`.
