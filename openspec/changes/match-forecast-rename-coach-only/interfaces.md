## Step 1: Backend rename to `MatchForecast`, Coach-only `POST .../requests` and API version bump

**Interfaces**:
- Endpoint `POST api/teams/{teamId}/match-forecast/requests` (type `RequestRivalStats`): the lambda checks the caller's roles against `AppRoles.Coach.Name` (exact, case-insensitive) before `mediator.Send`; on failure it returns `Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Solo un entrenador puede generar o actualizar el pronóstico de partidos", extensions: { ["code"] = ErrorCodes.MatchForecastRequestForbidden })`. The lambda parameters, `RequestRivalStatsBody`, `RequestRivalStatsCommand` and `Handler` do not change.
- New constant `ErrorCodes.MatchForecastRequestForbidden` (string), declared beside `ErrorCodes.TeamPlayerEditForbidden` and following its naming and value style.
- Test class `RequestRivalStatsAuthorizationTests` (`[Collection(PostgresCollection.Name)]`, nested `TestAuthHandler` reading the `X-Test-Role` header into `ClaimTypes.Role`, a recording `IMediator` substitute that counts `Send` calls).
- Namespace `RFFM.Api.Features.Coaches.MatchForecast` (and `RFFM.Api.Features.Coaches.MatchForecast.Services`) replaces `RFFM.Api.Features.Coaches.RivalStats` for the ten moved files; every public type keeps its name (`RequestRivalStats`, `GetRivalStats`, `GetRivalTeamStats`, `GetRivalSimulation`, `GetRivalSimulationHistory`, `SyncRivalSimulationRounds`, `RivalStatsLeague`, `RivalStatsConstants`, `RivalRoundSimulationService`, `RivalSimulationInputLoader`).
- Route literals (every `IFeatureModule.AddRoutes` keeps method, subroute and `.RequireAuthorization()`):
  - `GET api/teams/{teamId}/match-forecast`
  - `GET api/teams/{teamId}/match-forecast/teams/{teamCode}`
  - `POST api/teams/{teamId}/match-forecast/requests`
  - `GET api/teams/{teamId}/match-forecast/simulation`
  - `GET api/teams/{teamId}/match-forecast/simulation/rounds`
  - `PUT api/teams/{teamId}/match-forecast/simulation/rounds`
- `IWebPushNotificationDispatcher.DispatchRivalStatsFinishedAsync` and `RivalStatsRecipient` keep their signatures; only the text it builds changes.
- `Directory.Build.props` `<Version>` `1.52.0`.
- Web service `rivalStatsService` (module renamed in Step 3): every request URL base is `/api/teams/${teamId}/match-forecast` from this step on.
- Test class `MatchForecastRoutesTests` (xUnit, `[Collection(PostgresCollection.Name)]`, same `TestServer` plus nested `TestAuthHandler` pattern as `TeamNotesEndpointAuthorizationTests`).

