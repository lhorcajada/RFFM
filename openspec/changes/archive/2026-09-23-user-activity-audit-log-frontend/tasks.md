## 0. Cross-team blocking dependency (do first, non-code)

- [x] 0.1 Request back-specialist to seed a `FeaturePermission`/`CoachFeatureRoutes` row for a new `AuditLog` feature route (`/coach/audit-log`) for `Coach`, `ClubDirector`, `Administrator` roles (see `design.md` Open Question 1). Do not proceed past task group 5 without this confirmed or explicitly deferred by the user.
- [x] 0.2 Confirm with the user (or default per `design.md` Open Question 2, 25 rows/page) the screens' own pagination page size before building the filter UI.

## 1. Shared service — `auditLogService.ts` (TDD)

- [x] 1.1 (Red) Write `shared/services/__tests__/auditLogService.test.ts`: `recordPageAccess` posts to `/api/audit-log/page-access` with the exact request shape via the shared Axios client (mocked); `searchAuditLog` gets `/api/audit-log` with query params, parses `X-Total-Count` header into `totalCount`, returns typed `items`.
- [x] 1.2 (Red) Add a test for `searchAuditLog` omitting `undefined` optional params from the query string (no `clubId=undefined` leaking through).
- [x] 1.3 (Green) Implement `shared/services/auditLogService.ts` per `design.md` Decision 5 — typed `RecordPageAccessRequest`, `AuditEventType`, `AuditLogSearchParams`, `UserActivityLogResponse`, `AuditLogSearchResult`; no `any`.
- [x] 1.4 Run `npm run test -- auditLogService` — verify green.

## 2. Shared hook — `useAuditPageAccess` (TDD)

- [x] 2.1 (Red) Write `shared/hooks/__tests__/useAuditPageAccess.test.ts`: mounting a test component calling the hook with a `pageIdentifier` calls the mocked `recordPageAccess` exactly once; a re-render with the same `pageIdentifier` does not call it again; a rejected `recordPageAccess` promise does not throw/propagate.
- [x] 2.2 (Red) Add a test: an empty-string `pageIdentifier` never calls `recordPageAccess`.
- [x] 2.3 (Green) Implement `shared/hooks/useAuditPageAccess.ts` per `design.md` Decision 3 (ref-guarded, swallowed `.catch`).
- [x] 2.4 Run `npm run test -- useAuditPageAccess` — verify green.

## 3. Shared component — `AuditLogView` (TDD)

- [x] 3.1 (Red) Write `shared/components/ui/AuditLogView/__tests__/AuditLogView.test.tsx`: renders loading state while `searchAuditLog` is pending; renders a card per returned event (role, user, translated event type in Spanish, timestamp, result, reason if present) once resolved; renders an explicit empty state on zero results; renders an error state on rejection; asserts no `<table>`/MUI `Table` element is present (`queryByRole("table")` must be null).
- [x] 3.2 (Red) Write a filters test: changing the event-type filter and submitting calls `searchAuditLog` again with the new `eventType` param; `fixedFilters` props are always included and cannot be overridden by the visible filter form.
- [x] 3.3 (Red) Write a pagination test: clicking "next page" calls `searchAuditLog` with an incremented `pageNumber` and reflects the `totalCount` from the response.
- [x] 3.4 (Green) Implement `shared/components/ui/AuditLogView/AuditLogView.tsx` + `AuditLogView.module.css` per `design.md` Decision 4 — responsive card/list layout, MUI theme tokens only, mobile-first (verify by hand at ~360-400px viewport).
- [x] 3.5 (Refactor) Extract the event-type-to-Spanish-label map to a small local constant/util if it grows past a simple object literal.
- [x] 3.6 Run `npm run test -- AuditLogView` — verify green.

## 4. Federation app wiring

