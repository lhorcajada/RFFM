## 1. Domain

- [ ] 1.1 Add `NewsStatus : SmartEnum<NewsStatus>` (`Domain/Entities/News/NewsStatus.cs`) with `Draft`/`Published` values, mirroring `SanctionCategory`.
- [ ] 1.2 Add `NewsItem` entity (`Domain/Entities/News/NewsItem.cs`): `Title`, `Subtitle`, `Body`, `CoverImageUrl` (required), `Status`, `PublishedAt` (nullable), `CreatedAt`, `UpdatedAt`, with intention-revealing methods (`Publish()`, `UpdateContent(...)`) rather than public setters.

## 2. Persistence

- [ ] 2.1 Add `IEntityTypeConfiguration<NewsItem>` under `Infrastructure/Persistence/Configuration/Entities/NewsItemEntityConfiguration.cs`: table `News`, schema `app`, required field constraints (max lengths per design.md), index on `(Status, PublishedAt)`.
- [ ] 2.2 Add `AppDbContext.News` `DbSet<NewsItem>` property.
- [ ] 2.3 Generate migration `AddNews` via `.\manage-migrations.ps1 -Action create -MigrationName AddNews -Context AppDbContext`; verify it applies cleanly.

## 3. Feature: Cover image upload

- [ ] 3.1 Write failing test(s) for `POST /api/coach/news/image` (Coach/Administrator can upload; other roles forbidden; missing file returns 400).
- [ ] 3.2 Implement `Features/Coaches/News/UploadNewsImage.cs` using `IStorageService.UploadAsync("news", ..., ...)`, mirroring `UploadPlayerPhoto`. Make tests pass.

## 4. Feature: Create news

- [ ] 4.1 Write failing tests for `CreateNewsCommand` handler and validator (required fields, status Draft vs Published sets `PublishedAt` correctly, role gating).
- [ ] 4.2 Implement `Features/Coaches/News/CreateNews.cs` (`IFeatureModule`, command, handler, `FluentValidation` validator, `[Authorize(Roles = "Coach,Administrator")]`). Make tests pass.

## 5. Feature: Update news

- [ ] 5.1 Write failing tests for `UpdateNewsCommand` handler (edits allowed on Draft and Published, `Status`/`PublishedAt` untouched, 404 on missing id, role gating).
- [ ] 5.2 Implement `Features/Coaches/News/UpdateNews.cs`. Make tests pass.

## 6. Feature: Publish news

- [ ] 6.1 Write failing tests for `PublishNewsCommand` handler (Draft → Published sets `PublishedAt`; already-Published returns 409; role gating).
- [ ] 6.2 Implement `Features/Coaches/News/PublishNews.cs`. Make tests pass.

## 7. Feature: Delete news

- [ ] 7.1 Write failing tests for `DeleteNewsCommand` handler (allowed on Draft and Published; 404 on missing id; role gating).
- [ ] 7.2 Implement `Features/Coaches/News/DeleteNews.cs`. Make tests pass.

## 8. Feature: List published news

- [ ] 8.1 Write failing tests for `GetNewsQuery` (published-only, paginated, sorted `PublishedAt DESC`, `X-Total-Count` header, open to all authenticated roles, drafts never leak).
- [ ] 8.2 Implement `Features/Coaches/News/GetNews.cs`, including `ICacheRequest` caching and cache invalidation wiring on the write commands (`IInvalidateCacheRequest`). Make tests pass.

## 9. Feature: List draft news

- [ ] 9.1 Write failing tests for `GetNewsDraftsQuery` (draft-only, paginated, sorted `CreatedAt DESC`, restricted to Coach/Administrator, 403 for other roles).
- [ ] 9.2 Implement `Features/Coaches/News/GetNewsDrafts.cs`. Make tests pass.

## 10. Feature: News detail

- [ ] 10.1 Write failing tests for `GetNewsByIdQuery` (published visible to all; draft visible only to Coach/Administrator; draft returns 404 — not 403 — for other roles; unknown id returns 404).
- [ ] 10.2 Implement `Features/Coaches/News/GetNewsById.cs` with the role-aware visibility check from design.md Decision 3. Make tests pass.

## 11. Verification (Backend)

- [ ] 11.1 Run `dotnet build` — must pass with no new warnings/errors.
- [ ] 11.2 Run `dotnet test` — full suite green, including new News tests.
- [ ] 11.3 Manually smoke-test the full lifecycle against a local run (`dotnet run --project src/RFFM.Host`): upload image → create draft → edit draft → publish → list published → list drafts → delete.
- [ ] 11.4 Confirm the API contract in `design.md` matches the actual shipped DTOs/routes exactly (field names, status casing, status codes) before handing off to mobile-specialist.

