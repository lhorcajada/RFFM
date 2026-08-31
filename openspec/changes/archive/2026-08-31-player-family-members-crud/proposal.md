## Why

Hoy `TeamPlayer.FamilyMembers` (tabla `TeamPlayerFamilies`) solo se puede leer
(embebido en `GetTeamPlayer`/`UpdateTeamPlayer`) o reescribir **en bloque** vía
`PUT /api/catalog/teamplayer/{id}` (`SetFamily`, capado a 2 familiares en el
frontend — `FamilyMembersEdit.tsx`, `MAX_FAMILY_MEMBERS = 2`). No existe una forma
de añadir o eliminar un familiar concreto sin reenviar el array completo, y el DTO
de respuesta (`FamilyResponse`) no expone ningún identificador estable por
familiar — solo posición en el array — lo que hace imposible referenciar "este
familiar" desde el cliente para borrarlo de forma granular. El coach necesita poder
dar de alta y eliminar contactos/tutores individuales (más de 2, con relaciones más
allá de Madre/Padre) desde la ficha del jugador sin ese límite ni ese acoplamiento.

## What Changes

- **Backend**: se promueve el value object owned `Family` (colección `OwnsMany` sin
  Id real, solo shadow key) a una entidad de primer nivel `TeamPlayerFamilyMember :
  BaseEntity` con Id propio persistido, mismo patrón que `TeamPlayerSanction` /
  `TeamPlayerInjury` (DbSet dedicado + `IEntityTypeConfiguration` propio). Nuevos
  endpoints REST: `POST /api/catalog/teamplayer/{id}/family-members` (crear) y
  `DELETE /api/catalog/teamplayer/{id}/family-members/{familyMemberId}` (eliminar).
  `GetTeamPlayer`/`UpdateTeamPlayer` (`FamilyResponse`) **BREAKING**: añaden el campo
  `Id` a la respuesta (aditivo, no rompe consumidores que ya ignoran campos
  desconocidos). El catálogo de relaciones (`FamilyMember` value object: hoy solo
  Madre/Padre) se amplía con "Tutor legal" y "Otro" para cubrir contactos no
  parentales. Se elimina el límite de 2 familiares.
- **Frontend**: `FamilyMembersEdit.tsx` gana botones "Añadir" (ya existe, se adapta
  a la nueva API) y "Eliminar" por tarjeta, llamando a los nuevos endpoints en vez
  de reenviar el PUT completo; se quita `MAX_FAMILY_MEMBERS`.

## Capabilities

### New Capabilities
- `player-family-members-crud`: alta y baja individual de familiares/contactos de
  un `TeamPlayer` vía endpoints REST dedicados, con Id estable por familiar.

### Modified Capabilities
(ninguna spec existente en `openspec/specs/` cubre familiares hoy — no aplica)

## Impact

- **Back**: `Domain/Entities/TeamPlayers/TeamPlayer.cs`, nueva entidad
  `TeamPlayerFamilyMember`, `Infrastructure/Persistence/AppDbContext.cs`, nueva
  `TeamPlayerFamilyMemberEntityConfiguration.cs`, nueva migración EF, nuevos
  `CreateFamilyMember.cs`/`DeleteFamilyMember.cs` (Features/Coaches/Players/Commands),
  `Features/Coaches/Players/Queries/GetTeamPlayer.cs`,
  `Features/Coaches/Players/Commands/UpdateTeamPlayer.cs` (añadir `Id` a
  `FamilyResponse`), `Domain/ValueObjects/FamilyMember.cs` (nuevos valores),
  `Domain/ErrorCodes.cs`.
- **Front** (fuera del alcance de este agente, coordinar con front-specialist):
  `apps/coach/pages/player/components/FamilyMembersEdit.tsx`,
  `apps/coach/services/teamplayerService.ts` (nuevos métodos `createFamilyMember`/
  `deleteFamilyMember`), tipos `TeamPlayerResponse`.
