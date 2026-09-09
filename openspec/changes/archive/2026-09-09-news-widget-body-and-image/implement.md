# Implement: news-widget-body-and-image (backend + frontend)

Self-contained technical script. Follow it exactly; read every file listed in section 0 before
editing anything. Strict TDD: write the failing test, confirm it fails, then write the minimal
code to pass it, for every step below — do not batch implementation ahead of tests.

Repo root: `C:\Proyects\MisProyectos\FutbolBase`
Backend root: `Back/ExtractionApi` (commands in §1-2 assume this as cwd)
Frontend root: `Front` (commands in §3-6 assume this as cwd)

`design.md` in this change folder is the source of truth — if anything below conflicts with it,
`design.md` wins.

## 0. Read first (do not skip)

Backend:
1. `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/News/GetNews.cs` — `NewsSummaryResponse`
   record (bottom of file) and its `.Select(...)` projection inside `GetNewsHandler.Handle`.
2. `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/News/GetNewsDrafts.cs` — the second
   `.Select(...)` projection of the same shared `NewsSummaryResponse` record.
3. `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetNewsHandlerTests.cs` and
   `GetNewsDraftsHandlerTests.cs` — existing test style/fixtures (`PostgresContainerFixture`,
   `NewsItem.Create(...)` calls) to extend.

Frontend:
4. `Front/src/apps/coach/services/newsService.ts` — `NewsSummaryDto`/`NewsDetailDto` (the DTO to
   extend).
5. `Front/src/apps/coach/pages/news/components/NewsListCard.tsx` — the `compact` prop and the
   currently-unconditional `<p className={styles.subtitle}>{item.subtitle}</p>` line to make
   conditional.
6. `Front/src/apps/coach/pages/news/components/NewsListCard.module.css` — `.compact .image`
   (fixed `height: 72px`, lines ~84-88) and `.compact .content`/`.compact .subtitle` (lines
   ~90-99) to resize.
7. `Front/src/apps/coach/pages/news/components/__tests__/NewsListCard.test.tsx` — existing test
   conventions (mocked `fetchPublicStorageFile`, `MemoryRouter` + `Routes` wrapping via
   `renderCard(overrides)`) to extend.
