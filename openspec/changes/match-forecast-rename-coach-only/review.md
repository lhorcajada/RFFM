# Code Review — Match Forecast Rename Coach Only

**Reviewed:** `main` ec435a8b..cb330ffd · 2026-11-11

## Security Surface Triage

- **Surface touched:** Yes — `POST /api/teams/{teamId}/match-forecast/requests` gains a role-based authorization check (`RequestRivalStats.cs`), all six API routes change, and new frontend redirects are added (`RedirectKeepingSearch.tsx`, `routes.tsx`).

---

## Performance Surface Triage

- **Surface touched:** Yes — HTTP endpoints are re-routed and the coach routes / lazy-loaded page components change (`routes.tsx`, `MatchForecast.tsx`); the change is a rename plus conditional rendering, so the risk is low.

---

## Accessibility Surface Triage

- **Surface touched:** Yes — `.tsx` pages and navigation change (`MatchForecast.tsx`, `RivalSimulation.tsx`, `teamSections.ts`, `routes.tsx`), with controls shown or hidden by role.

---

## Findings

### Critical

None.

### High

None.

### Medium

#### M1 — Route test misses one endpoint and accepts any non-404 status
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/MatchForecastRoutesTests.cs:127-142`
- **Problem:** `MatchForecastRoute_IsRouted` covers only four of the five read/sync routes: `GET /api/teams/{teamId}/match-forecast/teams/{teamCode}` (`GetRivalTeamStats.cs`) is not in the `InlineData` list, so a wrong route literal in that file would go undetected. The test asserts only `Assert.NotEqual(HttpStatusCode.NotFound, response.StatusCode)`, which also passes on `405 Method Not Allowed`. A route registered under the right path but the wrong verb would therefore pass. The spec requires "la misma estructura de subrutas, métodos" under `match-forecast`.
- **Suggested fix:** Add `[InlineData("GET", "/api/teams/{0}/match-forecast/teams/E1")]` (and the matching `rival-stats/teams/E1` case to the 404 theory). Also assert `Assert.NotEqual(HttpStatusCode.MethodNotAllowed, ...)`, or check endpoint metadata (`EndpointDataSource` route pattern + HTTP method) rather than the status code.

### Low

#### L1 — Administrator-without-Coach 403 test does not assert the ProblemDetails body
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RequestRivalStatsAuthorizationTests.cs:161-171`
- **Problem:** The spec scenario «Administrador sin rol Coach llama al endpoint» requires "403 con `ProblemDetails`". The test checks only the status code and `Assert.Empty(sent)`. The Player/FamilyMember theory (lines 152-157) does assert `status`, `title` and `code`. The branch is the same, so a regression is unlikely, but the body requirement for this case has no test.
- **Suggested fix:** Add `"Administrator"` to the `[InlineData]` of the non-Coach theory at line 142, or copy its three ProblemDetails assertions into this test.

#### L2 — The production `roles` claim type is not exercised by the authorization test
- **Location:** `Back/ExtractionApi/tests/RFFM.Api.Tests/IntegrationTests/RequestRivalStatsAuthorizationTests.cs:76-79`
- **Problem:** `TestAuthHandler` emits only `new Claim(ClaimTypes.Role, role)`. `TokenService.cs:222` issues the roles as a `"roles"` claim, and the endpoint filter matches `c.Type == "roles" || c.Type == ClaimTypes.Role`. The `"roles"` branch, the one real tokens hit when inbound claim mapping does not apply, is never tested.
- **Suggested fix:** Add a case (e.g. an `X-Test-Claim-Type: roles` header or a second theory parameter) that emits the Coach role as a `"roles"` claim and expects 202, plus a non-Coach case that expects 403.

