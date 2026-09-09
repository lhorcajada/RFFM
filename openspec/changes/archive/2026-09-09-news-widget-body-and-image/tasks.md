## 1. Backend — read path

- [x] 1.1 Extend `GetNewsHandlerTests.cs`/`GetNewsDraftsHandlerTests.cs` FIRST: assert `Body` is
      present and round-trips correctly in the response for a created news item.
- [x] 1.2 Add `string Body` to the `NewsSummaryResponse` record (`GetNews.cs`, bottom of file).
- [x] 1.3 Update the `.Select(n => new NewsSummaryResponse(...))` projections in `GetNews.cs` and
      `GetNewsDrafts.cs` to pass `n.Body`.
- [x] 1.4 Run the tests from 1.1 — confirm green.

## 2. Backend verification

- [x] 2.1 `dotnet build` — 0 errors.
- [x] 2.2 `dotnet test --filter "FullyQualifiedName~News"` — green (110/110 passed, no
      regression on existing News-feature tests).

## 3. Frontend — service layer

- [x] 3.1 `newsService.ts`: add `body: string` to `NewsSummaryDto`.

## 4. Frontend — NewsListCard compact rendering

- [x] 4.1 Write/extend tests FIRST in `NewsListCard.test.tsx`: a `compact` card with a `body` set
      renders that `body` text (not `subtitle`); a non-`compact` card still renders `subtitle`,
      not `body`.
- [x] 4.2 Confirm Red, then implement: `NewsListCard.tsx` renders `{compact ? item.body :
      item.subtitle}` in place of the current unconditional `item.subtitle`.
- [x] 4.3 Run the test file — confirm green.

## 5. Frontend — compact card sizing (image ~50%, body fills remainder)

- [x] 5.1 `NewsListCard.module.css`: change `.compact .image` from `height: 72px` to a
      flex-based ~50% share of the card (`flex: 1 1 50%; min-height: 0; object-fit: cover`,
      dropping the fixed `aspect-ratio`/`height`), and give `.compact .content` a matching
      `flex: 1 1 50%; min-height: 0` so image and text split the card evenly.
- [x] 5.2 `.compact .subtitle` (now rendering `body`): raise `-webkit-line-clamp` from `4` to `6`
      per `design.md` Decision 4 (generous ceiling; `.content`'s own height is the real bound).
- [x] 5.3 Manual visual check: confirmed by the user testing the live dashboard, who requested
      two follow-up refinements (now applied, see below) — the larger image/body preview itself
      needed no further changes.

## 6. Frontend verification

- [x] 6.1 `npm run test` — 209 files passed; 4 pre-existing/unrelated failing files confirmed
      via `git stash` baseline comparison (not caused by this change).
- [x] 6.2 `npm run build` — clean.

## 7. Change management

- [x] 7.1 `specs/news/spec.md` and `specs/coach-dashboard-widgets/spec.md` deltas applied via
      `openspec archive`.

## 8. Follow-up (user feedback after manual testing, same session)

- [x] 8.1 "Próximos eventos" widget cards (`EventCard.tsx`/`EventCard.module.css`, `compact`
      mode used by `UpcomingEventsWidget`) enlarged closer to the non-compact sizes, so the
      widget reads with similar visual weight to the now-larger news cards. Out of this change's
      original scope (a different widget) but a direct, same-session follow-up — not
      OpenSpec-tracked (styling tweak).
- [x] 8.2 `.compact` changed from `height: auto` to `height: 100%` (`EventCard.module.css`) and
      `.eventCardLink` gained `flex: 1` (`UpcomingEventsWidget.module.css`) so the compact card
      fills the dashboard row's full height instead of leaving blank space when the row is
      stretched taller than the card's own content (e.g. by the enlarged news card in 8.1).
- [x] 8.3 Chips/tags (`chipsRow` + `EventAttendanceBadges`) wrapped in a new `.bottomTags`
      (`margin-top: auto`) so they anchor to the card's bottom edge instead of sitting right
      under the description with blank space below, now that 8.2 lets the card stretch taller.