- [x] 4.1 (Red) Write `apps/federation/pages/AuditLog/__tests__/AuditLog.test.tsx`: renders `AuditLogView` with no `fixedFilters`; wrapped in `<MemoryRouter>`.
- [x] 4.2 (Green) Implement `apps/federation/pages/AuditLog/AuditLog.tsx` (thin wrapper per `design.md` Decision 4).
- [x] 4.3 Add the `audit-log` route to `apps/federation/routes.tsx`, nested in `<RequireAuth requiredRoles={["Federation"]}>` (import from `core/router/RequireAuth`), plus the lazy import alongside the other Federation pages.
- [x] 4.4 (Red) Extend or add a `RequireAuth`/routing test asserting a `Player`-only or `FamilyMember`-only user cannot render the audit screen content at `/federation/audit-log` (reuse `RequireAuth.test.tsx` patterns).
- [x] 4.5 Run `npm run test -- federation` — verify green.

## 5. Coach app wiring

- [x] 5.1 Add `AuditLog: "/coach/audit-log"` to `apps/coach/constants/featureRoutes.ts` (`COACH_FEATURE_ROUTES`).
- [x] 5.2 (Red) Write `apps/coach/pages/audit-log/__tests__/AuditLog.test.tsx`: renders `AuditLogView`.
- [x] 5.3 (Green) Implement `apps/coach/pages/audit-log/AuditLog.tsx` (thin wrapper per `design.md` Decision 4).
- [x] 5.4 Add the `audit-log` route to `apps/coach/routes.tsx`, wrapped in `<RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.AuditLog} allowPlayerAccess={false}>`, plus the lazy import alongside the other Coach pages.
- [x] 5.5 (Red) Add/extend a `RequireFeaturePermission` test asserting a `Player`/`FamilyMember` user is redirected away from `/coach/audit-log` even with `allowPlayerAccess` defaulting differently elsewhere (confirm `false` is actually passed here).
- [x] 5.6 Run `npm run test -- coach` — verify green.

## 6. Page-access instrumentation — Federation app (11 sections)

- [x] 6.1 Add `useAuditPageAccess("Dashboard")` to `apps/federation/pages/Dashboard/Dashboard.tsx`.
- [x] 6.2 Add `useAuditPageAccess("Calendar")` to `apps/federation/pages/Calendar/GetCalendar.tsx`.
- [x] 6.3 Add `useAuditPageAccess("Classification")` to `apps/federation/pages/Classification/Classification.tsx`.
- [x] 6.4 Add `useAuditPageAccess("Squad")` to `apps/federation/pages/Squad/GetPlayers.tsx`.
- [x] 6.5 Add `useAuditPageAccess("Goleadores")` to `apps/federation/pages/Goleadores/Goleadores.tsx`.
- [x] 6.6 Add `useAuditPageAccess("Matchday")` to `apps/federation/pages/Matchday/Matchday.tsx`.
- [x] 6.7 Add `useAuditPageAccess("Callups")` to `apps/federation/pages/Callups/Callups.tsx`.
- [x] 6.8 Add `useAuditPageAccess("Settings")` to `apps/federation/pages/Settings/Settings.tsx`.
- [x] 6.9 Add `useAuditPageAccess("SavedConfigs")` to `apps/federation/pages/SavedConfigs/SavedConfigs.tsx`.
- [x] 6.10 Add `useAuditPageAccess("Statistics")` to `apps/federation/pages/Statistics/Statistics.tsx`.
- [x] 6.11 Add `useAuditPageAccess("AuditLog")` to `apps/federation/pages/AuditLog/AuditLog.tsx` (already created in task 4.2 — add the hook call there).
- [x] 6.12 (Red→Green per page, or one batched test file) Write/extend a smoke test per page (or a shared parametrized test) asserting `recordPageAccess` is called with the correct `pageIdentifier` on mount — do not skip this for "trivial" pages.
- [x] 6.13 Run `npm run test -- federation` — verify green.

## 7. Page-access instrumentation — Coach app (23 sections)

