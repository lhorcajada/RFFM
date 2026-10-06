## Context

- **Plantilla RFFM**:
  - `GetPlayers.tsx` → `usePlayers` → `GET /teams/{teamId}?season` (`FederationGetTeam`, con 5 min de
    caché en `IMemoryCache`);
  - por debajo, `ITeamService.GetStaticsTeamPlayers(AgesQueryApp(teamCode, season))`, que devuelve
    `(TeamPlayerRffm teamPlayer, Player? playerDetails)[]`;
  - `Player` (RFFM) trae `PlayerId`, `Name`, `BirthYear`, `JerseyNumber` y `PhotoUrl`;
  - el endpoint no sabe quién hace la petición.
- **Equipos del coach (`AppDbContext`)**:
  - `UserTeam`: `ApplicationUserId`, `TeamId`, `RoleId`;
  - `Membership.Coach.Id == 2`;
  - `Team`: `RffmCompetitionId`, `RffmGroupId`, `SeasonId` → `Season` (`Name`, `StartDate`,
    `EndDate`). La temporada es la del club, no el id de temporada RFFM;
  - `Team` **no** guarda el código de equipo RFFM.
- **Jugadores en BD**:
  - `TeamPlayer`: `Dorsal?.Number`, `LeftDate` y `Player`;
  - `Player`: `Name`, `LastName`, `UrlPhoto` y `BirthDate`;
  - no hay código RFFM.
- **Temporadas RFFM**:
  - `RffmOptions.SelectableSeasons` con `(Id, Label)`, por ejemplo `(22, "2026-2027")`;
  - la temporada anterior se calcula como en `RequestSquadHistory.PreviousSeasonId`: la de mayor id
    menor que la actual.
- **Participaciones**: `GetParticipationSummary` llama a `playerService.GetPlayerAsync(id, season)` por
  cada jugador y agrupa `Competitions` por competición/grupo/equipo, excluyendo el propio equipo.

## Decisions

### D1 · Nuevo endpoint en vez de tocar `GET /teams/{teamId}`

`GET /teams/{teamCode}/coach-squad-comparison?season=22&competition=…&group=…`:

- vive en `Features/Federation/Teams/Queries/GetCoachSquadComparison.cs`, con `RequireAuthorization()`;
- toma el `userId` de `ClaimTypes.NameIdentifier`;
- es `IRequest<T>`, no `IQueryApp`: la respuesta depende del usuario y de su BD, así que no debe pasar
  por el `CachingBehavior` de 1 h;
- la caché de `FederationGetTeam` y su contrato no cambian;
- el front lo llama en paralelo al de siempre.

```csharp
public record QueryApp(string UserId, string TeamCode, int SeasonId, int CompetitionId, int GroupId)
    : IRequest<CoachSquadComparisonResponse>;

public record CoachSquadComparisonResponse(bool IsCoachTeam, string? TeamId, string? TeamName,
    IReadOnlyList<ComparedPlayer> Players);

public record ComparedPlayer(string Name, string? PhotoUrl, string? JerseyNumber,
    string? RffmPlayerId, string? TeamPlayerId, ComparedPlayerStatus Status);

public enum ComparedPlayerStatus { Licensed, Unlicensed, NotInTeam } // JSON como string
```

### D2 · Resolución del equipo del coach (competición + grupo + temporada)

1. Se busca la etiqueta de `season` en `SelectableSeasons` y se toma su primer año
   (`"2026-2027"` → `2026`). Si la temporada no está en la lista, se responde `IsCoachTeam = false`.
1b. El `teamCode` RFFM pedido tiene que estar en alguna `FederationSetting` del usuario
    (`FederationDbContext`, `TeamId == teamCode`). Si no está, se responde `IsCoachTeam = false`.
    `Team` no guarda el código RFFM, y sin esta comprobación cualquier rival del mismo grupo se
    tomaba por el equipo del coach y su plantilla se mezclaba con la nuestra (detectado al probar
    con datos reales).
2. Los equipos del usuario se calculan con el mismo criterio que `TeamEditAuthorization.CanEditAsync`:
   - equipos de un club donde el usuario es `Directive` o `Coach` (`UserClub`);
   - o equipos donde tiene `UserTeam` con rol `Coach`.

   Al probarlo con datos reales se vio que un coach de club no tiene `UserTeam`, así que filtrar
   solo por `UserTeam` no encontraba su equipo. La consulta queda así:
   ```csharp
   db.Teams.AsNoTracking()
     .Where(t => t.RffmCompetitionId == competitionId && t.RffmGroupId == groupId
              && t.Season.StartDate.Year == startYear
              && (managedClubIds.Contains(t.ClubId) || coachedTeamIds.Contains(t.Id)))
   ```
