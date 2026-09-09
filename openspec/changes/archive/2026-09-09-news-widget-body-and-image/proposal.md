## Why

The Coach team dashboard's "Últimas noticias" widget (`Front/src/apps/coach/pages/team-dashboard/components/NewsWidget.tsx`, rendering `NewsListCard` in `compact` mode) currently shows only each news item's short `Subtitle` and a fixed 72px-tall cover image. The user reports the cover photo reads as "very small" and doesn't fill the card, and asked that the widget show the news item's actual long description (the `Body` field, labeled "Cuerpo" in the create/edit form) instead of just the subtitle, so the widget gives a more useful preview of the story.

## What Changes

- Backend: `GetNews`/`GetNewsDrafts`'s shared `NewsSummaryResponse` gains the full `Body` field (already stored on `NewsItem`, already returned by `NewsDetailResponse` for the detail page) so list responses can render it without a second request per item.
- Frontend: `NewsSummaryDto` (`newsService.ts`) gains `body: string`.
- Frontend: `NewsListCard`'s `compact` variant renders `item.body` instead of `item.subtitle`, clamped (`-webkit-line-clamp`) to however many lines fit the available card height before truncating with "…" — as many lines as the space allows, not a fixed small count.
- Frontend: the compact cover image grows from a fixed 72px band to occupy roughly half the compact card's height (currently `height: 72px` in `NewsListCard.module.css`'s `.compact .image`), with the text content (title + body preview + date) filling the other half.
- Non-compact rendering (`News.tsx`'s full list, `NewsDetail.tsx`) is unaffected — this only touches the `compact` variant used by the dashboard widget.

## Capabilities

### Modified Capabilities
- `coach-dashboard-widgets`: the latest-news widget's card now shows the news item's body/description text and a larger, proportionally-sized cover image instead of the subtitle and a small fixed-height image.
- `news`: `GET /api/coach/news` and `GET /api/coach/news/drafts` responses include the full `body` field.

## Impact

- Backend: `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/News/GetNews.cs` (`NewsSummaryResponse` record + its projection), `GetNewsDrafts.cs` (its projection of the same shared record).
- Frontend: `Front/src/apps/coach/services/newsService.ts` (`NewsSummaryDto`), `Front/src/apps/coach/pages/news/components/NewsListCard.tsx` (compact rendering), `Front/src/apps/coach/pages/news/components/NewsListCard.module.css` (`.compact .image`/`.compact .subtitle` sizing).
- No changes to `News.tsx`'s full list page, `NewsDetail.tsx`, or the Federación/Mobile apps.
