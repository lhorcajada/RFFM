## 1. Domain

- [x] 1.1 Create `NewsLinkType` smart enum in
      `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/News/NewsLinkType.cs`
      (`None`/`MatchConvocation`/`External`, `TryParseName` — mirrors `NewsStatus.cs`).
- [x] 1.2 Extend `NewsItem` (`Domain/Entities/News/NewsItem.cs`): add `LinkType`,
      `LinkedEventId`, `LinkedTeamId`, `LinkUrl` properties; extend `Create` and
      `UpdateContent` to accept and validate them via a shared private `ValidateLink` guard
      (per `design.md` Decision 1).
- [x] 1.3 Domain unit tests in `NewsItemTests.cs` covering `Create`/`UpdateContent` for all
      three `LinkType` values (valid + missing-required-field cases).

## 2. Infrastructure

- [x] 2.1 `NewsItemEntityConfiguration.cs`: `LinkType` required (SmartEnum, via the existing
      `modelBuilder.ConfigureSmartEnum()` convention), `LinkedEventId`/`LinkedTeamId`/`LinkUrl`
      optional.
- [x] 2.2 EF Core migration `AddNewsLink` (`20260904173942_AddNewsLink`), `app` schema.
      **Post-review fix**: the migration's `AddColumn<int>("LinkType", ..., defaultValue: 0)`
      used `0` for existing rows, but `NewsLinkType.None`'s underlying value is `1` — every
      pre-existing news row got backfilled with an unrecognized enum value, and any read
      touching `LinkType` (e.g. `n.LinkType.Name` in a `Select`) threw ("Exception has been
      thrown by the target of an invocation", `SmartEnum.EFCore`'s converter failing to match
      `0` to any `NewsLinkType` member) — a live 500 on `GET /api/coach/news` once applied to
      the dev database. Fixed by reverting the migration (`dotnet ef database update
      20260904124902_AddTeamNotes`), changing `defaultValue` to `1`, and reapplying
      (`dotnet ef database update`).

## 3. Backend feature slice — write path

- [x] 3.1-3.2 `CreateNewsValidator`/`UpdateNewsValidator`: `LinkType` must be one of the three
      values; `MatchConvocation` requires non-empty `LinkedEventId`+`LinkedTeamId`; `External`
      requires a well-formed `http(s)` `LinkUrl`.
- [x] 3.3-3.4 `CreateNewsCommand`/`UpdateNewsCommand` extended with the four link fields
      (default `LinkType = "None"`), handlers pass them to `NewsItem.Create`/`UpdateContent`.

## 4. Backend feature slice — read path

- [x] 4.1-4.2 `NewsSummaryResponse`/`NewsDetailResponse` include `linkType`/`linkedEventId`/
      `linkedTeamId`/`linkUrl`; `GetNews.cs`/`GetNewsById.cs`/`GetNewsDrafts.cs`/`PublishNews.cs`/
      `UnpublishNews.cs` projections updated.
- [x] 4.3 No new authorization rules needed — link fields ride along existing auth gates.

## 5. Backend verification

- [x] 5.1 `dotnet build` — 0 errors.
- [x] 5.2 `dotnet test` — 984/986 passed (the 2 failures are the pre-existing, unrelated
      `AdnLegibleImporterFullDocumentSpotCheckTests`/`GameModelSeederRealDocumentTests`).
