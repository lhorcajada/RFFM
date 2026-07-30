## 1. Backend: attendance roster query

- [x] 1.1 (RED) xUnit test for `GetEventAttendanceRoster` handler: returns every `TeamPlayer` of the event's team with `Pending` status when no `EventAttendanceConfirmation` exists, and the correct status when one does
  - Added `tests/RFFM.Api.Tests/UnitTests/GetEventAttendanceRosterHandlerTests.cs` (integration-style, real Postgres test container via `PostgresCollection`/`PostgresContainerFixture`, seeding modeled on `ConfirmAttendanceHandlerTests.SeedTeamAndPlayerAsync`). Three cases: no-confirmation → `Pending`, existing confirmation → that status, and a mixed two-player roster asserting per-player status independence.
- [x] 1.2 (GREEN) Implement `GetEventAttendanceRoster` vertical-slice feature (`Features/Mobile/Attendance/Queries/`): endpoint `GET /api/mobile/events/{eventId}/attendance-roster`, `IRequireFeaturePermission` (`FeatureRoute = CoachFeatureRoutes.AttendanceConfirmation`, `RequiredPermission = "Read"`) + `IRequireTeamMembership`, response `TeamPlayerId, Alias, UrlPhoto, Dorsal, Status, StatusId`
  - `src/RFFM.Api/Features/Mobile/Attendance/Queries/GetEventAttendanceRoster.cs`. Endpoint resolves `TeamId` from the `SportEvent` (mirrors `GetEventConvocations.cs`'s pattern) before dispatching the query, so `IRequireTeamMembership` has a `TeamId` to check.
- [x] 1.3 (REFACTOR) Confirm query mirrors `GetTeamPlayersForSelection.cs`'s join pattern; extract shared bits only if trivial
  - Confirmed: same `TeamPlayers.Include(tp => tp.Player)` + `Where(tp => tp.TeamId == ...)` shape. No shared extraction — the confirmation left-join logic is specific to this feature and small enough to keep inline (vertical slice, one file).

## 2. Backend: Coach write parity

- [x] 2.1 (RED) xUnit test: `ConfirmAttendanceCommand` handler allows a Coach-role caller to confirm attendance for a player that isn't their own; still rejects a Player-role caller doing the same
  - Extended `tests/RFFM.Api.Tests/UnitTests/ConfirmAttendanceHandlerTests.cs` with `Handle_PlayerConfirmsAnotherPlayersAttendance_ThrowsForbiddenAccessException` (new, explicit Player-role-non-owner case), `Handle_CoachConfirmsAnotherPlayersAttendance_CreatesRecord` (Coach, no `UserTeam`/`LinkPlayer` link needed), `Handle_AdministratorConfirmsAnotherPlayersAttendance_CreatesRecord`. Pre-existing `Handle_FamilyMemberConfirmsUnlinkedPlayer_ThrowsForbiddenAccessException` left unchanged and still passes.
- [x] 2.2 (GREEN) Update `ConfirmAttendance.cs` handler: bypass `isOwnPlayer` when caller's roles include `Administrator` or `Coach` (`AppRoles` constants, case-insensitive)
  - `src/RFFM.Api/Features/Mobile/Attendance/Commands/ConfirmAttendance.cs`: `isOwnPlayer` is now `isPrivilegedRole || <existing UserTeam check>`, where `isPrivilegedRole` checks `currentUser.Roles` against `AppRoles.Administrator.Name`/`AppRoles.Coach.Name` case-insensitively. Player/FamilyMember behavior unchanged.
- [x] 2.3 (GREEN) Seed new `FeaturePermission` row in `WebApplicationExtensions.cs`: `("AttendanceConfirmation", CoachFeatureRoutes.AttendanceConfirmation, "Coach", 3, false)`
  - Added next to the existing Player/FamilyMember rows in `src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs` (idempotent seeding loop, no migration needed).
- [x] 2.4 Run `dotnet test` for the affected test project — 100% pass
  - `dotnet test --filter "FullyQualifiedName~Attendance"` → 10/10 passed. Full `dotnet test` → 233/233 passed (no regressions).

## 3. Mobile: i18n infrastructure

- [x] 3.1 Added `expo-localization`, `i18n-js` via `npx expo install`, plus `expo-localization` plugin in `app.config.ts`
- [x] 3.2 (RED) `Mobile/src/i18n/__tests__/index.test.ts`: Spanish default, English for `en` locale, fallback to Spanish for unsupported/missing locale
- [x] 3.3 (GREEN) `Mobile/src/i18n/index.ts` + `translations/es.ts` + `translations/en.ts` with `attendance.going/notGoing/pending` — 4/4 tests pass

## 4. Mobile: role detection

- [x] 4.1 Added `jwt-decode` dependency
- [x] 4.2 (RED) `Mobile/src/auth/__tests__/roles.test.ts` (`getRolesFromToken`) + extended `AuthContext.test.tsx` with a `roles` probe
- [x] 4.3 (GREEN) `Mobile/src/auth/roles.ts` (`getRolesFromToken`, decodes `"roles"` claim via `jwt-decode`, fails closed to `[]`) wired into `AuthContext.tsx` as a new `roles: string[]` field (memoized off `token`) — 4/4 + 5/5 tests pass

## 5. Mobile: EventDetailScreen roster UI

- [x] 5.1 (RED) Rewrote `Mobile/src/screens/__tests__/EventDetailScreen.test.tsx`: fetches `/api/mobile/events/{eventId}/attendance-roster`, renders every row with localized status (`t()` mocked to a fixed es dictionary for determinism), edit buttons only on own row for Player role, edit buttons on every row for Coach/Administrator, tapping a row's button posts that row's `teamPlayerId`
- [x] 5.2 (GREEN) Rewrote `Mobile/src/screens/EventDetailScreen.tsx`: fetches the roster, reads `roles` from `useAuth()`, `isPrivileged = roles include Administrator/Coach (case-insensitive)`, per-row `canEdit = isPrivileged || row.teamPlayerId === myTeamPlayerId`, status rendered via `Mobile/src/i18n`'s `t()`, optimistic local status update on successful confirm
- [x] 5.3 (REFACTOR) Kept inline (no sub-component) — the row markup is small enough; added a `status-{teamPlayerId}` testID to disambiguate status text from button labels once both render the same localized word
- Note: added `expo-localization` to `jest.config.js`'s `transformIgnorePatterns` (needed once a test imports something that transitively pulls in `Mobile/src/i18n`, since jest-expo doesn't transform it by default)