3. Si sale exactamente 1 equipo, es el del coach. Si salen 0 o más de 1, se responde
   `IsCoachTeam = false` con `Players = []`, y el front muestra el listado RFFM de siempre. El caso de
   más de un equipo (A/B en el mismo grupo) es una limitación aceptada, porque no guardamos el código
   RFFM.
4. Si el equipo no coincide, no se consulta la RFFM.

### D3 · `SquadPlayerMatcher` (servicio puro, `Features/Federation/Teams/Services/`)

```csharp
public record SquadDbPlayer(string TeamPlayerId, string FullName, int? BirthYear, string? PhotoUrl, int? Dorsal);
public record SquadRffmPlayer(string PlayerId, string Name, int? BirthYear, string? PhotoUrl, string? JerseyNumber);

public static class SquadPlayerMatcher
{
    public static IReadOnlyList<ComparedPlayer> Compare(IEnumerable<SquadDbPlayer> db, IEnumerable<SquadRffmPlayer> rffm);
    internal static string[] Tokens(string name); // sin tildes, mayúsculas, sin comas/puntos, tokens ordenados
}
```

- **Normalización**:
  - `FormD` y quitar `NonSpacingMark`;
  - `ToUpperInvariant`;
  - sustituir por espacio todo lo que no sea letra o dígito;
  - partir en tokens de 2 caracteres o más.
- **Coincidencia**:
  - el conjunto de tokens de uno contiene todos los del otro (la RFFM a veces trae dos apellidos y
    nosotros uno, o el orden «APELLIDOS, NOMBRE»);
  - y, si ambos tienen año de nacimiento, el año es el mismo.
- Cada jugador RFFM se usa como máximo una vez. Se recorre la BD en orden y, ante varios candidatos,
  gana el que comparte más tokens.
- **Resultado**:
  - jugador de BD con pareja → `Licensed`, con la foto de BD (o la de la RFFM si no hay) y el dorsal de
    BD (o el de la RFFM si no hay);
  - jugador de BD sin pareja → `Unlicensed`;
  - jugador RFFM sin pareja → `NotInTeam`, con foto y dorsal de la RFFM.
- Orden: `Licensed` y `Unlicensed` por dorsal y luego por nombre; `NotInTeam` al final, por nombre.

### D4 · Datos de entrada del cruce

- **BD**:
  - `TeamPlayers` del equipo con `LeftDate == null`, `Include(Player)`;
  - `FullName = $"{Name} {LastName}"`;
  - `BirthYear = Player.BirthYear`.
- **RFFM**:
  - `teamService.GetStaticsTeamPlayers(new AgesQueryApp(teamCode, season))`;
  - se usa `playerDetails` si existe y, si no, `teamPlayer` (nombre y código, sin año);
  - si la RFFM falla, se propaga el error: el front ya trata el error de la plantilla.

### D5 · Participaciones con la temporada anterior

- En `GetParticipationSummary.Handler`:
  - `seasons = [request.SeasonId, PreviousSeasonId(request.SeasonId)]`, sin nulos, inyectando
    `IOptions<RffmOptions>`;
  - para cada jugador y cada temporada, `GetPlayerAsync(playerId, season)` en paralelo, con el mismo
    `try/catch` por jugador.
- `ParticipationCount` gana `SeasonId` (int) y `SeasonName` (la etiqueta).
- La clave de agrupación incluye la temporada.
- La exclusión del propio equipo (`selectedTeamCode`) se aplica en ambas temporadas.
- **Orden**: temporada descendente, luego competición y equipo.
- El cálculo de la temporada anterior se extrae a `RffmSeasons.Previous(options, seasonId)`
  (`Features/Federation/Seasons/Services/RffmSeasons.cs`), y `RequestSquadHistory` pasa a usarlo para
  no duplicar código.

### D6 · Frontend

- **`services/squadComparisonService.ts`** (mismo patrón que `squadHistoryService.ts`):
  `getCoachSquadComparison(teamCode, season, competition, group)` con el cliente único, y los tipos
  `CoachSquadComparison` y `ComparedPlayer` co-ubicados.