#### L3 — Coach-role check duplicates `ICurrentUserService.Roles` (EXCLUDED: interfaces.md fixes the lambda parameters; the duplication is harmless and covered by tests)
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/MatchForecast/RequestRivalStats.cs:41-43`
- **Problem:** The endpoint repeats the claim filter inline: `httpContext.User.Claims.Where(c => c.Type == "roles" || c.Type == ClaimTypes.Role)`. `CurrentUserService.Roles` (`Infrastructure/Services/CurrentUserService.cs:27-32`) already implements that filter. The design names `UpdateTeamPlayer.cs` as the precedent, and it injects `ICurrentUserService currentUser` and checks `currentUser.Roles`. If the claim mapping ever changes, two copies have to be updated.
- **Suggested fix:** Inject `ICurrentUserService currentUser` into the lambda and use `currentUser.Roles.Any(r => string.Equals(r, AppRoles.Coach.Name, StringComparison.OrdinalIgnoreCase))`, matching `UpdateTeamPlayer.cs:39`.

#### L4 — «Crear pronóstico» query-string preservation is untested
- **Location:** `Front/src/apps/coach/pages/matchForecast/__tests__/MatchForecast.test.tsx:157-161`
- **Problem:** The spec scenario «Botón de la simulación» requires that «Crear pronóstico» opens `/coach/match-forecast/simulation` "conservando la query string". The code forwards `search` (`MatchForecast.tsx:207`), but the test renders with no query string and asserts `href` `"/coach/match-forecast/simulation"`, so dropping `search` would still pass.
- **Suggested fix:** Render the page at `/coach/match-forecast?teamId=team-1` (the `MemoryRouter` `initialEntries`) and assert `href` `"/coach/match-forecast/simulation?teamId=team-1"`.

#### L5 — Leftover `rival-stats` wording in a production log message
- **Location:** `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notifications/Services/WebPushNotificationDispatcher.cs:322`
- **Problem:** `_logger?.LogWarning(ex, "Failed to dispatch rival-stats web push");` is the only `rival-stats` literal left in `Back/ExtractionApi/src`. The title and link two lines above were renamed. Log searches by feature name will miss it.
- **Suggested fix:** Change the message to `"Failed to dispatch match-forecast web push"`.

#### L6 — Stale `RivalStats` identifiers for renamed page and hook (EXCLUDED: cosmetic naming inside tests and a type alias, no behavior)
- **Location:** `Front/src/apps/coach/hooks/useMatchForecast.ts:6`; `Front/src/apps/coach/pages/matchForecast/__tests__/MatchForecast.test.tsx:114` (also `mockUseRivalStats`, and `MatchForecast.leagueSummary.test.tsx:27`)
- **Problem:** Design Decision 1 renames the page hook (`useRivalStats` → `useMatchForecast`) and the page component, and keeps only the data-concept names (`getRivalStats`, response types, `RivalSimulation*`). The hook's return type alias is still `UseRivalStats`, the page test suite is still `describe("RivalStats")`, and the hook mock is still `mockUseRivalStats`. These are neither data concepts nor kept names, so they read as missed renames.
- **Suggested fix:** Rename the alias to `UseMatchForecast`, the suite to `describe("MatchForecast")`, and the mock to `mockUseMatchForecast`.

#### L7 — Squad-strength notice prompts non-coaches to do a Coach-only action (EXCLUDED: the approved specs leave the simulation page unrestricted and unchanged; the fix adds behavior outside the scope)
- **Location:** `Front/src/apps/coach/pages/matchForecast/simulation/RivalSimulation.tsx:191-195`
- **Problem:** The notice «Genera las estadísticas de rivales para tener en cuenta las plantillas; ahora solo se usan los resultados.» is shown to every role. After this change only the Coach role can generate statistics: the endpoint rejects others with 403 and the button is hidden. A player or family member who reaches the simulation page by URL is told to do something they cannot do. The spec makes the notice itself unconditional, so this concerns only its wording.
- **Suggested fix:** Keep the notice for everyone, but show the call to action only when `useIsCoachRole()` is true. For example, non-coaches see «Ahora solo se usan los resultados; las plantillas se tendrán en cuenta cuando el entrenador genere las estadísticas.»

### Questions

None.

---

Summary: Critical=0 High=0 Medium=1 Low=7 Questions=0
