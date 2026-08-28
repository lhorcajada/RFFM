## Why

Hoy, registrarse como `Player` o `FamilyMember` (`POST api/register`, `CreateUser.cs`) exige tres campos encadenados: el `TeamInvitationCode` del equipo, elegir manualmente el `TeamPlayerId` del roster completo (`TeamPlayerPicker`), y opcionalmente un `PlayerLinkCode` individual — si no se aporta este último, la solicitud queda pendiente de aprobación manual del entrenador (`TeamPlayerLinkRequest`, ver `archive/2026-08-22-team-player-link-verification`). Es un formulario largo y confuso para una familia que solo tiene un código que le ha dado el club: tiene que además elegir a su hijo/a en una lista del equipo entero. El código individual del jugador (`TeamPlayer.LinkCode`) ya identifica de forma unívoca al jugador y al equipo — el código de equipo y el selector de roster son redundantes una vez que ese código es obligatorio.

## What Changes

- **Backend**: para `Player`/`FamilyMember`, `CreateUser.cs` deja de pedir `TeamInvitationCode`/`TeamPlayerId` y hace **obligatorio** `PlayerLinkCode`. El `TeamPlayer` se resuelve directamente buscando por `LinkCode` (ya no hace falta pasar por equipo + roster). La regla de unicidad "un único `Player` por `TeamPlayer`" (índice único de BD sobre `UserTeams.LinkedTeamPlayerId`) no cambia; `FamilyMember` sigue sin límite. Se elimina el flujo `TeamPlayerLinkRequest` de la ruta de registro (código obligatorio ⇒ ya no hay rama "pendiente de aprobación por falta de código"): se retiran los endpoints `api/teams/{teamId}/player-link-requests` (listar/aprobar/rechazar) y el enum `RegistrationStatus.PendingPlayerLinkApproval`. Nuevo efecto secundario: si el rol es `Player`, se actualiza `TeamPlayer.ContactInfo.Email` con el email de registro; si es `FamilyMember` y ese email no existe ya en `TeamPlayer.FamilyMembers`, se añade una nueva entrada `Family` con ese email (si ya existe, solo se crea el vínculo de usuario, sin duplicar).
- **Frontend**: `Register.tsx` sustituye, para estos dos roles, el bloque código-de-equipo + `TeamPlayerPicker` + código-opcional por un único campo obligatorio "Código del jugador". Error de código inexistente se muestra bajo el campo y permite reintentar hasta 3 veces (al 4º intento fallido se bloquea el reintento con un mensaje de contacto); error de jugador ya vinculado (rol Player) se muestra como error de formulario. El aviso de "pendiente de aprobación" tras enviar sigue siendo el mensaje genérico de activación de cuenta ya existente (`SendConfirmationEmailAsync`), sin relación con este cambio.

## Non-Goals

- No se elimina la entidad/tabla `TeamPlayerLinkRequest` de la base de datos (queda sin uso, sin migración destructiva) — solo se retiran los endpoints y la UI de aprobación que dependían del código opcional.
- No cambia el flujo de registro de `ClubDirector`, `Coach`, `ClubMember` ni `Fan`.
- No cambia el flujo de `Team.JoinCode`/`ClubInvitationCode` (siguen existiendo para otros roles).
- No se añade validación de intentos a nivel de backend/rate-limiting; el límite de 3 intentos es solo UX en el formulario.
- No se toca `RegenerateTeamPlayerLinkCode`/`GetTeamPlayerLinkCode` (el coach sigue generando/consultando el código desde la ficha del jugador).

## Impact

- **Back**: `Features/Coaches/Users/Commands/CreateUser.cs`, `Domain/Entities/TeamPlayers/TeamPlayer.cs` (nuevos métodos de intención), `Domain/ErrorCodes.cs`; se retiran `Features/Coaches/TeamPlayerLinkRequests/*` (Queries/Commands) y sus rutas.
- **Front**: `shared/pages/auth/register/Register.tsx` y componentes asociados (`TeamPlayerPicker` deja de usarse en este flujo), `shared/types/scope.ts`, `apps/coach/services/authService.ts`; se retira la página `shared/pages/TeamPlayerLinkRequests/*` y su entrada de ruta/menú.
