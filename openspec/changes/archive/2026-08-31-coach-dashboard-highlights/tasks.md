## 1. GetEventAttendanceSummary — query, validator, aggregation (~2h)

- [x] 1.1 Create `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/SportEvents/Queries/
      GetEventAttendanceSummary.cs` as a new `IFeatureModule`: `GET /api/sport-events/
      attendance-summary?teamId={teamId}&eventIds={csv}`, parsing `eventIds` from a
      comma-separated query string into `string[]`.
- [x] 1.2 Define `EventAttendanceSummaryQuery : IQueryApp<EventAttendanceSummaryResponse[]>,
      IRequireFeaturePermission, IRequireTeamMembership` with `FeatureRoute =
      CoachFeatureRoutes.Events`, `RequiredPermission = "Read"`.
      Define `EventAttendanceSummaryResponse(string EventId, int Convocados, int Going, int
      Pending, int NotGoing, double AttendancePercentage, string? MyStatus, int? MyStatusId)`.
- [x] 1.3 Add a `FluentValidation` validator: `TeamId` not empty, `EventIds` not empty and
      `Length <= 50` (design.md Risk 1).
- [x] 1.4 Implement the handler: filter `SportEvents` to `TeamId == request.TeamId &&
      ids.Contains(Id)` first (design.md Decision 2) to derive the authorized event id set;
      query `Convocations.Where(c => authorizedEventIds.Contains(c.SportEventId))` grouped by
      `SportEventId` for `convocados`; query `EventAttendanceConfirmations.Where(...)` for the
      same event/teamPlayer pairs, defaulting missing rows to `AttendanceStatus.Pending`
      (mirror `GetEventAttendanceRoster.cs`'s default pattern); compute `Going`/`Pending`/
      `NotGoing` counts and `AttendancePercentage = convocados == 0 ? 0 :
      Math.Round(going * 100.0 / convocados, 1)`.
- [x] 1.5 Implement `MyStatus`/`MyStatusId` population (design.md Decision 3): if
      `currentUser.Roles` contains `Player` or `FamilyMember` (reuse
      `TeamMembershipBehavior`'s `RestrictedRoles` convention), resolve the caller's
      `UserTeam.LinkedTeamPlayerId` for `TeamId` once, then look up that player's own
      confirmation per event; otherwise leave both fields `null`.
- [x] 1.6 Verify no N+1: the handler issues a fixed, small number of queries (events, one
      grouped convocations query, one confirmations query, optional one `UserTeam` lookup) —
      not one query per event id.

## 2. GetEventAttendanceSummary — tests (~1.5h)

- [x] 2.1 xUnit: Coach requests summaries for 3 events on their team → `200 OK`, correct
      `convocados`/`going`/`pending`/`notGoing`/`attendancePercentage` per event.
- [x] 2.2 xUnit: event id belonging to a different team is silently omitted from the response.
- [x] 2.3 xUnit: event with zero `Convocation` rows → `convocados = 0`,
      `attendancePercentage = 0` (no `DivideByZeroException`/`NaN`).
- [x] 2.4 xUnit: convoked player with no `EventAttendanceConfirmation` row is counted as
      `pending`.
- [x] 2.5 xUnit: Player with a linked `TeamPlayer` on `teamId` receives non-null `myStatus`
      matching their own confirmation; Coach/Administrator receives `myStatus: null`.
- [x] 2.6 xUnit: missing `teamId` → `400`; more than 50 `eventIds` → `400`; Player with no
      `UserTeam` for `teamId` → `403`.
- [x] 2.7 Run `dotnet test --filter GetEventAttendanceSummary` (or the actual test class name)
      green before moving on.

## 3. UnpublishNews — command and domain method (~1.5h)

- [x] 3.1 Add `NewsItem.Unpublish()` to `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/News/
      NewsItem.cs`: mirrors `Publish()` — throws `ConflictException("La noticia ya está en
      borrador.", ErrorCodes.NewsNotPublished)` if `Status != NewsStatus.Published`, else sets
      `Status = NewsStatus.Draft`, `PublishedAt = null`, `UpdatedAt = DateTime.UtcNow`.
- [x] 3.2 Add `ErrorCodes.NewsNotPublished` next to the existing `NewsAlreadyPublished` /
      `NewsNotFound` constants in `Back/ExtractionApi/src/RFFM.Api/Domain/ErrorCodes.cs`.
- [x] 3.3 Create `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/News/UnpublishNews.cs` as a
      new `IFeatureModule`, following `PublishNews.cs`'s exact shape: `POST /api/coach/news/
      {id}/unpublish`, `AuthorizeAttribute { Roles = "Coach,Administrator" }`,
      `UnpublishNewsCommand(string Id) : IRequest<NewsDetailResponse>, IInvalidateCacheRequest`
      with `PrefixCacheKey => NewsConstants.PublishedListCachePrefix`, `200 OK` with
      `NewsDetailResponse` on success, `404`/`409` `ProducesResponseType` declarations.
- [x] 3.4 Handler: load by id (404 via `NotFoundException` if missing, matching
      `PublishNewsHandler`), call `news.Unpublish()`, `SaveChangesAsync`, map to
      `NewsDetailResponse`. Do **not** call `IPushNotificationDispatcher` (design.md Decision 5
      — no unpublish notification exists or is requested).

## 4. UnpublishNews — tests (~1h)

- [x] 4.1 xUnit: Coach unpublishes a Published item → `200 OK`, `Status = "Draft"`,
      `PublishedAt = null`.
- [x] 4.2 xUnit: unpublishing an already-Draft item → `409 Conflict`.
- [x] 4.3 xUnit: unpublished item no longer appears in `GET /api/coach/news` (cache
      invalidation via `PublishedListCachePrefix` actually clears the cached page).
- [x] 4.4 xUnit: FamilyMember/Player role → `403 Forbidden`.
- [x] 4.5 xUnit: unknown id → `404 Not Found`.
- [x] 4.6 Run `dotnet test --filter UnpublishNews` green before moving on.

## 5. GetNews — `descending` parameter (~1h)

- [x] 5.1 Add `bool Descending = false` to `GetNewsQuery` in `Back/ExtractionApi/src/RFFM.Api/
      Features/Coaches/News/GetNews.cs`, wired from a new optional `descending` query parameter
      on `GET /api/coach/news` (default `false` — no behavior change for existing callers that
      omit it), mirroring `GetSportEvents`'s `Descending` flag naming/default exactly
      (design.md Decision 6).
- [x] 5.2 Update `GetNewsQuery.CacheKey` to
      `$"{NewsConstants.PublishedListCachePrefix}{PageNumber}:{PageSize}:{Descending}"` so
      ascending and descending pages never collide in the cache (design.md Decision 6 — this is
      required for correctness, not optional).
- [x] 5.3 Update `GetNewsHandler.Handle` to apply
      `request.Descending ? query.OrderByDescending(n => n.NewsDate) :
      query.OrderBy(n => n.NewsDate)` in place of the current unconditional `OrderBy`.
- [x] 5.4 No new validator needed (`bool` has no invalid values) — confirm the existing minimal
      route binding still compiles with the added parameter.
- [x] 5.5 xUnit: `descending=false` (or omitted) returns the same ascending-by-`NewsDate` order
      as today (regression test — must not change existing behavior).
- [x] 5.6 xUnit: `descending=true` returns items ordered by `NewsDate` descending (most recent
      first).
- [x] 5.7 xUnit: fetching `pageNumber=1&pageSize=3` with `descending=false` then
      `descending=true` back-to-back returns *different* orderings (proves the cache key split
      works — a stale cached ascending page must not leak into the descending request or vice
      versa).
- [x] 5.8 Run `dotnet test --filter GetNews` green before moving on.

## 6. Full verification (~0.5h)

- [x] 6.1 `dotnet build` from `Back/ExtractionApi` — zero errors/warnings introduced.
- [x] 6.2 `dotnet test` — full backend suite green, no regressions in `News`,
      `SportEvents`, `Convocations`, or `Mobile/Attendance` test classes.
- [x] 6.3 `openspec validate coach-dashboard-highlights --strict` — zero errors.
- [ ] 6.4 Manually confirm (via `dotnet run --project src/RFFM.Host` + a REST client) that
      `GET /api/sport-events/attendance-summary`, `POST /api/coach/news/{id}/unpublish`, and
      `GET /api/coach/news?descending=true` match the exact response shapes documented in
      design.md's API Contract section, since front-specialist will build directly against them
      in a follow-up change.

## 7. Out of scope — explicitly not part of this change

- News CRUD authorization change (creator-only / `EnsureCreatorAsync`) — closed, rejected by the
  user (design.md Decision 4). Do not revisit without a new, explicit user request.
- Note: an earlier draft of this change deferred (a) a Front "mark my attendance" control and
  (b) fuzzy `eventId` matching for federation-synced `MatchCard` rows as open questions. Both were
  investigated on 2026-08-30 and resolved to "reuse what already exists, no backend change" —
  (a) is now implemented in §11b below (`ConfirmAttendance` reused as-is); (b) needed no work at
  all (§10's scope note explains why). Neither required backend involvement.
- A coach confirming attendance *on behalf of* a player from Front (as opposed to a player/family
  member confirming their own) — `ConfirmAttendance`'s `isPrivilegedRole` branch already
  technically allows this server-side, but no Front UI is built for it in this change
  (design.md Frontend Design, Non-Goals).

---

# Frontend tasks (front-specialist)

Backend tasks §1-6 must be green (`dotnet build`/`dotnet test`) before starting §8 onward, since
every frontend task is built directly against the live contracts, not a mock — including the
existing, unmodified `ConfirmAttendance`/`GetMyProfile` endpoints §11b reuses (no backend task
required for those). TDD per
`.claude/rules/frontend-testing.md` — write the failing test first for every new component/hook.

## 8. Shared attendance-summary plumbing (~2h)

- [x] 8.1 Create `Front/src/apps/coach/services/eventAttendanceSummaryService.ts`: export
      `EventAttendanceSummaryDto` type (`eventId, convocados, going, pending, notGoing,
      attendancePercentage, myStatus: "Going"|"Pending"|"NotGoing"|null, myStatusId: number|null`)
      and `getEventAttendanceSummaries(teamId: string, eventIds: string[]):
      Promise<EventAttendanceSummaryDto[]>` calling
      `GET /api/sport-events/attendance-summary?teamId=&eventIds=` (comma-joined) via the shared
      Axios client. Returns `[]` when `eventIds` is empty (no network call).
- [x] 8.2 Write `Front/src/apps/coach/hooks/__tests__/useEventAttendanceSummaries.test.ts` first
      (Red): asserts it fetches once for a given `(teamId, eventIds)` pair, re-fetches when the
      sorted/joined ids change, does not re-fetch on array-identity-only changes, and returns a
      `Record<eventId, EventAttendanceSummaryDto>` map plus `loading`/`error`.
- [x] 8.3 Implement `Front/src/apps/coach/hooks/useEventAttendanceSummaries.ts` to pass (Green);
      design.md Decision 7.
- [x] 8.4 Write `Front/src/apps/coach/components/EventAttendanceBadges/__tests__/
      EventAttendanceBadges.test.tsx` first (Red): coach view renders convocados/going/pending/
      notGoing/percentage; player/family view renders "Tu estado: <myStatus>" and never the
      aggregate counts; renders `null`/empty when `summary` is `undefined`.
- [x] 8.5 Implement `Front/src/apps/coach/components/EventAttendanceBadges/
      EventAttendanceBadges.tsx` + `.module.css` to pass (Green); design.md Decision 7. Use
      existing Coach dark-theme tokens (mirror `EventCard.module.css`'s chip styling), not new
      hardcoded colors.
- [x] 8.6 `npm run test -- eventAttendanceSummaries EventAttendanceBadges` green.

## 9. `EventCard.tsx` attendance badges (Attendance page) (~1.5h)

- [x] 9.1 Write/extend a test in `Front/src/apps/coach/pages/attendance/__tests__/
      EventCard.trainingBadges.test.tsx` (or a new `EventCard.attendanceBadges.test.tsx`) first
      (Red): passing an `EventAttendanceSummaryDto` prop renders the badge inside the card;
      omitting it renders the card without a badge (loading/omitted state, no crash).
- [x] 9.2 Add an optional `attendanceSummary?: EventAttendanceSummaryDto` prop to `EventCard`'s
      `Props`, rendering `<EventAttendanceBadges summary={attendanceSummary} isPlayer={isPlayer} />`
      in the card body (Green). Thread `isPlayer` into `EventCard` as a new prop (currently absent)
      resolved by the caller (`Attendance.tsx`) via `usePlayerAutoLoad()`.
- [x] 9.3 Wire `Attendance.tsx`: call `usePlayerAutoLoad()` for `isPlayer`, call
      `useEventAttendanceSummaries(team?.id, events.map(e => e.id))` once for the current page of
      events, pass `attendanceSummary={summaries[e.id]}` and `isPlayer` to each `EventCard`.
- [x] 9.4 `npm run test -- EventCard Attendance` green; `npm run build` green.

## 10. `MatchCard.tsx` attendance badges (Convocatorias page) (~1.5h)

Scope note (design.md Decision 9, revised): investigation of `useConvocations.ts` found every
`MatchCard` this page renders is already built from an internal `SportEvent` via
`normalizeFromSportEvent` — `normalizeRawMatch`'s output (raw, unsynced federation rows) is only
used transiently inside `handleSyncCalendar` and never reaches a rendered card. So `eventId` is
expected to be set on every card in practice; the `undefined` branch below is a defensive
type-safety guard, not the primary case to design around (this narrows the original ~2h estimate).

- [x] 10.1 Add `eventId?: string` to `NormalizedMatch` (`pages/convocations/types.ts`); set it in
      `normalizeFromSportEvent` (`= ev.id`). `normalizeRawMatch` leaves it `undefined` — harmless,
      since its output never reaches `matches` state (confirmed by design.md's Context/Decision 9
      trace through `useConvocations.ts`).
- [x] 10.2 Write `Front/src/apps/coach/pages/convocations/components/__tests__/
      MatchCard.attendanceBadge.test.tsx` first (Red): a match with `eventId` and a matching
      summary renders the badge; as a defensive edge case, a match with no `eventId` renders no
      badge and no error (should not occur via `Convocations.tsx`'s actual data flow, but the
      component must not crash if it ever does).
- [x] 10.3 Add an optional `attendanceSummary?: EventAttendanceSummaryDto` + `isPlayer?: boolean`
      prop to `MatchCard`, rendering `<EventAttendanceBadges .../>` only when `attendanceSummary`
      is defined (Green); design.md Decision 9.
- [x] 10.4 Wire `Convocations.tsx`: call `usePlayerAutoLoad()`, collect
      `matches.map(m => m.eventId).filter((id): id is string => !!id)`, call
      `useEventAttendanceSummaries(teamId, thatArray)` once, pass the per-match summary + isPlayer
      down through the `matchByDay`/`MatchCard` render loop.
- [x] 10.5 `npm run test -- MatchCard Convocations` green; `npm run build` green.

## 11. Dashboard "A la vista" section — upcoming events widget shell (read side) (~2h)

- [x] 11.1 Write `Front/src/apps/coach/pages/team-dashboard/components/__tests__/
      UpcomingEventsWidget.test.tsx` first (Red): renders up to 3 upcoming events with title/date;
      coach view shows aggregate badges, player/family view shows own-status badges; each event
      links to `/coach/attendance/{id}?teamId=...`; empty state when no upcoming events; loading
      state while fetching.
- [x] 11.2 Implement `Front/src/apps/coach/pages/team-dashboard/components/
      UpcomingEventsWidget.tsx` + `.module.css` (Green): `sportEventService.getSportEvents(team.
      id, 1, 3, todayISODate)` then `useEventAttendanceSummaries` for badges; design.md
      Decision 10. Mobile-first card layout (no table/grid), consistent with `.claude/rules/
      frontend-architecture.md`.
- [x] 11.3 `npm run test -- UpcomingEventsWidget` green.

## 11b. Upcoming-events widget — mark-my-attendance controls (player/family) (~2.5h)

Backend dependency check (design.md Decision 14, investigated 2026-08-30): **none.**
`POST /api/mobile/events/{eventId}/attendance` (`ConfirmAttendance.cs`) has no client-type
restriction — only `IRequireFeaturePermission`/`IRequireTeamMembership`, both JWT-driven — and
`FeaturePermission` rows already grant `Player`/`FamilyMember`/`Coach` ReadWrite on
`AttendanceConfirmation` (`WebApplicationExtensions.cs:482-488`, already shipped). This section
implements only Front-side work; no back-specialist coordination needed before starting it.

- [x] 11b.1 Add `AttendanceConfirmation: "/mobile/attendance"` to `COACH_FEATURE_ROUTES`
      (`Front/src/apps/coach/constants/featureRoutes.ts`), mirroring the backend's
      `CoachFeatureRoutes.AttendanceConfirmation` constant exactly (pre-existing gap, closed here).
- [x] 11b.2 Add `EventAttendanceStatus` type (`"Going" | "Pending" | "NotGoing"`) and
      `confirmMyAttendance(eventId: string, payload: { teamId: string; teamPlayerId: string;
      status: EventAttendanceStatus }): Promise<void>` to
      `Front/src/apps/coach/services/eventAttendanceSummaryService.ts`, calling
      `POST /api/mobile/events/{eventId}/attendance` with body `{ TeamId, TeamPlayerId, Status }`.
- [x] 11b.3 Write a test in `Front/src/apps/coach/hooks/__tests__/
      useEventAttendanceSummaries.test.ts` (or a small new hook, see 11b.4) first (Red): confirms
      that after a successful `confirmMyAttendance` call, `refetch()` re-fetches and the returned
      `summaries` map reflects the new `myStatus`.
- [x] 11b.4 Write `Front/src/apps/coach/pages/team-dashboard/components/__tests__/
      UpcomingEventsWidget.attendanceActions.test.tsx` first (Red): player/family view renders
      "Voy"/"No voy" buttons per event card; clicking one optimistically updates that card's
      status immediately; a per-card loading state disables that card's buttons while the request
      is in flight (other cards remain interactive); on request failure, the status reverts to its
      pre-click value and an `rffm.show_snackbar` error event fires; coach/administrator view
      never renders these buttons.
- [x] 11b.5 Implement the buttons in `UpcomingEventsWidget.tsx` (Green): resolve `teamPlayerId` via
      `coachApi.getMyProfile()` (existing function — `MyProfileResponse.playerId` is the
      `TeamPlayer.Id`/`UserTeam.LinkedTeamPlayerId` value `ConfirmAttendanceRequest.TeamPlayerId`
      expects, per design.md Decision 14's backend trace) once when `isPlayer`; local optimistic
      state per event card; call `confirmMyAttendance`; `refetch()` on success; dispatch
      `rffm.show_snackbar` + revert optimistic state on failure.
- [x] 11b.6 `npm run test -- UpcomingEventsWidget useEventAttendanceSummaries` green;
      `npm run build` green.

## 12. `newsService.ts` + `NewsListCard` (shared) (~1.5h)

- [x] 12.1 Create `Front/src/apps/coach/services/newsService.ts`: `NewsSummaryDto`,
      `NewsDetailDto` types (mirroring `NewsSummaryResponse`/`NewsDetailResponse`); functions
      `getNews(pageNumber, pageSize, descending)`, `getNewsDrafts(pageNumber, pageSize)`,
      `getNewsById(id)`, `createNews(payload)`, `updateNews(id, payload)`, `deleteNews(id)`,
      `publishNews(id)`, `unpublishNews(id)`, `uploadNewsImage(file: File)`. Plain function
      exports + default object export, matching `sportEventService.ts`'s pattern.
- [x] 12.2 Write `Front/src/apps/coach/pages/news/components/__tests__/NewsListCard.test.tsx`
      first (Red): renders title/subtitle/date/cover image, links to `/coach/news/{id}`.
- [x] 12.3 Implement `Front/src/apps/coach/pages/news/components/NewsListCard.tsx` +
      `.module.css` (Green); design.md Decision 13.
- [x] 12.4 `npm run test -- newsService NewsListCard` green.

## 13. `News.tsx` rebuild (list + Coach/Administrator CRUD) (~3h)

- [x] 13.1 Write `Front/src/apps/coach/pages/news/__tests__/News.readOnly.test.tsx` first (Red):
      a Player/FamilyMember role sees the published list (via `NewsListCard`) with no "Nueva
      noticia" button, no per-card edit/delete/publish actions, no drafts tab.
- [x] 13.2 Write `Front/src/apps/coach/pages/news/__tests__/News.coachManagement.test.tsx` first
      (Red): a Coach/Administrator role sees the "Nueva noticia" button, a Publicadas/Borradores
      tab switcher, and per-card Editar/Publicar/Despublicar/Eliminar actions matching the item's
      current `status`.
- [x] 13.3 Implement the rebuilt `Front/src/apps/coach/pages/news/News.tsx` +
      `News.module.css` (Green): fetches published list via `newsService.getNews`; role-branches
      via `coachAuthService.hasRole("Coach") || coachAuthService.hasRole("Administrator")` per
      design.md Decision 11; drafts tab fetches `getNewsDrafts` lazily (only when the tab is
      opened, Coach/Administrator only).
- [x] 13.4 Write `Front/src/apps/coach/pages/news/components/__tests__/
      NewsFormDialog.test.tsx` first (Red): required-field validation (title/subtitle/body/
      coverImageUrl/newsDate), submit calls `createNews` (create mode) or `updateNews` (edit
      mode) with the entered payload, image upload calls `uploadNewsImage` and populates
      `coverImageUrl`.
- [x] 13.5 Implement `Front/src/apps/coach/pages/news/components/NewsFormDialog.tsx` +
      `.module.css` (Green): reuses the shared `FileImagePicker` component
      (`Front/src/shared/components/ui/FileImagePicker/`) for cover image upload.
- [x] 13.6 Wire publish/unpublish/delete actions on `News.tsx`'s per-card buttons to
      `newsService.publishNews`/`unpublishNews`/`deleteNews`, refetching the active tab's list on
      success; use the shared `ConfirmDialog` component
      (`Front/src/shared/components/ui/ConfirmDialog/`) for the delete confirmation, matching
      `EventCard.tsx`'s existing delete-confirmation pattern.
- [x] 13.7 `npm run test -- News NewsFormDialog` green; `npm run build` green.

## 14. `NewsDetail.tsx` + routing (~1h)

- [x] 14.1 Write `Front/src/apps/coach/pages/news/__tests__/NewsDetail.test.tsx` first (Red):
      renders title/subtitle/body/cover image/date for a valid id; shows a not-found state on
      `404`; "Volver a noticias" navigates to `/coach/news`.
- [x] 14.2 Implement `Front/src/apps/coach/pages/news/NewsDetail.tsx` + `.module.css` (Green);
      design.md Decision 12.
- [x] 14.3 Register `<Route path="news/:id" element={<RequireFeaturePermission
      featureRoute={COACH_FEATURE_ROUTES.News}><NewsDetail /></RequireFeaturePermission>} />` in
      `Front/src/apps/coach/routes.tsx`, lazy-loaded like every other top-level page.
      Update `NewsListCard`/`NewsWidget` links to point at this route.
- [x] 14.4 `npm run test -- NewsDetail` green.

## 15. Dashboard "A la vista" section — news widget + wiring into `TeamDashboard.tsx` (~1.5h)

- [x] 15.1 Write `Front/src/apps/coach/pages/team-dashboard/components/__tests__/
      NewsWidget.test.tsx` first (Red): renders up to 3 published news items via `NewsListCard`,
      empty state when there are none, loading state while fetching.
- [x] 15.2 Implement `Front/src/apps/coach/pages/team-dashboard/components/NewsWidget.tsx` +
      `.module.css` (Green): `newsService.getNews(1, 3, true)`; design.md Decision 13.
- [x] 15.3 Write/extend `Front/src/apps/coach/pages/team-dashboard/__tests__/TeamDashboard.test.tsx`
      first (Red): an "A la vista" section renders above the existing dashboard cards, containing
      both `UpcomingEventsWidget` and `NewsWidget`.
- [x] 15.4 Wire `TeamDashboard.tsx`: render the "A la vista" section (both widgets, each in its
      own error boundary/try-catch so one widget's failure never blocks the other or the cards
      below — reuse `Front/src/shared/components/ui/ErrorBoundary/` if it fits, else a local
      try/catch per widget) above `<TeamDashboardCards .../>`.
- [x] 15.5 `npm run test -- TeamDashboard NewsWidget` green; `npm run build` green.

## 16. Full frontend verification (~0.5h)

- [x] 16.1 `npm run build` from `Front/` — zero TypeScript errors, no `any` introduced.
- [x] 16.2 `npm run test` — full Vitest suite green, no regressions in `Attendance`,
      `Convocations`, `TeamDashboard`, or `News` test files.
- [x] 16.3 `openspec validate coach-dashboard-highlights --strict` — zero errors.
- [x] 16.4 Manually verify in the dev server (`npm run dev`, backend running per tasks.md §6.4):
      dashboard "A la vista" section for both a Coach account and a Player/FamilyMember account;
      Attendance and Convocatorias card badges; News list/create/edit/publish/unpublish for Coach;
      News read-only list + detail for Player/FamilyMember; a Player/FamilyMember account can mark
      "Voy"/"No voy" on an upcoming-event card in the widget and see it persist across a page
      reload (confirms `POST /api/mobile/events/{eventId}/attendance` really accepts the Front
      JWT with no backend change, per design.md Decision 14).

## 17. Post-QA adjustments (manual testing feedback, TDD, ~6h)

The user manually tested the implementation from §8–§16 and requested five adjustments. All
implemented with tests written first (Red → Green), verified against the full Vitest suite +
`npm run build`.

- [x] 17.1 New shared `Front/src/apps/coach/components/Carousel/Carousel.tsx` + `.module.css`:
      manual carousel (arrows + touch swipe via `translateX` slider, no scroll-snap — chosen over
      CSS scroll-snap because jsdom can't provide real layout/`clientWidth`, so a transform+state
      driven slider is deterministically testable with Testing Library while still needing zero
      new npm dependencies) with an optional `autoAdvanceMs` prop for combined auto+manual mode.
      Manual interaction pauses auto-advance and resumes after 6s of inactivity (chosen over
      "stays paused until manually resumed" — standard carousel UX, doesn't strand an accidental
      bump). Respects `prefers-reduced-motion` (skips auto-advance and instant instead of
      animated transitions). No new carousel library — `package.json` has none, and scroll-snap
      wasn't used per the testability trade-off above. 11 tests
      (`Carousel/__tests__/Carousel.test.tsx`).
- [x] 17.2 `UpcomingEventsWidget.tsx` and `NewsWidget.tsx` wrapped in `Carousel`
      (manual-only and `autoAdvanceMs={5500}` respectively); removed the now-unused
      `.eventsList`/`.newsList` flex/grid CSS.
- [x] 17.3 `UpcomingEventsWidget.tsx` event cards show event type (chip, colored via
      `attendanceUtils.getEventTypeColor`, resolved the same way `Attendance.tsx` does via
      `sportEventTypeService.getSportEventTypes()`), time (not just date), location, and rival
      name when present — reusing `SportEventResponse` fields already used by `EventCard.tsx`.
      New tests in `UpcomingEventsWidget.test.tsx`.
- [x] 17.4 Fixed Voy/No voy gating bug: buttons now show only when
      `baseSummary?.myStatus === "Pending"` (convoked, undecided) or a confirmation for that
      event is already in flight (`pendingEventId === event.id` — needed because the optimistic
      update flips `myStatus` away from `"Pending"` instantly, which was making the buttons
      *unmount* on click instead of visibly disabling). `null` (not convoked) and
      `"Going"`/`"NotGoing"` (already decided) show no buttons. Also fixed
      `EventAttendanceBadges.tsx`: `myStatus === null` now renders nothing for a player (was
      incorrectly falling back to "Pendiente", conflating "not convoked" with "convoked but
      undecided") — coordinated with the backend fix to `GetEventAttendanceSummary.cs` that only
      fills `myStatus` for players actually convoked to the event. New/updated tests in
      `UpcomingEventsWidget.attendanceActions.test.tsx` and `EventAttendanceBadges.test.tsx`.
- [x] 17.5 Fixed broken news images: `coverImageUrl` from the backend (`IStorageService`) is a
      relative storage path for local storage, not a browser-navigable URL. Added
      `fetchPublicStorageFile(url)` to `Front/src/shared/services/imageService.ts` (calls
      `GET /api/public/storage?url=` with `responseType: "blob"`, mirrors `fetchImage`'s existing
      shape) and a new `Front/src/apps/coach/hooks/useCoverImageUrl.ts` hook (resolves the object
      URL, revokes it on path change/unmount, mirrors `DashboardCards.tsx`'s
      `createdObjUrls`/`revokeObjectURL` cleanup pattern). Wired into `NewsListCard.tsx` and
      `NewsDetail.tsx` (`NewsFormDialog.tsx` never rendered `coverImageUrl` as an `<img>` — its
      preview is `FileImagePicker`'s own `File`-based preview — so it needed no change). New
      tests: `shared/services/__tests__/imageService.test.ts`,
      `hooks/__tests__/useCoverImageUrl.test.ts`, plus updated `NewsListCard.test.tsx` and
      `NewsDetail.test.tsx`.
- [x] 17.6 Fixed mobile footer cutoff: `TeamDashboard.tsx` had no bottom padding after
      `TeamDashboardCards` (the actual last visible content), unlike `News.tsx`/`NewsDetail.tsx`
      which already had `sx={{ p: 3 }}` (24px on all sides). Wrapped `TeamDashboard.tsx`'s content
      in a new `.pageContent { padding-bottom: 24px }` (`TeamDashboard.module.css`) — same 24px
      value already established by `Clubs.module.css`'s `.wrapper`, not a new magic number. New
      test in `TeamDashboard.test.tsx`.
- [x] 17.7 Full verification: `npm run test` (whole affected area: `components`, `team-dashboard`,
      `news`, `hooks`, `imageService`, `attendance`, `convocations` — 45 files, 205 tests) green;
      full `npm run build` green; `openspec validate coach-dashboard-highlights --strict` clean.

## 18. Second round of post-QA adjustments (manual testing feedback, TDD, ~5h)

Four more items from the user testing §17's output. TDD throughout; item 4 investigation found and
fixed a real, confirmed bug (not the one originally suspected).

- [x] 18.1 Images not distorted: `NewsListCard.module.css`'s `.image` already had
      `object-fit: cover` + a fixed height — switched the fixed `150px` to `aspect-ratio: 16/9`
      (more robust once the card's own width changes, e.g. inside the carousel's new desktop
      cap). `NewsDetail.module.css`'s `.coverImage` was the actual gap (`max-width:100%;
      height:auto` only, no `object-fit`) — added `aspect-ratio: 16/9; object-fit: cover`.
- [x] 18.2 Desktop carousel width: added a `@media (min-width: 769px)` rule to the shared
      `Carousel.module.css` (`.slide` becomes a centering flex container, its child capped at
      `max-width: 360px`) — applies uniformly to both widgets via the one shared component
      instead of duplicating a magic number in `UpcomingEventsWidget.module.css` and
      `NewsListCard.module.css` separately. 360px chosen as a middle ground between
      `DashboardCard`'s plain nav cards (~220px, `Dashboard.module.css`'s grid) and this app's
      richer content cards (~250-260px elsewhere), since these carousel cards carry more content
      (badges, actions) than either — within the user's own suggested 320-400px range, not an
      arbitrary new value. Single centered card chosen over multi-card-visible, per the
      simpler-option the user offered.
- [x] 18.3 `UpcomingEventsWidget.tsx` now reuses `EventCard.tsx` (from `pages/attendance/`) for
      its cards instead of a simplified custom design, matching Attendance.tsx's list look
      exactly. Added a new `compact?: boolean` prop to `EventCard` (`EventCard.compact.test.tsx`,
      4 tests): hides the Asistencias/Editar/Eliminar/"Ir al partido" action icons and both
      dialogs. Necessary, not cosmetic — `EventCard`'s "Asistencias" button calls
      `navigate(String(event.id))`, a *relative* navigation that only resolves correctly under
      `/coach/attendance`; reusing it un-compacted from the dashboard would have silently
      navigated to the wrong route. Widget tests (`UpcomingEventsWidget.test.tsx`/
      `.attendanceActions.test.tsx`) now mock `EventCard` and assert the props passed to it,
      rather than re-testing EventCard's own extensively-covered rendering — avoids duplicating
      that coverage and decouples the widget's tests from EventCard's internal markup.
- [x] 18.4 Investigated "ruta rota al hacer clic en Eventos" — found and fixed a real bug, not
      the one first suspected. `useEventAttendanceSummaries`'s `key` (sorted/joined event ids) is
      a stable primitive across re-renders despite `events.map()` producing a new array reference
      each time — confirmed via a new integration test
      (`Attendance.attendanceSummariesIntegration.test.tsx`) that mounts the REAL (unmocked) hook
      inside the REAL `Attendance.tsx`: exactly one network call, no render loop, no crash. The
      actual bug: `usePlayerAutoLoad()` (added to `Attendance.tsx`/`Convocations.tsx` in §17.4
      purely to read the `isPlayer` boolean) also carries a navigation side-effect that redirects
      *any* player-role user away from *any* route that isn't `/coach/team-dashboard` back to the
      dashboard — so a Player/FamilyMember account clicking the "Eventos" quick-access card (or
      an event link from the widget) was immediately bounced back. Reproduced deterministically
      in `Attendance.playerNoRedirect.test.tsx` (Red: `navigate` called with
      `/coach/team-dashboard?...`), fixed by extracting the pure role check into
      `hooks/isPlayerRole.ts` (`computeIsPlayerRole`) and a new side-effect-free
      `hooks/useIsPlayerRole.ts` hook (5 tests), which `Attendance.tsx`/`Convocations.tsx` now use
      instead of `usePlayerAutoLoad`. `usePlayerAutoLoad` itself is unchanged behaviorally (just
      refactored to reuse the extracted pure function) — Dashboard.tsx/TeamDashboard.tsx/
      AppSelector's existing auto-redirect flows are untouched. No "Ver todos los eventos" link
      added — the confirmed bug fully explains the reported symptom; per the coordinator's
      explicit "no asumas sin evidencia clara," that speculative addition was intentionally
      skipped.
- [x] 18.5 Full verification: `npm run test` full suite (657/661 pass, 3 skipped — the 2 failing
      files/1 failing test are the same pre-existing, unrelated `e2e/scoped-membership.spec.ts`
      config collision and `SeasonPlanEditor.test.tsx` full-suite timeout flakiness confirmed in
      prior rounds); full `npm run build` clean, zero errors; `openspec validate
      coach-dashboard-highlights --strict` clean.

## 19. Backend data-source correction (Convocation, not EventAttendanceConfirmation) + widget layout (manual QA, TDD, ~4h)

The back-specialist corrected `GetEventAttendanceSummary` to source `myStatus`/`myConvocationId`
from `Convocation.ConvocationStatusId` (the same system `ConvocationCard.tsx`/`AttendanceTabs.tsx`
already write to) instead of `EventAttendanceConfirmation`/Mobile — see design.md's top-of-file
Context correction and the revised Decision 14. Frontend updated to match, TDD throughout.

- [x] 19.1 `eventAttendanceSummaryService.ts`: `EventAttendanceStatus` (`"Going"|"Pending"|
      "NotGoing"`) replaced with `ConvocationStatusName` (`"Pending"|"Accepted"|"Deconvoke"|
      "Justified"`); `EventAttendanceSummaryDto` gains `myConvocationId: string | null`. Removed
      `confirmMyAttendance` entirely (dead code — nothing calls the Mobile endpoint from the
      dashboard anymore); `EventAttendanceConfirmation`/`POST /api/mobile/events/{eventId}/
      attendance` themselves are untouched on the backend, simply no longer called from here.
- [x] 19.2 `EventAttendanceBadges.tsx`: status→label/color map now mirrors `ConvocationCard.tsx`'s
      real status set, past-participle wording since this is a *decided-state* badge, not an
      action button (`Pending`→"Pendiente", `Accepted`→"Aceptado", `Deconvoke`→"Rechazado",
      `Justified`→"Justificado" — the last one has no equivalent action button in
      `ConvocationCard.tsx` but must still render honestly if a coach sets it elsewhere). 7 tests,
      `EventAttendanceBadges.test.tsx`.
- [x] 19.3 `UpcomingEventsWidget.tsx`: `handleConfirm` now calls `convocationService.
      updateConvocationStatus(eventId, myConvocationId, statusId)` — "Voy"→`statusId=2`
      (Accepted), "No voy"→`statusId=5` (Deconvoke), no `excuseTypeId` (backend defaults to 7,
      "Decisión técnica"). Removed the `coachApi.getMyProfile()`/`teamPlayerId` effect entirely —
      `myConvocationId` comes directly from the attendance-summary response, nothing else in the
      widget needed `teamPlayerId`. Gating: `isPlayer && !!myConvocationId && (baseSummary?.
      myStatus === "Pending" || pendingEventId === event.id)` — the in-flight fallback still
      needed for the same reason as §17.4 (optimistic update flips `myStatus` away from
      `"Pending"` instantly). 10 tests, `UpcomingEventsWidget.attendanceActions.test.tsx`.
- [x] 19.4 design.md updated: Decision 14 revised in place (original Mobile-based version kept in
      a collapsed `<details>` block for history), Context/Goals/Non-Goals paragraphs, Risks/
      Trade-offs, Frontend API Consumption Summary, and Migration Plan all updated to reference
      `convocationService.updateConvocationStatus`/`ConvocationStatusName` instead of
      `confirmMyAttendance`/Going-Pending-NotGoing. Backend's own aggregate field names
      (`going`/`pending`/`notGoing`) are unchanged by this correction — only `myStatus` (the
      caller's own row) uses real `ConvocationStatus` names; that distinction is called out
      explicitly where it could otherwise read as inconsistent.
- [x] 19.5 Layout: "Próximos eventos" and "Últimas noticias" now render side-by-side on desktop/
      tablet instead of stacked full-width. Added a `@media (min-width: 769px)` rule to
      `TeamDashboard.module.css`'s `.widgetsContainer` (`flex-direction: row`, `gap: 16px`, each
      child `flex: 1 1 0; min-width: 0`) — same 769px breakpoint already used for the carousel's
      own desktop card-width cap (`Carousel.module.css`), so both agree on where "desktop" starts.
      Stays stacked (column) below that, unchanged. Considered zeroing each widget's own
      `margin-bottom` via a `.widgetsContainer > *` override; rejected — cross-CSS-Module
      equal-specificity cascade order isn't reliably predictable, and the extra bottom margin in
      the row layout is cosmetically harmless. New structural test confirms both widgets stay
      direct children of `.widgetsContainer` (`TeamDashboard.test.tsx`), which is what the media
      query targets — CSS media-query behavior itself isn't verifiable in jsdom, so this needs a
      manual visual check (see below).
- [x] 19.6 Full verification: affected-area suite (48 files, 217 tests) green; full `npm run test`
      (662/665 pass, 3 skipped — only the same pre-existing `e2e/scoped-membership.spec.ts` config
      collision, zero real failures); full `npm run build` clean, zero errors; `openspec validate
      coach-dashboard-highlights --strict` clean.
- [ ] 19.7 Manual visual QA needed (not verifiable via jsdom): confirm "Voy"/"No voy" persist
      through the real `Convocation` row and are reflected in `ConvocationCard.tsx`/
      `AttendanceTabs.tsx` too (proves both surfaces now agree); confirm the desktop/tablet
      side-by-side widget layout at and around the 769px breakpoint, including the carousel's own
      card-width cap inside the now-narrower column; confirm news/event card images render
      uncropped-looking (`object-fit: cover` + `aspect-ratio`) at the new widths.
- [x] 19.8 Equal-height widget columns (manual QA feedback: "próximos eventos es más alto que
      últimas noticias"). Pure CSS layout fix, no new component boundary — no jsdom-testable
      behavior change (media-query/flex-stretch rendering isn't verifiable in jsdom, same
      limitation already noted in 19.5/19.6), so verified via the full build + test suite (no
      regressions) rather than a new automated test:
      - `TeamDashboard.module.css`'s `.widgetsContainer` desktop rule (`@media (min-width:
        769px)`): `align-items: flex-start` → `align-items: stretch`, so both widget columns
        match the row's tallest child instead of each sitting at its own natural height.
      - `UpcomingEventsWidget.module.css` and `NewsWidget.module.css`'s `.container`: added
        `display: flex; flex-direction: column; height: 100%` so each widget's background fills
        the stretched column (percentage height resolves to `auto` on mobile's unconstrained
        `.widgetsContainer`, so this is a no-op there).
      - `Carousel.module.css` (shared by both widgets, currently their only consumers): `.root`
        gets `display:flex; flex-direction:column; flex:1; min-height:0` and `.viewport` gets
        `flex:1` so the carousel grows to fill the widget's remaining height; `.slide` gets
        `height:100%; display:flex; flex-direction:column` and a new `.slide > *{ flex:1 }` so
        each slide's single child (the `EventCard` wrapper / `NewsListCard`) stretches too.
      - `NewsListCard.module.css`'s `.card`: `display:block` → `display:flex; flex-direction:
        column; height:100%`; `.image` gets `flex-shrink:0` (keeps its fixed aspect-ratio from
        being squashed); `.content` gets `flex:1; display:flex; flex-direction:column`; `.date`
        gets `margin-top:auto` so a stretched card's extra height shows as breathing room above
        the date, not an ugly gap below it. `EventCard.module.css` was deliberately left
        untouched — its `.card` already has a fixed `height: 320px` by design (see its own
        comment), so it's the tall reference the shorter `NewsListCard` stretches to match, not
        something that itself needed to grow.
      - Verified: `npm run test -- Carousel TeamDashboard NewsWidget UpcomingEventsWidget
        NewsListCard` green (9 files, 51 tests); full `npm run build` clean (`✓ built in 2m 50s`,
        exit 0); full `npm run test` — 663 passed, 3 skipped, only the same pre-existing
        `e2e/scoped-membership.spec.ts` Playwright/Vitest config-collision failure (unrelated to
        this change, already documented in 18.5/19.6).
      - Not verifiable by me (needs a real browser): whether the stretched `NewsListCard` actually
        *looks* good with the extra bottom space (vs. e.g. wanting the image to also grow), and
        the exact visual balance of the two columns at various widths around/above the 769px
        breakpoint — add this to 19.7's manual QA pass.

## 20. Quick-access cards redesign — "app launcher" grid (mockup Option A, ~1.5h)

The user reviewed a mockup comparing two redesigns of `TeamDashboardCards` (needed because the
old rectangular icon+title+description cards visually competed with the two carousels added
above them in §11–§19) and picked **Option A: compact "app launcher" grid** — icon + short
label only, no description, denser columns (5 desktop / 3 mobile).

- [x] 20.1 Design decision: **new component, not a `DashboardCard` variant.** Evaluated adding a
      `compact?: boolean` prop to the shared `DashboardCard`
      (`Front/src/shared/components/ui/DashboardCard/DashboardCard.tsx`) vs. a new
      `LauncherTile` local to `team-dashboard/components/`. Chose the new component: `DashboardCard`
      is also used by `Dashboard/components/DashboardCards.tsx` (the team-selection screen) with
      its icon+title+description, left-aligned, `min-height:112px` layout via the shared
      `Dashboard.module.css` `.cards` grid — a squashed 1:1 aspect-ratio, centered-icon,
      label-only tile is a different enough shape (alignment, aspect ratio, no description slot,
      denser grid) that reusing `DashboardCard` would need a pile of conditional styling for
      little actual reuse, and risks regressing the other consumer's layout. Created
      `Front/src/apps/coach/pages/team-dashboard/components/LauncherTile.tsx` +
      `LauncherTile.module.css` instead, mirroring `DashboardCard`'s FC26 visual language (same
      `--rffm-dash-card-bg`/`--rffm-dash-accent`/`--rffm-dash-card-text` tokens, chamfered corner
      via `clip-path`) but centered icon+label, `aspect-ratio: 1/1`, no description prop at all.
- [x] 20.2 Write `Front/src/apps/coach/pages/team-dashboard/components/__tests__/
      LauncherTile.test.tsx` first (Red): renders a `<Link>` with the full title as accessible
      name (`aria-label`) and correct `href`; renders the short label text visibly; never renders
      anything beyond icon + label (no description slot to test against).
- [x] 20.3 Implement `LauncherTile.tsx` + `.module.css` (Green).
- [x] 20.4 Rewired `TeamDashboardCards.tsx` to render `LauncherTile` instead of `DashboardCard`
      for all 14 entries (unchanged: titles, hrefs, `hasFeatureAccess` permission gating, the
      `isPlayer` gate on "Gestión de usuarios") — pure presentation swap, so the existing
      `TeamDashboardCards.permissions.test.tsx` and `TeamDashboardCards.teamUsers.test.tsx` (both
      assert via `getByRole("link", { name: <title> })`) needed zero changes and stayed green,
      confirming behavior was preserved.
- [x] 20.5 New `Front/src/apps/coach/pages/team-dashboard/TeamDashboardCards.module.css` (grid
      class only) instead of continuing to reuse `Dashboard.module.css`'s `.cards` — kept the two
      grids independent so `Dashboard/components/DashboardCards.tsx`'s layout is untouched. Grid:
      `repeat(3, 1fr)` mobile, `repeat(5, 1fr)` desktop at the same `min-width: 769px` breakpoint
      already used elsewhere in this change (Carousel, widgets side-by-side layout).
- [x] 20.6 Removed the per-card inline `style={{ fontSize: 40 }}` icon sizing (a `DashboardCard`-era
      pattern) — `LauncherTile.module.css`'s `.iconWrap`/`.iconWrap svg` now control icon size
      responsively (28px desktop / 24px mobile).
- [x] 20.7 Verified: `npm run test -- TeamDashboardCards LauncherTile TeamDashboard.test` green
      (4 files, 15 tests, no test file modified — only the new `LauncherTile.test.tsx` added);
      full `npm run test` — 665 passed, 3 skipped, 1 failure (`SeasonManager.test.tsx` — a
      timeout under full-suite load in an unrelated Settings/Seasons file never touched by this
      task; re-ran in isolation and it passed 6/6, confirming pre-existing flakiness, not a
      regression) plus the same pre-existing `e2e/scoped-membership.spec.ts` Playwright/Vitest
      config collision documented since §16; full `npm run build` clean, zero TypeScript errors.
- [ ] 20.8 Manual visual QA needed (not verifiable via jsdom): confirm the 5-col desktop / 3-col
      mobile grid actually reads as a dense "app launcher" and doesn't feel cramped at the
      768/769px boundary; confirm icon+label legibility at the smallest mobile width (2-line
      label clamp via `-webkit-line-clamp: 2` on longer titles like "Resumen de asistencias" /
      "Gestión de usuarios"); confirm the tile hover/focus lift still feels right at the smaller
      1:1 aspect ratio; confirm the grid no longer visually competes with the "A la vista"
      carousels above it, which was the point of this redesign.