- [x] 7.1 Add `useAuditPageAccess("Dashboard")` to `apps/coach/pages/Dashboard/Dashboard.tsx`.
- [x] 7.2 Add `useAuditPageAccess("TeamDashboard")` to `apps/coach/pages/team-dashboard/TeamDashboard.tsx`.
- [x] 7.3 Add `useAuditPageAccess("TeamUsers")` to `apps/coach/pages/team-users/TeamUsers.tsx`.
- [x] 7.4 Add `useAuditPageAccess("Settings")` to `apps/coach/pages/settings/Settings.tsx`.
- [x] 7.5 Add `useAuditPageAccess("News")` to `apps/coach/pages/news/News.tsx`.
- [x] 7.6 Add `useAuditPageAccess("Squad")` to `apps/coach/pages/squad/Squad.tsx`.
- [x] 7.7 Add `useAuditPageAccess("Events")` to `apps/coach/pages/attendance/Attendance.tsx`.
- [x] 7.8 Add `useAuditPageAccess("AttendanceSummary")` to `apps/coach/pages/attendance/AttendanceSummary.tsx`.
- [x] 7.9 Add `useAuditPageAccess("Convocations")` to `apps/coach/pages/convocations/Convocations.tsx`.
- [x] 7.10 Add `useAuditPageAccess("Trainings")` to `apps/coach/pages/trainings/Trainings.tsx`.
- [x] 7.11 Add `useAuditPageAccess("Injured")` to `apps/coach/pages/injured/Injured.tsx`.
- [x] 7.12 Add `useAuditPageAccess("GameModel")` to `apps/coach/pages/game-model/GameModel.tsx`.
- [x] 7.13 Add `useAuditPageAccess("TeamRulesDocument")` to `apps/coach/pages/team-rules/TeamRules.tsx`.
- [x] 7.14 Add `useAuditPageAccess("Sanctions")` to `apps/coach/pages/sanctions/Sanctions.tsx`.
- [x] 7.15 Add `useAuditPageAccess("MyDocuments")` to `apps/coach/pages/my-documents/MyDocuments.tsx`.
- [x] 7.16 Add `useAuditPageAccess("PlayerDocuments")` to `apps/coach/pages/player-documents/PlayerDocumentsTracking.tsx`.
- [x] 7.17 Add `useAuditPageAccess("Lottery")` to `apps/coach/pages/lottery/Lottery.tsx`.
- [x] 7.18 Add `useAuditPageAccess("Rivals")` to `apps/coach/pages/rivals/Rivals.tsx`.
- [x] 7.19 Add `useAuditPageAccess("SeasonAccess")` to `apps/coach/pages/season-access/SeasonAccess.tsx`.
- [x] 7.20 Add `useAuditPageAccess("ClubManagement")` to `apps/coach/pages/clubs/clubs.tsx`.
- [x] 7.21 Add `useAuditPageAccess("ClubPlayers")` to `apps/coach/pages/clubs/players/ClubPlayers.tsx`.
- [x] 7.22 Add `useAuditPageAccess("ClubTeams")` to `apps/coach/pages/clubTeams/ClubTeams.tsx`.
- [x] 7.23 Add `useAuditPageAccess("ClubRegistrations")` to `apps/coach/pages/clubs/registrations/PlayerRegistrations.tsx`.
- [x] 7.24 Add `useAuditPageAccess("AuditLog")` to `apps/coach/pages/audit-log/AuditLog.tsx` (already created in task 5.3 — add the hook call there).
- [x] 7.25 (Red→Green per page, or one batched test file) Write/extend a smoke test per page (or a shared parametrized test) asserting `recordPageAccess` is called with the correct `pageIdentifier` on mount.
- [x] 7.26 Run `npm run test -- coach` — verify green.

## 8. Final verification

- [x] 8.1 Run the full suite: `npm run test`.
- [x] 8.2 Run `npm run build` — verify no TypeScript strict errors, no `any` introduced.
- [x] 8.3 Manually check both `AuditLogView` renders at a ~360-400px viewport (mobile) and at desktop width — confirm card/list layout, no horizontal scroll, no table.
- [x] 8.4 Add/extend Playwright coverage for the two new screens' critical path (navigate to `/coach/audit-log` and `/federation/audit-log` as an allowed role, see the list render; as a disallowed role, confirm redirect) if the project's Playwright suite already covers comparable Coach/Federation flows — otherwise flag as a follow-up, do not skip silently.
- [x] 8.5 Run `openspec validate user-activity-audit-log-frontend --strict` — confirm no errors before requesting review.
