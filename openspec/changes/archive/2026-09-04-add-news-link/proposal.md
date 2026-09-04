## Why

Coaches publish news items (`Back/ExtractionApi/.../Features/Coaches/News/`,
`Front/src/apps/coach/pages/news/`) that today are plain title/subtitle/body/cover-image
content with no way to point the reader anywhere else. Two common cases: (1) a news item
announcing Sunday's match should let the reader tap through straight to that match's
convocation screen (`/coach/convocations/match?eventId=...`) instead of navigating there
manually; (2) a news item about an away trip should let the reader tap a Google Maps link (or
any other external URL) to see the venue. This change adds a single optional "link" to a news
item that covers both an in-app destination and an arbitrary external URL.

## What Changes

- News items gain an optional link of one of two kinds:
  - **Internal — match convocation**: a reference to a sport event (match). When set, the
    reader gets a "Ver convocatoria" action that navigates in-app to that match's convocation
    screen (`ConvocationMatchDetail`, reusing the existing `?eventId=&teamId=` deep-link
    contract — no new frontend route needed).
  - **External — arbitrary URL**: a free-text URL (e.g. a Google Maps link, a federation
    website, a sponsor page). When set, the reader gets a link/button that opens it in a new
    tab (`target="_blank" rel="noopener noreferrer"`).
- A news item has at most one link, of one kind or the other — not both at once.
- When creating/editing a news item, the coach picks the link kind (none / match / external
  URL) and then either a team+match (from existing lookups, `getSportEvents`) or types a URL
  (validated as a well-formed `http(s)` URL). Leaving it as "none" keeps today's behavior
  unchanged.
- If a linked match no longer exists or the reader isn't allowed to view it, the link is
  hidden/disabled instead of navigating to a broken or unauthorized screen. External URLs are
  not validated for reachability — only for well-formed `http(s)` shape at save time.
- Backend: `NewsItem` gains an optional link (`LinkType`: `None`/`MatchConvocation`/`External`,
  plus `LinkedEventId` for the match case or `LinkUrl` for the external case);
  `CreateNews`/`UpdateNews` accept it, `GetNews`/`GetNewsById` return it.
- Existing news items (no link) are unaffected — the field is nullable/optional throughout.

## Capabilities

### New Capabilities
- `news-link`: optional link from a news item — either an in-app match convocation or an
  arbitrary external URL — surfaced as a navigable action on the news list/detail.

### Modified Capabilities
(none — no existing spec covers the News feature's contract yet; this is additive to
undocumented existing behavior)

## Impact

- Backend: `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/News/NewsItem.cs` (+ a new
  `NewsLinkType` smart enum alongside `NewsStatus`),
  `Features/Coaches/News/{CreateNews,UpdateNews,GetNews,GetNewsById}.cs`, EF configuration +
  migration for the new column(s), `AppDbContext`.
- Frontend: `Front/src/apps/coach/services/newsService.ts` (DTO fields),
  `pages/news/components/NewsFormDialog.tsx` (link-kind selector: none / match picker /
  external URL field), `pages/news/NewsDetail.tsx` and
  `pages/news/components/NewsListCard.tsx` (render the resulting action — "Ver convocatoria"
  or the external link), reusing `services/sportEventService.ts` (`getSportEvents`) for the
  match picker.
- No changes to the Federación app or to `ConvocationMatchDetail`'s own routing/contract.
