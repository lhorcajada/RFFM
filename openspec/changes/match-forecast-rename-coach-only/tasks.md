## Step 1: Backend rename to `MatchForecast`, Coach-only `POST .../requests` and API version bump

- [x] Step 1: Backend rename to `MatchForecast`, Coach-only `POST .../requests` and API version bump

**Routing**: category=backend · context=large · difficulty=medium (mechanical moves plus a Coach check, two new test files and the matching web service base URL)

**Files Affected**:
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalStats.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalStats.cs
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalTeamStats.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalTeamStats.cs
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RequestRivalStats.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/RequestRivalStats.cs
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalSimulation.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalSimulation.cs
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/GetRivalSimulationHistory.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/GetRivalSimulationHistory.cs
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/SyncRivalSimulationRounds.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/SyncRivalSimulationRounds.cs
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RivalStatsLeague.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/RivalStatsLeague.cs
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RivalSimulationContracts.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/RivalSimulationContracts.cs
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/Services/RivalRoundSimulationService.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/Services/RivalRoundSimulationService.cs
- R Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/Services/RivalSimulationInputLoader.cs -> Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/Services/RivalSimulationInputLoader.cs
- M Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LeagueScorers/GetLeagueScorers.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/LeagueScorers/RefreshLeagueActas.cs
- M Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notifications/Services/WebPushNotificationDispatcher.cs
- M Back/ExtractionApi/Directory.Build.props
- M Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationSeeder.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalStatsTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationHistoryTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalRoundSimulationServiceTests.cs
- M Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/WebPushNotificationDispatcherTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/MatchForecastRoutesTests.cs
- A Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RequestRivalStatsAuthorizationTests.cs
- M Front/src/apps/coach/services/rivalStatsService.ts
- M Front/src/apps/coach/services/__tests__/rivalStatsService.simulation.test.ts

**What Will Be Done**: Move the ten feature files with `git mv` into `Features/Coaches/MatchForecast/` and change their namespace to `RFFM.Api.Features.Coaches.MatchForecast` (and `...MatchForecast.Services`); type names stay as they are (design Decision 1). Change the route literal of every endpoint in the six endpoint files from `rival-stats` to `match-forecast`, keeping subroutes, methods and `.RequireAuthorization()` as they are. Fix the importers: the `using` and the fully qualified `RequestRivalStats.Validator` reference in `ServiceCollectionExtensions.cs`, and the `using` in `GetLeagueScorers.cs` and `RefreshLeagueActas.cs`. In `DispatchRivalStatsFinishedAsync` change the two titles and the link to the new text and `/coach/match-forecast?teamId=` while keeping the type keys `RivalStatsReady` and `RivalStatsFailed` (Decision 6). Bump `<Version>` from 1.51.0 to 1.52.0. In the `RequestRivalStats` `MapPost` lambda, before `mediator.Send`, test the caller's roles against `AppRoles.Coach.Name` (exact, case-insensitive, as `UpdateTeamPlayer` does at L39) and return `Results.Problem` with status 403 and a `code` extension when the role is missing (design Decision 2); add the new constant to `Domain/ErrorCodes.cs` beside `TeamPlayerEditForbidden`, and keep `.RequireAuthorization()` so anonymous callers still get 401. Update the URL assertions of the web service test (L35, L50, L59) and write the two new backend test files first (RED), both mirroring the `TestServer` plus nested `TestAuthHandler` pattern of `TeamNotesEndpointAuthorizationTests`, then move and change. In the web service change the base URL (L129) from `/api/teams/{id}/rival-stats` to `/api/teams/{id}/match-forecast` in the same step, so the web app and the API never disagree at a commit boundary; the module itself is renamed in Step 3. Specs: `specs/match-forecast/spec.md` (routes, API removal, Coach-only endpoint), `specs/coach-rival-squad-stats/spec.md` (notification), `specs/rival-match-simulation/spec.md`, `specs/rival-simulation-history/spec.md`.

