## Context

The backend (`restrict-player-role-coach-features`, already implemented, 115/115 tests passing) exposes
`GET /api/permissions/me` returning `{ role, featurePermissions: {featureName, featureRoute,
permissionType}[], pagePermissions }`. `Front/src/shared/services/permissions/permissionService.ts`
already wraps this call (`getMyPermissions()`), and `Front/src/shared/hooks/useFeaturePermission.ts`
already exists as a single-route check hook (`{ hasAccess, loading }` for one `featureRoute`). Neither
is currently consumed anywhere in the Coach app.

Card gating today is hardcoded and inconsistent:
- `Front/src/apps/coach/pages/team-dashboard/TeamDashboardCards.tsx` — the real feature-card grid
  (Squad, Events, AttendanceSummary, Convocations, Rivals, Trainings, Injured, GameModel, Sanctions,
  Lottery, News, SeasonAccess). Only `GameModel` (`canSeeGameModel`, role string match) and
  `SeasonAccess` (`!isPlayer`) are gated; the rest render unconditionally for every role, including
  Player.
- `Front/src/apps/coach/pages/Dashboard/components/DashboardCards.tsx` — hides the "Configuración"
  (Settings) card via `!isPlayer` and hides the whole "Acceso Rápido" team-list section for players.
  There is no "Club" card in the current code (an existing test,
  `DashboardCards.clubCard.test.tsx`, already asserts a Club card never renders for anyone — that
  concern is already resolved and out of scope here).
- `Front/src/apps/coach/components/ProtectedRoute.tsx` and `context/CoachAuthContext.tsx`'s
  `CoachAuthGuard` only check `isAuthenticated`; a code comment in `CoachAuthContext.tsx` explicitly
  says role-based restrictions are "added later" — this change is that later step, scoped to feature
  routes (not arbitrary RBAC).
- `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/CoachFeatureRoutes.cs` is the canonical route catalog
  and its string values already match real frontend route paths 1:1 (e.g. `Squad = "/coach/squad"`).

**Administrator caveat**: the backend never seeds `FeaturePermission` rows for `Administrator` (it
bypasses `FeaturePermissionBehavior` unconditionally instead). So `GET /api/permissions/me` returns an
**empty** `featurePermissions` array for an Administrator caller. Any frontend gate that just checks
"is this route in the list" would incorrectly hide everything for Administrator. The frontend must
special-case `role === "Administrator"` as an unconditional bypass, mirroring the backend.

## Goals / Non-Goals

**Goals:**
- One shared hook, fetched once per page mount, that both the dashboard card components and the route
  guard consume — no duplicated ad-hoc permission logic.
- Mirror the backend's `CoachFeatureRoutes` catalog on the frontend as typed constants, so route strings
  aren't duplicated as magic strings across cards and route guards.
- Card visibility and route access use the *same* underlying check (`hasFeatureAccess(route)`), so they
  can't drift from each other.
- TDD: tests for the hook, the guard, and both card components before/alongside implementation.

**Non-Goals:**
- Building real Sanctions/Lottery/News backends — those pages already exist in the frontend as
  placeholders (`Front/src/apps/coach/pages/{sanctions,lottery,news}/`) and already have routes; this
  change only ensures they're treated as allowed/visible like the other 7 features, consistent with the
  backend's seeded (if currently backend-less) permission rows for them.
- Per-action (Read vs Write) UI gating within a page (e.g. hiding an "Edit" button when permission is
  Read-only). Only route/card-level visibility is in scope, matching the granularity of the 8-cards /
  route-block requirement.
- Changing `ProtectedRoute`'s existing auth-only behavior for federation or shared routes — this change
  is scoped to `Front/src/apps/coach`.
- A dedicated "403 Access Denied" page — redirecting to `/coach/dashboard` (or `team-dashboard` when a
  `teamId` is present) is sufficient per the proposal; a full-page 403 experience is a future
  enhancement if product wants one.

## Decisions

### 1. New shared hook `usePermissions()` instead of reusing `useFeaturePermission` everywhere

`useFeaturePermission(route)` fetches on every call, once per distinct route — using it for 8+ cards on
one page would mean 8+ parallel identical network calls. New hook
`Front/src/shared/hooks/usePermissions.ts` fetches `getMyPermissions()` once and returns
`{ role, featurePermissions, pagePermissions, loading, error, hasFeatureAccess(route: string): boolean }`,
where `hasFeatureAccess` = `role === "Administrator" || featurePermissions.some(p => p.featureRoute ===
route)`. `useFeaturePermission` is left untouched (still useful for a single ad-hoc check) but is not
used by this change's new components — mirrors existing repo convention of small focused hooks without
introducing a caching/query library (this codebase has no react-query; each hook consumer does its own
fetch, matching `useTeamAndClub`, `useUserTeams`, etc.).

### 2. Frontend route catalog mirrors backend `CoachFeatureRoutes.cs` as literal strings

New `Front/src/apps/coach/constants/featureRoutes.ts` exports a `const` object with the same route
string values as the backend catalog (`/coach/squad`, `/coach/attendance`, ...). This is a plain
TypeScript object (not fetched from the backend) because the mapping is structural/compile-time, exactly
like the backend's `static class` of `const string`. Duplicated as data (not code) across the two repos
— acceptable since `FeatureRoute` values are described in both places as "stable logical identifiers"
that change rarely and are already tested end-to-end via `GetMyPermissions` responses.

### 3. Route guard: new `RequireFeaturePermission` component, `ProtectedRoute` left as-is