- [x] 5.3 Migration verified against the real dev database (see 2.2's post-review fix), not
      just the test fixture.

## 6. Frontend — service layer

- [x] 6.1 `newsService.ts`: `NewsSummaryDto`/`NewsDetailDto`/`NewsPayload` gain the four link
      fields; `createNews`/`updateNews` pass them through.

## 7. Frontend — form (create/edit)

- [x] 7.1-7.2 Link-kind `Select` in `NewsFormDialog.tsx` (None/MatchConvocation/External).
      **Post-review fixes** (the picker was non-functional/wrong as first implemented, caught
      by manual testing, not by the tests that existed at the time):
  - The team `Select` had no options (`{/* In a real implementation, fetch teams... */}`) —
    wired to `useUserTeams()` (`pages/Dashboard/hooks/useUserTeams.ts`, the same hook the Coach
    Dashboard already uses to list every team across the coach's clubs).
  - `getSportEvents(teamId)` returns a paginated `{ items, ... }` object, not an array — it was
    being assigned directly to the match list state, which would have broken `.map()`; fixed to
    `paged.items`.
  - The match `Select` listed every calendar event for the team (trainings included), and
    labeled each option with the event's raw `title`/`name` — for calendar-synced fixtures this
    is often just the rival's name, indistinguishable from other matches and impossible to tell
    apart from a training. Fixed: filter to actual matches with the same heuristic
    `useConvocations.ts` uses (`matchCategory` present, or legacy `eventTypeId === 1` /
    `eventType` contains "partido"), and label each option
    `"{Liga|Amistoso|Torneo} · {fecha} · vs {rival}"` using `matchCategory`, `normalizeDateStr`
    (`convocationUtils.ts`), and `rivalName`/`rival`.
  - Added regression tests to `NewsFormDialog.test.tsx` covering: teams list from
    `useUserTeams`, matches are fetched and filtered per team, non-match events never appear as
    options, and both team+match must be selected before submit.

## 8. Frontend — list and detail rendering

- [x] 8.1-8.2 `NewsListCard.tsx`/`NewsDetail.tsx` render the link action.
      **Post-review fixes** (two rounds, both reported directly by the user testing the
      feature):
  - *Wrong destination*: originally navigated to `/coach/convocations/match?eventId=&teamId=`
    (`ConvocationMatchDetail`), which is Coach-only (`allowPlayerAccess={false}` in
    `routes.tsx`) — a Player/FamilyMember reader would be blocked. Fixed to navigate to
    `/coach/attendance/{linkedEventId}?viewConvocation=1` instead — reachable by every role
    that can read news, opening the same read-only "Ver convocatoria" popup
    (`ConvocationDetailsDialog`) that `AttendanceEvent.tsx` already offers via a manual button
    click. `AttendanceEvent.tsx` gained a `useSearchParams` effect that auto-opens the dialog
    when `?viewConvocation=1` is present and the existing `isMatchOrFriendly &&
    convocationConfirmed` gate (the same one guarding the manual button) is satisfied.
  - *List-card badge didn't navigate anywhere useful*: the original design had the
    `NewsListCard` badge as a non-interactive indicator only (avoiding a `<Link>`-inside-`<Link>`
    HTML violation, since the whole card is already a `Link` to the news detail), with the real
    action living solely on `NewsDetail`. The user expected the visible badge on the card
    itself to go to the link target directly. Fixed by making the `Chip` `clickable` with an
    `onClick` that calls `e.preventDefault(); e.stopPropagation();` before navigating
    (`navigate(...)` for `MatchConvocation`, `window.open(linkUrl, "_blank",
    "noopener,noreferrer")` for `External`) — a non-anchor interactive element, so it stays
    valid HTML while still being directly actionable.
  - Regression tests added to `NewsListCard.test.tsx`/`NewsDetail.test.tsx` (using `Routes`
    instead of a bare `MemoryRouter`, so navigation targets are asserted against rendered
    routes, not just `href` strings) and `AttendanceEvent.viewConvocation.test.tsx` (auto-open
    with/without the query param).

## 9. Frontend verification

- [x] 9.1 `npm run test` — full suite 1013/1022 passed after every round of fixes (the 6
      failures are pre-existing, unrelated `AttendanceSummaryContent` tests — confirmed via
      `git diff --stat` that this change never touched that file).
- [x] 9.2 `npm run build` — clean after every round of fixes.
- [x] 9.3 Manual smoke check performed by the user in the dev server surfaced all three
      post-review fixes above (migration default, match picker, link destination) — none were
      caught by the test suite that existed before the fix, and each fix added the regression
      test that would have caught it.

## 10. Change management

- [x] 10.1 `design.md` and `specs/news-link/spec.md` updated to match the final, corrected
      behavior (destination route, list-card interactivity, match-picker filtering/labeling)
      before archiving — see the "Post-review fix(es)" notes above for what changed from the
      original design and why.
