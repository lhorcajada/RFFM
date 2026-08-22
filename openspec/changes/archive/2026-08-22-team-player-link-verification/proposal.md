## Why

Hoy, al registrarse con rol `Player` o `FamilyMember`, `CreateUser.cs` (`POST /api/register`) solo exige el `TeamInvitationCode` del **equipo** (`Team.JoinCode`, un único código compartido por todos los jugadores/familias del equipo) y deja que el propio usuario elija libremente cualquier `TeamPlayerId` del roster (`TeamRosterQueries.GetRoster`). No hay nada que verifique que quien se registra como "Fernando" sea realmente Fernando o su familiar: basta con conocer el código del equipo (que por diseño circula entre muchas familias) para vincularse a cualquier jugador del roster que aún no tenga cuenta `Player` asociada. La única protección existente es la regla `AlreadyLinked` (un `TeamPlayer` no puede tener dos cuentas `Player`), que evita duplicados pero no evita la suplantación del primero en registrarse. `FamilyMember` no tiene ni siquiera esa protección, y en fútbol base implica acceso a datos de menores.

## What Changes

- **Backend**: nueva entidad `TeamPlayerLinkRequest` (mismo patrón que `ClubJoinRequest`: `ApplicationUserId`, `TeamId`, `TeamPlayerId`, `MembershipId`, `Status` Pending/Approved/Rejected/Cancelled, auditoría de decisión). `CreateUser.cs` deja de crear el `UserTeam` al instante para `Player`/`FamilyMember`: crea una `TeamPlayerLinkRequest` pendiente salvo que el usuario aporte un **código de vinculación propio del jugador** (`TeamPlayer.LinkCode`, nuevo campo opcional, generable/regenerable por el coach desde la ficha del jugador), en cuyo caso se aprueba y crea el `UserTeam` al instante. Nuevos endpoints `api/team-player-link-requests` (list/approve/reject, autorizados al coach del equipo) siguiendo el patrón de `ClubJoinRequests`. La unicidad de `Player` por `TeamPlayer` se refuerza con índice único parcial a nivel de BD para evitar condiciones de carrera entre aprobaciones concurrentes.
- **Frontend**: `Register.tsx` añade un campo opcional "código del jugador" junto al selector de roster; nueva pantalla de coach (calco de `ClubJoinRequests.tsx`) para listar y aprobar/rechazar solicitudes de vinculación por equipo, y UI en la ficha del jugador para generar/copiar su `LinkCode`.

## Non-Goals

- No se toca el rol `Fan` (seguidor): sigue sin código ni aprobación.
- No se sustituye el `TeamInvitationCode` de equipo existente; sigue siendo necesario además del `LinkCode` del jugador.
- No se añade verificación por email/SMS en esta iteración.

## Impact

- **Back**: `Features/Coaches/Users/Commands/CreateUser.cs`, `Domain/Aggregates/UserClubs/` (nueva entidad + `TeamPlayer.LinkCode`), nuevo `Features/Coaches/TeamPlayerLinkRequests/`, migración EF.
- **Front**: `shared/pages/auth/register/Register.tsx`, nueva página de solicitudes de vinculación (coach), ficha de jugador (mostrar/generar `LinkCode`).