**Testing Strategy**: New `RequestRivalStatsAuthorizationTests` (with a recording `IMediator` substitute): Player gets 403 `ProblemDetails` and the mediator is never called; `Administrator` without `Coach` gets 403 and no mediator call; `Coach` reaches the mediator and the endpoint answers 202 for a pending report; anonymous gets 401. `RivalStatsTests.cs` calls `RequestRivalStats.Handler` directly, so the endpoint-level check leaves its assertions compatible. New `MatchForecastRoutesTests` hosts the feature modules in a `TestServer`: a member request to `GET /api/teams/{teamId}/match-forecast` is routed (not 404) and `GET /api/teams/{teamId}/rival-stats` answers 404 without a redirect. Existing handler-level tests only need their `using` updated and keep their assertions; reviewed paths: `RivalStatsTests.cs`, `RivalSimulationTests.cs`, `RivalSimulationHistoryTests.cs`, `RivalRoundSimulationServiceTests.cs` and `RivalSimulationSeeder.cs` (namespace only, compatible after the `using` change), `WebPushNotificationDispatcherTests.cs` (title and link assertions at L670-672 and L685 change). Stubs of `DispatchRivalStatsFinishedAsync` in other test files stay compatible because the method name does not change. Run the filtered suites (they compile the API and test projects) for `RivalStats`, `RivalSimulation`, `RivalRoundSimulation`, `RequestRivalStatsAuthorization`, `WebPushNotificationDispatcher` and `MatchForecastRoutes`, plus `npx vitest run src/apps/coach/services/__tests__/rivalStatsService.simulation.test.ts` from `Front`.

**Existing Tests Broken**:
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationSeeder.cs` — compile
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalStatsTests.cs` — compile
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationTests.cs` — compile
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalSimulationHistoryTests.cs` — compile
- `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RivalRoundSimulationServiceTests.cs` — compile
- `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/WebPushNotificationDispatcherTests.cs` — runtime
- `Front/src/apps/coach/services/__tests__/rivalStatsService.simulation.test.ts` — runtime

## Step 2: Coach-only controls on the page and «Crear pronóstico» button text

- [x] Step 2: Coach-only controls on the page and «Crear pronóstico» button text

**Routing**: category=frontend-ui · context=medium · difficulty=medium (four controls to gate and two page tests to adapt)

**Files Affected**:
- M Front/src/apps/coach/hooks/isPlayerRole.ts
- A Front/src/apps/coach/hooks/__tests__/isPlayerRole.test.ts
- A Front/src/apps/coach/hooks/useIsCoachRole.ts
- A Front/src/apps/coach/hooks/__tests__/useIsCoachRole.test.ts
- M Front/src/apps/coach/pages/rivalStats/RivalStats.tsx
- M Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.test.tsx
- M Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.leagueSummary.test.tsx

**What Will Be Done**: Add `computeIsCoachRole(roles)` beside `computeIsPlayerRole`, comparing the role name case-insensitively against `Coach` so `Administrator` alone is false, and `useIsCoachRole()` with the same read-once shape as `useIsPlayerRole` over `coachAuthService.getRoles()` (Decision 3). In the page render the four controls only when the hook returns true, and rename the «Simulación» link text to «Crear pronóstico» (its `href` still points to the current simulation route until Step 3); the status, the team list and the player statistics render for everyone. Specs: `specs/match-forecast/spec.md` requirement «Solo el rol Coach ve y usa las acciones que generan o actualizan el pronóstico», and the modified page requirement in `specs/coach-rival-squad-stats/spec.md`.

**Testing Strategy**: Write first (RED) the helper tests (Coach true; Player, FamilyMember, Administrator-only and empty false; mixed-case input), the hook test (mocking `coachAuthService.getRoles`, as `useIsPlayerRole.test.ts` does) and page tests for each spec scenario: Coach sees «Crear pronóstico» and «Actualizar»; Player does not see them; Administrator without Coach does not; empty state has no «Generar estadísticas» for a non-Coach; failed state has no «Reintentar» for a non-Coach and still shows the message. Reviewed paths: `RivalStats.test.tsx` and `RivalStats.leagueSummary.test.tsx` mock no roles today and assert the buttons visible (and the `/simulación/i` link name), so each needs a Coach role mock and the new link name to keep those assertions; no other test renders the page. Run `npx vitest run` on `src/apps/coach/hooks/__tests__` and `src/apps/coach/pages/rivalStats`.

**Existing Tests Broken**:
- `Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.test.tsx` — runtime
- `Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.leagueSummary.test.tsx` — runtime