8. `Front/src/apps/coach/pages/team-dashboard/components/NewsWidget.tsx` and its
   `NewsWidget.module.css`/`__tests__/NewsWidget.test.tsx` — confirm the widget renders
   `NewsListCard` with `compact` and nothing else needs to change here (this change only touches
   `NewsListCard`'s compact rendering, not `NewsWidget` itself).

## 1. Backend — read path

TDD, in order:

1. Extend `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetNewsHandlerTests.cs` FIRST: add
   a test asserting `result[0].Body` equals the `body` string passed to `NewsItem.Create(...)`
   for a single published item (follow the exact fixture/clear-table pattern already used by
   `Handle_WithLinkTypeNone_ReturnsNullLinkFields` in that file — `ClearNewsTableAsync()` first,
   seed via a fresh `_fixture.CreateDbContext()`, assert via a second fresh context).
2. Extend `Back/ExtractionApi/tests/RFFM.Api.Tests/UnitTests/GetNewsDraftsHandlerTests.cs` the
   same way, for a draft item.
3. Run both filtered test runs — confirm they fail (Red) because `NewsSummaryResponse` has no
   `Body` member yet (compile error is an acceptable form of "Red" here — do not skip the
   confirmation step, just note the failure is a build failure, not a runtime assertion failure).
4. In `GetNews.cs`, add `string Body` as the **last** parameter of the `NewsSummaryResponse`
   record (bottom of file, after `LinkUrl`):
   ```csharp
   public record NewsSummaryResponse(
       string Id, string Title, string Subtitle, string CoverImageUrl, string Status, DateTime? PublishedAt, DateTime NewsDate,
       string LinkType, string? LinkedEventId, string? LinkedTeamId, string? LinkUrl, string Body);
   ```
5. In `GetNews.cs`'s `GetNewsHandler.Handle`, update the projection to pass `n.Body` last:
   ```csharp
   .Select(n => new NewsSummaryResponse(
       n.Id, n.Title, n.Subtitle, n.CoverImageUrl, n.Status.Name, n.PublishedAt, n.NewsDate,
       n.LinkType.Name, n.LinkedEventId, n.LinkedTeamId, n.LinkUrl, n.Body))
   ```
6. In `GetNewsDrafts.cs`'s `GetNewsDraftsHandler.Handle`, update its projection the same way
   (same parameter order, `n.Body` last).
7. Re-run the tests from steps 1-2 — confirm green.

## 2. Backend verification

From `Back/ExtractionApi`:
```
dotnet build
dotnet test --filter "FullyQualifiedName~News"
```
Both must be clean/green before proceeding to §3. If any other News test constructs
`NewsSummaryResponse` positionally and now fails to compile because of the new trailing
parameter, fix that call site by appending the appropriate `Body` value — do not reorder
existing parameters.

## 3. Frontend — service layer

In `Front/src/apps/coach/services/newsService.ts`, add `body: string;` to `NewsSummaryDto`
(alongside the existing fields, e.g. after `coverImageUrl`). `NewsDetailDto` is defined as
`NewsSummaryDto & { body: string; createdAt: string; updatedAt: string }` — once `body` exists on
`NewsSummaryDto`, remove the now-redundant `body: string;` from `NewsDetailDto`'s own intersection
literal (TypeScript allows the duplicate but it is dead weight — check whether removing it causes
any type error first; if it does for any reason, leave it in place rather than fighting the type
checker over a cosmetic redundancy).

No dedicated test file needed for this pure type change — §4's component tests exercise it
through the `NewsSummaryDto` object literals they construct.

## 4. Frontend — NewsListCard compact rendering

Write tests FIRST in
`Front/src/apps/coach/pages/news/components/__tests__/NewsListCard.test.tsx` (extend the existing
file, follow its `renderCard(overrides)` helper and `item` fixture — add `body: "..."` to the
base `item` fixture at the top of the file since `NewsSummaryDto` now requires it):

- `compact` card with a `body` set renders that `body` text and does NOT render `subtitle`'s
  text (use a `body` value distinct from `subtitle` in the override so the assertion is
  unambiguous, e.g. `body: "Cuerpo largo de la noticia con más detalle."`).
- Non-`compact` card (the existing default `renderCard()` calls, no `compact` prop) still renders
  `subtitle`'s text, not `body`'s.

Confirm both fail first (Red — `NewsListCard` currently always renders `item.subtitle`
regardless of `compact`), then implement:

In `NewsListCard.tsx`, change:
```tsx
<p className={styles.subtitle}>{item.subtitle}</p>
```
to:
```tsx
<p className={styles.subtitle}>{compact ? item.body : item.subtitle}</p>
```

Run the test file — confirm green.

## 5. Frontend — compact card sizing (image ~50%, body fills remainder)

In `Front/src/apps/coach/pages/news/components/NewsListCard.module.css`, replace the `.compact
.image` rule:
```css
.compact .image {
  aspect-ratio: auto;
  height: 72px;
  object-fit: cover;
}
```
with:
```css
.compact .image {
  aspect-ratio: auto;
  flex: 1 1 50%;
  min-height: 0;
  object-fit: cover;
}
```
and the `.compact .content` rule:
```css
.compact .content {
  padding: 10px 12px;
}
```
with:
```css
.compact .content {
  padding: 10px 12px;
  flex: 1 1 50%;
  min-height: 0;
}
```
and `.compact .subtitle`'s clamp count from `4` to `6`:
```css
.compact .subtitle {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```
(Keep the existing comment block above `.compact .image` but update it to describe the new
50/50 split instead of the old fixed-72px rationale — see `design.md` Decision 4 for the wording
basis; do not leave a comment describing behavior that no longer matches the code.)

No new CSS-only test is expected (this codebase doesn't unit-test computed styles) — verification
is the manual dev-server check in §5 of `tasks.md` and the full frontend test/build run in §6
below.

## 6. Frontend verification

From `Front`:
```
npm run test
npm run build
```
Both must be clean. Then manually smoke-test in the dev server (`npm run dev`): open
`/coach/team-dashboard`, confirm the "Últimas noticias" widget's cards show a visibly larger
cover image (roughly half the card height) and the news item's body/description text (truncated
with `…` if long) instead of the short subtitle, at both mobile (2-column) and desktop
(4-column) dashboard widths. Confirm `/coach/news` (the full list page, non-compact) is visually
unchanged — still shows `subtitle`, not `body`, and the original 16:9 `object-fit: contain`
image band.

## 7. Do not commit, push, or archive

Leave the change in `openspec/changes/news-widget-body-and-image/` (not archived). Do not run
`git commit`/`git push`. Report: files created/modified (full paths, backend and frontend
separately), build/test status for both stacks, and confirm the manual dev-server check from §6
was performed and what it showed.
