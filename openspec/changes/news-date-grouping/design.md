## Backend (`Back/ExtractionApi/`)

### Domain — `Domain/Entities/News/NewsItem.cs`
- Add `public DateTime NewsDate { get; private set; }`.
- `Create(...)` gains a required `DateTime newsDate` parameter; validate `newsDate != default`.
- `UpdateContent(...)` gains `DateTime newsDate` and sets it alongside the existing fields.
- No time-of-day semantics needed beyond `DateTime.Date` — store the date component only (mirrors how `PublishedAt`/`CreatedAt` already use `DateTime`, but `NewsDate` is user-selected, not server-generated).

### Infrastructure
- `Infrastructure/Persistence/Configuration/Entities/NewsItemEntityConfiguration.cs`: map `NewsDate` as a required column (`.IsRequired()`), same pattern as other `NewsItem` columns.
- New EF Core migration `AddNewsDateToNewsItem` (via `.\manage-migrations.ps1` or `dotnet ef migrations add AddNewsDateToNewsItem --startup-project src/RFFM.Host`), adding a non-nullable `NewsDate` column. Existing rows need a backfill default (use `PublishedAt ?? CreatedAt` as the migration's `defaultValueSql`/data-fill step so the column can be non-nullable without breaking existing data).

### Feature files (`Features/Coaches/News/`)
- `CreateNews.cs`: `CreateNewsCommand` gains `DateTime NewsDate`; `CreateNewsValidator` adds `RuleFor(x => x.NewsDate).NotEmpty()`; handler passes it to `NewsItem.Create(...)`.
- `UpdateNews.cs`: `UpdateNewsCommand` gains `DateTime NewsDate`; validator adds `RuleFor(x => x.NewsDate).NotEmpty()`; handler passes it to `news.UpdateContent(...)`.
- `GetNews.cs`:
  - `NewsSummaryResponse` gains `DateTime NewsDate` (add as new positional field, keep `PublishedAt` for backward display of "fecha de publicación").
  - Handler: replace `.OrderByDescending(n => n.PublishedAt)` with `.OrderBy(n => n.NewsDate)` (ascending — closest upcoming/today first); `Select(...)` projection includes `n.NewsDate`.
- `GetNewsDrafts.cs`: same `NewsSummaryResponse` projection change (include `NewsDate`); keep ordering by `CreatedAt` DESC (drafts aren't part of the date-grouped feed ordering contract — Mobile groups them client-side using their own `NewsDate` once merged into the feed).
- `GetNewsById.cs`: `NewsDetailResponse` gains `DateTime NewsDate`, included in the projection.

### Tests (update first — Red)
- `CreateNewsHandlerTests.cs`, `UpdateNewsHandlerTests.cs`, `GetNewsHandlerTests.cs`: update existing fixtures/builders to pass `NewsDate`; add a case asserting `GetNews` orders by `NewsDate` ascending (not `PublishedAt`).
- New validator tests: `NewsDate` required (rejects `default(DateTime)`).

## Mobile (`Mobile/`)

### API client — `src/api/news.ts`
- `NewsSummary`, `NewsDetail`: add `newsDate: string`.
- `CreateNewsPayload`, `UpdateNewsPayload`: add `newsDate: string` (ISO date, e.g. `2026-09-01`).

### Grouping logic — new `src/screens/hooks/groupNewsByDate.ts`
Mirrors the existing `groupPlayersByPosition.ts` pattern (pure function + typed section shape), but two levels deep:

```ts
export interface NewsDateSubgroup<T> {
  key: string;        // e.g. 'today', '2026-09'
  title: string;       // 'Hoy' | 'Septiembre 2026'
  data: T[];
}

export interface NewsDateRootGroup<T> {
  key: 'current-future' | 'past';
  title: string;       // 'Actuales y futuras' | 'Anteriores'
  subgroups: NewsDateSubgroup<T>[];
}

export function groupNewsByDate<T extends { newsDate: string }>(items: T[]): NewsDateRootGroup<T>[]
```

- Split by `newsDate >= today` (current/future) vs `< today` (past), comparing at day granularity (local time).
- **current-future**: subgroup `'today'` (title `'Hoy'`) first if any items match today, then remaining items bucketed by `YYYY-MM` and sorted ascending by month, items within each subgroup sorted ascending by `newsDate`.
- **past**: bucketed by `YYYY-MM`, months sorted descending, items within each subgroup sorted descending by `newsDate` (closest-to-today first).
- Month titles use `date-fns`-free manual formatting consistent with `formatPublishDate` in `NewsDetailScreen.tsx` (`toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })`, capitalized).
- Omit empty subgroups/root groups (an empty "Anteriores" or "Hoy" simply doesn't render, same as `groupPlayersByPosition` omitting empty position groups).

### Feed screen — `src/screens/NewsScreen.tsx`
- Replace the flat `FlatList` with a nested collapsible structure built from `groupNewsByDate(items)`:
  - Root groups rendered as collapsible headers (same visual treatment as `sectionHeader`/`sectionHeaderTitle` in `PlayerSeasonCardsScreen.tsx`, chevron via `Ionicons`).
  - Expand state: `expandedKeys: Set<string>` (not a single key like `PlayerSeasonCardsScreen`, since "Actuales y futuras" root + "Hoy" subgroup must both start expanded simultaneously). Initialize with `{'current-future', 'current-future:today'}`; toggling a key adds/removes it from the set.
  - Within an expanded root group, render its subgroups as nested collapsible headers (same chevron pattern, one indent level deeper); within an expanded subgroup, render the existing news card (`Pressable`/`Image`/badge) unchanged.
  - Implementation approach: build a single flat array of typed rows (`{type: 'root-header', ...} | {type: 'sub-header', ...} | {type: 'item', ...}`) filtered by which headers are currently expanded, and render it with the existing `FlatList` (simpler than nesting `SectionList`s, and keeps `keyExtractor`/`testID` patterns consistent with the current file). Each header row's `onPress` toggles its key in `expandedKeys`.
  - `testID`s: `news-root-header-${rootKey}`, `news-sub-header-${rootKey}-${subKey}`, keep existing `news-card-${id}` for items.

### Detail screen — `src/screens/NewsDetailScreen.tsx`
- Add a second date row below the existing "Fecha de publicación" row: `news-detail-newsdate-label` / `news-detail-newsdate-value`, label `"Fecha de la noticia: "`.
- New formatter `formatNewsDate(iso)` using `toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })` then capitalize the first letter, to produce `Jueves 30 de julio de 2026`.

### Form screen — `src/screens/NewsFormScreen.tsx`
- Add `newsDate` state (ISO string, default: today for create, loaded value for edit).
- Add a date picker input using `@react-native-community/datetimepicker` if already a project dependency, else confirm the versioned Expo docs (`https://docs.expo.dev/versions/v57.0.0/`) for the currently recommended date-picker approach before adding a new dependency — **check `Mobile/package.json` first; do not assume a package is available.**
- `handleSubmit` validation: reject submit if `newsDate` is empty (mirrors the existing required-fields check), field is `testID="news-date-input"`.
- Pass `newsDate` in `createNews`/`updateNews` payloads.

### Tests (Jest + Testing Library for RN, TDD Red→Green→Refactor)
- `src/api/__tests__/news.test.ts`: payloads/responses include `newsDate`.
- `src/screens/hooks/__tests__/groupNewsByDate.test.ts` (new): today/past/future bucketing, month ordering both directions, empty-group omission, "Hoy" always first in current-future.
- `src/screens/__tests__/NewsScreen.test.tsx`: default expand state (Hoy + Actuales y futuras visible, Anteriores collapsed), toggling a root/sub header, item placement within correct group.
- `src/screens/__tests__/NewsDetailScreen.test.tsx`: renders formatted `newsDate`.
- `src/screens/__tests__/NewsFormScreen.test.tsx`: required-field validation includes `newsDate`; submit payload includes it.
