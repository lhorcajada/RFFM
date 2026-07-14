## Why

The backend change `restrict-player-role-coach-features` now enforces at the API level that a `Player`
role may only read the 8 approved Coach dashboard features (Squad, Events, AttendanceSummary,
Convocations, Injured, Sanctions, Lottery, News) via `GET /api/permissions/me` and 403s on everything
else. Today the frontend hides only one card ("Club") via a hardcoded `!isPlayer` check in
`DashboardCards.tsx`, and `ProtectedRoute.tsx` only checks `isAuthenticated` — a Player can still see
and navigate directly (by URL) to every other Coach dashboard card/page. We need the frontend to mirror
the real permission set so the UI is consistent with what the API actually allows, instead of relying on
a second, drifting hardcoded list.

## What Changes

- Add a shared `usePermissions()` hook that calls `GET /api/permissions/me` once (via the existing Axios
  singleton) and exposes the caller's `featurePermissions` (route + permission type) with loading/error
  state, following the existing hook pattern in the coach app.
- Replace the hardcoded `!isPlayer` filter in `DashboardCards.tsx` with a permission-driven filter:
  a card is shown only if the current user's `featurePermissions` include its `featureRoute` (or the
  user's role bypasses the check, e.g. Administrator/Coach/ClubDirector, mirroring backend semantics).
- Add a route guard (extend `ProtectedRoute.tsx` or introduce a sibling `RequireFeaturePermission`
  guard) so direct URL navigation to a route lacking a matching permission redirects instead of
  rendering page content.
- **BREAKING** (intentional, cosmetic-to-real): a `Player` who could previously view non-allowed pages by
  typing the URL will now be redirected; this matches the API's existing 403 behavior for those same
  actions.

## Capabilities

### New Capabilities
- `coach-dashboard-permission-ui`: Frontend consumption of `GET /api/permissions/me` to drive Coach
  dashboard card visibility and route-level access guarding, scoped to `Front/src/apps/coach`.

### Modified Capabilities
(none — no existing `openspec/specs/` capability governs Coach frontend permission UI yet)

## Impact

- New: `Front/src/apps/coach/hooks/usePermissions.ts` (+ test)
- `Front/src/apps/coach/pages/Dashboard/components/DashboardCards.tsx` (+ test) — replace hardcoded
  `!isPlayer` filter with permission-driven filter
- `Front/src/apps/coach/components/ProtectedRoute.tsx` (+ test) or a new sibling guard component — add
  feature-permission check for direct URL access
- `Front/src/apps/coach/routes.tsx` — wire the new/extended guard onto routes that map to a catalogued
  `FeatureRoute`
- Out of scope: building real Sanctions/Lottery/News backend APIs (per backend design.md, these are
  seeded permissions with no backend yet); this change only ensures their cards/routes are treated
  consistently with the other 8 allowed features if/where they already exist in the frontend.
