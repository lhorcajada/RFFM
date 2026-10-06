## Why

En Federación → Plantilla (`GetPlayers.tsx`) solo se ven los jugadores que devuelve la ficha del equipo
en la RFFM (scraping). Cuando el equipo que se consulta es **uno de los equipos del coach**, ese listado
no le dice lo que de verdad necesita saber: qué jugadores de su plantilla real (nuestra BD) tienen ya
ficha federativa y cuáles no. Si un jugador no aparece en la RFFM, todavía no tiene ficha.

Además, «Participaciones» (`GetParticipationSummary`) solo consulta la temporada seleccionada. Al
arrancar la temporada, la mayoría de jugadores aún no ha jugado nada, así que el resumen sale casi
vacío. Hay que incluir también la temporada anterior.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Nuevo endpoint `GET /teams/{teamCode}/coach-squad-comparison?season&competition&group`
    (autenticado):
    - busca entre los equipos del usuario (`UserTeam` con rol `Coach`) el que tenga la misma
      competición RFFM, el mismo grupo RFFM y la misma temporada;
    - si no hay ninguno, o hay más de uno, devuelve `isCoachTeam = false`;
    - si encuentra uno, cruza su plantilla activa con la de la RFFM y devuelve, por jugador: nombre,
      foto, dorsal y si tiene ficha;
    - los jugadores que están solo en la RFFM se incluyen marcados como «no está en el equipo».
  - Un `SquadPlayerMatcher` puro que cruza los jugadores por nombre normalizado y año de nacimiento.
  - `GetParticipationSummary` consulta también la temporada anterior (`SelectableSeasons`). Cada
    entrada indica a qué temporada pertenece.
  - **Versión**: API minor.
- **Frontend (`Front`)**:
  - En Plantilla, si el equipo es del coach, se sustituye el listado RFFM por tarjetas de comparación.
    Cada tarjeta muestra la foto, el dorsal, el nombre y un tag: «Con ficha», «Sin ficha» o «No está
    en el equipo».
  - El modal de Participaciones agrupa por temporada.
  - **Versión**: Web minor.

## Capabilities

### New Capabilities
- `federation-squad-coach-comparison`: comparación de la plantilla RFFM con la plantilla del coach, y
  participaciones de la temporada actual y la anterior.

## Impact

- `Back/ExtractionApi`:
  - `Features/Federation/Teams/Queries/GetCoachSquadComparison.cs`;
  - `Features/Federation/Teams/Services/SquadPlayerMatcher.cs`;
  - `GetParticipationSummary.cs`;
  - tests.
- `Front`:
  - `federation/services/api.ts`;
  - `pages/Squad/` (hook, componente de tarjeta, `GetPlayers.tsx`, `ParticipationModal.tsx`);
  - `types/participation.ts`;
  - tests.
- **Fuera de alcance**:
  - guardar el código de equipo RFFM en `Team` (se descartó: el cruce es por competición, grupo y
    temporada);
  - cambiar el endpoint `GET /teams/{teamId}` ni su caché;
  - Mobile;
  - la exportación PDF/Excel, que sigue usando el listado RFFM.
