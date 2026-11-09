## Planning Status

Planificado a partir de `proposal.md`, `specs/league-scorers/spec.md`, `specs/coach-league-scorers-page/spec.md` y `design.md`. Nada implementado ni verificado todavía. TDD: cada paso escribe primero los tests (RED).

## Step 1: Confirmar la forma real de los goles en las actas

- [x] 1.1 (sin acta real en el repo: `100` normal, `101` penalti — supuesto —, `102` propia, ya usado en `GetGoalSectors`) Inspeccionar un acta cerrada guardada (o el JSON de ejemplo de los tests) y fijar el valor de `tipo_gol` de penalti y propia, formatos de `minuto` y casos de `codjugador` vacío.
- [x] 1.2 Confirmar que `RffmCompetitionGroup.GroupCode` coincide con `Team.RffmGroupId.ToString()`.

## Step 2: Lógica pura `LeagueScorersBuilder` (backend)

- [x] 2.1 Tests (RED): orden por minuto con `90+2'` y vacíos al final; tipo de gol; propia fuera del ranking; agrupación por código y por nombre+equipo; acumulado hasta la ronda; top 20 y desempate por nombre. (specs: Goals of a round, Accumulated scorers ranking)
- [x] 2.2 Implementar `LeagueScorersBuilder` y DTOs mínimos (GREEN) y refactorizar.

## Step 3: Endpoint `GET /api/teams/{teamId}/league-scorers` (backend)

- [x] 3.1 Tests (RED) del handler con BD real: ronda por defecto, partido cerrado sin acta → pendiente, partido sin jugar sin flag, grupo sin rondas → vacío, equipo sin liga → `ProblemDetails`, no miembro → 403, sin llamadas a la RFFM. (specs: Scorers come only from stored actas, Closed matches without stored acta, Scope is the league)
- [x] 3.2 Implementar `GetLeagueScorers.cs` (endpoint + query + handler + DTOs) con `IRequireTeamMembership` e `IRequireFeaturePermission`, `AsNoTracking` y carga acotada de actas; añadir código de error si hace falta.
- [x] 3.3 Ejecutar los tests del área (`dotnet test --filter`) y comprobar `dotnet build`.

## Step 4: Servicio y hook (frontend)

- [x] 4.1 Tests (RED) de `useLeagueScorers`: carga, cambio de ronda, error y reintento, equipo sin liga.
- [x] 4.2 Implementar `scorersService.ts` (tipos `type`, Axios único) y `useLeagueScorers`.

## Step 5: Página y componentes (frontend)

- [x] 5.1 Tests (RED) con Testing Library: selector de ronda con estado pressed; tarjeta de partido con goles, tags «Penalti» / «En propia» y «Mi equipo»; «Acta pendiente»; «Sin goles»; ranking con líder resaltado y nota de acumulado; loading, error con «Reintentar», vacío y sin liga. (specs: coach-league-scorers-page)
- [x] 5.2 Implementar `Scorers.tsx`, `RoundSelector`, `MatchGoalsCard`, `ScorersRanking` con CSS Modules, sin tablas, siguiendo `.design/goleadores/`.
- [x] 5.3 Añadir la ruta lazy `scorers` en `routes.tsx` con `RequireFeaturePermission` y la entrada «Goleadores» en el menú de equipo (con su test).

## Step 6: Cierre

- [x] 6.1 Revisión visual en 390 px y escritorio contra el diseño.
- [x] 6.2 Suite completa (`dotnet test`, `npx vitest run`) y builds (`dotnet build`, `npm run build`) una sola vez.
- [x] 6.3 Subir versión minor en `Back/ExtractionApi/Directory.Build.props` y `Front/package.json`.

## Step 7: Descarga explícita de actas pendientes

- [x] 7.1 Tests (RED) del comando `RefreshLeagueActas`: solo cerradas sin acta de la jornada, fallos individuales, nada pendiente sin llamadas, equipo sin liga. (spec: Missing actas can be downloaded on demand)
- [x] 7.2 Implementar `RefreshLeagueActas.cs` (endpoint POST + comando + validador + handler) reutilizando `IActaService`.
- [x] 7.3 Tests (RED) y UI del botón «Actualizar actas»: visible solo con pendientes, recarga y avisos de éxito, aviso parcial y error. (spec: Download missing actas of the round)

## Step 8: Total de goles de la temporada en cada gol

- [x] 8.1 Tests (RED) del builder: total por gol hasta la jornada, mismo total para dos goles del mismo partido, jugadores fuera del top 20, propia sin total. (spec: Season total on each goal)
- [x] 8.2 Implementar los totales por jugador en `LeagueScorersBuilder` y `SeasonGoals` en `LeagueGoal`.
- [x] 8.3 Tests (RED) y UI: «(N)» tras el nombre del goleador en `MatchGoalsCard`, sin número en las propias.
