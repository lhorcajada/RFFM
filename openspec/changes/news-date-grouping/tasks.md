## 1. Backend — domain & persistence (~1.5h)
- [ ] `NewsItem.cs`: add `NewsDate`, update `Create(...)` and `UpdateContent(...)` signatures + validation.
- [ ] `NewsItemEntityConfiguration.cs`: map `NewsDate` as required.
- [ ] Migration `AddNewsDateToNewsItem` with backfill (`PublishedAt ?? CreatedAt`) for existing rows.
- **Verify**: `dotnet build` from `Back/ExtractionApi`.

## 2. Backend — feature files & tests (~2h)
- [ ] `CreateNews.cs`, `UpdateNews.cs`: command + validator + handler pass `NewsDate` through.
- [ ] `GetNews.cs`, `GetNewsDrafts.cs`, `GetNewsById.cs`: response records + projections include `NewsDate`; `GetNews` ordering changes to `NewsDate` ASC.
- [ ] Update `CreateNewsHandlerTests.cs`, `UpdateNewsHandlerTests.cs`, `GetNewsHandlerTests.cs`, `PublishNewsHandlerTests.cs` fixtures for the new required field (Red before code change, Green after).
- [ ] Add ordering assertion test for `GetNews` (ascending by `NewsDate`).
- **Verify**: `dotnet test` from `Back/ExtractionApi` (News-related tests green).

## 3. Mobile — API client & grouping logic (~1.5h)
- [ ] `src/api/news.ts`: add `newsDate` to `NewsSummary`, `NewsDetail`, `CreateNewsPayload`, `UpdateNewsPayload`.
- [ ] Write `src/screens/hooks/__tests__/groupNewsByDate.test.ts` first (Red): today bucket, month buckets both directions, empty-group omission.
- [ ] Implement `src/screens/hooks/groupNewsByDate.ts` (Green).
- **Verify**: `npm test -- groupNewsByDate` from `Mobile/`.

## 4. Mobile — Form screen date input (~1.5h)
- [ ] Check `Mobile/package.json` for an existing date-picker dependency; if none, consult `https://docs.expo.dev/versions/v57.0.0/` before adding one.
- [ ] Update `src/screens/__tests__/NewsFormScreen.test.tsx` first (Red): required `newsDate`, submit payload includes it.
- [ ] Implement date input + validation in `NewsFormScreen.tsx` (Green).
- **Verify**: `npm test -- NewsFormScreen` from `Mobile/`.

## 5. Mobile — Detail screen date display (~1h)
- [ ] Update `src/screens/__tests__/NewsDetailScreen.test.tsx` first (Red): formatted `newsDate` row (`Jueves 30 de julio de 2026`).
- [ ] Implement `formatNewsDate` + new date row in `NewsDetailScreen.tsx` (Green).
- **Verify**: `npm test -- NewsDetailScreen` from `Mobile/`.

## 6. Mobile — Feed screen collapsible date grouping (~2.5h)
- [ ] Update `src/screens/__tests__/NewsScreen.test.tsx` first (Red): default expand state, toggle behavior, correct item placement.
- [ ] Implement root/sub collapsible rendering in `NewsScreen.tsx` using `groupNewsByDate` (Green).
- **Verify**: `npm test -- NewsScreen` from `Mobile/`.

## 7. Full verification & OpenSpec archive (~0.5h)
- [ ] `dotnet build && dotnet test` (Back/ExtractionApi) — full green.
- [ ] `npm run build && npm test` — wait, Mobile has no `build` step; run `npm test` (Mobile) full suite green.
- [ ] `openspec validate news-date-grouping --strict`.
- [ ] Confirm with user before commit/push (per `.claude/rules/git.md` §6.3).
- [ ] Archive change to `openspec/changes/archive/<date>-news-date-grouping/` once merged.