## 6. Verification

- [x] 6.1 `dotnet build` — 0 errors (full `dotnet test` — 233/233 — already verified by the backend agent for tasks 1-2; no backend files changed since)
- [x] 6.2 `cd Mobile && npx jest` — 57/57 pass, no skipped tests
- [x] 6.3 `cd Mobile && npx tsc --noEmit` — no errors outside `__tests__` (same pre-existing `@types/jest` gap noted in `mobile-events-cards`)
- [x] 6.4 Confirmed via `git status` — only `Back/ExtractionApi`, `Mobile/`, and `openspec/` changed; no `Front/` files touched

## 7. Follow-up: player card photo

- [x] 7.1 (RED) `EventDetailScreen.test.tsx`: row shows an `Image` (`player-photo-{teamPlayerId}`) with `source.uri = row.urlPhoto` when present, a placeholder (`player-photo-placeholder-{teamPlayerId}`) when absent
- [x] 7.2 (GREEN) `EventDetailScreen.tsx`: each row header shows the player's photo (circular `Image`) when `urlPhoto` is present, otherwise a placeholder circle — same visual language as `EventCard`'s `ShieldImage`
- [x] 7.3 Full suite re-run: 59/59 Mobile tests pass; `tsc --noEmit` clean outside `__tests__`

## 8. Follow-up: photo URL resolution (relative storage paths)