- **`pages/Squad/components/SquadPlayersSection.tsx`**: decide entre las tarjetas de comparación y
  `PlayerRow`, para poder testearlo sin montar toda la página.
- **`pages/Squad/hooks/useCoachSquadComparison.ts`**:
  - se dispara solo con equipo, competición y grupo;
  - devuelve `{ comparison, loading }`;
  - si falla, devuelve `comparison = null` sin romper la página (fallback al listado RFFM).
- **`pages/Squad/components/ComparedPlayerCard.tsx` + `.module.css`**:
  - `Paper` con `Avatar` (foto o iniciales), dorsal destacado, nombre y `Chip`;
  - textos del `Chip`: «Con ficha» (success), «Sin ficha» (warning), «No está en el equipo» (default);
  - mobile-first, sin tablas ni `style={{}}`.
- **`GetPlayers.tsx`**:
  - con `comparison?.isCoachTeam`, `PlayersContainer` pinta las tarjetas de comparación con el título
    «{nombre} · Mi equipo»;
  - en otro caso, sigue con `PlayerRow`;
  - Edades, Participaciones y las exportaciones no cambian.
- **`ParticipationModal.tsx`**:
  - agrupa los elementos por `seasonName` con un subtítulo por temporada;
  - `TeamParticipationSummaryItem` gana `seasonId?` y `seasonName?`;
  - si no llega `seasonName`, se pinta como hoy.

## Risks / Trade-offs

- **Coincidencia por nombre**: puede fallar con apodos o errores tipográficos. El jugador saldría dos
  veces («Sin ficha» y «No está en el equipo»), pero el coach lo detecta a simple vista. Mitigación: el
  criterio de contención de tokens y la comprobación del año de nacimiento.
- **Coste de Participaciones**: duplica las peticiones a la RFFM (dos temporadas por jugador).
  `PlayerService` no cachea, así que el handler de participaciones guarda en `IMemoryCache` la ficha
  de cada jugador y temporada durante 10 min (`player_{id}_{season}`), con el mismo patrón que
  `FederationGetTeam`.
- **Dos equipos del coach en el mismo grupo**: no hay comparación (D2.3).

### D7 · Estadísticas por temporada (ampliación)

- **`SeasonStats`**: `record SeasonStats(int Called, int Starter, int Substitute, int Played, int Goals, int Yellow, int Red, int DoubleYellow)`.
  - Va en `SquadRffmPlayer.Stats` y en `ComparedPlayer.Stats`, que es `null` para los `Unlicensed`.
  - El handler de comparación la saca de `Player.Matches`/`Player.Cards` de la temporada pedida.
  - Recupera en la tarjeta lo que mostraba `PlayerRow`: goles y tarjetas.
- **`GET /players/{id}/season-summary?season`** (`Features/Federation/Players/Queries/GetPlayerSeasonSummary.cs`):
  - `IRequest`, con `RequireAuthorization()`;
  - temporadas `[season, RffmSeasons.Previous(season)]`;
  - ficha por `IPlayerService.GetPlayerAsync`, cacheada 10 min (`player_{id}_{season}`), con `try/catch` por temporada;
  - devuelve `PlayerSeasonSummary[]` con
    `(SeasonId, SeasonName, SeasonStats Stats, IReadOnlyList<PlayerSeasonTeam> Teams)`;
  - `PlayerSeasonTeam(CompetitionName, GroupName, TeamName, TeamPoints, TeamPosition, TeamShieldUrl)`;
  - la categoría es el `CompetitionName` de la RFFM, que no trae otra;
  - se omite la temporada sin ficha, o con ficha sin equipos y sin convocatorias.
- **Front**:
  - `services/playerSeasonSummaryService.ts`;
  - `pages/Squad/components/PlayerSeasonsDetail.tsx` (+ `.module.css`): carga al montarse, con un bloque por temporada;
    - cada bloque muestra el título «Temporada X», una fila de estadísticas (Conv., Tit., Jug., Goles y tarjetas) y una tarjeta por equipo (categoría · grupo, equipo, puntos y posición);
    - estados de carga, vacío y error;
  - `ComparedPlayerCard`: fila con goles y tarjetas si hay `stats`, y un `IconButton` para desplegar `PlayerSeasonsDetail` si hay `rffmPlayerId`;
  - `PlayerRow`: el desplegable pasa a usar `PlayerSeasonsDetail` en lugar de `getPlayer` + `PlayerStatsCard`.
