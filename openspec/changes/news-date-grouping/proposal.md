## Why

News items currently only carry `PublishedAt` (when the coach hit "publish"), which is unrelated to what the news is *about*. A coach may publish today an announcement for something happening in September, and publish tomorrow an announcement for something happening this week — today's item should still sort after the September one relative to its own relevance date. Families need the feed ordered by relevance ("fecha de la noticia"), not by publish order, and need past-event news visually separated from current/upcoming news.

## What Changes

- **Backend**: add a new required field `NewsDate` (`DateTime`, date-only semantics) to `NewsItem`, distinct from `PublishedAt`. Required on create and update via FluentValidation. New EF Core migration. `GetNews`/`GetNewsDrafts`/`GetNewsById` responses include `newsDate`; `GetNews` (published feed) now orders by `NewsDate` ascending instead of `PublishedAt` descending.
- **Mobile**: `NewsFormScreen` gains a required date picker for "Fecha de la noticia" (create and edit).
- **Mobile**: `NewsDetailScreen` shows the new "Fecha de la noticia" alongside the existing publication date, formatted as `Jueves 30 de julio de 2026`.
- **Mobile**: `NewsScreen` feed is restructured into two root groups — **Anteriores** (`NewsDate` < today, subgrouped by month descending, e.g. Julio 2026 → Junio 2026) and **Actuales y futuras** (`NewsDate` ≥ today, subgroup "Hoy" first, then by month ascending, e.g. Julio 2026 → Agosto 2026 → Septiembre 2026). All groups/subgroups collapsed by default except: root group "Actuales y futuras" is the default expanded/visible root, and within it the "Hoy" subgroup starts expanded. Grouping/collapsing UI reuses the collapsible-section pattern already used in `PlayerSeasonCardsScreen.tsx` (`SectionList` + chevron header + `expandedSectionKey`).
- Drafts (visible only to Coach/Administrator) are grouped the same way as published items, keeping their "Borrador" badge.

## Capabilities

### Modified Capabilities
- `news`: `NewsItem` gains required `NewsDate`; `GetNews` ordering changes from `PublishedAt` DESC to `NewsDate` ASC.
- `mobile-news`: feed screen restructured into date-based collapsible groups; form screen gains required date input; detail screen shows the new date.

## Impact

- **Backend** (`Back/ExtractionApi/`): `NewsItem` entity, `NewsItemEntityConfiguration`, new migration, `CreateNews`/`UpdateNews`/`GetNews`/`GetNewsDrafts`/`GetNewsById` feature files, validators, existing handler tests updated.
- **Mobile** (`Mobile/`): `api/news.ts` (new `newsDate` field on all payloads/responses), `NewsFormScreen.tsx`, `NewsDetailScreen.tsx`, `NewsScreen.tsx` (new grouping hook `screens/hooks/groupNewsByDate.ts`), corresponding `__tests__`.
- No changes to `Front/` in this change.
