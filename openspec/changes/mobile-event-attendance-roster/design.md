## Context

**Current state**: `EventDetailScreen.tsx` fetches `GET /api/events/{eventId}/convocations` (the Coach convocations endpoint), filters client-side for the row matching `teamPlayerId` from route params, and shows only that one row with "Voy"/"No voy" buttons that call `POST /api/mobile/events/{eventId}/attendance`.

**Backend facts gathered from the codebase** (not assumptions):
- `AttendanceStatus` (`Domain/Entities/AttendanceStatus.cs`): `Pending=0`, `Going=1`, `NotGoing=2`.
- `EventAttendanceConfirmation` (`Domain/Entities/EventAttendanceConfirmation.cs`): `SportEventId`, `TeamPlayerId`, `ConfirmedByApplicationUserId`, `AttendanceStatusId`, `RespondedAt`. No row exists until a player/family member confirms — absence means "Pending".
- `ConfirmAttendance.cs`'s `ConfirmAttendanceCommand` implements both `IRequireFeaturePermission` (`FeatureRoute = CoachFeatureRoutes.AttendanceConfirmation = "/mobile/attendance"`, `RequiredPermission = "Write"`) and `IRequireTeamMembership`. Seeded `FeaturePermission` rows for this route (`WebApplicationExtensions.cs:429-430`) only grant `Player` and `FamilyMember` ReadWrite(3) — **Coach has no row for this route today**, so a Coach calling this endpoint would be 403'd by `FeaturePermissionBehavior` before even reaching the handler's `isOwnPlayer` check. Administrator bypasses `FeaturePermissionBehavior` unconditionally (`FeaturePermissionBehavior.cs:42`).
- `TeamMembershipBehavior` (`IRequireTeamMembership`) only enforces membership for `Player`/`FamilyMember` roles; Coach/Administrator/others bypass it automatically (`TeamMembershipBehavior.cs:20,29`).
- `UserTeam.LinkedTeamPlayerId` is the single field used both for a Player's own `TeamPlayerId` and for a FamilyMember's linked player — there's no separate "own player" concept to resolve.
- `AppRoles` (`Domain/Entities/AppRoles.cs`): confirmed role names `Administrator`, `Coach`, `ClubDirector`, `Player`, `FamilyMember`, `ClubMember`, `Federation`, `Fan`.
- JWT roles are embedded under the claim key **`"roles"`** (not `ClaimTypes.Role`) as a string array, set in `TokenService.GenerateJwtForUser` (`claims["roles"] = roleNames`), signed HS256 via Jose-JWT. Mobile's `/api/mobile/login` issues the exact same token type (`MobileLogin.cs` calls the same `ITokenService.GenerateJwtForCredentials`).
- `GetTeamPlayersForSelection.cs` (`GET /api/catalog/team/{teamId}/players-for-selection`) is a precedent for a team-roster endpoint gated by nothing but `.RequireAuthorization()` — shows the codebase already has "list team players" endpoints without feature-permission gates when appropriate.

## Goals / Non-Goals

**Goals:**
- Show every convocated player's attendance status on `EventDetailScreen.tsx`, for every role.
- Let Player/FamilyMember edit only their own player's status (existing behavior, unchanged).
- Let Coach/Administrator edit any player's status.
- Localize the status label (`Going`/`NotGoing`/`Pending`) to the device's language via new, reusable Mobile i18n infrastructure.

**Non-Goals:**
- No changes to the Coach convocations feature, its statuses, or its `FeaturePermission` rows.
- No new roles or a general-purpose permissions UI in Mobile — only enough role-awareness to gate this screen's edit buttons.
- No translation of the entire Mobile app in this change — only the attendance status strings are migrated to the new i18n system; other screens keep their hardcoded Spanish strings until a future change migrates them.
- No server-side authorization changes beyond what's needed for Coach to reach parity with Administrator on this one feature route.

## Decisions

1. **New query endpoint reuses the existing `AttendanceConfirmation` feature route** (`CoachFeatureRoutes.AttendanceConfirmation`) with `IRequireFeaturePermission` (`RequiredPermission = "Read"`) + `IRequireTeamMembership`, instead of inventing a new permission concept. Player/FamilyMember already hold ReadWrite(3) on this route (satisfies Read). Once Coach gets a new ReadWrite(3) row (decision 2), Coach satisfies Read too. Administrator bypasses the permission check entirely already.
   - *Alternative considered*: gate with a brand-new `FeatureRoute`. Rejected — no behavioral difference needed between reading and writing attendance; reusing the route keeps the permission model simple and avoids a migration adding two rows instead of one.

