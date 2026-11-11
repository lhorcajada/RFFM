## Planning Status

Planificado a partir de `proposal.md`, `specs/deconvoke-proposal-positions/spec.md` y `design.md`. Ninguna tarea está implementada ni verificada.

## Step 1: Backend expone `leagueGoals` (requisito "Season stats expose league goals")

- [x] 1.1 RED: tests xUnit del `Calculator` de `GetSeasonPlayerStats` — gol en liga + gol en amistoso (`LeagueGoals` 2, `TotalGoals` 5), solo amistosos (`LeagueGoals` 0), torneo excluido de liga.
- [x] 1.2 GREEN: añadir `LeagueGoals` a `PlayerSeasonStatsDto`; extraer la agregación a un `Calculator` puro; filtrar ids de evento con `SportEventsConstants.MatchEventTypeId` en el handler.
- [x] 1.3 Ejecutar solo los tests del handler (`dotnet test --filter`) y `dotnet build`.

## Step 2: Front puntúa con goles de liga (requisito "Proposal goals use league goals only")

- [x] 2.1 RED: tests Vitest de `goalsRule` — usa `leagueGoals` (valor 2 → impacto 4), ignora `totalGoals`, ausente = 0, etiqueta "Goles (liga)".
- [x] 2.2 GREEN: añadir `leagueGoals` a `SeasonPlayerStats` (`liveMatch.types.ts`); `goalsRule.ts` lee `leagueGoals` y cambia la etiqueta.
- [x] 2.3 RED: tests de `useConvocationMatchContext` — goleadores RFFM escriben `leagueGoals` y no tocan `totalGoals`; jugador no casado conserva el `leagueGoals` del backend; sin estadísticas del backend, `leagueGoals` toma el valor RFFM o 0.
- [x] 2.4 GREEN: ajustar la fusión en `useConvocationMatchContext.ts` para escribir `leagueGoals`.
- [x] 2.5 Actualizar los tests existentes de la propuesta que construyan `SeasonPlayerStats` o asuman la etiqueta anterior; ejecutar solo `convocations/utils` y `convocations/hooks`.

## Step 3: Cierre

- [x] 3.1 Subir versión patch (`fix`): `Front/package.json` y `Back/ExtractionApi/Directory.Build.props`.
- [x] 3.2 Ejecutar una sola vez la suite completa de Front y de Back, y `npm run build` / `dotnet build`.
- [x] 3.3 `openspec validate deconvoke-proposal-league-goals --strict`.
