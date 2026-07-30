## Why

El código de invitación de un club (`Club.InvitationCode`) se usa para que un directivo (`ClubDirector`) invite a otros usuarios a unirse al club. Hoy `GetClub.cs` (`GET /api/catalog/club/{id}`) y `GetClubs.cs` (`GET /api/catalog/clubs`) devuelven `invitationCode` **sin ninguna restricción de rol**, y el frontend (`ClubSelector.tsx`, dentro de Ajustes → "Mis clubes") lo muestra a cualquier usuario autenticado que tenga acceso a esa pantalla, incluidos entrenadores (`Coach`) y otros roles sin responsabilidad de gestión del club. Solo `Administrator` y `ClubDirector` deberían poder ver ese código; el resto de roles debe recibirlo como `null`.

Nota: el código de invitación de **equipo** (`Team.JoinCode`, visible hoy en `ClubTeams.tsx`) no se ve afectado por este cambio — ya se genera automáticamente al crear el equipo y ya está pensado para que el entrenador lo comparta.

## What Changes

- **Backend**: `GetClub.cs` y `GetClubs.cs` calculan, por request, si el usuario autenticado es `Administrator` (rol global de Identity) o `ClubDirector` del club concreto (vía `UserClubs` + `Membership` con clave `"Directive"`, igual que en `GetUserClub.cs`). Si no lo es, `invitationCode` se devuelve como `null`. Ambos endpoints están cacheados (`ICacheRequest`) con una clave que hoy no distingue por usuario/rol — se ajusta `CacheKey` para incluir esa dimensión (p.ej. sufijo `:priv`/`:pub`) y evitar que la respuesta con código visible de un directivo quede cacheada y se sirva a un no-directivo (o viceversa). El prefijo de invalidación (`ClubConstants.CachePrefix`) no cambia, así que `CreateClub`/`UpdateClub`/`DeleteClub` siguen invalidando ambas variantes correctamente.
- **Frontend**: `ClubSelector.tsx` oculta por completo la columna/campo "Código de invitación" (tabla y tarjeta compacta) cuando `club.invitationCode` es `null`, en lugar de mostrar `"-"`.

## Non-Goals

- No se toca `Team.JoinCode` ni `ClubTeams.tsx`.
- No se introduce el mecanismo `FeaturePermission`/`IRequireFeaturePermission` (es para proteger comandos de escritura con 403; aquí se trata de un campo condicional dentro de una respuesta 200 de lectura).
- No se restringe la navegación a la pantalla de Ajustes en sí, solo el dato del código.

## Impact

- **Back**: `Features/Coaches/Clubs/Queries/GetClub.cs`, `Features/Coaches/Clubs/Queries/GetClubs.cs`.
- **Front**: `apps/coach/pages/settings/components/ClubSelector/ClubSelector.tsx`.