2. **Seed one new `FeaturePermission` row**: `("AttendanceConfirmation", CoachFeatureRoutes.AttendanceConfirmation, "Coach", 3, false)` in `WebApplicationExtensions.cs`, next to the existing Player/FamilyMember rows. This is the only permission-table change required — Administrator already bypasses the check, and Player/FamilyMember are unaffected.

3. **Relax `ConfirmAttendance.cs`'s handler**: after the `FeaturePermissionBehavior` and `TeamMembershipBehavior` pipeline steps pass, the handler's `isOwnPlayer` check becomes: allow if `isOwnPlayer` OR `currentUser.Roles` contains `Administrator` or `Coach` (case-insensitive, matching the existing `AppRoles` constants). All other roles keep the strict "own player" requirement.

4. **New read query**: `GetEventAttendanceRoster` (vertical slice under `Features/Mobile/Attendance/Queries/`), returns `TeamPlayerId, Alias, UrlPhoto, Dorsal, Status (string), StatusId (int)` for every `TeamPlayer` on the event's team, left-joined with `EventAttendanceConfirmation` for that event, defaulting to `AttendanceStatus.Pending` when no confirmation row exists. Modeled after `GetTeamPlayersForSelection.cs`'s query shape (same team-roster join pattern) but scoped to one event and status-aware.

5. **Mobile role detection**: decode the `"roles"` claim from the stored JWT client-side using the `jwt-decode` package (new, small, pure-JS dependency — no signature verification needed client-side since the token was already validated server-side at issuance and every write is re-validated server-side anyway; this is purely for UI gating). A `getCurrentUserRoles()` helper in `Mobile/src/auth/` reads the token from `AuthContext`/`SecureStore` and returns the decoded roles array.
   - *Alternative considered*: add a `/api/mobile/me` endpoint returning the current user's roles. Rejected — the JWT already carries this, and adding a network round-trip for information already available locally is unnecessary given `jwt-decode`'s small footprint.

6. **Own-player identification client-side**: `EventDetailScreen.tsx` already receives `teamPlayerId` via route params (the caller's own player, resolved earlier in `TeamSwitcherScreen`/navigation params). The roster row matching that `teamPlayerId` shows edit buttons for Player/FamilyMember; Coach/Administrator get edit buttons on every row.

7. **i18n infrastructure**: add `expo-localization` (device locale via `Localization.getLocales()`) + `i18n-js` (dictionary-based `t()` translator) under a new `Mobile/src/i18n/` module: `Mobile/src/i18n/index.ts` (i18n instance wired to device locale, fallback `es`) and `Mobile/src/i18n/translations/{es,en}.json` (or `.ts`) holding at minimum the three attendance status keys. `EventCard`-adjacent status rendering calls `t('attendance.going')` etc. instead of hardcoded strings.
   - *Alternative considered*: hand-rolled `t()` function with a plain object switch, no new dependency. Rejected per explicit user request for "i18n completo para toda la app" — a real library keeps the door open for interpolation/pluralization needs in future screens without a rewrite.

## Risks / Trade-offs

- **[Risk] Client-side-only role gating is not a security boundary** → mitigated by the fact that the actual write endpoint (`ConfirmAttendance.cs`) re-checks roles/ownership server-side (decision 3); the Mobile UI gating only controls what buttons are *shown*, never the actual authorization outcome.
- **[Risk] `jwt-decode` assumes the stored token is well-formed** → if decoding fails (malformed/missing token), `getCurrentUserRoles()` returns an empty array, which is treated the same as "no elevated role" (edit buttons only on own row, or none if `teamPlayerId` is also missing) — fails closed, not open.
- **[Risk] Adding two new Mobile dependencies** (`expo-localization`, `i18n-js`) for a small initial string set → accepted per user's explicit choice of app-wide i18n infrastructure over a minimal one-off translator.
- **[Risk] `EventDetailScreen.tsx` behavior change is a rewrite, not additive** → existing tests in `EventDetailScreen.test.tsx` assert single-convocation behavior; they will be replaced (not extended) as part of Red-Green-Refactor, per the same pattern used in the `mobile-events-cards` change.

## Migration Plan

- Backend: new query feature file + one seed-data addition (idempotent — `WebApplicationExtensions.cs`'s seeding loop already skips rows that exist via `db.FeaturePermissions.Any(...)` check) + handler change in `ConfirmAttendance.cs`. No destructive migration; `FeaturePermissions` seeding runs on app startup.
- Mobile: additive dependencies + new i18n module + `EventDetailScreen.tsx` rewrite. No data migration needed (attendance data model unchanged).

## Open Questions

(none — resolved above)