`ProtectedRoute.tsx` is unused by `routes.tsx` today (routes.tsx uses `CoachAuthGuard` from
`CoachAuthContext.tsx` instead, wrapping the whole `<Routes>` tree once). Feature-permission checking
must happen per-route (different routes need different `featureRoute` values), so a single wrapper
around the whole tree can't do it. New `Front/src/apps/coach/components/RequireFeaturePermission.tsx`
takes a `featureRoute` prop and wraps individual `<Route element={...}>` values in `routes.tsx`:

```tsx
<Route path="settings" element={<RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.Settings}><Settings /></RequireFeaturePermission>} />
```

While `usePermissions()` is loading, the guard renders the existing `LoadingFallback`-style spinner (not
the blocked redirect) to avoid a flash-redirect before permissions arrive. On resolved `!hasAccess`, it
calls `<Navigate to="/coach/dashboard" replace />` and dispatches
`window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: '...', severity:
'warning' } }))` once (via a `useEffect`), consistent with the project's event-bus convention for
cross-cutting notifications.

Routes NOT wrapped (deliberately, to avoid breaking flows unrelated to the 8-vs-blocked distinction):
`dashboard`, `team-dashboard` (both accessible to everyone, they self-filter their cards), onboarding /
identity-verification-adjacent routes not present in `routes.tsx` today, and any route with no
catalogued `FeatureRoute` mapping.

### 4. Route-to-featureRoute mapping (frontend routes.tsx → backend CoachFeatureRoutes)

Sub-pages inherit their parent feature area's route since the backend catalog is granular at the
feature-area level, not the page level:

| routes.tsx path(s) | featureRoute constant |
|---|---|
| `settings` | `Settings` (blocked) |
| `news` | `News` (allowed) |
| `squad`, `squad/new`, `squad/players-club`, `squad/:playerId/rating/*`, `player/:id` | `Squad` (allowed) |
| `attendance`, `attendance/:id` | `Events` (allowed) |
| `attendance/summary` | `AttendanceSummary` (allowed) |
| `convocations`, `convocations/match` | `Convocations` (allowed) |
| `trainings`, `trainings/new-exercise` | `Trainings` (blocked) |
| `injured` | `Injured` (allowed) |
| `game-model`, `game-model/create`, `game-model/edit`, `game-model/create-session`, `game-model/sessions` | `GameModel` (blocked; ClubMember allowed) |
| `sanctions` | `Sanctions` (allowed) |
| `lottery` | `Lottery` (allowed) |
| `rivals` | `Rivals` (blocked) |
| `season-access`, `season-access/prepare` | `SeasonAccess` (blocked) |
| `clubs`, `clubs/new`, `clubs/dashboard/:id` | `ClubManagement` (blocked) |
| `clubs/:id/players` | `ClubPlayers` (blocked) |
| `clubs/:id/registrations` | `ClubRegistrations` (blocked) |
| `clubs/:id/teams`, `clubs/:id/teams/new`, `clubs/:id/teams/:teamId/edit` | `ClubTeams` (blocked) |

### 5. Card components: replace ad-hoc booleans with `hasFeatureAccess`

`TeamDashboardCards.tsx` gains a `usePermissions()` call; every card is wrapped in
`{hasFeatureAccess(COACH_FEATURE_ROUTES.X) && <DashboardCard .../>}`, replacing `canSeeGameModel` and
`!isPlayer` (SeasonAccess). `DashboardCards.tsx`'s Settings card conditional becomes
`hasFeatureAccess(COACH_FEATURE_ROUTES.Settings)` instead of `!isPlayer`; the rest of that file's
`isPlayer`-driven "Acceso Rápido" section visibility is untouched (it's about team quick-links, not a
catalogued feature route, so out of scope). Both `isPlayer` props remain as-is for backward
compatibility with existing callers/tests not touched by this change.

## Risks / Trade-offs

- [Risk] Wrapping ~25 `<Route>` elements individually in `routes.tsx` is a large mechanical diff →
  [Mitigation] one line per route, data-driven via the table above, verified by `npm run build` +
  targeted route-guard tests per representative allowed/blocked pair (not exhaustive per-route tests).
- [Risk] `usePermissions()` fetching independently in both the dashboard cards and the route guard means
  2 network calls per page instead of 1 (no shared cache/context) → [Mitigation] acceptable: matches
  existing repo convention (no query-caching library), 1 extra lightweight GET per navigation is a minor
  cost; a shared `PermissionsContext` is a valid future optimization but adds cross-cutting state not
  justified by this change's scope.
- [Risk] Missing the `Administrator` empty-list special case would silently break the dashboard for
  Administrator → [Mitigation] explicit unit test asserts Administrator sees all cards despite an empty
  `featurePermissions` fixture.
- [Risk] Flash of blocked content before the permission fetch resolves → [Mitigation] guard renders a
  loading spinner (not the protected content) while `loading === true`.

## Migration Plan

1. Add `Front/src/apps/coach/constants/featureRoutes.ts`.
2. Add `Front/src/shared/hooks/usePermissions.ts` (+ test).
3. Add `Front/src/apps/coach/components/RequireFeaturePermission.tsx` (+ test).
4. Update `TeamDashboardCards.tsx` and `DashboardCards.tsx` (+ update/extend existing tests).
5. Wire the guard onto routes in `routes.tsx` per the mapping table.
6. `npm run build` + `npm run test`.
7. Rollback: pure code revert, no data/schema involved.

## Open Questions

None outstanding — the backend's `CoachFeatureRoutes.cs` catalog and `GetMyPermissions` contract are
finalized and confirmed against by direct inspection.
