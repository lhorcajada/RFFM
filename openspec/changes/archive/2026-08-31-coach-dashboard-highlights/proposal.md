## Why

The Coach web dashboard (`Front/src/apps/coach/pages/team-dashboard`) will gain an "A la vista" section
(upcoming events + news) so coaches and players/family see what matters without opening a
sub-page. Two of the three data needs are new: (1) a reusable attendance-summary aggregate
(convocados/aceptados/pendientes/rechazados/%) that today's per-player rosters (`GetSportEvents`,
`GetEventConvocations`, `GetEventAttendanceRoster`) don't compute, needed both for the new widget
and for badges on the existing Convocatorias/Attendance event cards; (2) a `POST
/api/coach/news/{id}/unpublish` endpoint — `PublishNews` exists but there is no way back to
Draft. This backend slice unblocks the frontend work.

**Correction to the original ask**: `Features/Coaches/News/*` already has full Create/Update/
Delete/Publish/GetDrafts/GetById (only Unpublish is missing), authorized by `Roles =
"Coach,Administrator"` — not creator-only. `NewsItem` has no `TeamId`/`ClubId`; it is federation-
wide content (`GetNews` is open to any authenticated role), so `IScopeAuthorizationService.
EnsureCreatorAsync`, which resolves a *team/club* scope, does not apply without adding a scope FK
to `NewsItem` — a bigger, unrequested schema change. See design.md Decision 4 and Open Questions.

## What Changes

- Add a reusable event-attendance-summary aggregate (convocados count, Going/Pending/NotGoing
  counts among convocados, attendance %, plus the caller's own status when Player/FamilyMember)
  exposed as one new batch query endpoint, consumed by both the new dashboard widget and the
  existing Convocatorias/Attendance event-card lists.
- Add `POST /api/coach/news/{id}/unpublish` (Draft ⇄ Published symmetry with existing `publish`).
- No change to `GetSportEvents`/`GetEventConvocations`/`GetEventAttendanceRoster` — they stay as
  today's per-event/per-player detail endpoints; the summary is additive, not a modification of
  their response shape.
- No change to News CRUD authorization (`Coach,Administrator` role check stays) — see Decision 4.
- **Frontend** (`Front/src/apps/coach/...`, this revision — see design.md "Frontend Design"):
  add an "A la vista" section to `TeamDashboard.tsx` with an upcoming-events widget (coach
  aggregate view vs. player/family own-status view, the latter with "Voy"/"No voy" quick actions —
  see below) and a latest-news widget; add attendance badges to the existing Convocatorias/
  Attendance event cards, reusing one shared hook/service so the attendance-summary endpoint is
  fetched once per page, not once per card; and build out the previously-empty `News.tsx` page
  into a full read (any role with the `News` feature route) / manage (Coach, Administrator)
  surface, plus a new read-only `NewsDetail.tsx` page linked from both the widget and the list.
- **Player/family attendance confirmation from Front** (widened scope, confirmed 2026-08-30): the
  upcoming-events widget's player/family view is interactive, not read-only — it lets the caller
  mark their own attendance (Going/NotGoing) via the existing `POST /api/mobile/events/{eventId}/
  attendance` endpoint, which investigation confirmed is already callable from Front as-is (no
  backend change; design.md Decision 14).

## Capabilities

### New Capabilities
- `event-attendance-summary`: batch endpoint returning per-event convocation/confirmation counts
  and percentage, reusable by any Coach-app surface that lists events.
- `coach-dashboard-widgets`: the "A la vista" section on the Coach team dashboard (upcoming
  events + latest news) and the attendance badges it introduces on existing event-card lists.

### Modified Capabilities
- `news`: adds the "Only Coach or Administrator can unpublish news" requirement (mirrors the
  existing publish requirement), plus the frontend management/read surface (list, create, edit,
  publish, unpublish, detail view) built against the existing and new News endpoints.

## Impact

- New file: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Queries/
  GetEventAttendanceSummary.cs` (new `IFeatureModule`).
- New file: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/News/UnpublishNews.cs`.
- No migrations — reuses `Convocation`, `EventAttendanceConfirmation`, `NewsItem` as they exist.
- Frontend: new service/hook/component files under `Front/src/apps/coach/services/`,
  `Front/src/apps/coach/hooks/`, `Front/src/apps/coach/components/`, and
  `Front/src/apps/coach/pages/{team-dashboard,news}/`; edits to
  `Front/src/apps/coach/pages/attendance/EventCard.tsx`,
  `Front/src/apps/coach/pages/convocations/{types.ts,helpers/convocationUtils.ts,
  components/MatchCard.tsx,Convocations.tsx}`, `Front/src/apps/coach/pages/attendance/
  Attendance.tsx`, `Front/src/apps/coach/pages/team-dashboard/TeamDashboard.tsx`,
  `Front/src/apps/coach/constants/featureRoutes.ts` (adds the pre-existing gap
  `AttendanceConfirmation` mirror), and `Front/src/apps/coach/routes.tsx`. **No backend files are
  touched by this frontend work** — both items that could have required a back-specialist
  dependency (attendance confirmation, federation match id resolution) were investigated and
  resolved to "reuse what already exists" (design.md Decisions 9 and 14). Full inventory and
  rationale in design.md's "Frontend Design" section; task breakdown in tasks.md §8-14b.
