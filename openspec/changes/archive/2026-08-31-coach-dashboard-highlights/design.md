## Context

> **CORRECTION (2026-08-30, post-implementation)**: This design's original Decision 3 sourced the
> aggregate breakdown and `MyStatus` from `EventAttendanceConfirmation`/`AttendanceStatus` (the
> Mobile RSVP flow). After implementing and testing `GetEventAttendanceSummary` against the real
> app, the user identified this as wrong: the convocation form coaches and players actually use
> (`ConvocationCard.tsx`, backed by `Features/Coaches/Convocations/UpdateConvocationStatus.cs`)
> writes `Convocation.ConvocationStatusId`, an entirely separate status from
> `EventAttendanceConfirmation`. The two systems are unrelated — `EventAttendanceConfirmation` is
> the Mobile app's own RSVP flow (`ConfirmAttendance.cs`) and remains untouched, but
> `GetEventAttendanceSummary` no longer reads it. The rest of this section and Decision 3 below
> have been rewritten to reflect the corrected, shipped implementation. The **Frontend Design**
> section further down (Decisions 7–14, written by front-specialist before this correction) still
> describes the old `EventAttendanceConfirmation`/`ConfirmAttendance` integration for the
> dashboard widget's "mark my attendance" control (Decision 14) and `MyStatus` wording
> (Going/Pending/NotGoing) — that section is **stale** as of this correction and needs a matching
> revision by front-specialist before frontend implementation proceeds; it has not been rewritten
> here since it is outside this correction's (backend) scope.

**One convocation system is the source of truth.** `Convocation`
(`Domain/Aggregates/Assistances/Convocation.cs`) is the real convocation workflow: one row per
`(SportEventId, TeamPlayerId)` a coach convokes, with its own `ConvocationStatus` (`Pending=1,
Accepted=2, Justified=4, Deconvoke=5`, `Domain/Aggregates/Assistances/ConvocationStatus.cs`)
tracking the outcome — "Aceptar" sets `Accepted`, "Rechazar" sets `Deconvoke` (with
`ExcuseTypeId` defaulting to `7`, "Decisión técnica," when none is supplied), both written via
`PUT /api/events/{eventId}/convocations/{convocationId}/status`
(`UpdateConvocationStatus.cs`) — the same endpoint `ConvocationCard.tsx` (Front's real
convocation form, used in both the Attendance and Convocatorias pages) already calls. This is the
**only** data source `GetEventAttendanceSummary` reads. `EventAttendanceConfirmation`
(`Domain/Entities/EventAttendanceConfirmation.cs`) — the separate Mobile RSVP system, written via
`POST /api/mobile/events/{eventId}/attendance` (`Features/Mobile/Attendance/Commands/
ConfirmAttendance.cs`) — is a different, unrelated flow with no bearing on this endpoint; it is
left completely intact (not modified, not deleted), simply no longer read here.

`convocados` = `COUNT(Convocation WHERE SportEventId = eventId)` (unchanged from the original
design). For each of those rows, `ConvocationStatusId` is bucketed: `Accepted` → `Going`;
`Pending` (or an unset/unrecognized status id, defensively) → `Pending`; `Deconvoke` **and**
`Justified` → `NotGoing` (a justified absence is still an absence for this coach-facing aggregate
— see Decision 3 for the alternative considered and why it wasn't taken). `attendancePercentage`
= `Going / convocados * 100` (`0` when `convocados == 0`, avoiding a division-by-zero `NaN`) —
unchanged. `MyStatus`/`MyStatusId` now echo `ConvocationStatus`'s own name/id
("Pending"/"Accepted"/"Deconvoke"/"Justified"), not a Going/NotGoing relabeling — more honest to
the frontend, which needs the real status to decide what action ("Aceptar"/"Rechazar") to offer.
A new `MyConvocationId` field carries the caller's own `Convocation.Id` for the event, required
by the frontend to call `PUT /api/events/{eventId}/convocations/{convocationId}/status` directly
from the dashboard widget (that endpoint needs the convocation id, not just the team player id).

**Where today's event lists live, and why the summary is a new endpoint, not a field bolted onto
them.** `GetSportEvents.cs` (`GET /api/sport-events/{teamId}`) drives the Coach web Convocatorias/
Attendance list and is `[IRequireFeaturePermission FeatureRoute=CoachFeatureRoutes.Events]`,
cached implicitly? — no, it is **not** an `ICacheRequest` today (no caching), paginated, and
already does one `_db.Convocations.Any(...)` subquery per row for `HasConvokedPlayers`.
`GetEventConvocations.cs` / `GetEventAttendanceRoster.cs` are per-event, per-player detail
endpoints scoped by `IRequireTeamMembership` (`TeamId` resolved server-side from the event, so a
Player/FamilyMember caller is restricted to their own team). None of the three compute the
aggregate counts this proposal needs.

**News has no team/club scope.** `NewsItem` (`Domain/Entities/News/NewsItem.cs`) has no
`TeamId`/`ClubId` property, and `GetNews`/`GetNewsById` treat Published items as visible to *any*
authenticated role — it is federation-wide editorial content, not a per-team resource. The
precedent cited in the task framing (`openspec/changes/archive/2026-08-30-coach-team-user-
management/`) uses `IScopeAuthorizationService.EnsureCreatorAsync(userId, scopeKind, scopeId,
...)`, which requires a concrete `Team`/`Club` `scopeId` to resolve "is this caller the creator of
*that* team/club" — there is no scope to pass for a `NewsItem`. **Resolved**: the user confirmed
News authorization stays role-based (`Coach,Administrator`); `EnsureCreatorAsync` is not adopted
for News in this or any near-term change — see Decision 4 (closed).

## Goals / Non-Goals

**Goals:**
- One reusable, batch-friendly endpoint for the attendance-summary aggregate, callable with up to
  a handful of `eventIds` at once (3 for the dashboard widget, however many are on-screen for the
  Convocatorias/Attendance list) without N+1 queries.
- Support both the coach aggregate view and the player/family "my own status for this event"
  view from the same endpoint, since both consumers (widget for coach, widget for player/family)
  hit the same URL — no separate endpoint per role.
- Close the Publish/Unpublish asymmetry in the News feature with a new command that mirrors
  `PublishNews.cs`'s existing shape exactly.
- Let `GetNews` serve "most recent published news first" so the dashboard's news widget can
  request it directly, without a client-side reorder (Decision 6).

**Non-Goals:**
- Not changing `GetSportEvents`, `GetEventConvocations`, or `GetEventAttendanceRoster` response
  shapes — the summary is additive and separately fetched.
- Not adding a `TeamId`/`ClubId` scope to `NewsItem`, and not changing News CRUD authorization
  from `Roles = "Coach,Administrator"` to creator-only — **confirmed by the user as final**
  (Decision 4, closed), not a change deferred for later.
- No database migration.

## Decisions

### 1. New batch endpoint `GET /api/sport-events/attendance-summary?eventIds=a,b,c`, not a field added to `GetSportEvents`

**Decision**: Add `Features/Coaches/SportEvents/Queries/GetEventAttendanceSummary.cs` as its own
`IFeatureModule`, taking a comma-separated `eventIds` query parameter (capped, see Validator),
returning one summary object per requested event id.

**Why**: `GetSportEvents.SportEventResponse` is a widely-consumed, paginated DTO; embedding a
per-row aggregate (two extra grouped subqueries) would tax *every* caller of that endpoint even
when the summary isn't needed (e.g. calendar-only views), and would force a cache-key change for
any future caching of `GetSportEvents`. A separate batch endpoint lets each consumer (dashboard
widget: 3 ids; Convocatorias/Attendance list: however many rows are visible) request exactly the
summaries it needs in one round trip, keeps `GetSportEvents` untouched (Non-Goal), and is the
"reusable piece" the task explicitly asks for rather than a one-off dashboard field.

**Alternative considered**: A per-event endpoint `GET /api/events/{eventId}/attendance-summary`
mirroring `GetEventConvocations`/`GetEventAttendanceRoster`'s per-event shape. Rejected — the
dashboard widget and the event-list page both need *several* events' summaries on one screen
load; a per-event endpoint would force N HTTP calls where N is the number of visible cards, which
is exactly the kind of chattiness a batch endpoint avoids for a "list of cards" UI.

### 2. Authorization: `IRequireTeamMembership` resolved from a required `teamId` query parameter, not per-event lookup

**Decision**: The query record requires both `TeamId` (query parameter) and `EventIds`; the
handler filters `Convocation`/`EventAttendanceConfirmation` to events that belong to `TeamId`
(via a `SportEvents.Where(se => se.TeamId == teamId && ids.Contains(se.Id))` guard) before
aggregating, silently dropping any requested id that doesn't belong to the team. Marked
`IRequireFeaturePermission` (`FeatureRoute = CoachFeatureRoutes.Events`, `RequiredPermission =
"Read"`) and `IRequireTeamMembership` (`TeamId` from the query param), matching `GetSportEvents`'s
own authorization shape exactly since this is its sibling/complement endpoint.

**Why**: `GetEventConvocations`/`GetEventAttendanceRoster` resolve `TeamId` server-side from a
single `eventId` route parameter (cheap: one event to look up). A batch endpoint has multiple
event ids that could, in a malicious/buggy request, span teams the caller has no access to;
requiring the caller to declare which team they're asking about and then filtering server-side to
that team's own events is the same trust boundary `GetSportEvents` already uses (`{teamId}` in
the route) and avoids N per-id ownership checks.