---

All Mobile tasks below follow strict TDD (Red → Green → Refactor): write the failing Jest + Testing Library for RN test first, watch it fail, implement the minimal code to pass, then refactor keeping the suite green. Backend tasks 1-11 must be shipped (or the endpoints otherwise available in the target environment) before Mobile tasks are exercised end-to-end, since Mobile consumes the live contract.

## 12. Mobile: API client

- [x] 12.1 Write failing tests in `Mobile/src/api/__tests__/news.test.ts` for `getNews`, `getNewsDrafts`, `getNewsById`, `uploadNewsImage`, `createNews`, `updateNews`, `publishNews`, `deleteNews` — success shape (including `X-Total-Count` header parsing into `totalCount`), and error propagation.
- [x] 12.2 Implement `Mobile/src/api/news.ts` (typed `NewsSummary`/`NewsDetail`, all eight functions via the shared `api` client from `src/api/client.ts`) to make tests pass.

## 13. Mobile: NewsScreen (feed)

- [x] 13.1 Write failing tests in `Mobile/src/screens/__tests__/NewsScreen.test.tsx` covering: loading state; published-only feed for non-coach roles (no drafts call made); combined drafts+published feed for Coach/Administrator with drafts visually tagged "Borrador" and listed first; empty state; error state (`e.response?.data?.detail` and fallback in Spanish); a failed `getNewsDrafts` call does not blank the published feed for Coach/Administrator; FAB visible only for Coach/Administrator; tapping a card navigates to `NewsDetail` with the item's id.
- [x] 13.2 Implement `Mobile/src/screens/NewsScreen.tsx` (replace the placeholder): fetch feed(s) per role, render newspaper-style cards (cover photo + headline + optional "Borrador" badge) in a `FlatList`, Coach/Administrator-only FAB navigating to `NewsForm` in create mode. Make tests pass.

## 14. Mobile: NewsDetailScreen

- [x] 14.1 Write failing tests in `Mobile/src/screens/__tests__/NewsDetailScreen.test.tsx` covering: loading state; full detail rendering (title, subtitle, cover photo, body, formatted date); error state (including the 404-as-"not found" case); Editar/Eliminar visible only for Coach/Administrator; Eliminar confirms before calling `deleteNews` and navigates back on success; Editar navigates to `NewsForm` in edit mode with the item's id.
- [x] 14.2 Implement `Mobile/src/screens/NewsDetailScreen.tsx` (`getNewsById` on mount via route param `newsId`) to make tests pass.

## 15. Mobile: NewsFormScreen (create/edit)

- [x] 15.1 Write failing tests in `Mobile/src/screens/__tests__/NewsFormScreen.test.tsx` covering: create mode renders Draft/Publish choice, submits `createNews` with the chosen status, navigates to the new item on success; edit mode preloads existing fields via `getNewsById`, has no status control, submits `updateNews`; image pick + `uploadNewsImage` two-step flow (upload happens before submit, submit sends the resulting URL, not the local file URI); validation errors (empty required fields) block submit; save error sets a Spanish fallback message.
- [x] 15.2 Implement `Mobile/src/screens/NewsFormScreen.tsx` (`mode: 'create' | 'edit'` via route params, two-step cover photo upload — verify the exact `expo-image-picker` API against `https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/` before writing this, per `Mobile/AGENTS.md`) to make tests pass.

## 16. Mobile: Navigation

- [x] 16.1 Write/update failing tests in `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx` (and/or a new `NewsTabStack.test.tsx` mirroring `CalendarTabStack.test.tsx`) asserting: `NewsTab` still registers with `tabBarLabel` "Noticias" and icon `newspaper-outline` at its existing position; `NewsTabStack` registers `NewsList`, `NewsDetail`, `NewsForm` routes.
- [x] 16.2 Update `Mobile/src/navigation/RootNavigator.tsx`: add `NewsStack`/`NewsTabStack` (mirroring `TeamTabStack`), change `NewsTab`'s `component` from `NewsScreen` to `NewsTabStack` — `NewsTab`'s `name`, `tabBarLabel`, `tabBarIcon`, and position in `CalendarTabs` stay unchanged.

## 17. Mobile: Verification

- [x] 17.1 Run `npm test` in `Mobile/` — full suite green, no skipped tests.
- [x] 17.2 Run `openspec validate news-feature --strict` — no errors.
- [x] 17.3 Confirm no changes were made under `Front/` in the Mobile tasks' diff.
