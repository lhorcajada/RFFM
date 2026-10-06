## 1. Matcher de jugadores (~1,5h)

- [x] Red: `SquadPlayerMatcherTests`:
  - mismo jugador con tildes o mayúsculas y «APELLIDOS, NOMBRE» → `Licensed`;
  - la BD con un apellido y la RFFM con dos → `Licensed`;
  - mismo nombre y distinto año → `Unlicensed` + `NotInTeam`;
  - jugador solo en BD → `Unlicensed`;
  - jugador solo en RFFM → `NotInTeam` con su foto y dorsal;
  - un jugador RFFM no se empareja dos veces;
  - foto y dorsal: los de BD, y si faltan, los de RFFM;
  - orden: por dorsal y nombre, con `NotInTeam` al final.
- [x] Green: `Features/Federation/Teams/Services/SquadPlayerMatcher.cs` (design D3).
- **Verify**: `dotnet test --filter SquadPlayerMatcherTests`.

## 2. Endpoint de comparación (~2h)

- [x] Red: `GetCoachSquadComparisonHandlerTests` (Postgres + `ITeamService` mock):
  - un equipo coincide → `IsCoachTeam` con los jugadores cruzados;
  - sin coincidencia → `false` sin llamar a la RFFM;
  - dos equipos en el mismo grupo → `false`;
  - si el usuario es `Player` en ese equipo, no cuenta;
  - Coach o Directivo del club (`UserClub`) sin `UserTeam` → `true`; `ClubMember` → `false`;
  - otra temporada → `false`;
  - temporada no configurada → `false`;
  - los jugadores con `LeftDate` no se incluyen.
- [x] Green: `Features/Federation/Teams/Queries/GetCoachSquadComparison.cs` (D1, D2, D4).
- **Verify**:
  - `dotnet test --filter GetCoachSquadComparison`;
  - `dotnet build`.

## 3. Participaciones con la temporada anterior (~1,5h)

- [x] Red: `RffmSeasonsTests`:
  - la temporada anterior es el id menor más alto;
  - la temporada más baja → `null`.
- [x] Red: `GetParticipationSummaryHandlerTests` (mocks de `ITeamService`/`IPlayerService`):
  - agrega las dos temporadas con `SeasonId`/`SeasonName`;
  - excluye el propio equipo en ambas;
  - orden por temporada descendente;
  - sin temporada anterior, solo la actual.
- [x] Green:
  - `Features/Federation/Seasons/Services/RffmSeasons.cs`;
  - `GetParticipationSummary.cs` (D5), con caché de la ficha en `IMemoryCache`;
  - `RequestSquadHistory` pasa a usar `RffmSeasons.Previous`.
- [x] Subir la versión de la API (minor) en `Directory.Build.props`.
- **Verify**:
  - `dotnet test`;
  - `dotnet build`.

## 4. Frontend (~2h)

- [x] Red: `ComparedPlayerCard.test.tsx`:
  - pinta nombre y dorsal;
  - tag «Con ficha», «Sin ficha» o «No está en el equipo» según el estado;
  - sin foto muestra las iniciales.
- [x] Red: `SquadPlayersSection.test.tsx` + `useCoachSquadComparison.test.ts`:
  - con `isCoachTeam = true` muestra las tarjetas de comparación;
  - con `false`, o si falla, muestra el listado RFFM.
- [x] Red: `ParticipationModal.test.tsx`: agrupa por temporada con su título.
- [x] Green:
  - `getCoachSquadComparison` y sus tipos en `services/squadComparisonService.ts`;
  - `components/SquadPlayersSection.tsx` (elige entre la comparación y el listado RFFM);
  - `hooks/useCoachSquadComparison.ts`;
  - `components/ComparedPlayerCard.tsx` + `.module.css`;
  - `GetPlayers.tsx`;
  - `ParticipationModal.tsx`;
  - `types/participation.ts` (D6).
- [x] Comprobación visual a 375 px y en escritorio.
- [x] Subir la versión de la web (minor) con `npm version x.y.0 --no-git-tag-version`.
- **Verify**:
  - `npm run test`;
  - `npm run build`.

## 5. Cierre

- [x] `openspec validate federation-squad-coach-comparison --strict`.
- [x] Preguntar al usuario antes de commitear (back y front en commits separados).

## 6. Estadísticas por temporada en cada jugador (~3h)

- [x] Red: `SquadPlayerMatcherTests` → los `Licensed`/`NotInTeam` llevan las estadísticas RFFM; los `Unlicensed`, `null`.
- [x] Green: `SeasonStats` en `SquadRffmPlayer`/`ComparedPlayer`; el handler de comparación la rellena con `Matches`/`Cards`.
- [x] Red: `GetPlayerSeasonSummaryHandlerTests`:
  - dos temporadas en orden descendente;
  - omite una temporada sin ficha o que falla;
  - omite una ficha vacía;
  - mapea equipos y puntos.
- [x] Green: `Features/Federation/Players/Queries/GetPlayerSeasonSummary.cs` (caché de la ficha en `IMemoryCache`).
- [x] Red: `PlayerSeasonsDetail.test.tsx`:
  - agrupa por temporada con estadísticas y equipos;
  - estado vacío;
  - estado de error.
- [x] Red: `ComparedPlayerCard.test.tsx` → muestra goles y tarjetas, y despliega el detalle; sin `rffmPlayerId` no hay botón.
- [x] Green:
  - `getPlayerSeasonSummary` en `services/playerSeasonSummaryService.ts`;
  - `components/PlayerSeasonsDetail.tsx`;
  - `ComparedPlayerCard.tsx`;
  - `PlayerRow.tsx` usa `PlayerSeasonsDetail` al desplegar.
- [x] Subir versiones (API minor ya subida en este cambio; web minor ya subida).
- **Verify**:
  - `dotnet test`;
  - `npm run test`;
  - `npm run build`.