**Alternative considered**: Resolve `TeamId` from the first valid event found among `EventIds`
(like the single-event endpoints do). Rejected — ambiguous when `EventIds` spans zero or multiple
teams, and more expensive (an extra query) than trusting the explicit `teamId` param the same way
`GetSportEvents` already does.

### 3. Response includes `MyStatus`/`MyStatusId`/`MyConvocationId` only when the caller is Player/FamilyMember AND is convoked to that specific event — sourced from `Convocation.ConvocationStatusId`, revised

**Status**: Revised (2026-08-30, post-implementation correction — see the Context callout above).
The original decision sourced `myStatus` from `EventAttendanceConfirmation`; this revision
replaces that with `Convocation.ConvocationStatusId`, the real convocation form's data.

**Decision**: The handler checks `currentUser.Roles` for `Player`/`FamilyMember` (same
`RestrictedRoles` convention as `TeamMembershipBehavior.cs:20`); if matched, it resolves the
caller's `UserTeam.LinkedTeamPlayerId` for `TeamId`. Per event, it then looks for a `Convocation`
row matching `(eventId, myTeamPlayerId)` among that event's own convocations (the same list
already fetched for the aggregate counts — no extra query). Only when that row exists does the
response include `myStatus` (`ConvocationStatus`'s own name — "Pending"/"Accepted"/"Deconvoke"/
"Justified", defensively falling back to `"Pending"` for a `null`/unrecognized `ConvocationStatusId`
rather than throwing), `myStatusId` (the same, as an int), and `myConvocationId` (that
`Convocation.Id`). When the linked player is **not** convoked to that event (no matching row),
all three fields stay `null` — this is deliberately distinct from `"Pending"`, letting the
frontend show "not called up" (no badge, no action buttons) instead of a misleading "pending
response" prompt for an event the player was never invited to. (This not-convoked-is-null
behavior was itself a bug fix applied before this data-source correction — the original
implementation defaulted to `"Pending"` for any linked player regardless of convocation, which
this design's Decision 3 always intended but the first implementation got wrong; both issues are
now fixed together.) For Coach/Administrator/other roles, all three fields are `null` and only
the aggregate breakdown is populated.