## Step 3: Frontend rename to `matchForecast`, redirects of the old routes and web version bump

- [x] Step 3: Frontend rename to `matchForecast`, redirects of the old routes and web version bump

**Routing**: category=frontend-code · context=large · difficulty=medium (many moves; import paths and mock paths must follow)

**Files Affected**:
- R Front/src/apps/coach/pages/rivalStats/RivalStats.tsx -> Front/src/apps/coach/pages/matchForecast/MatchForecast.tsx
- R Front/src/apps/coach/pages/rivalStats/RivalStats.module.css -> Front/src/apps/coach/pages/matchForecast/MatchForecast.module.css
- R Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.test.tsx -> Front/src/apps/coach/pages/matchForecast/__tests__/MatchForecast.test.tsx
- R Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.leagueSummary.test.tsx -> Front/src/apps/coach/pages/matchForecast/__tests__/MatchForecast.leagueSummary.test.tsx
- R Front/src/apps/coach/pages/rivalStats/components/RivalTeamCard.tsx -> Front/src/apps/coach/pages/matchForecast/components/RivalTeamCard.tsx
- R Front/src/apps/coach/pages/rivalStats/components/RivalTeamCard.module.css -> Front/src/apps/coach/pages/matchForecast/components/RivalTeamCard.module.css
- R Front/src/apps/coach/pages/rivalStats/components/RivalPlayerCard.tsx -> Front/src/apps/coach/pages/matchForecast/components/RivalPlayerCard.tsx
- R Front/src/apps/coach/pages/rivalStats/components/RivalPlayerCard.module.css -> Front/src/apps/coach/pages/matchForecast/components/RivalPlayerCard.module.css
- R Front/src/apps/coach/pages/rivalStats/simulation/RivalSimulation.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/RivalSimulation.tsx
- R Front/src/apps/coach/pages/rivalStats/simulation/RivalSimulation.module.css -> Front/src/apps/coach/pages/matchForecast/simulation/RivalSimulation.module.css
- R Front/src/apps/coach/pages/rivalStats/simulation/simulationFormat.ts -> Front/src/apps/coach/pages/matchForecast/simulation/simulationFormat.ts
- R Front/src/apps/coach/pages/rivalStats/simulation/__tests__/RivalSimulation.test.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/__tests__/RivalSimulation.test.tsx
- R Front/src/apps/coach/pages/rivalStats/simulation/components/MatchPredictionCard.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/MatchPredictionCard.tsx
- R Front/src/apps/coach/pages/rivalStats/simulation/components/MatchPredictionCard.module.css -> Front/src/apps/coach/pages/matchForecast/simulation/components/MatchPredictionCard.module.css
- R Front/src/apps/coach/pages/rivalStats/simulation/components/ProjectedStandingCard.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/ProjectedStandingCard.tsx
- R Front/src/apps/coach/pages/rivalStats/simulation/components/ProjectedStandingCard.module.css -> Front/src/apps/coach/pages/matchForecast/simulation/components/ProjectedStandingCard.module.css
- R Front/src/apps/coach/pages/rivalStats/simulation/components/__tests__/MatchPredictionCard.test.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/__tests__/MatchPredictionCard.test.tsx
- R Front/src/apps/coach/pages/rivalStats/simulation/components/__tests__/ProjectedStandingCard.test.tsx -> Front/src/apps/coach/pages/matchForecast/simulation/components/__tests__/ProjectedStandingCard.test.tsx
- R Front/src/apps/coach/hooks/useRivalStats.ts -> Front/src/apps/coach/hooks/useMatchForecast.ts
- R Front/src/apps/coach/hooks/__tests__/useRivalStats.test.ts -> Front/src/apps/coach/hooks/__tests__/useMatchForecast.test.ts
- R Front/src/apps/coach/services/rivalStatsService.ts -> Front/src/apps/coach/services/matchForecastService.ts
- R Front/src/apps/coach/services/__tests__/rivalStatsService.simulation.test.ts -> Front/src/apps/coach/services/__tests__/matchForecastService.simulation.test.ts
- M Front/src/apps/coach/hooks/useRivalSimulation.ts
- M Front/src/apps/coach/hooks/__tests__/useRivalSimulation.test.ts
- M Front/src/apps/coach/routes.tsx
- M Front/src/apps/coach/navigation/teamSections.ts
- M Front/src/apps/coach/navigation/teamNavRoutes.ts
- M Front/src/apps/coach/navigation/__tests__/teamSections.test.ts
- M Front/src/apps/coach/navigation/__tests__/teamNavRoutes.test.ts
- M Front/package.json
- A Front/src/apps/coach/components/RedirectKeepingSearch.tsx
- A Front/src/apps/coach/components/__tests__/RedirectKeepingSearch.test.tsx