**Test assertions**:
- A team member calls `GET /api/teams/{teamId}/match-forecast` → the request is routed to `GetRivalStats` (status is not 404) and the body shape is the one `GetRivalStats` returned under the old route. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Ruta nueva disponible».
- A client calls `GET /api/teams/{teamId}/rival-stats` → status 404, no `Location` header, no redirect. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Ruta antigua inexistente».
- `PUT` and `GET /api/teams/{teamId}/match-forecast/simulation/rounds` are routed (not 404) and the same paths under `rival-stats` answer 404. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/rival-simulation-history/spec.md` requirements «Round synchronization endpoint» and «Simulation history with real results».
- `GET /api/teams/{teamId}/match-forecast/simulation` is routed (not 404). Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/rival-match-simulation/spec.md` requirement «Rival simulation endpoint».
- `getRivalStats('t1')` requests `/api/teams/t1/match-forecast`; `requestRivalStats('t1')` posts to `/api/teams/t1/match-forecast/requests`; simulation, rounds sync and history use `/api/teams/t1/match-forecast/simulation` and `/simulation/rounds` (PUT and GET). Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/rival-simulation-history/spec.md` requirements «Round synchronization endpoint» and «Simulation history with real results».
- `WebPushNotificationDispatcher.DispatchRivalStatsFinishedAsync` for a successful generation → notification title `Pronóstico de partidos listo` and link `/coach/match-forecast?teamId=<teamId>`. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md` scenario «Generación completada».
- Same method for a failed generation → title `No se pudo generar el pronóstico de partidos`, same link, and type key still `RivalStatsFailed` (success keeps `RivalStatsReady`). Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md` scenario «Generación fallida».
- The existing handler tests (`RivalStatsTests`, `RivalSimulationTests`, `RivalSimulationHistoryTests`, `RivalRoundSimulationServiceTests`) keep every assertion value unchanged after only their `using` changes. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «El cálculo no cambia».
- Caller with role `Player` posts to `/api/teams/{teamId}/match-forecast/requests` → status 403, `ProblemDetails` body with `status` 403, `title` equal to `Solo un entrenador puede generar o actualizar el pronóstico de partidos`, `code` extension equal to `ErrorCodes.MatchForecastRequestForbidden`, recording mediator `Send` count 0. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Usuario sin rol Coach llama directamente al endpoint».
- Caller with role `Administrator` only → status 403, `ProblemDetails`, `Send` count 0. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Administrador sin rol Coach llama al endpoint».
- Caller with role `Coach` → the recording mediator receives exactly one `RequestRivalStatsCommand` for the route `teamId`, and when the stub returns a report with status `Pending` (an in-progress status) the endpoint answers 202; a stub returning a completed report would give 200, which this test does not assert. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Entrenador llama al endpoint».
- Caller with roles `Coach` and `Administrator` → same result as `Coach` alone (`Send` count 1). Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` requirement «El endpoint de actualización exige el rol Coach».
- Anonymous caller → status 401 and `Send` count 0. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` requirement «El endpoint de actualización exige el rol Coach» (the existing access checks stay).

## Step 2: Coach-only controls on the page and «Crear pronóstico» button text

**Interfaces**:
- `computeIsCoachRole(roles: string[]): boolean` exported from the `isPlayerRole` module, beside `computeIsPlayerRole`; true only when some role equals `Coach` ignoring case.
- `useIsCoachRole(): boolean` (named and default export), computed once from `coachAuthService.getRoles()` through `computeIsCoachRole`.
- `RivalStats` page (still at its current path in this step): the four controls `Crear pronóstico`, `Actualizar`, `Generar estadísticas`, `Reintentar` render only when `useIsCoachRole()` is true; the link formerly named `Simulación` is now named `Crear pronóstico`.

**Test assertions**:
- `computeIsCoachRole(['Coach'])` → true; `['coach']` → true; `['Coach', 'Administrator']` → true; `['Administrator']` → false; `['Player']` → false; `['FamilyMember']` → false; `[]` → false. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Administrador sin rol Coach no ve los controles».
- `useIsCoachRole()` with `coachAuthService.getRoles` mocked to `['Coach']` → true; mocked to `['Player']` → false. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` requirement «Solo el rol Coach ve y usa las acciones que generan o actualizan el pronóstico».
- Page with Coach role and a completed report → buttons `Crear pronóstico` and `Actualizar` present, and no link named `Simulación`. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenarios «Entrenador ve los controles» and «Botón de la simulación».
- Page with Player (or family) role and a completed report → team list and player statistics present, buttons `Crear pronóstico` and `Actualizar` absent. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Usuario sin rol Coach no ve «Crear pronóstico» ni «Actualizar»».
- Page with only the `Administrator` role and a completed report → buttons `Crear pronóstico` and `Actualizar` absent. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Administrador sin rol Coach no ve los controles».
- Page with a non-Coach role and no report for the league → empty state shown, button `Generar estadísticas` absent. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Usuario sin rol Coach ante una liga sin estadísticas».
- Page with Coach role and no report → button `Generar estadísticas` present. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md` scenario «Sin estadísticas generadas».
- Page with a non-Coach role and a failed report → error message shown, button `Reintentar` absent; with Coach role the button is present. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Usuario sin rol Coach ante una generación fallida» and `openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md` scenario «La última generación falló».
- Page with Coach role whose last update is too recent → button `Actualizar` present and disabled. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md` scenario «Actualización no disponible todavía».