**Bucketing decision — `Justified` folds into `NotGoing`, no 4th response field**: `Accepted` →
`going`; `Deconvoke` and `Justified` → `notGoing`; `Pending` (or unset/unrecognized) → `pending`.
A `Justified` convocation means the player will not attend (with an accepted excuse) — from the
coach's aggregate-breakdown point of view, that is indistinguishable in *effect* from `Deconvoke`
(the player isn't coming), so it is folded into `notGoing` rather than adding a fourth counted
bucket to the response. This keeps the response shape stable (`going`/`pending`/`notGoing`,
unchanged field names from the original design) rather than forcing every consumer (dashboard
widget, `EventCard`, `MatchCard` badges) to handle a `justified` field most UIs would just add to
their "not attending" display anyway. `MyStatus`/`MyStatusId` still surface the real, un-folded
`ConvocationStatus` name/id ("Justified", not "NotGoing") for the caller's own row, so a
player-facing UI that wants to say "justificado" specifically still can — only the coach-facing
*aggregate counts* fold Justified into NotGoing.

**Alternative considered (bucketing)**: Add a fourth `justified: int` field to
`EventAttendanceSummaryResponse`, keeping `notGoing` strictly meaning `Deconvoke` only.
Rejected for this revision — no consumer (dashboard widget's aggregate coach view, `EventCard`/
`MatchCard` badges) was specified as needing to distinguish "declined" from "excused-absence" in
the aggregate counts; folding keeps the contract smaller. If a future UI need for that
distinction emerges, adding the field is additive (non-breaking) and can be done then.

**Alternative considered (two endpoints)**: Two separate endpoints (`.../attendance-summary` for
coach, `.../my-status` for player/family). Rejected — both need the exact same `Convocation`
query per event; splitting them means running that query twice for the same page load in the
common case (a coach's dashboard also shows in the same shared `TeamDashboard.tsx` layout used
for players), and doubles the contract front-specialist has to integrate against for what is
fundamentally one dataset viewed two ways.

### 4. News authorization stays `Coach,Administrator`; creator-only is rejected — CLOSED

**Status**: Closed. The user confirmed (2026-08-30) that News authorization stays role-based;
`EnsureCreatorAsync`/team-scoping is explicitly not adopted for News, now or as a deferred
follow-up implied by this change.

**Decision**: `UnpublishNews.cs` (the only new News file) uses the identical `AuthorizeAttribute {
Roles = "Coach,Administrator" }` every other News command already uses. No change to `CreateNews`/
`UpdateNews`/`DeleteNews`/`PublishNews`/`GetNewsDrafts` authorization, and no `TeamId`/`ClubId`
added to `NewsItem`.

**Why**: As established in Context, `NewsItem` has no scope to pass to
`IScopeAuthorizationService.EnsureCreatorAsync` — implementing "only the team creator can manage
news" as literally requested would require first deciding (a) is News per-team or per-club
content going forward, a product decision with no obvious existing precedent since today it is
federation-wide, and (b) a migration backfilling every existing `NewsItem` row with *some* scope,
which has no unambiguous historical owner. Both are out of proportion for a change whose stated
goal is a dashboard widget, and doing it silently/implicitly would change who can publish
federation-wide content without an explicit confirmation. This was surfaced to the user, who
confirmed the existing role-based check is sufficient — no migration, no `TeamId`/`ClubId` on
`NewsItem`, no `EnsureCreatorAsync` adoption for News. `UnpublishNews` ships under the same rule
as its sibling `PublishNews` so the feature is symmetric with what exists today.

**Alternative considered**: Add `TeamId`/`ClubId` to `NewsItem` now and gate all News commands
with `EnsureCreatorAsync`. Rejected by the user — no migration is listed as needed in the
proposal (matching the task's own "probablemente ninguna" expectation), and unilaterally deciding
News becomes team-scoped would be a **BREAKING** change to the existing `news` spec's "Published
news are listable by any authenticated user" requirement that no one has asked to change.

### 5. `UnpublishNews` mirrors `PublishNews.cs` exactly: same route shape, same cache-invalidation prefix, same conflict semantics

**Decision**: `POST /api/coach/news/{id}/unpublish` → `UnpublishNewsCommand(string Id) :
IRequest<NewsDetailResponse>, IInvalidateCacheRequest` with `PrefixCacheKey =>
NewsConstants.PublishedListCachePrefix`; handler loads the item, calls a new `NewsItem.Unpublish()`
domain method (mirrors `Publish()`: throws `ConflictException` with a new
`ErrorCodes.NewsNotPublished` if `Status != Published`, else sets `Status = Draft`, `PublishedAt =
null`, `UpdatedAt = now`), saves, returns `204`... actually mirrors `PublishNews`'s `200 OK` with
the updated `NewsDetailResponse` (not `204`) for symmetry, and does **not** call
`IPushNotificationDispatcher` (no "your news was unpublished" notification exists or is
requested).

**Why**: `PublishedListCachePrefix` cache invalidation matters here too — an unpublished item must
disappear from `GetNews`'s cached published list, exactly like publishing must appear in it — so
reusing the identical prefix-invalidation mechanism `PublishNews`/`CreateNews`/`UpdateNews`/
`DeleteNews` already use is correct, not optional. Returning the full `NewsDetailResponse` (vs.
`204 No Content`) matches `PublishNews`'s existing choice, which the frontend will already know
how to consume if/when a "Despublicar" button reuses the same response-handling code path as
"Publicar".

**Alternative considered**: `PATCH /api/coach/news/{id}/status` accepting a `Draft`/`Published`
enum, replacing both `publish` and `unpublish` with one endpoint. Rejected — `PublishNews.cs`
already ships and is presumably wired into the (currently backend-only, since the CRUD UI doesn't
exist per the task's own — now corrected — framing) News admin flow; changing its route shape is
an unrequested, unnecessary breaking change for a feature whose actual gap is just "no reverse
operation," not "the operation is shaped wrong."

### 6. `GetNews` gains a `descending` query parameter, defaulting to today's ascending order — CLOSED

**Status**: Closed. The user confirmed the dashboard's "3 most recent news" widget should be able
to request `GetNews` directly in most-recent-first order, rather than fetching a larger page and
reordering client-side.

**Decision**: Add an optional `bool descending = false` parameter to `GET /api/coach/news`
(`GetNewsQuery` in `Features/Coaches/News/GetNews.cs`), mirroring `GetSportEvents`'s existing
`Descending` flag (`Features/Coaches/SportEvents/Queries/GetSportEvents.cs:44`) both in name and
default value (`false`, so today's callers — including any already-shipped frontend code that
doesn't pass the parameter — see no behavior change). The handler applies
`request.Descending ? query.OrderByDescending(n => n.NewsDate) : query.OrderBy(n => n.NewsDate)`
in place of the current unconditional `OrderBy(n => n.NewsDate)`. The `ICacheRequest.CacheKey`
gains the flag: `$"{NewsConstants.PublishedListCachePrefix}{PageNumber}:{PageSize}:{Descending}"`,
so ascending and descending pages of the same `pageNumber`/`pageSize` are cached under distinct
keys and never collide or serve stale-ordered data to each other.

**Why**: `GetSportEvents` already establishes the exact convention (`Descending` bool query
param, default `false`, same naming) for this codebase — reusing it on `GetNews` avoids inventing
a second convention (e.g. a `sort=newsDate:desc` string, which `GetSportEvents` does not use) for
what is the same underlying need. Extending the cache key is required, not optional: `GetNews` is
an `ICacheRequest` (`CachingBehavior` caches per `CacheKey`) — without the flag in the key, the
first caller (ascending or descending) to populate the cache for a given `pageNumber:pageSize`
would silently serve its ordering to the other, which is a real correctness bug once two ordering
modes exist for the same endpoint, not a cosmetic detail.

**Alternative considered**: A separate `GET /api/coach/news/recent` endpoint hard-coded to
descending + a fixed small page size, purpose-built for the widget. Rejected — `GetSportEvents`'s
own precedent is a single endpoint with a `Descending` flag, not a parallel endpoint per sort
order; a generic `descending` parameter is reusable by any future "most recent news" surface
(e.g. Mobile's `mobile-news` spec, not touched by this change) without adding another file.

## Risks / Trade-offs

- **[Risk]** `GetEventAttendanceSummary`'s `eventIds` query parameter has no explicit cap, so a
  caller could request an unbounded number of event ids in one call. → **Mitigation**: Validator
  rejects more than 50 ids (`RuleFor(x => x.EventIds).Must(ids => ids.Length <= 50)`), comfortably
  above the widget's 3 and a typical event-list page's visible count, while bounding worst-case
  query cost.
- **[Accepted — CLOSED, superseded wording]** An event with zero `Convocation` rows reports
  `convocados = 0` and `attendancePercentage = 0` — only an explicit `Convocation` row counts as
  "convocado," confirmed by the user as intended, final semantics. (This bullet originally
  described this as an intersection with `EventAttendanceConfirmation`/Mobile RSVP data; after the
  2026-08-30 data-source correction — see Context — `GetEventAttendanceSummary` no longer reads
  `EventAttendanceConfirmation` at all, so there is no longer a second data source to intersect
  with. The "zero convocados → zero percentage, even if some other signal exists" semantics is
  unchanged and still applies, now simply because `Convocation` is the only signal.)
- **[Accepted — CLOSED]** `Justified` convocations are folded into the `notGoing` aggregate count
  (Decision 3) rather than getting a dedicated 4th response field. → **Accepted**: no current
  consumer needs the distinction in the aggregate view; `myStatus` for the caller's own row still
  surfaces "Justified" un-folded, so a player-facing UI retains the distinction where it matters.
- **[Trade-off]** `GetEventAttendanceSummary` is not cached (`ICacheRequest`), unlike `GetNews`.
  → **Accepted**: attendance data changes frequently (any family RSVP or coach convocation edit
  invalidates it), and the existing sibling endpoints (`GetEventConvocations`,
  `GetEventAttendanceRoster`) are likewise uncached — consistent with how this data is already
  treated elsewhere in the codebase.

## Frontend Design (front-specialist)

> **CORRECTION APPLIED (2026-08-30, post-implementation) — front-specialist.** Following the
> backend's data-source correction (top-of-file Context note, Decision 3), this section's
> Decision 14, the `EventAttendanceBadges` status wording (Decision 7), and every UI-facing
> reference to `confirmMyAttendance`/`ConfirmAttendance`/Going-Pending-NotGoing have been revised
> to match the corrected `Convocation`-sourced contract. The widget now writes through
> `convocationService.updateConvocationStatus` (`ConvocationCard.tsx`'s existing write path), and
> `myStatus` uses real `ConvocationStatus` names (`Pending`/`Accepted`/`Deconvoke`/`Justified`).
> Decision 14's original (Mobile-based) text is preserved in a collapsed `<details>` block for
> history. The remaining frontend decisions (news widget/CRUD, dashboard layout, `MatchCard`/
> `EventCard` id-threading, the shared `Carousel`) are unaffected by this correction.

### Context

**`TeamDashboard.tsx` today is one component rendering `TeamDashboardCards.tsx`, nothing else.**
`Front/src/apps/coach/pages/team-dashboard/TeamDashboard.tsx` resolves `team`/`isPlayer` via
`useTeamAndClub()` and `usePlayerAutoLoad()` (the same `isPlayer` flag already used by
`archive/2026-08-30-coach-team-user-management`'s Decision 6 to gate a dashboard card) and passes
both straight through to `TeamDashboardCards`. There is no existing "widgets above the cards"
section anywhere in the Coach app to mirror — this is new layout, not a refactor of an existing
pattern.

**Two separate existing event-card renderers — both, on closer investigation, always have a real
event id.** `Front/src/apps/coach/pages/attendance/EventCard.tsx` (rendered from `Attendance.tsx`,
backed by `sportEventService.getSportEvents`) always has `event.id` — a real `SportEvent.Id` —
because it is fed directly from the paginated `GET /api/sport-events/{teamId}` response.
`Front/src/apps/coach/pages/convocations/components/MatchCard.tsx` (rendered from
`Convocations.tsx`) is fed a `NormalizedMatch` (`pages/convocations/types.ts`) built by
`normalizeFromSportEvent` **or** `normalizeRawMatch` (`pages/convocations/helpers/
convocationUtils.ts`) — the latter parses raw, unsynced federation calendar rows with no
corresponding internal `SportEvent`, which is why an earlier draft of this design (Decision 9,
now revised) assumed `NormalizedMatch` could reach `MatchCard` with no id. **Re-reading
`useConvocations.ts` end-to-end shows this assumption was wrong**: `normalizeRawMatch` is called
*only* inside `handleSyncCalendar` (`useConvocations.ts:102-155`), to build the payload for
`POST /api/sport-events/sync-calendar` — its output is never stored into the hook's `matches`
state and never reaches `MatchCard`/`AgendaList`. The `matches` state that `Convocations.tsx`
actually renders (`useConvocations.ts:38-85`, `loadCoachEvents`) is built **exclusively** from
`sportEventService.getSportEvents(teamId, ...)` → filtered to match-type events →
`normalizeFromSportEvent(ev)`. A coach must click "Generar calendario" (sync) before any
federation match appears as a card at all; pre-sync, unsynced matches are simply absent from the
list, not present as id-less cards. **Conclusion: every `MatchCard` this page renders today
already carries a real `SportEvent.Id`** — see the revised Decision 9.

**News is a Player-visible feature route with no CRUD UI at all today.**
`COACH_FEATURE_ROUTES.News` (`Front/src/apps/coach/constants/featureRoutes.ts:18`) is listed
under the "Allowed for Player (Read-only)" comment block — the same feature route gates both
Coach and Player/FamilyMember access, with no separate "read" vs. "manage" route. `News.tsx`
(`Front/src/apps/coach/pages/news/News.tsx`) is currently an empty shell (`{/* Contenido de
noticias */}`) — no service file, no list, no create/edit dialog exist yet, even though the full
backend CRUD (`CreateNews`, `UpdateNews`, `DeleteNews`, `PublishNews`, `GetNewsDrafts`,
`GetNewsById`, `UploadNewsImage`) already ships (see proposal.md's "Correction to the original
ask").

**Attendance confirmation (`myStatus`) — REVISED: writes through `Convocation`, the real
convocation workflow, not Mobile's `ConfirmAttendance`.** An earlier draft of this section (and of
Decision 14 below) had the widget write to `EventAttendanceConfirmation` via
`POST /api/mobile/events/{eventId}/attendance`. Once `GetEventAttendanceSummary` was corrected
(top-of-file Context correction, backend Decision 3) to read `myStatus`/`myConvocationId` from
`Convocation.ConvocationStatusId` instead, the widget's write path had to follow: it now calls
`Front/src/apps/coach/services/convocationService.ts`'s `updateConvocationStatus` — the same
function `ConvocationCard.tsx` (Front's real convocation form) already uses, via
`PUT /api/events/{eventId}/convocations/{convocationId}/status`
(`UpdateConvocationStatus.cs`). This endpoint requires no new permission wiring either — it's the
one `ConvocationCard.tsx` already calls for the same roles. See Decision 14 for the full detail;
`Front/src/apps/coach/constants/featureRoutes.ts`'s `AttendanceConfirmation` entry (added for the
now-superseded Mobile call) is left in place since it still correctly mirrors the backend's
`CoachFeatureRoutes.AttendanceConfirmation` constant, even though the widget no longer calls that
particular endpoint. The player/family upcoming-events widget this change adds is **interactive**,
not read-only.

### Goals (frontend)

- One shared hook/service pair for the attendance-summary endpoint, called once per page load
  with the currently-visible event ids, consumed identically by the new dashboard widget, the
  Attendance event-card list, and the Convocatorias match-card list — never a per-card network
  call.
- The dashboard's "A la vista" section renders two independent widgets (events, news); either can
  be empty/loading/erroring without blocking the other, and neither blocks
  `TeamDashboardCards` below it from rendering.
- Coach and player/family see materially different content from the *same* widget component tree
  (aggregate counts vs. own status), driven by the `isPlayer` flag already resolved by
  `usePlayerAutoLoad()` — no new role-detection mechanism.
- `News.tsx` becomes a real page: any role with `COACH_FEATURE_ROUTES.News` access sees the
  published list; Coach/Administrator additionally see create/edit/publish/unpublish controls and
  a drafts tab. A new `NewsDetail.tsx` route renders one article read-only, linked from both the
  list and the new dashboard widget.
- The player/family upcoming-events widget lets the caller mark their own convocation status
  (Accepted/Deconvoke) directly from the widget, reusing `ConvocationCard.tsx`'s existing write
  path (`convocationService.updateConvocationStatus`) — no backend change (Decision 14).

### Non-Goals (frontend)

- Not adding a "mark attendance" action to `EventCard.tsx`/`MatchCard.tsx`/`AttendanceEvent.tsx`
  or to the coach's own view of any of these — the interactive control is scoped to the
  player/family upcoming-events widget only (Decision 14), matching what was actually asked for.
  A coach setting convocation status *on behalf of* a player already exists via
  `ConvocationCard.tsx` itself — this widget doesn't duplicate that surface.
- Not adding a second Axios instance, a new global store, or a barrel `index.ts` — every new file
  follows the conventions in `.claude/rules/react.md` / `frontend-architecture.md` exactly.
- Not building fuzzy date+rival matching for `MatchCard.tsx` — investigation (Decision 9, revised)
  found the problem it would have solved doesn't exist in the current UI: every rendered
  `MatchCard` already has a real `eventId`.

### Decisions

### 7. One shared hook (`useEventAttendanceSummaries`) + one presentational component (`EventAttendanceBadges`), not three separate fetches

**Decision**: Add `Front/src/apps/coach/services/eventAttendanceSummaryService.ts` exporting
`getEventAttendanceSummaries(teamId: string, eventIds: string[]): Promise<EventAttendanceSummaryDto[]>`
(calls `GET /api/sport-events/attendance-summary?teamId=...&eventIds=...`, comma-joining
`eventIds` client-side to match the backend's CSV parsing). Add `Front/src/apps/coach/hooks/
useEventAttendanceSummaries.ts`: takes `(teamId: string | undefined, eventIds: string[])`, returns
`{ summaries: Record<string, EventAttendanceSummaryDto>, loading, error, refetch }`, re-fetching
when the **sorted, joined** `eventIds` string changes (not on every array-identity change, since
callers rebuild their `eventIds` array on every render from paginated/query state). Add
`Front/src/apps/coach/components/EventAttendanceBadges/EventAttendanceBadges.tsx` +
`.module.css`: a small presentational component taking `{ summary: EventAttendanceSummaryDto |
undefined, isPlayer: boolean }`, rendering either the coach aggregate chips
(`convocados · going/pending/notGoing · %`) or the player/family "Tu estado: <myStatus>" chip,
`null` while `summary` is `undefined` (still loading, or the event was silently omitted per the
backend's team-mismatch behavior).

**Why**: The task explicitly requires "reutiliza el mismo hook/servicio que el widget nuevo, no
dupliques la llamada" across three call sites (dashboard widget, `EventCard.tsx`, `MatchCard.tsx`).
A single hook keyed by the caller-supplied `eventIds` (rather than one global cache) lets each page
request exactly the ids it currently renders — the dashboard widget's 3 ids, `Attendance.tsx`'s
current page of up to `pageSize` ids, `Convocations.tsx`'s currently-expanded month's ids — without
coordinating a shared cache invalidation story across unrelated pages. `EventAttendanceBadges` as
a separate presentational component (not inlined three times) is what actually prevents the
"badge markup" from drifting between the three call sites, which is the more likely duplication
risk once the hook itself is shared.

**Alternative considered**: A single app-wide `EventAttendanceSummaryContext` populated once at
`TeamDashboard`/`Attendance`/`Convocations` mount and read by descendants. Rejected — these three
pages are not nested under a common layout that outlives navigation between them (each is its own
lazy-loaded route), so a context would either need to live above the router (too broad a scope for
data that's relevant to 3 of ~15 Coach pages) or be re-created per page anyway, at which point it
adds indirection over a plain hook without the payoff of a real cross-page cache.

### 8. Coach vs. player/family rendering reuses `usePlayerAutoLoad()`'s `isPlayer`, no new role hook

**Decision**: `UpcomingEventsWidget` and `EventAttendanceBadges` both take `isPlayer: boolean` as a
prop, threaded from `TeamDashboard.tsx`'s existing `usePlayerAutoLoad()` call down through
`TeamDashboardCards`'s sibling widget (not through `TeamDashboardCards` itself — the widgets render
above it, as siblings in `TeamDashboard.tsx`, not children of `TeamDashboardCards`). `Attendance.tsx`
and `Convocations.tsx` independently call `usePlayerAutoLoad()` themselves (already a cheap,
idempotent hook — see Context) to get `isPlayer` for their own `EventCard`/`MatchCard` badge props,
rather than threading it down from a shared ancestor neither page has.

**Why**: `isPlayer` is already the codebase's established "is this caller a
Player/FamilyPlayer/FamilyMember without coach/admin access" signal (Context; also
`archive/2026-08-30-coach-team-user-management` Decision 6). Reusing it avoids a second
role-detection mechanism that could disagree with the first. Each page calling
`usePlayerAutoLoad()` independently (rather than lifting it to a shared provider) matches the
existing pattern — `Attendance.tsx`/`AttendanceTabs.tsx` and `Convocations.tsx` already resolve
their own coach-vs-player distinctions locally (`isPlayerOrFamily` in `AttendanceTabs.tsx:81`,
`canEditEvent` in `EventCard.tsx:148`) rather than receiving it via a shared context.

### 9. `NormalizedMatch` gains `eventId` — REVISED: no fuzzy matching needed, every rendered `MatchCard` already has one

**Status**: Revised after investigation prompted by an open question raised in an earlier draft
of this design ("should federation-synced matches with no backing `SportEvent` get a fuzzy
date+rival-matched `eventId`?"). The investigation's answer is that the premise was wrong — see
Context's "Two separate existing event-card renderers" paragraph for the full trace through
`useConvocations.ts`.

**Decision**: Add `eventId?: string` to `NormalizedMatch` (`pages/convocations/types.ts`) — kept
optional only for type parity with `normalizeRawMatch`'s output shape (see below), not because a
rendered card is expected to lack one. `normalizeFromSportEvent` (`convocationUtils.ts:21`) sets
it to `ev.id`. `Convocations.tsx`'s `matches` state, which is what `MatchCard`/`AgendaList`
actually render, is built **exclusively** via `normalizeFromSportEvent` (`useConvocations.ts:79`,
`matchEvents.map(normalizeFromSportEvent)`) — `normalizeRawMatch` (`convocationUtils.ts:89`) is
called only inside `handleSyncCalendar` to build the `POST /api/sport-events/sync-calendar`
payload, and its output never becomes a `NormalizedMatch` in `matches` state. So in practice,
every `MatchCard` `Convocations.tsx` renders today has `eventId` set. `MatchCard.tsx` still
renders `<EventAttendanceBadges summary={match.eventId ? summaries[match.eventId] : undefined}
isPlayer={isPlayer} />` — the `match.eventId ? ... : undefined` guard is defensive (protects
against a future code path that renders a raw/unsynced match directly, and against a summary that
hasn't loaded yet, per Decision 7), not a routinely-hit branch. `Convocations.tsx` collects
`matches.map(m => m.eventId).filter((id): id is string => !!id)` as the `eventIds` array passed to
`useEventAttendanceSummaries` — in practice this equals `matches.map(m => m.eventId)` with no
filtering actually removing anything, but the `.filter(Boolean)` stays for type-safety and as a
guard against the type's optionality.

**Why**: No backend change and no fuzzy id-resolution logic (date+rival heuristic matching) are
needed — the acceptance criteria's "badges en las tarjetas del listado ya existente" is fully
satisfiable by threading the id that's already present on every card's underlying `SportEvent`.
Building a fuzzy matcher for a case that doesn't occur in the current UI would be speculative,
unrequested complexity with a real failure mode (false positives/negatives on date+rival matching)
for zero actual benefit today.

**Alternative considered**: Build a best-effort `eventId` resolver for federation-only rows anyway,
as defensive future-proofing. Rejected — `Convocations.tsx` has no code path that renders
`normalizeRawMatch`'s output as a card today, and adding speculative matching logic for a
hypothetical future UI change is exactly the kind of premature complexity this design should
avoid; if a future change does add a "browse unsynced federation matches" view, resolving that
view's `eventId` question belongs to that change, with its own investigation of what correlation
key is actually reliable then (e.g. `codActa`/`matchRecordCode`, which both `SportEvent` and raw
federation rows already carry and which — unlike date+rival — is an exact match key already used
by `handleSyncCalendar`'s own sync payload, not a fuzzy one).

### 10. Upcoming-events widget: reuse `getSportEvents(teamId, 1, 3, todayISO, undefined, false)` verbatim, no new query params

**Decision**: `Front/src/apps/coach/pages/team-dashboard/components/UpcomingEventsWidget.tsx` +
`.module.css` calls `sportEventService.getSportEvents(team.id, 1, 3, new Date().toISOString().
slice(0, 10))` (existing function, existing signature — see this design's own "This same endpoint
is called by" note in the API Contract section) to get the next 3 events, then
`useEventAttendanceSummaries(team.id, events.map(e => e.id))` for their badges. Each event renders
as a compact card (title, date/time, `EventAttendanceBadges`) linking to
`` `/coach/attendance/${event.id}?teamId=${team.id}` `` (the existing `attendance/:id` route,
`AttendanceEvent.tsx`) for both coach and player/family — the same detail page both roles already
reach from the Attendance list today.

**Why**: The proposal's own "Reutiliza" line in the task framing says exactly this — no new
backend query shape needed. Linking to the existing `attendance/:id` detail route (rather than a
new dashboard-specific detail view) means the widget's "view details" action lands on a page that
already renders correctly for both roles (Context: `AttendanceEvent.tsx`/`AttendanceTabs.tsx`
already branch on `isPlayerOrFamily`).

### 11. `News.tsx`: one role-branching page, not two separate routes for "read" vs. "manage"

**Decision**: `News.tsx` fetches `GET /api/coach/news?pageNumber=1&pageSize=20&descending=true`
(published list, any role) via a new `newsService.ts`. When the caller is Coach/Administrator
(checked via `coachAuthService.hasRole("Coach") || coachAuthService.hasRole("Administrator")` —
the same pattern already used by `EventCard.tsx:148-152`'s `canEditEvent`, since that's the
codebase's established way to branch UI on the caller's own role, as opposed to `hasFeatureAccess`
which checks *page-level* access, not *action-level* permissions within a page they already
reached), the page additionally renders: a "Publicadas"/"Borradores" tab switcher (drafts via
`GET /api/coach/news/drafts`), a "Nueva noticia" button opening `NewsFormDialog` (create), per-card
"Editar"/"Publicar"/"Despublicar"/"Eliminar" actions. Non-Coach/Administrator callers
(Player/FamilyMember, per the "Allowed for Player (Read-only)" comment) see the published list
only, each card linking to `NewsDetail.tsx` — no tabs, no buttons.

**Why**: One backend feature route (`COACH_FEATURE_ROUTES.News`) already gates *reaching* the page
at the router level (`routes.tsx`'s existing `RequireFeaturePermission featureRoute={COACH_FEATURE_
ROUTES.News}`) for both roles — splitting into two routes would need a second feature route with
no backend seed to back it (the same problem `archive/2026-08-30-coach-team-user-management`
Decision 6 already ran into and explicitly avoided by reusing an existing coarse signal rather than
inventing a new gate). The backend independently enforces the real authorization on every mutating
call (`403` for non-Coach/Administrator on create/update/delete/publish/unpublish) — the frontend
role branch here is a UI convenience (hide buttons a non-coach can't use), not the security
boundary, exactly like Decision 6's precedent.

### 12. `NewsDetail.tsx`: new read-only route `/coach/news/:id`, backed by `GetNewsById`

**Decision**: Add `Front/src/apps/coach/pages/news/NewsDetail.tsx` + `.module.css`, registered in
`routes.tsx` as `<Route path="news/:id" element={<RequireFeaturePermission featureRoute={COACH_
FEATURE_ROUTES.News}><NewsDetail /></RequireFeaturePermission>} />` (same gate as `news`). Calls
`newsService.getNewsById(id)` (`GET /api/coach/news/{id}`), renders title/subtitle/body/cover
image/`newsDate`, with a "Volver a noticias" back button to `/coach/news`. Linked from: each
`News.tsx` list card (both roles), and the dashboard's `NewsWidget` (Decision 13).

**Why**: The acceptance criteria explicitly ask for "enlace a detalle" from the dashboard widget.
`GetNewsById` already exists and already handles the Draft-visibility rule server-side (only
Coach/Administrator can fetch a Draft item by id, `GetNewsById.cs:50-58`) — reusing it here means
`NewsDetail.tsx` needs no client-side draft-visibility logic of its own; a `404` naturally covers
"a Player tried to open a Draft's detail link," which cannot happen from the UI anyway since
`News.tsx` only ever links Published items for non-coach roles (Decision 11).

### 13. `NewsWidget`: `GET /api/coach/news?pageNumber=1&pageSize=3&descending=true`, same list-card look as `News.tsx`, reused component

**Decision**: `Front/src/apps/coach/pages/team-dashboard/components/NewsWidget.tsx` +
`.module.css` calls `newsService.getNews(1, 3, true)` and renders up to 3 compact cards (title,
`newsDate`, cover image thumbnail), each linking to `` `/coach/news/${item.id}` ``. The card markup
is a new, small presentational component (`Front/src/apps/coach/pages/news/components/
NewsListCard.tsx` + `.module.css`) shared between `NewsWidget` (dashboard) and `News.tsx` (full
list) so the two surfaces stay visually consistent without copy-pasted JSX.

**Why**: Matches Decision 6 from the backend half of this design exactly (`GetNews` already gained
`descending` for precisely this widget) — no new endpoint needed. Extracting `NewsListCard` once,
used by both `NewsWidget` and `News.tsx`, follows the same "shared presentational component, not
copy-pasted markup" pattern established by Decision 7's `EventAttendanceBadges`.

### 14. Player/family upcoming-events widget gets a "mark my attendance" control — REVISED to call the real convocation endpoint, not Mobile's `ConfirmAttendance`

**Status**: Revised a second time (2026-08-30, post-implementation), superseding the version below.
The original version of this decision (preserved beneath the line for history) had the widget call
`POST /api/mobile/events/{eventId}/attendance` (Mobile's RSVP flow,
`EventAttendanceConfirmation`). Once `GetEventAttendanceSummary` itself was corrected (Context's
top-of-file correction note, Decision 3) to source `myStatus`/`myConvocationId` from
`Convocation.ConvocationStatusId` — the same system `ConvocationCard.tsx` already writes to — the
widget's write path had to be corrected to match: writing to `EventAttendanceConfirmation` while
reading from `Convocation` would have meant the button's own action never affected what the badge
next displayed.

**Decision**: `UpcomingEventsWidget.tsx`'s "Voy"/"No voy" buttons call
`Front/src/apps/coach/services/convocationService.ts`'s existing
`updateConvocationStatus(eventId: string, convocationId: string, statusId: number,
excuseTypeId?: number | null): Promise<void>` — the exact function `ConvocationCard.tsx` (Front's
real convocation form) already calls, via `PUT /api/events/{eventId}/convocations/
{convocationId}/status`. "Voy" sends `statusId = 2` (`ConvocationStatus.Accepted`); "No voy" sends
`statusId = 5` (`ConvocationStatus.Deconvoke`) with no `excuseTypeId` — the backend
(`UpdateConvocationStatus.cs`) defaults it to `7` ("Decisión técnica") when omitted, so the widget
doesn't need an excuse-picker UI. The call needs `myConvocationId` (from the attendance-summary
response, Decision 3), not a `teamPlayerId` — so the widget's earlier `coachApi.getMyProfile()`
call to resolve `teamPlayerId` (used only to build the old `ConfirmAttendance` payload) is removed
entirely; nothing else in the widget needed that value.

Gating stays "show the buttons only when `myStatus === 'Pending'`," but `"Pending"` and the two
decided outcomes are now the real `ConvocationStatus` names — `"Pending" | "Accepted" |
"Deconvoke" | "Justified"` — not `"Going" | "Pending" | "NotGoing"`. `EventAttendanceBadges.tsx`'s
label map now mirrors `ConvocationCard.tsx`'s `STATUS_LABELS` for the decided states (past-participle
wording since this is a *decided* badge, not an action button: `Accepted` → "Aceptado", `Deconvoke`
→ "Rechazado", plus `Justified` → "Justificado", a state `ConvocationCard.tsx` doesn't offer as a
button target but that a coach can still set elsewhere and the badge must still render honestly).
The optimistic local update, per-button loading state, `rffm.show_snackbar` failure path, and
`refetch()`-on-success behavior described below are otherwise unchanged from the original decision.

**Why**: Once the backend's own source of truth moved to `Convocation` (Decision 3's correction),
reusing `ConvocationCard.tsx`'s already-shipped write path is the only choice that keeps the
dashboard widget and the real convocation form agreeing with each other — a coach accepting/
rejecting via `ConvocationCard.tsx` and a player confirming via this widget both mutate the same
row, so `refetch()` after either one shows the other surface the same truth. Continuing to write
to `EventAttendanceConfirmation` (Mobile's separate table) would have silently diverged from what
`myStatus` now reads, reintroducing exactly the two-systems mismatch the backend correction was
about.

**Alternative considered**: Keep writing to `EventAttendanceConfirmation` (original Decision 14)
and ask back-specialist to also source `myStatus` from it after all. Rejected — this was the
premise the user explicitly corrected (Context's top-of-file note); `Convocation` is the system
the real convocation UI (`ConvocationCard.tsx`, `AttendanceTabs.tsx`) already uses, and building a
second, competing "attendance" concept on the dashboard would confuse coaches who already work in
`ConvocationCard.tsx` daily.

---

<details>
<summary>Original version of Decision 14 (superseded above) — calling Mobile's `ConfirmAttendance` verbatim, kept for history</summary>

**Status**: Revised after investigation prompted by an open question raised in an earlier draft of
this design ("should Front eventually get its own attendance-confirmation write path?"). The
investigation's answer is that Front already can call the existing endpoint as-is.

**Investigation findings** (backend, read-only — no code changed by front-specialist):
- `POST /api/mobile/events/{eventId}/attendance` (`Back/ExtractionApi/src/RFFM.Api/Features/
  Mobile/Attendance/Commands/ConfirmAttendance.cs`) carries **no** `[Authorize(Roles=...)]` or any
  other client-type restriction. Its only gates are `IRequireFeaturePermission` (`FeatureRoute =
  CoachFeatureRoutes.AttendanceConfirmation`, i.e. the string `"/mobile/attendance"`,
  `RequiredPermission = "Write"`) and `IRequireTeamMembership` — both pipeline behaviors that read
  the same JWT bearer token already attached to every Front request by the shared Axios client.
  The `/api/mobile/...` path prefix is an organizational namespace (which client historically
  built the feature first), not an enforcement boundary.
- `WebApplicationExtensions.SeedPermissionsAsync` (`Back/ExtractionApi/src/RFFM.Host/
  DependencyInjection/WebApplicationExtensions.cs:482-488`) already seeds `FeaturePermission` rows
  granting **ReadWrite** (`PermissionTypeId = 3`) on `AttendanceConfirmation` to `Player`,
  `FamilyMember`, **and** `Coach` — every role this widget's audience needs already has write
  access today, with no seed/migration change required.
- The handler's own authorization (`ConfirmAttendance.cs:70-85`) allows the call when the caller
  is Coach/Administrator (`isPrivilegedRole`) **or** the target `TeamPlayerId` matches the
  caller's own `UserTeam.LinkedTeamPlayerId` for that team (`isOwnPlayer`) — again JWT-role/
  ownership-based, nothing mobile-specific.
- **Conclusion: no backend change or new dependency on back-specialist is needed to call this
  endpoint from Front.** The only backend-authored artifact this decision reads (not writes) is
  the existing `CoachFeatureRoutes.AttendanceConfirmation` constant and the existing seed rows
  above — both already shipped.

**Decision**: Add `Front/src/apps/coach/services/eventAttendanceSummaryService.ts`'s sibling
export `confirmMyAttendance(eventId: string, payload: { teamId: string; teamPlayerId: string;
status: "Going" | "Pending" | "NotGoing" }): Promise<void>`, calling `POST /api/mobile/events/
{eventId}/attendance` with body `{ TeamId, TeamPlayerId, Status }` (co-located in the same
service file as `getEventAttendanceSummaries` since both belong to the same read/write feature
pair, following the same "one service per domain resource" convention as `sportEventService.ts`
covering both reads and writes for `SportEvent`). Add `AttendanceConfirmation:
"/mobile/attendance"` to `Front/src/apps/coach/constants/featureRoutes.ts`'s
`COACH_FEATURE_ROUTES` — it mirrors the backend's `CoachFeatureRoutes.AttendanceConfirmation`
constant exactly but was never added to the frontend mirror, a pre-existing gap this change closes
as a prerequisite (the widget's own `hasFeatureAccess` check would otherwise have nothing to
compare against).

For `teamPlayerId`: `GetMyProfile` (`GET /api/users/me/profile`, already called by
`usePlayerAutoLoad.ts` via `coachApi.getMyProfile()`) returns `{ roleName, playerId, teamId }`.
Tracing the backend (`Features/Coaches/Teams/Queries/VerifyPlayerIdentity.cs:127`,
`SaveUserProfileAsync(request.UserId, AppRoles.Player.Name, teamPlayerId, team.Id, ...)`) confirms
`MyProfileResponse.PlayerId` is populated from `teamPlayerId` — i.e. despite its name, it **is**
the `TeamPlayer.Id`/`UserTeam.LinkedTeamPlayerId` value `ConfirmAttendanceRequest.TeamPlayerId`
expects. `UpcomingEventsWidget` calls `coachApi.getMyProfile()` once (when `isPlayer`) to resolve
this value, reusing the existing function rather than adding a new backend field.

`UpcomingEventsWidget`'s player/family event cards get two quick-action buttons ("Voy" / "No
voy", `AttendanceStatus` `Going`/`NotGoing`) that call `confirmMyAttendance`, with: an optimistic
local update of that card's `myStatus` (rolled back on request failure), a per-button loading
state while the request is in flight (disabling both buttons for that card, not the whole widget),
and an error surfaced via the existing `rffm.show_snackbar` event bus
(`window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message, severity:
"error" } }))`) on failure, matching the codebase's established cross-app error-notification
pattern. On success, the hook's `refetch()` (Decision 7) re-fetches the true server state for that
event, replacing the optimistic value. Coach/Administrator's view of the same widget stays
read-only (aggregate chips only, no action buttons) — Non-Goals.

**Why**: The acceptance criteria's "indicar si debe marcar su asistencia o ya la marcó y qué
decidió" reads naturally as "let them mark it," and the investigation shows nothing blocks that —
inventing a read-only restriction (as an earlier draft of this design did) was an unnecessarily
conservative reading once the endpoint's actual authorization was traced end-to-end. Reusing
`ConfirmAttendance` verbatim (rather than asking back-specialist for a new non-mobile-namespaced
endpoint) avoids duplicating the upsert logic in `EventAttendanceConfirmation` handling
(`ConfirmAttendance.cs:87-110`) for zero behavioral gain — the existing endpoint already does
exactly what's needed, gated by exactly the roles that need it.

**Alternative considered**: Ask back-specialist to add a `Features/Coaches/Attendance/
ConfirmMyAttendance.cs` endpoint under a non-`mobile` namespace, purely for organizational
tidiness. Rejected — no functional gap justifies it (the existing endpoint has no client
restriction and the necessary `FeaturePermission` rows already exist for the roles this widget
targets), and it would mean maintaining two handlers with identical `EventAttendanceConfirmation`
upsert logic for a naming preference, not a requirement.

</details>

### Risks / Trade-offs (frontend)

- **[Risk]** The optimistic `myStatus` update in `UpcomingEventsWidget` (Decision 14) can
  momentarily show a status the server hasn't actually persisted yet if the request is slow, and
  must be rolled back cleanly on failure (network error, `403` if `isOwnPlayer` somehow fails,
  `400` on an invalid status). → **Mitigation**: per-card loading state disables that card's
  buttons for the duration of the request (no double-submit), the optimistic value is only ever
  shown between click and response (never persisted to any cache beyond the component's local
  state), and `refetch()` after a successful response replaces it with the server-confirmed value;
  a failed request reverts to the pre-click `myStatus` and shows an `rffm.show_snackbar` error.
- **[Trade-off, resolved by the Convocation-sourced revision]** The original decision resolved
  `teamPlayerId` via a second network call (`coachApi.getMyProfile()`) since
  `EventAttendanceSummaryDto` had no player identifier of its own. The revised
  `updateConvocationStatus` call needs `myConvocationId` instead, which the attendance-summary
  response already carries directly — so this trade-off no longer applies; the widget no longer
  calls `getMyProfile()` at all.
- **[Trade-off]** `News.tsx`'s coach/non-coach branch uses `coachAuthService.hasRole(...)`
  (Decision 11) rather than a backend-seeded feature permission — if the frontend's local role
  read ever falls out of sync with what the backend would authorize (e.g. a new role added to the
  "Coach,Administrator" set on some future News command without a matching frontend update), the
  UI would show/hide the wrong buttons while the backend still enforces correctly (worst case: a
  visible button that 403s on click, or a hidden action a role could actually perform). →
  **Accepted**: identical trade-off already accepted by `EventCard.tsx`'s existing `canEditEvent`
  pattern this decision reuses verbatim; not a new risk introduced by this change.

### Frontend API Consumption Summary

- `GET /api/sport-events/attendance-summary?teamId=&eventIds=` — `eventAttendanceSummaryService.
  getEventAttendanceSummaries`, called via `useEventAttendanceSummaries` from
  `UpcomingEventsWidget`, `Attendance.tsx` (for `EventCard`), `Convocations.tsx` (for `MatchCard`).
- `PUT /api/events/{eventId}/convocations/{convocationId}/status` — existing
  `convocationService.updateConvocationStatus` (the same function `ConvocationCard.tsx` already
  calls, no backend changes), called from `UpcomingEventsWidget`'s "Voy"/"No voy" buttons for
  Player/FamilyMember callers only, using `myConvocationId` from the attendance-summary response
  (design.md Decision 14, revised — no backend change, no `getMyProfile()` call needed here).
- `GET /api/sport-events/{teamId}?startDate=&pageSize=3&descending=false` — existing
  `sportEventService.getSportEvents`, called from `UpcomingEventsWidget` (no new frontend function
  needed).
- `GET /api/coach/news?pageNumber=&pageSize=&descending=` — new `newsService.getNews`, called from
  `News.tsx` (published tab, `descending=true`) and `NewsWidget` (`pageSize=3&descending=true`).
- `GET /api/coach/news/drafts?pageNumber=&pageSize=` — new `newsService.getNewsDrafts`, called
  from `News.tsx`'s drafts tab (Coach/Administrator only).
- `GET /api/coach/news/{id}` — new `newsService.getNewsById`, called from `NewsDetail.tsx`.
- `POST /api/coach/news` / `PUT /api/coach/news/{id}` / `DELETE /api/coach/news/{id}` — new
  `newsService.createNews` / `updateNews` / `deleteNews`, called from `News.tsx`'s
  `NewsFormDialog` (create/edit) and per-card delete action (Coach/Administrator only).
- `POST /api/coach/news/{id}/publish` / `POST /api/coach/news/{id}/unpublish` — new
  `newsService.publishNews` / `unpublishNews`, called from `News.tsx`'s per-card actions
  (Coach/Administrator only).
- `POST /api/coach/news/image` — new `newsService.uploadNewsImage`, called from `NewsFormDialog`
  via the existing shared `FileImagePicker` component.

## Migration Plan

No database schema change — reuses `Convocation`, `EventAttendanceConfirmation`, `NewsItem`,
`UserTeam` as they exist today.

1. **Backend** (back-specialist): `GetEventAttendanceSummary.cs`, `UnpublishNews.cs`, and the
   `descending` parameter added to the existing `GetNews.cs`, per the contracts below, with xUnit
   tests per tasks.md §1-6. The new endpoint and command are inert (unused) until the frontend
   calls them; the `GetNews` change is additive and backward-compatible (`descending` defaults to
   `false`, matching today's behavior exactly) — no risk of a broken intermediate state.
   `dotnet build`/`dotnet test` green before frontend work starts.
2. **Frontend** (front-specialist, tasks.md §8-14b, revised per §18's Convocation-sourced
   correction), built directly against the contracts below and the existing, unmodified
   `UpdateConvocationStatus`/`GetEventAttendanceSummary` endpoints (Decision 14), not a mock:
   `eventAttendanceSummaryService.ts` (summaries only), `useEventAttendanceSummaries.ts`,
   `EventAttendanceBadges`, `UpcomingEventsWidget` (including its "Voy"/"No voy" controls calling
   `convocationService.updateConvocationStatus`), `NewsWidget`, `newsService.ts`, the rebuilt `News.tsx`,
   `NewsDetail.tsx`, `NewsFormDialog`, `NewsListCard`, the `TeamDashboard.tsx` "A la vista"
   section, the `EventCard.tsx`/`MatchCard.tsx` badge integrations (including the
   `NormalizedMatch.eventId` addition), the `COACH_FEATURE_ROUTES.AttendanceConfirmation`
   addition, and the `routes.tsx` registration for `news/:id`. See "Frontend Design" above for
   full rationale. **No backend changes required for this frontend work** — both open questions
   from an earlier draft of this design resolved to "reuse what already exists" (Decisions 9 and
   14). TDD per `.claude/rules/frontend-testing.md` (Vitest + Testing Library, Red → Green →
   Refactor).
3. Run `dotnet test`/`dotnet build` for backend and `npm run test`/`npm run build` for frontend
   before this change is marked ready to archive.

## API Contract (for front-specialist)

```
GET /api/sport-events/attendance-summary?teamId={teamId}&eventIds={id1},{id2},{id3}
Authorization: Bearer <jwt>

200 OK
[
  {
    "eventId": "...",
    "convocados": 14,
    "going": 10,        // ConvocationStatus.Accepted count
    "pending": 3,        // ConvocationStatus.Pending (or unset/unrecognized) count
    "notGoing": 1,        // ConvocationStatus.Deconvoke + ConvocationStatus.Justified, folded together
    "attendancePercentage": 71.4,        // going / convocados * 100, rounded to 1 decimal; 0 when convocados == 0
    "myStatus": "Pending",               // ConvocationStatus name — "Pending" | "Accepted" | "Deconvoke" | "Justified" | null
    "myStatusId": 1,                     // ConvocationStatus.Id (1/2/4/5) — null when myStatus is null
    "myConvocationId": "..."             // Convocation.Id for PUT /api/events/{eventId}/convocations/{convocationId}/status — null when myStatus is null
  }
]
// myStatus/myStatusId/myConvocationId are null for Coach/Administrator, for a caller with no
// linked player, AND for a Player/FamilyMember whose linked player is not convoked to that
// specific event (distinct from "Pending" — "not called up" vs. "called up, awaiting response").
// Events in eventIds that don't exist or don't belong to teamId are silently omitted from the array.
// SOURCE OF TRUTH: Convocation.ConvocationStatusId only (the real convocation form's status,
// UpdateConvocationStatus.cs). EventAttendanceConfirmation (Mobile RSVP) is NOT read here — see
// the Context correction note above. To act on myConvocationId, call:
//   PUT /api/events/{eventId}/convocations/{myConvocationId}/status
//   Body: { "newStatusId": 2, "excuseTypeId": null }   // 2 = Accepted ("Aceptar")
//   Body: { "newStatusId": 5, "excuseTypeId": null }   // 5 = Deconvoke ("Rechazar"; excuseTypeId defaults server-side to 7 "Decisión técnica" if omitted)
// (UpdateConvocationStatus.cs, existing endpoint, unmodified by this change.)

400 Bad Request   — teamId missing, eventIds empty/malformed, or more than 50 ids requested.
403 Forbidden     — ProblemDetails, caller (Player/FamilyMember) has no UserTeam for teamId.
401 Unauthorized  — not authenticated.
```

This same endpoint is called by:
- The new dashboard widget, with the up-to-3 event ids from `GET /api/sport-events/{teamId}?
  startDate=<today>&pageNumber=1&pageSize=3&descending=false` (existing endpoint, no change).
- The existing Convocatorias/Attendance event-card list, with whatever event ids are currently
  rendered, to add the badge (convocados/aceptados/pendientes/rechazados/%) to each card — this
  is a frontend-only integration; no backend change is needed beyond this one new endpoint.

```
POST /api/coach/news/{id}/unpublish
Authorization: Bearer <jwt>
Roles: Coach, Administrator

200 OK
{
  "id": "...", "title": "...", "subtitle": "...", "body": "...", "coverImageUrl": "...",
  "status": "Draft", "publishedAt": null, "newsDate": "...", "createdAt": "...", "updatedAt": "..."
}

404 Not Found     — ProblemDetails, no news item with that id.
409 Conflict      — ProblemDetails, item is already Draft.
403 Forbidden     — ProblemDetails, caller role is neither Coach nor Administrator.
401 Unauthorized  — not authenticated.
```

```
GET /api/coach/news?pageNumber=1&pageSize=3&descending=true
Authorization: Bearer <jwt>

200 OK
[
  {
    "id": "...", "title": "...", "subtitle": "...", "coverImageUrl": "...",
    "status": "Published", "publishedAt": "...", "newsDate": "2026-08-28T00:00:00Z"
  }
]
// X-Total-Count response header carries the total published count.
// descending is optional, defaults to false (today's existing ascending-by-NewsDate behavior,
// unchanged for any caller that omits it). descending=true orders NewsDate largest-first —
// this is what the dashboard's "3 most recent news" widget should pass.
```

The dashboard's "3 most recent published news" widget calls `GET /api/coach/news?pageNumber=1&
pageSize=3&descending=true` — no separate endpoint, the existing `GetNews` gains this one
optional parameter (cached separately per `descending` value; see Decision 6).

## Open Questions

Three backend items raised during design were confirmed by the user on 2026-08-30 and are closed:
1. News authorization stays role-based (`Coach,Administrator`); no `TeamId`/`ClubId` scope or
   `EnsureCreatorAsync` adoption for News (Decision 4, closed).
2. `GetNews` gains a `descending` parameter so the dashboard widget can request most-recent-first
   directly (Decision 6, closed; task added in tasks.md §5).
3. "Convocados" aggregation counts only explicit `Convocation` rows — a training event with RSVPs
   but no formal convocation legitimately shows `convocados = 0` (Risks/Trade-offs, closed).

Two frontend items raised in an earlier draft of this design were investigated per the user's
request on 2026-08-30 and are now closed, both resolving to "reuse what already exists, no
backend dependency":
4. Front (web) gains a "mark my attendance" control in the upcoming-events widget, reusing
   `ConfirmAttendance` (`POST /api/mobile/events/{eventId}/attendance`) verbatim — investigation
   found the endpoint carries no client-type restriction and the `Player`/`FamilyMember`/`Coach`
   `FeaturePermission` rows it needs are already seeded (Frontend Design, Decision 14). No
   coordination with back-specialist is required to implement this.
5. `MatchCard.tsx`/`Convocations.tsx` do not need fuzzy date+rival matching to resolve `eventId`
   for federation-synced rows: tracing `useConvocations.ts` shows every card `Convocations.tsx`
   actually renders is already built from an internal `SportEvent` with a real `id` — the raw,
   unsynced federation path (`normalizeRawMatch`) is used only for the "Generar calendario" sync
   payload and never reaches a rendered card (Frontend Design, Decision 9, revised). No backend
   change, and no frontend fuzzy-matching logic, is needed.
