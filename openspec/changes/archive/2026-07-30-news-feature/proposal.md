## Why

The Mobile app (Coach/Familia) needs a "Noticias" feed so clubs can publish news to families and players, but no backend capability exists today for creating, storing, or listing news items. This proposal delivers the backend contract only; the Mobile screen will be built afterwards against the API defined here.

## What Changes

- Add a new backend feature module `News` under `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/News/` following the standard Mediator ICommand/IQueryApp vertical-slice pattern (one file per command/query), mirroring `Features/Coaches/Trainings/Exercises/`.
- New domain entity `NewsItem` (title, subtitle, body, required cover image URL, `PublishedAt` (nullable, auto-set on publish), `Status` as a new `NewsStatus` SmartEnum with `Draft`/`Published` values).
- New EF Core migration adding the `News` table (schema `app`) plus `IEntityTypeConfiguration<NewsItem>`, and a `News` DbSet on `AppDbContext`.
- Endpoints: `GET /api/coach/news` (paginated, published-only, all authenticated roles), `GET /api/coach/news/drafts` (paginated, Coach/Administrator only), `GET /api/coach/news/{id}` (detail — published visible to all, draft visible only to Coach/Administrator), `POST /api/coach/news` (create draft or publish directly, Coach/Administrator), `PUT /api/coach/news/{id}` (edit, Coach/Administrator, allowed on both draft and published items), `POST /api/coach/news/{id}/publish` (transition draft → published, sets `PublishedAt`, Coach/Administrator), `DELETE /api/coach/news/{id}` (Coach/Administrator).
- Cover image upload reuses the existing `IStorageService` abstraction (`Storage:UseLocal` toggle / Supabase bucket), following the `UploadPlayerPhoto` pattern — no new storage mechanism.
- FluentValidation validators for every command; RFC 7807 `ProblemDetails` for all errors.
- xUnit + Moq tests for handlers and authorization (draft visibility, role gating), written first (TDD).
- **Mobile**: turn the existing `Mobile/src/screens/NewsScreen.tsx` placeholder into a real "newspaper front page" feed — large-cover-photo cards for published news (visible to every authenticated role), plus the caller's own drafts appended and visually marked "Borrador" when the caller is Coach/Administrator (via the separate drafts endpoint).
- **Mobile**: new `Mobile/src/screens/NewsDetailScreen.tsx` (title, subtitle, cover photo, body, date) reachable by tapping a card, with Editar/Eliminar actions for Coach/Administrator.
- **Mobile**: new `Mobile/src/screens/NewsFormScreen.tsx` shared between create and edit (title, subtitle, body, two-step cover-photo upload, Draft/Publish choice on create), reachable via a Coach/Administrator-only FAB on `NewsScreen` and via "Editar" on the detail screen.
- **Mobile**: new `Mobile/src/api/news.ts` client for all eight endpoints above, following the typed-function pattern of `Mobile/src/api/team.ts`.
- **Mobile**: `NewsTab` in `Mobile/src/navigation/RootNavigator.tsx` gains a nested native-stack (`NewsTabStack`, mirroring `TeamTabStack`/`CompetitionTabStack`) so the list can push to detail/create/edit without leaving the tab; the `NewsTab` route name and its position in `CalendarTabs` are unchanged.
- **Mobile**: Jest + Testing Library for RN tests for the API client and all three screens, TDD Red→Green→Refactor.

## Capabilities

### New Capabilities
- `news`: Backend CRUD + publishing workflow for club news items (draft/published lifecycle, cover image, paginated public + coach-only listing), exposed via Minimal API endpoints under `/api/coach/news`.
- `mobile-news`: Mobile (Coach/Familia) feed, detail, and coach/admin-only authoring (create/edit/publish/delete) screens for club news, consuming the `news` API contract.

### Modified Capabilities
(none — no existing spec requirements change; `mobile-news` is new)

## Impact

- **Backend** (`Back/ExtractionApi/`): new feature files, domain entity + SmartEnum, EF configuration, migration, DbSet, tests.
- **Mobile** (`Mobile/`): `NewsScreen.tsx` rewritten from placeholder to real feed; two new screens (`NewsDetailScreen.tsx`, `NewsFormScreen.tsx`); new `api/news.ts`; `RootNavigator.tsx` gains `NewsTabStack`; new `__tests__` for all of the above.
- No changes to `Front/` in this change.