## Step 3: Frontend rename to `matchForecast`, redirects of the old routes and web version bump

**Interfaces**:
- `RedirectKeepingSearch(props: { to: string }): JSX.Element` — renders `<Navigate to={{ pathname: to, search: location.search }} replace />`; default export.
- Page module `MatchForecast` (default export, was `RivalStats`) at the new page folder; simulation page `RivalSimulation` (default export) unchanged in name and props.
- Hook module `useMatchForecast` (default export, was `useRivalStats`) with the same return shape.
- Service module `matchForecastService` with the same exported functions and types as the former `rivalStatsService` (`getRivalStats`, `requestRivalStats`, `getRivalTeamStats`, the simulation functions and their types); every request URL base is already `/api/teams/${teamId}/match-forecast` from Step 1.
- Route table of the Coach app: `match-forecast` and `match-forecast/simulation` wrapped in `RequireFeaturePermission` with the Convocations feature route; `rival-stats` and `rival-stats/simulation` render `<RedirectKeepingSearch to="/coach/match-forecast" />` and `<RedirectKeepingSearch to="/coach/match-forecast/simulation" />` outside the guard.
- Team menu entry: key `match-forecast`, label `Pronóstico de partidos`, target `/coach/match-forecast` with the `teamId` query; `isTeamNavRoute` recognizes `/coach/match-forecast` and `/coach/match-forecast/simulation`.
- `Front/package.json` `version` `1.117.0`.

**Test assertions**:
- `MemoryRouter` at `/coach/rival-stats?teamId=abc` with the redirect routes → location becomes `/coach/match-forecast` with search `?teamId=abc`. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Ruta antigua de la página».
- `MemoryRouter` at `/coach/rival-stats/simulation?teamId=abc` → location becomes `/coach/match-forecast/simulation` with search `?teamId=abc`. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Ruta antigua de la simulación».
- The old push link `/coach/rival-stats?teamId=abc` ends on the match forecast page of team `abc` (same redirect assertion). Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Enlace de una notificación push ya enviada».
- `teamSections` for a team with competition access → the «Competición» section contains an entry with text `Pronóstico de partidos` and target `/coach/match-forecast?teamId=team-1`, and no entry with text `Estadísticas de rivales`. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Entrada del menú del equipo».
- `isTeamNavRoute('/coach/match-forecast')` and `isTeamNavRoute('/coach/match-forecast/simulation')` are true. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «La barra de navegación del equipo se muestra en la ruta nueva».
- Page rendered with a completed report → heading `Pronóstico de partidos` present and no text `Estadísticas de rivales`. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Título de la página».
- With Coach role, the link named `Crear pronóstico` has `href` `/coach/match-forecast/simulation` with the query string kept. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md` scenario «Botón de la simulación».
- `matchForecastService` (renamed module) keeps the same exported functions and the `/api/teams/${teamId}/match-forecast` base URL set in Step 1; its moved test passes with only its import path changed. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/rival-simulation-history/spec.md` requirement «Simulation history with real results».
- Simulation page back navigation targets `/coach/match-forecast`. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/rival-match-simulation/spec.md` requirement «Simulation page».
- A user whose permissions lack the Convocations feature (and who is not `Administrator`) opening `/coach/rival-stats` is redirected away and the page content is never rendered (guard on the destination). Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/coach-dashboard-permission-ui/spec.md` scenario «Former rival-stats routes keep the permission check».
- A `Player` role user opening `/coach/match-forecast` sees the page render normally. Anchor: `openspec/changes/match-forecast-rename-coach-only/specs/coach-dashboard-permission-ui/spec.md` scenario «Player navigates directly to the match forecast routes».
