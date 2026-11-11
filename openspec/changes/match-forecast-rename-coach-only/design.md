## Target State

When the change is complete, the page that used to be «Estadísticas de rivales» is «Pronóstico de partidos» everywhere a user or client can see it. The web page lives at `/coach/match-forecast` and its simulation page at `/coach/match-forecast/simulation`; the API lives under `/api/teams/{teamId}/match-forecast/...`; the old web URLs redirect keeping the query string; the old API URLs are gone. The generate/update controls and the `POST .../requests` endpoint belong to the Coach role only. The computation, the stored data and the database schema do not change.

### Architecture Snapshot

#### External Surfaces

- Coach API, all under `/api/teams/{teamId}/match-forecast` (feature folder `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/`), same methods, access and response bodies as the former `/rival-stats` routes:
  - `GET /api/teams/{teamId}/match-forecast` (`GetRivalStats.cs`)
  - `GET /api/teams/{teamId}/match-forecast/teams/{teamCode}` (`GetRivalTeamStats.cs`)
  - `POST /api/teams/{teamId}/match-forecast/requests` (`RequestRivalStats.cs`): 202 as before for a Coach; 403 `ProblemDetails` for any caller without the `Coach` role (an `Administrator` without `Coach` included), with no report created or changed and nothing queued; 401 for anonymous callers.
  - `GET /api/teams/{teamId}/match-forecast/simulation` (`GetRivalSimulation.cs`)
  - `GET` and `PUT /api/teams/{teamId}/match-forecast/simulation/rounds` (`GetRivalSimulationHistory.cs`, `SyncRivalSimulationRounds.cs`)
  - `/api/teams/{teamId}/rival-stats/...` no longer exists: the API answers 404 and does not redirect.
- Coach web routes in `Front/src/apps/coach/routes.tsx`, lazy-loaded and each wrapped in `RequireFeaturePermission` with the Convocations feature route:
  - `/coach/match-forecast` and `/coach/match-forecast/simulation`.
  - `/coach/rival-stats` and `/coach/rival-stats/simulation` render a redirect to the new path with the same query string (`?teamId=` included). The redirect element is not wrapped itself, so the permission check runs on the destination.
- Web push and in-app notification when a requested generation ends, built in `Features/Coaches/Notifications/Services/WebPushNotificationDispatcher.cs` (`DispatchRivalStatsFinishedAsync`): title «Pronóstico de partidos listo» on success, «No se pudo generar el pronóstico de partidos» on failure, link `/coach/match-forecast?teamId=<id>`. The persisted notification type keys `RivalStatsReady` and `RivalStatsFailed` keep their values.
- Visible texts: team menu entry «Pronóstico de partidos» (section «Competición», route `/coach/match-forecast`), page title «Pronóstico de partidos», simulation button «Crear pronóstico». «Crear pronóstico», «Actualizar», «Generar estadísticas» and «Reintentar» render only for the `Coach` role.

#### Internal Public Surfaces

- `Front/src/apps/coach/hooks/isPlayerRole.ts`: new `computeIsCoachRole(roles: string[]): boolean`, true only when the list contains the `Coach` role (case-insensitive); an `Administrator` alone gives false.
- `Front/src/apps/coach/hooks/useIsCoachRole.ts`: new `useIsCoachRole(): boolean`, built on `computeIsCoachRole(coachAuthService.getRoles())`, same shape as `useIsPlayerRole`.
- `Front/src/apps/coach/components/RedirectKeepingSearch.tsx`: new `RedirectKeepingSearch({ to })`, a `<Navigate replace>` to `to` with the current `location.search`.
- `Front/src/apps/coach/services/matchForecastService.ts`: the former `rivalStatsService.ts`; same exported functions and types, base URL `/api/teams/{id}/match-forecast`.
- `Front/src/apps/coach/hooks/useMatchForecast.ts`: the former `useRivalStats.ts`; same behavior.
- `Front/src/apps/coach/pages/matchForecast/MatchForecast.tsx` (+ `MatchForecast.module.css`): the former `rivalStats/RivalStats.tsx`; reads `useIsCoachRole()` to render the four Coach-only controls. `matchForecast/simulation/RivalSimulation.tsx` and its components move with the folder; its back link points to `/coach/match-forecast`.
- Backend namespace `RFFM.Api.Features.Coaches.MatchForecast` replaces `RFFM.Api.Features.Coaches.RivalStats`; type names inside it (`RequestRivalStats`, `RivalStatsLeague`, `RivalStatsConstants`, ...) do not change.

