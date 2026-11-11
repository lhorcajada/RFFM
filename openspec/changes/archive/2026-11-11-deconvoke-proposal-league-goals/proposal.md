## Why

La regla de goles de la propuesta de desconvocados puntúa con "Goles (temporada)", que hoy suma goles de todas las participaciones terminadas, incluidos amistosos y torneos. Un jugador que marca en amistosos queda más protegido de la desconvocatoria que uno que no, aunque la propuesta debe medir solo rendimiento en liga.

## What Changes

- El backend devuelve un campo nuevo `leagueGoals` por jugador en las estadísticas de temporada: suma solo goles de participaciones de partidos de tipo liga (`SportEventsConstants.MatchEventTypeId`).
- `totalGoals` no cambia: estadísticas, fichas y demás consumidores siguen contando todos los partidos.
- El front añade `leagueGoals` al tipo `SeasonPlayerStats`.
- La sobrescritura con goleadores RFFM en `useConvocationMatchContext.ts` escribe `leagueGoals` (no `totalGoals`). Un jugador que no aparece en los goleadores RFFM conserva el `leagueGoals` del backend, sin recurrir al total con amistosos.
- `goalsRule` puntúa con `leagueGoals` y la etiqueta del factor pasa de "Goles (temporada)" a "Goles (liga)".

## Capabilities

### New Capabilities
<!-- Ninguna -->

### Modified Capabilities
- `deconvoke-proposal-positions`: se añade el requisito de que la puntuación por goles de la propuesta de desconvocados use solo goles de partidos de liga y se muestre como "Goles (liga)".

## Impact

- Back: `Features/Coaches/Players/Queries/GetSeasonPlayerStats.cs` (DTO `PlayerSeasonStatsDto` + filtro por tipo de evento) y su test unitario.
- Front: `liveMatch.types.ts`, `useConvocationMatchContext.ts`, `rules/goalsRule.ts` y los tests de la regla y del hook.
- API: campo aditivo en `GET` de estadísticas de temporada (no rompe clientes existentes).
- Versión: `fix` → patch en `Front/package.json` y `Back/ExtractionApi/Directory.Build.props`.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts
- Front/src/apps/coach/pages/convocations/utils/rules/goalsRule.ts
- Front/src/apps/coach/pages/convocations/hooks/useConvocationMatchContext.ts
- Front/src/apps/coach/pages/convocations/components/simulation/liveMatch.types.ts
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetSeasonPlayerStats.cs
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Queries/GetLeaguePlayerStats.cs (precedente: filtra por `SportEventsConstants.MatchEventTypeId`)
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Queries/SportEventsConstants.cs
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/TeamPlayers/MatchParticipation.cs
- openspec/specs/deconvoke-proposal-positions/spec.md

**External URLs**:
<!-- Ninguna -->

## Additional Notes

- Tipos de evento sembrados: 1 Partido (liga), 2 Entrenamiento, 3 Reunión, 4 Amistoso, 5 Pruebas de acceso, 6 Torneo. "Tipo liga" = `EventTypeId == 1`.
- `MatchParticipation` enlaza con el evento por `EventId` (no `SportEventId`).
- `GetTeamPlayerStatistics` y `GetPlayerSeasonCards` replican la lógica de `GetSeasonPlayerStats`; no se tocan.