**What Will Be Done**: Move the page folder and rename the page component, its hook, the service module and the tests that exercise them, following design Decision 1; fix every import and `vi.mock` path that points at a moved module, including `useRivalSimulation.ts` and its test. The service keeps the `/api/teams/{id}/match-forecast` base URL set in Step 1. In the page, rename the heading to «Pronóstico de partidos» and point the «Crear pronóstico» link `href` to `/coach/match-forecast/simulation`; in the simulation page point the back navigation to `/coach/match-forecast`. In `routes.tsx` declare `match-forecast` and `match-forecast/simulation` wrapped in `RequireFeaturePermission` with the Convocations feature route exactly as the old blocks were, and declare `rival-stats` and `rival-stats/simulation` as `RedirectKeepingSearch` elements outside the guard (Decision 4). Create `RedirectKeepingSearch` as a `<Navigate replace>` carrying `location.search`. Update `teamSections.ts` (key, label, route) and `teamNavRoutes.ts` (new path only). Bump `Front/package.json` from 1.116.2 to 1.117.0 with `npm version 1.117.0 --no-git-tag-version`. Use `git mv` so history follows. Specs: `specs/match-forecast/spec.md`, `specs/coach-dashboard-permission-ui/spec.md`, `specs/rival-match-simulation/spec.md`.

**Testing Strategy**: Write the redirect test first (RED) with `MemoryRouter`: `/coach/rival-stats?teamId=abc` lands on `/coach/match-forecast?teamId=abc` and the simulation path likewise. Update the assertions that name the old route, label or heading first (RED), then move the code (GREEN). Reviewed paths and verdict: `teamSections.test.ts` (L59, L84-85, L189, L213: label and route change, runtime), `teamNavRoutes.test.ts` (L16 path changes, runtime), `RivalStats.test.tsx` (heading and the simulation link `href` at L145 and L151 change, runtime), `rivalStatsService.simulation.test.ts` (URLs already updated in Step 1; only its import path to the renamed module changes, compile), moved tests whose relative imports change (compile), `useRivalSimulation.test.ts` (mock path to the renamed service, compile). The guard tests of `RequireFeaturePermission` stay compatible because the guard still keys on the feature-route constant. Run `npx vitest run` on the affected folders (`pages/matchForecast`, `hooks/__tests__`, `services/__tests__`, `navigation/__tests__`, `components/__tests__`). Closing check, run once after this last step and not per step: `npm run build`, `dotnet build` and the affected tests of the whole change (the filtered suites listed above). The full web suite (`npx vitest run --maxWorkers=4`) and the full `dotnet test` run only if the user confirms when `/opsx:apply` asks.

**Existing Tests Broken**:
- `Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.test.tsx` — runtime
- `Front/src/apps/coach/pages/rivalStats/__tests__/RivalStats.leagueSummary.test.tsx` — compile
- `Front/src/apps/coach/pages/rivalStats/simulation/__tests__/RivalSimulation.test.tsx` — compile
- `Front/src/apps/coach/pages/rivalStats/simulation/components/__tests__/MatchPredictionCard.test.tsx` — compile
- `Front/src/apps/coach/pages/rivalStats/simulation/components/__tests__/ProjectedStandingCard.test.tsx` — compile
- `Front/src/apps/coach/hooks/__tests__/useRivalStats.test.ts` — compile
- `Front/src/apps/coach/hooks/__tests__/useRivalSimulation.test.ts` — compile
- `Front/src/apps/coach/services/__tests__/rivalStatsService.simulation.test.ts` — compile
- `Front/src/apps/coach/navigation/__tests__/teamSections.test.ts` — runtime
- `Front/src/apps/coach/navigation/__tests__/teamNavRoutes.test.ts` — runtime

## Required Documentation

