Technical script for the implementer agent(s). Backend first (Mobile depends on the `newsDate` contract), then Mobile. Follow strict TDD (Red → Green → Refactor) per `CLAUDE.md` / `.claude/rules/testing.md` / `.claude/rules/frontend-testing.md`.

## Phase A — Backend (`back-specialist`, `Back/ExtractionApi/`)

1. **Red**: update `tests/RFFM.Api.Tests/UnitTests/CreateNewsHandlerTests.cs`, `UpdateNewsHandlerTests.cs`, `GetNewsHandlerTests.cs`, `PublishNewsHandlerTests.cs` to pass/assert a `NewsDate` value; add a `GetNews` test asserting ascending order by `NewsDate`. Run `dotnet test` — confirm failures (compile errors are acceptable as "Red" here since the field doesn't exist yet).
2. **Green**:
   - `Domain/Entities/News/NewsItem.cs`: add `public DateTime NewsDate { get; private set; }`; extend `Create(string title, string subtitle, string body, string coverImageUrl, NewsStatus status, DateTime newsDate)` with a guard (`if (newsDate == default) throw new ArgumentException("La fecha de la noticia es obligatoria.")`); extend `UpdateContent(..., DateTime newsDate)` to set it.
   - `Infrastructure/Persistence/Configuration/Entities/NewsItemEntityConfiguration.cs`: add `builder.Property(n => n.NewsDate).IsRequired();`.
   - Generate migration: `dotnet ef migrations add AddNewsDateToNewsItem --project src/RFFM.Api --startup-project src/RFFM.Host` (or via `.\manage-migrations.ps1` per repo convention) from `Back/ExtractionApi`. Edit the generated `Up()` to backfill existing rows before adding the NOT NULL constraint (e.g. add column nullable → `UPDATE` set `NewsDate = COALESCE("PublishedAt", "CreatedAt")` → `AlterColumn` to non-nullable), matching how other non-nullable backfills are handled in this codebase (check `Infrastructure/Migrations/` for a precedent before writing raw SQL).
   - `Features/Coaches/News/CreateNews.cs`: add `DateTime NewsDate` to `CreateNewsCommand`; `RuleFor(x => x.NewsDate).NotEmpty()` in `CreateNewsValidator`; pass to `NewsItem.Create(...)`.
   - `Features/Coaches/News/UpdateNews.cs`: same for `UpdateNewsCommand`/`UpdateNewsValidator`/`news.UpdateContent(...)`.
   - `Features/Coaches/News/GetNews.cs`: add `DateTime NewsDate` to `NewsSummaryResponse` (keep existing fields, append `NewsDate`); change handler to `.OrderBy(n => n.NewsDate)`; include `n.NewsDate` in the `Select(...)`.
   - `Features/Coaches/News/GetNewsDrafts.cs`: include `n.NewsDate` in the `Select(...)` (ordering stays `CreatedAt` DESC).
   - `Features/Coaches/News/GetNewsById.cs`: add `DateTime NewsDate` to `NewsDetailResponse`, include in projection.
3. Run `dotnet build && dotnet test` from `Back/ExtractionApi` — confirm green.

## Phase B — Mobile (`mobile-specialist`, `Mobile/`)

1. Update `src/api/news.ts`: add `newsDate: string` to `NewsSummary`, `NewsDetail`; add `newsDate: string` to `CreateNewsPayload`, `UpdateNewsPayload`.
2. **Red → Green**: `src/screens/hooks/__tests__/groupNewsByDate.test.ts` then `src/screens/hooks/groupNewsByDate.ts`, implementing the two-level grouping described in `design.md` (root: `current-future`/`past`; subgroups: `today`/`YYYY-MM`). Use fixed dates in tests (no `Date.now()` without control — mock `Date` or inject a `today` param).
3. **Red → Green**: `src/screens/__tests__/NewsFormScreen.test.tsx` then `NewsFormScreen.tsx` — add required date input (`testID="news-date-input"`), wire into `handleSubmit` validation and `createNews`/`updateNews` payloads. Check `Mobile/package.json` for an existing date-picker dependency before adding one; if adding `@react-native-community/datetimepicker` (or Expo's recommended equivalent), consult `https://docs.expo.dev/versions/v57.0.0/` first per `Mobile/AGENTS.md`.
4. **Red → Green**: `src/screens/__tests__/NewsDetailScreen.test.tsx` then `NewsDetailScreen.tsx` — add `formatNewsDate` (weekday + day + month + year, es-ES, capitalized) and a second date row (`news-detail-newsdate-label`/`-value`) below the existing publish-date row.
5. **Red → Green**: `src/screens/__tests__/NewsScreen.test.tsx` then `NewsScreen.tsx` — replace the flat list with the nested collapsible rendering described in `design.md` (flat row array derived from `groupNewsByDate` + `expandedKeys: Set<string>`, default `{'current-future', 'current-future:today'}`).
6. Run full `npm test` from `Mobile/` — confirm green, no skipped tests.

## Phase C — Verification & handoff

1. `dotnet build && dotnet test` (Back/ExtractionApi) and `npm test` (Mobile) both green.
2. `openspec validate news-date-grouping --strict` — no errors.
3. Report back to the user with a diff summary; **do not commit/push** until the user explicitly confirms (per `.claude/rules/git.md` §6.3).
