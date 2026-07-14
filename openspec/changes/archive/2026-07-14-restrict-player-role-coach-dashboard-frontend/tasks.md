## 1. Shared permission plumbing

- [x] 1.1 Create `Front/src/apps/coach/constants/featureRoutes.ts` with a `COACH_FEATURE_ROUTES` const object mirroring `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/CoachFeatureRoutes.cs` route strings (Squad, Events, AttendanceSummary, Convocations, Injured, Sanctions, Lottery, News, Rivals, Trainings, GameModel, SeasonAccess, Settings, ClubManagement, ClubPlayers, ClubTeams, ClubRegistrations).
- [x] 1.2 TDD: write `Front/src/shared/hooks/__tests__/usePermissions.test.ts` (Red) covering: loading state, successful fetch exposing `featurePermissions`/`role`, `hasFeatureAccess` true/false for present/absent routes, `hasFeatureAccess` true for any route when `role === "Administrator"` even with an empty list, error path leaves `hasFeatureAccess` false.
- [x] 1.3 Implement `Front/src/shared/hooks/usePermissions.ts` (Green) to pass 1.2.

## 2. Route guard

- [x] 2.1 TDD: write `Front/src/apps/coach/components/__tests__/RequireFeaturePermission.test.tsx` (Red) covering: renders children when `hasFeatureAccess` is true, renders loading spinner while loading, redirects (`Navigate`) when access is false, does not render children while redirecting.
- [x] 2.2 Implement `Front/src/apps/coach/components/RequireFeaturePermission.tsx` (Green) using `usePermissions()`.

## 3. Dashboard cards — permission-driven visibility

- [x] 3.1 TDD: extend/add tests for `TeamDashboardCards.tsx` (Red) asserting: Player role sees exactly the 8 allowed cards and not Rivals/Trainings/GameModel/SeasonAccess; Coach role sees all cards; Administrator sees all cards despite an empty permissions fixture.
- [x] 3.2 Implement: replace `canSeeGameModel` and the `!isPlayer` SeasonAccess conditional in `TeamDashboardCards.tsx` with `usePermissions().hasFeatureAccess(COACH_FEATURE_ROUTES.X)` per card (Green).
- [x] 3.3 TDD: extend `DashboardCards.tsx` tests (Red) asserting the Configuración/Settings card only renders when `hasFeatureAccess(COACH_FEATURE_ROUTES.Settings)` is true. Also updated the pre-existing `DashboardCards.clubCard.test.tsx` and two `CoachDashboard`-level test suites to mock the new `usePermissions` hook (they broke once `DashboardCards` started calling it for real).
- [x] 3.4 Implement: replace the Settings card's `!isPlayer` conditional with the permission check (Green). Left the rest of the `isPlayer`-driven "Acceso Rápido" section visibility untouched (out of scope per design.md).

## 4. Route wiring

- [x] 4.1 Wrap the routes listed in design.md's mapping table in `Front/src/apps/coach/routes.tsx` with `<RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.X}>`, per the route→featureRoute table. `dashboard` and `team-dashboard` deliberately left unwrapped.
- [x] 4.2 Smoke-checked via `npm run build`: every wrapped route still lazy-loads correctly (chunk list unchanged in shape, no new TypeScript errors, `React.lazy`/`React.createElement` usages preserved for `clubs/:id/teams/new`, `clubs/:id/teams/:teamId/edit`, `clubs/new`).

## 5. Build, test, verify

- [x] 5.1 `npm run build` — clean, no new TypeScript errors (one pre-existing, unrelated dynamic-import chunking warning for `seasonPrepAllTeamsService.ts`).
- [x] 5.2 `npm run test` — 134/134 Vitest tests pass (34 files), zero skipped. `@vitest/coverage-v8` is not installed in this repo so a numeric coverage percentage could not be generated; qualitative coverage: every new file (`usePermissions.ts`, `RequireFeaturePermission.tsx`, `featureRoutes.ts`) has a dedicated test file exercising all branches (loading/success/error/Administrator-bypass for the hook; loading/allowed/blocked for the guard), and both modified card components have direct assertions for the new permission-driven branches.
- [x] 5.3 Final report delivered to orchestrator in the conversation (files created/modified, guard mechanism, test results, Sanctions/Lottery/News note).