- Root cause: `Player.UrlPhoto` is a full `https://` URL only in Supabase storage mode; in local storage mode (default in Development) it's a bare relative path (e.g. `players/{clubId}/{guid}.jpg`), not directly loadable by `<Image>`. Coach web already works around this (`Front/src/apps/coach/pages/rivals/Rivals.tsx`'s `publicImageUrl` rewrites relative paths to `/api/public/storage?url=...`, an existing unauthenticated backend endpoint `GetPublicStorageFile.cs`); Mobile had no equivalent.
- [x] 8.1 (RED) `Mobile/src/utils/__tests__/resolvePhotoUrl.test.ts`: null/empty → null; absolute http(s) URL → unchanged; relative path → proxied through `{apiBaseUrl}/api/public/storage?url=<encoded>`
- [x] 8.2 (GREEN) `Mobile/src/utils/resolvePhotoUrl.ts` + exported `API_BASE_URL` from `Mobile/src/api/client.ts`; wired into `EventDetailScreen.tsx`'s photo `<Image>` (both the "has photo" and "resolves relative path" cases covered in `EventDetailScreen.test.tsx`)
- [x] 8.3 Full suite re-run: 64/64 Mobile tests pass; `tsc --noEmit` clean outside `__tests__`
- [x] 8.4 Fixed the same gap in `Mobile/src/screens/components/EventCard.tsx`'s `ShieldImage` (calendar match shields, `teamPhotoUrl`/`rivalPhotoUrl`): now resolved through the same `resolvePhotoUrl` helper before rendering. (RED) 3 new `EventCard.test.tsx` cases (absolute URL unchanged, relative path proxied, placeholder when no photo, using `shield-left`/`shield-right`/`shield-{side}-placeholder` testIDs). (GREEN) `ShieldImage` now takes a `testIDPrefix` and calls `resolvePhotoUrl(src, API_BASE_URL)`. 67/67 Mobile tests pass; `tsc --noEmit` clean outside `__tests__`.

## 9. Follow-up: own player always first

- [x] 9.1 (RED) `EventDetailScreen.test.tsx`: roster returned with the caller's own player NOT first (API order: other player, then own player) still renders own player's row (`roster-row-{teamPlayerId}`) first, for both a Player role and a Coach role (order doesn't matter for Coach/Admin, but showing own row first is harmless and simpler than branching)
- [x] 9.2 (GREEN) `EventDetailScreen.tsx`: added `testID={`roster-row-${row.teamPlayerId}`}` to each row; roster is sorted (`orderedRoster`, stable sort, own `teamPlayerId` first, all others keep their relative order) before rendering, applied unconditionally regardless of role
- [x] 9.3 Full suite re-run: 69/69 Mobile tests pass; `tsc --noEmit` clean outside `__tests__`

## 10. Follow-up: cromo-style cards grouped by status

- Redesigned `EventDetailScreen.tsx`: rows are now "cromo" trading-card style (photo left, dorsal badge overlay, accent line + name, mirroring Coach web's `PlayerCromo.tsx`/`.module.css`), grouped into three collapsible sections in fixed order: Pendientes, Asisten, No asisten — each with a tappable header showing a translated label + player count (`attendanceGroups.*` i18n keys added to `es.ts`/`en.ts`).
- Own player sorted first within whichever group they belong to (not across groups, since a player is only ever in one status group at a time).
- Initial expansion: exactly one group expanded on load — the group containing the caller's own player (Player/FamilyMember), or always "Pendientes" for Coach/Administrator regardless of where their own player (if any) sits.
- Tapping a group header toggles it independently (multiple groups can be open at once; not a single-open accordion, since nothing required that constraint).
- When a status change is confirmed (self or by Coach/Admin for someone else), the destination group is auto-expanded so the moved player stays visible instead of disappearing into a collapsed section.
- [x] 10.1 (RED) Full rewrite of `EventDetailScreen.test.tsx`: group headers/counts, per-role initial expansion (own group vs. always-Pending for Coach/Admin), toggle expand/collapse, own-player-first within group, photo/placeholder (carried over from section 8), edit-button visibility per role (carried over from section 5), confirm-attendance moves row + auto-expands destination group
- [x] 10.2 (GREEN) Rewrote `EventDetailScreen.tsx`: `GROUP_ORDER` constant, `expandedGroups` state (`Partial<Record<GroupStatus, boolean>>`) initialized once via an `expansionInitialized` ref on first successful fetch, `toggleGroup`, cromo-style card layout/styles
- [x] 10.3 Full suite re-run: 70/70 Mobile tests pass; `tsc --noEmit` clean outside `__tests__`