### File Manifest

- M Back/ExtractionApi/Directory.Build.props (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LeagueScorers/GetLeagueScorers.cs (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LeagueScorers/RefreshLeagueActas.cs (Step 1)
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalSimulation.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalSimulation.cs (Step 1)
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalSimulationHistory.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalSimulationHistory.cs (Step 1)
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalStats.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalStats.cs (Step 1)
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalTeamStats.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalTeamStats.cs (Step 1)
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RequestRivalStats.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/RequestRivalStats.cs (Step 1)
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RivalSimulationContracts.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/RivalSimulationContracts.cs (Step 1)
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RivalStatsLeague.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/RivalStatsLeague.cs (Step 1)
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/Services/RivalRoundSimulationService.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/Services/RivalRoundSimulationService.cs (Step 1)
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/Services/RivalSimulationInputLoader.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/Services/RivalSimulationInputLoader.cs (Step 1)
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/SyncRivalSimulationRounds.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/SyncRivalSimulationRounds.cs (Step 1)
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notifications/Services/WebPushNotificationDispatcher.cs (Step 1)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/MatchForecastRoutesTests.cs (Step 1)
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RequestRivalStatsAuthorizationTests.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalRoundSimulationServiceTests.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationHistoryTests.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationSeeder.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationTests.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalStatsTests.cs (Step 1)
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/WebPushNotificationDispatcherTests.cs (Step 1)
- M Front/package.json (Step 3)
- A Front/src/apps/coach/components/RedirectKeepingSearch.tsx (Step 3)
- A Front/src/apps/coach/components/__tests__/RedirectKeepingSearch.test.tsx (Step 3)
- A Front/src/apps/coach/hooks/__tests__/isPlayerRole.test.ts (Step 2)
- A Front/src/apps/coach/hooks/__tests__/useIsCoachRole.test.ts (Step 2)
- R Front/src/apps/coach/hooks/__tests__/useRivalStats.test.ts -> Front/src/apps/coach/hooks/__tests__/useMatchForecast.test.ts (Step 3)
- M Front/src/apps/coach/hooks/__tests__/useRivalSimulation.test.ts (Step 3)
- M Front/src/apps/coach/hooks/isPlayerRole.ts (Step 2)
- A Front/src/apps/coach/hooks/useIsCoachRole.ts (Step 2)
- R Front/src/apps/coach/hooks/useRivalStats.ts -> Front/src/apps/coach/hooks/useMatchForecast.ts (Step 3)
- M Front/src/apps/coach/hooks/useRivalSimulation.ts (Step 3)
- M Front/src/apps/coach/navigation/__tests__/teamNavRoutes.test.ts (Step 3)
- M Front/src/apps/coach/navigation/__tests__/teamSections.test.ts (Step 3)
- M Front/src/apps/coach/navigation/teamNavRoutes.ts (Step 3)
- M Front/src/apps/coach/navigation/teamSections.ts (Step 3)
- R Front/src/apps/coach/pages/rivalStats/RivalStats.module.css -> Front/src/apps/coach/pages/matchForecast/MatchForecast.module.css (Step 3)
- R Front/src/apps/coach/pages/rivalStats/RivalStats.tsx -> Front/src/apps/coach/pages/matchForecast/MatchForecast.tsx (Step 2, Step 3)
- R Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.leagueSummary.test.tsx -> Front/src/apps/coach/pages/matchForecast/__tests__/MatchForecast.leagueSummary.test.tsx (Step 2, Step 3)
- R Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.test.tsx -> Front/src/apps/coach/pages/matchForecast/__tests__/MatchForecast.test.tsx (Step 2, Step 3)
- R Front/src/apps/coach/pages/rivalStats/components/RivalPlayerCard.module.css -> Front/src/apps/coach/pages/matchForecast/components/RivalPlayerCard.module.css (Step 3)
- R Front/src/apps/coach/pages/rivalStats/components/RivalPlayerCard.tsx -> Front/src/apps/coach/pages/matchForecast/components/RivalPlayerCard.tsx (Step 3)
- R Front/src/apps/coach/pages/rivalStats/components/RivalTeamCard.module.css -> Front/src/apps/coach/pages/matchForecast/components/RivalTeamCard.module.css (Step 3)
- R Front/src/apps/coach/pages/rivalStats/components/RivalTeamCard.tsx -> Front/src/apps/coach/pages/matchForecast/components/RivalTeamCard.tsx (Step 3)
- R Front/src/apps/coach/pages/rivalStats/simulation/RivalSimulation.module.css -> Front/src/apps/coach/pages/matchForecast/simulation/RivalSimulation.module.css (Step 3)
- R Front/src/apps/coach/pages/rivalStats/simulation/RivalSimulation.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/RivalSimulation.tsx (Step 3)
- R Front/src/apps/coach/pages/rivalStats/simulation/__tests__/RivalSimulation.test.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/__tests__/RivalSimulation.test.tsx (Step 3)
- R Front/src/apps/coach/pages/rivalStats/simulation/components/MatchPredictionCard.module.css -> Front/src/apps/coach/pages/matchForecast/simulation/components/MatchPredictionCard.module.css (Step 3)
- R Front/src/apps/coach/pages/rivalStats/simulation/components/MatchPredictionCard.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/MatchPredictionCard.tsx (Step 3)
- R Front/src/apps/coach/pages/rivalStats/simulation/components/ProjectedStandingCard.module.css -> Front/src/apps/coach/pages/matchForecast/simulation/components/ProjectedStandingCard.module.css (Step 3)
- R Front/src/apps/coach/pages/rivalStats/simulation/components/ProjectedStandingCard.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/ProjectedStandingCard.tsx (Step 3)
- R Front/src/apps/coach/pages/rivalStats/simulation/components/__tests__/MatchPredictionCard.test.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/__tests__/MatchPredictionCard.test.tsx (Step 3)
- R Front/src/apps/coach/pages/rivalStats/simulation/components/__tests__/ProjectedStandingCard.test.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/__tests__/ProjectedStandingCard.test.tsx (Step 3)
- R Front/src/apps/coach/pages/rivalStats/simulation/simulationFormat.ts -> Front/src/apps/coach/pages/matchForecast/simulation/simulationFormat.ts (Step 3)
- M Front/src/apps/coach/routes.tsx (Step 3)
- R Front/src/apps/coach/services/__tests__/rivalStatsService.simulation.test.ts -> Front/src/apps/coach/services/__tests__/matchForecastService.simulation.test.ts (Step 1, Step 3)
- R Front/src/apps/coach/services/rivalStatsService.ts -> Front/src/apps/coach/services/matchForecastService.ts (Step 1, Step 3)

## Context

The «Estadísticas de rivales» page is a forecast tool, and the actions that generate or refresh its data must be reserved for coaches. This change is the skeleton (name, routes, role control) the rest of the forecast series (issue #10) depends on. The proposal and specs are settled; this design fixes how to build them.

Verified facts that shape the design:

- Backend feature: `Features/Coaches/RivalStats/` holds `RequestRivalStats.cs` (POST `rival-stats/requests`, `.RequireAuthorization()` only, command implements `IRequireFeaturePermission` and `IRequireTeamMembership`), `GetRivalStats.cs`, `GetRivalTeamStats.cs`, `GetRivalSimulation.cs`, `GetRivalSimulationHistory.cs`, `SyncRivalSimulationRounds.cs`, `RivalStatsLeague.cs` (holds `RivalStatsConstants.Feature = "RivalStats"`), plus services and contracts. Other code importing the namespace: `DependencyInjection/ServiceCollectionExtensions.cs` (the `using` at L16 and the fully qualified `RequestRivalStats.Validator` reference at L74; L190 is a type registration that resolves through that `using`, not a namespace import), `Coaches/LeagueScorers/GetLeagueScorers.cs` (L12, L48) and `RefreshLeagueActas.cs` (L13, L64). `Federation/LeagueSquadStats/Services/LeagueSquadStatsGenerator.cs` dispatches through the dispatcher and is not in the folder.
- Role enforcement precedents: `UpdateTeamPlayer.cs` checks `AppRoles.Coach.Name` explicitly (L39) and returns `Results.Problem` 403 (L53-56); `CreateTeamNote.cs` uses `RequireAuthorization(Roles = "Coach")` (L38) and its test asserts only the status code; `SetPlayerSanction.cs` uses `Roles = "Coach,Administrator"`, which lets an administrator through. `ForbiddenAccessException` is mapped to 403 `ProblemDetails` in `ServiceCollectionExtensions.cs` (L261). `Startup.cs` (L221-228) registers `UseProblemDetails` with no custom forbidden handler, so the body of a bare attribute 403 was not verified.
- Frontend: `routes.tsx` declares `rival-stats` (L252) and `rival-stats/simulation` (L260), both wrapped in `RequireFeaturePermission` with the Convocations feature route; the only existing redirects are plain `Navigate` (L104-116) with no query-string precedent. The guard keys on the feature-route constant (`COACH_FEATURE_ROUTES`), not on URL strings. `teamSections.ts` L91 holds the menu entry, `teamNavRoutes.ts` L14 lists the team-nav path (prefix match covers sub-routes).
- Roles on the web: `coachAuthService.getRoles()` returns the raw JWT roles; `computeIsPlayerRole` is a pure helper and `useIsPlayerRole` reads once in a `useState` initializer. No Coach helper exists yet.
- `RivalStats.tsx` renders «Reintentar» (L88), «Actualizar» (L123), «Generar estadísticas» (L181) and the «Simulación» link (L204); `RivalSimulation.tsx` L286 hardcodes `/coach/rival-stats`.
- Versions: API `<Version>1.51.0</Version>` in `Back/ExtractionApi/Directory.Build.props`; the web version is 1.116.2 in `Front/package.json` (`Front/package-lock.json` exists on disk but is not tracked by git).
- Tests that name the old page, texts or routes: backend `RivalStatsTests`, `RivalSimulationTests`, `RivalSimulationHistoryTests`, `RivalRoundSimulationServiceTests`, `RivalSimulationSeeder`, `WebPushNotificationDispatcherTests` (L656-685, under `UnitTests/`); backend tests that only stub the unchanged `DispatchRivalStatsFinishedAsync` or `RivalStatsRecipient` (for example `LeagueSquadStatsGeneratorTests` and `MatchResultNotificationServiceTests`, both under `IntegrationTests/`) stay compatible; frontend `RivalStats.test.tsx`, `RivalStats.leagueSummary.test.tsx`, simulation page and component tests, `rivalStatsService.simulation.test.ts`, `useRivalStats.test.ts`, `useRivalSimulation.test.ts`, `teamSections.test.ts`, `teamNavRoutes.test.ts`.

## Goals / Non-Goals

Goals:

- The new name, routes and texts exactly as the `match-forecast` spec states, on web, API and notifications.
- Old web URLs keep working through a redirect that keeps the query string; old API URLs stop existing.
- Only the Coach role sees and uses the generate/update actions, and the API rejects everyone else before any work is queued.
- No change to computation, stored data, schema or migrations.

Non-Goals:

- Mobile changes (Mobile does not use this page).
- Out of scope: restricting `PUT .../match-forecast/simulation/rounds` (round synchronization) and the read endpoints to the Coach role — revisit when the series asks for non-coaches to be unable to trigger any write, noting that the simulation page calls the synchronization on load for every member.
- Out of scope: renaming the database entities, the notification type keys, the `RivalStatsConstants.Feature` value or the type names of the unchanged data concepts — revisit when a later change needs one name across data and screens.
- Out of scope: restricting the `/coach/match-forecast/simulation` route to the Coach role — revisit when non-coaches should not see the simulation.

## Decisions

### 1. Rename names of the page, route and files; keep names of the data concepts

Renamed: the backend folder and namespace (`Features/Coaches/MatchForecast`), the API route segment, the frontend page folder and component (`pages/matchForecast/MatchForecast`), the page hook (`useRivalStats` to `useMatchForecast`), the service module (`rivalStatsService.ts` to `matchForecastService.ts`), the menu key and label, and the tests that exercise them. Kept: backend type names such as `RequestRivalStats`, `RivalStatsLeague` and `RivalStatsConstants.Feature`; the exported function and type names inside the service (`getRivalStats`, `requestRivalStats`, response types); the simulation page, hook and components (`RivalSimulation*`, `useRivalSimulation`), which keep their names and move under the new page folder. The names kept describe data that does not change, and keeping them keeps the diff reviewable as moves plus the real behavior changes.

**Provenance**: derived

### 2. Coach-only API check inside the endpoint, answering `Results.Problem` 403

`RequestRivalStats` checks the caller's `AppRoles.Coach.Name` role in the endpoint lambda, before sending the command to the mediator, and returns `Results.Problem` with status 403 (same shape as `UpdateTeamPlayer`). `RequireAuthorization()` stays, so anonymous callers still get 401. Because the check runs before the mediator, no report is created or modified and no generation is queued for a rejected caller. An `Administrator` without the `Coach` role is rejected because the check is an exact role match, not `Roles = "Coach,Administrator"`. The command keeps `IRequireFeaturePermission` and `IRequireTeamMembership`, so a coach outside the team is still rejected by the existing behaviors. Alternative considered: `RequireAuthorization(Roles = "Coach")` (the `CreateTeamNote` precedent); it needs less code but its 403 body was not verified to be `ProblemDetails`, which the spec requires.

**Provenance**: derived

### 3. Frontend Coach-only controls through a pure helper and a hook

`computeIsCoachRole(roles)` lives next to `computeIsPlayerRole` in `isPlayerRole.ts` (named in the proposal) and compares role names case-insensitively, the way `coachAuthService.hasRole` does. `useIsCoachRole()` wraps it over `coachAuthService.getRoles()` with the same read-once shape as `useIsPlayerRole`. `MatchForecast.tsx` renders «Crear pronóstico», «Actualizar», «Generar estadísticas» and «Reintentar» only when the hook returns true, and keeps rendering status, teams and player statistics for everyone. The backend check (Decision 2) is the authority; the hidden controls are a usability layer.

**Provenance**: user

### 4. Redirects keep the query string through a small component

`RedirectKeepingSearch` renders `<Navigate to={{ pathname: to, search: location.search }} replace />`. `routes.tsx` declares `rival-stats` and `rival-stats/simulation` with it, outside `RequireFeaturePermission`, so the guard of the new route decides access after the redirect. `teamNavRoutes.ts` lists only the new path, since the old path never stays mounted. The team id travels in the query string, so the redirect keeps the team selection and old push links still work.

**Provenance**: derived

### 5. Old API routes are removed, not redirected

The six endpoints change their route literal from `rival-stats` to `match-forecast`. No alias and no redirect remain; web and API deploy together. The frontend service base URL changes in the same change.

**Provenance**: user

### 6. Notification text and link change, type keys stay

`DispatchRivalStatsFinishedAsync` gets the new titles and the new link. `RivalStatsReady` and `RivalStatsFailed` keep their values because they are persisted identifiers that existing rows and clients may read. Notifications already sent keep their old link, which the web redirect resolves.

**Provenance**: derived

### 7. Version bumps

The change adds Coach-only behavior and renames public routes, so it is a `feat`: the API `<Version>` goes from 1.51.0 to the next minor and the web version in `Front/package.json` goes from 1.116.2 to 1.117.0 through `npm version 1.117.0 --no-git-tag-version`. A major bump needs the user's agreement and none was given.

**Provenance**: codebase-forced

## Risks / Trade-offs

- [A client outside the web app still calls `/api/teams/{teamId}/rival-stats/...` and breaks] → Mobile and the web e2e suite showed no references; the web service is updated in the same change, and both deploy together.
- [Files renamed by hand leave a stale import or a stale test name] → Update every importer listed under Context in the same step as the move; `dotnet build` and `npm run build` fail on any miss.
- [The persisted `Feature` tag value `RivalStats` and the notification type keys look inconsistent next to the new folder name] → Kept on purpose (Decision 6, Non-Goals); a later change can rename them with a data decision.
- [A non-Coach user keeps a bookmarked or cached page that still shows the controls until the roles are read] → The API rejects the request with 403 `ProblemDetails`, so no data changes.
- [The simulation page keeps calling the round synchronization for non-coaches, which writes saved simulations] → Documented as a non-goal; the endpoint stays idempotent and access unchanged.

## Open Questions

None.

## Manual Verification

- Generated-artifact drift: `None` — no migration, snapshot, designer file or tracked lockfile changes; the untracked `Front/package-lock.json` is not part of the change.
- End-to-end smoke across real runtimes: as a Coach, open the team menu, enter «Pronóstico de partidos», press «Generar estadísticas» and wait for the push; the notification title reads «Pronóstico de partidos listo» and its link opens `/coach/match-forecast?teamId=<id>`. Then open `/coach/rival-stats?teamId=<id>` and confirm the address bar becomes `/coach/match-forecast?teamId=<id>` with the same team. As a Player, open the same page and confirm the data shows and none of the four Coach-only controls appears.
