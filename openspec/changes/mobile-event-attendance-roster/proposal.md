## Why

`Mobile/src/screens/EventDetailScreen.tsx` only shows the logged-in user's own convocation and lets them confirm "Voy"/"No voy" for themselves. Coaches and families need to see the full roster's attendance at a glance, and coaches/admins need to be able to correct a player's status on their behalf (e.g. a parent calls the coach instead of using the app). Today the backend hard-blocks any write that isn't the caller's own player (`ConfirmAttendance.cs` throws `ForbiddenAccessException`), and no endpoint returns all players' attendance status for an event — only the coach-facing convocations endpoint exists, which uses a different status vocabulary (Pendiente/excuses) and is intentionally being kept separate. Additionally, attendance status labels are hardcoded in English (`Going`/`NotGoing`) with no device-locale awareness, and Mobile has no i18n infrastructure at all.

## What Changes

- **Backend — new read endpoint**: `GET /api/mobile/events/{eventId}/attendance-roster` (or similar), returning every team player for the event's team plus their `EventAttendanceConfirmation` status (`Going`/`NotGoing`/`Pending` when no confirmation exists yet). Reuses the existing `AttendanceConfirmation` feature route/permission gate (`IRequireFeaturePermission` Read + `IRequireTeamMembership`) — no new permission concept.
- **Backend — relax write restriction**: `ConfirmAttendance.cs`'s handler currently forces `isOwnPlayer` for every caller. Add a bypass for **Administrator** (already bypasses `FeaturePermissionBehavior` entirely) and **Coach** (needs a new seeded `FeaturePermission` row for the `AttendanceConfirmation` route, since Coach has none today) — both roles may confirm/edit any team player's attendance; all other roles keep the existing "only your own linked player" restriction.
- **Mobile — roster UI**: `EventDetailScreen.tsx` renders the full list of convocated players with their status. "Voy"/"No voy" buttons are shown only on the row for the caller's own player (Player/FamilyMember roles), or on every row for Coach/Administrator. Role is read from the `"roles"` claim already embedded in the JWT issued at login (same token family as Coach web) — no new auth endpoint needed.
- **Mobile — i18n infrastructure (new, app-wide)**: introduce `expo-localization` (device locale detection) + `i18n-js` (translation library) with an initial `es`/`en` dictionary, wired at the app root so any screen can adopt it going forward. Attendance status labels (`Going`/`NotGoing`/`Pending`) are the first strings migrated, rendered in the device's language.

## Capabilities

### New Capabilities
- `mobile-attendance-roster`: Mobile event detail screen shows every player's attendance status for an event, with edit rights scoped by role (own player vs. Coach/Administrator any player), status labels localized to the device language.

### Modified Capabilities
(none — no existing spec covers Mobile attendance or event-detail; no changes to the Coach convocations spec/behavior)

## Impact

- **Backend**: new query feature under `Back/ExtractionApi/.../Features/Mobile/Attendance/Queries/` (or similar vertical slice); `ConfirmAttendance.cs` handler logic change; one new `FeaturePermission` seed row for `Coach` on the `AttendanceConfirmation` route (`WebApplicationExtensions.cs`).
- **Mobile**: `Mobile/src/screens/EventDetailScreen.tsx` rewritten to a roster view; new i18n module (`Mobile/src/i18n/` or similar) + two new dependencies (`expo-localization`, `i18n-js`); a way to read roles from the stored JWT (new small utility, no new login endpoint).
- No changes to Coach web (`Front/src/apps/coach`) or the Coach convocations feature.