### Spec files
- openspec/changes/match-forecast-rename-coach-only/specs/match-forecast/spec.md
- openspec/changes/match-forecast-rename-coach-only/specs/coach-rival-squad-stats/spec.md
- openspec/changes/match-forecast-rename-coach-only/specs/rival-match-simulation/spec.md
- openspec/changes/match-forecast-rename-coach-only/specs/rival-simulation-history/spec.md
- openspec/changes/match-forecast-rename-coach-only/specs/coach-dashboard-permission-ui/spec.md

### Local files
- openspec/changes/match-forecast-rename-coach-only/proposal.md — scope, breaking API change and the notes on the extra controls that call the same endpoint.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/RivalStats/RequestRivalStats.cs — endpoint that gains the Coach check; lambda shape and command behaviors.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Commands/UpdateTeamPlayer.cs — pattern to imitate for the exact-role check and the `Results.Problem` 403 with `code` extension.
- Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs — home of the new error-code constant.
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notifications/Services/WebPushNotificationDispatcher.cs — notification titles and link that change.
- Back/ExtractionApi/src/RFFM.Api/DependencyInjection/ServiceCollectionExtensions.cs — namespace import, validator reference and the 403 `ProblemDetails` mapping.
- Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/TeamNotesEndpointAuthorizationTests.cs — pattern for `TestServer`, `TestAuthHandler` and role-header endpoint tests.
- Back/ExtractionApi/Directory.Build.props — API version to bump.
- Front/src/apps/coach/routes.tsx — route blocks to move and wrap, plus existing redirect style.
- Front/src/apps/coach/pages/rivalStats/RivalStats.tsx — page to rename; holds the four controls to gate.
- Front/src/apps/coach/hooks/isPlayerRole.ts — pattern to imitate for the Coach helper.
- Front/src/apps/coach/hooks/useIsPlayerRole.ts — pattern to imitate for the Coach hook and its test mock.
- Front/src/apps/coach/services/authService.ts — source of the roles used by the hook.
- Front/src/apps/coach/components/RequireFeaturePermission.tsx — guard that keeps wrapping the new routes.
- Front/src/apps/coach/navigation/teamSections.ts — menu entry label and route to change.
- Front/package.json — web version to bump.

### External URLs
None

## Implementation Context

**Stack**: .NET 9 ASP.NET Core Minimal API with Mediator v3, EF Core 9, PostgreSQL, xUnit with a Postgres container fixture (`Back/ExtractionApi`, API version 1.51.0); React 19 with TypeScript 5.5 strict, Vite 7, MUI v5, CSS Modules, Vitest with Testing Library (`Front`, version 1.116.2).

**Conventions**:
- Backend endpoints are vertical slices: one `.cs` file holds the `IFeatureModule` routes, command or query, handler and validator, and is mapped automatically; a feature folder name is also its namespace.
- Endpoint-level denials return `Results.Problem(statusCode: 403, ...)` with a `code` extension taken from the `ErrorCodes` constants (`UpdateTeamPlayer`), not an empty attribute 403.
- Endpoint authorization tests host the module in a `TestServer` with a nested `TestAuthHandler` that reads an `X-Test-Role` header, inside `[Collection(PostgresCollection.Name)]`.
- Frontend tests sit in a `__tests__` folder next to their subject, declare `vi.mock` before importing the component, use user-centric Testing Library queries and Spanish test names.
- Frontend files are imported directly (no barrel `index.ts`), each page or component has a co-located `.module.css`, and role checks use pure helpers like `computeIsPlayerRole` wrapped by a read-once hook.

**Avoid**: `[Authorize(Roles = "Coach,Administrator")]` or `RequireAuthorization(Roles = ...)` for the Coach-only rule (administrators pass, and the 403 body is unverified); renaming type names of unchanged data concepts (`RivalStats*`, `getRivalStats`) or the notification type keys; adding tables, inline `style={{}}`, `any`, a second Axios instance or a barrel file in the frontend.

**Test Command**: `cd Back/ExtractionApi && dotnet test tests/RFFM.Api.Tests --filter "FullyQualifiedName~<TestName>"` for a backend subset (the full suite only if the user asks for it); `cd Front && npx vitest run --config vitest.config.ts <path relative to Front>` for a frontend subset (`npx vitest run --maxWorkers=4` for the full suite only if the user asks for it).
