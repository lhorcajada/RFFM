## Context

No backend capability for club news exists today. Mobile (Coach/Familia) needs a feed screen showing published news to all users, plus a coach/admin-only authoring flow (draft → edit → publish, or publish directly) with a mandatory cover photo. The nearest structural templates in the backend are `Features/Coaches/Trainings/Exercises/` (standard `IRequest`/`IQueryApp` + `IRequireFeaturePermission` CRUD vertical slice, one file per command/query) and `Features/Coaches/Players/Commands/UploadPlayerPhoto.cs` (image upload via `IStorageService`). This design defines the backend contract (§ below) and, in `## Mobile Design`, the Mobile client that consumes it — both land in this same change.

## Goals / Non-Goals

**Goals:**
- Ship a paginated, published-only news list endpoint open to all authenticated roles (Coach, Familia/FamilyMember, Player, etc.).
- Ship a separate draft-listing endpoint restricted to Coach/Administrator, so authors can resume unfinished drafts — never exposed to Familia.
- Support the full authoring lifecycle: create as Draft or directly as Published; edit a Draft or a Published item; explicitly publish a Draft (sets `PublishedAt` server-side); delete.
- Reuse the existing `IStorageService` abstraction for the cover image (no new storage mechanism), matching the `Storage:UseLocal` / Supabase toggle already in place.
- Standard vertical slice: Mediator `IRequest`/`IQueryApp` (not the inline-Minimal-API exception used by `SetPlayerInjury`/`SetPlayerSanction`), because News has real list/detail/create/update/publish/delete breadth that benefits from FluentValidation + caching, unlike the small per-teamplayer CRUD siblings.
- Full TDD: xUnit + Moq tests for handlers (draft visibility, role gating, publish transition) written first.

**Non-Goals:**
- No categories/tags, comments, likes, or rich-text/markdown rendering rules for the body — `Body` is a plain string, formatting is a Mobile/Front concern if ever added.
- No scheduled/future-dated publishing — `PublishedAt` is always "now" at the moment of the publish action, not a chosen future date.
- No per-club/team scoping for now — news items are global to the tenant (mirrors how the club/app is currently single-tenant per deployment); scoping can be added later without breaking this contract if the business needs it.
- No un-publish (Published → Draft) action — the user's confirmed requirement is that publish is one-directional; a Published item can still be edited and deleted, just not reverted to Draft.
- No Front (React SPA) work — Mobile-only consumer for this change.

## Decisions

### 1. Standard Mediator CQRS vertical slice, not the inline-Minimal-API exception
`SetPlayerInjury`/`SetPlayerSanction` intentionally skip Mediator because they are small per-teamplayer sub-resource CRUD. News is a first-class, top-level resource with real breadth (list with pagination, detail, create, update, publish, delete) and benefits from FluentValidation, `IRequireFeaturePermission`, and optional response caching on the public list — the general project convention (`ICommand`/`IQueryApp`, validator required per command) applies here without a good reason to deviate. Each command/query is `IRequest<T>`/`IQueryApp<T>` implementing `IRequireFeaturePermission`, following `Features/Coaches/Trainings/Exercises/`.

### 2. `NewsStatus` as an `Ardalis.SmartEnum`
Mirrors the `SanctionCategory` precedent (`Domain/Entities/TeamPlayers/SanctionCategory.cs`) and the project's explicit convention ("never raw int enums"). `NewsStatus : SmartEnum<NewsStatus>` with `Draft = new(nameof(Draft), 1)` and `Published = new(nameof(Published), 2)`, persisted via the already-registered `modelBuilder.ConfigureSmartEnum()` convention. API DTOs expose it as its string `Name` (`"Draft"` / `"Published"`).

### 3. Draft visibility enforced in the handler, not just at the route level
`GetNewsById` is a single query used for both published and draft items (one detail endpoint, `GET /api/coach/news/{id}`), because Mobile/Front need one predictable "open a news item" URL regardless of status. The handler checks: if `Status == Published`, return to any authenticated caller; if `Status == Draft`, return only if the caller has role Coach or Administrator, else `404 NotFound` (not `403`) — a draft must not reveal its existence to Familia/Player callers. This mirrors the "don't leak existence" principle already implicit in RFC 7807 usage elsewhere. Role check inside the handler uses `ClaimsPrincipal` role claims (same claims-reading pattern as `GetExercises`), not just `[Authorize(Roles=...)]` on the route, since the route must stay open to all authenticated roles for the published case.

### 4. Two separate list endpoints instead of one with a status filter
Considered a single `GET /api/coach/news?status=Published|Draft`. Rejected: mixing an admin-only listing mode into the same public, cacheable, heavily-hit endpoint invites an authorization bug where a filter is forgotten and drafts leak. Splitting into `GET /api/coach/news` (always published-only, cacheable, open to all) and `GET /api/coach/news/drafts` (always draft-only, `[Authorize(Roles="Coach,Administrator")]`, not cached) makes the authorization boundary a route-level fact instead of a runtime parameter, which is easier to verify and test.

### 5. Cover image upload as a two-step flow (upload then reference), matching `UploadPlayerPhoto`
The cover photo is uploaded via a dedicated `POST /api/coach/news/image` (multipart `IFormFile`, Coach/Administrator only) that returns `{ "url": "..." }` using `IStorageService.UploadAsync("news", fileName, file, ct)`, exactly like `UploadPlayerPhoto`. `CreateNews`/`UpdateNews` then take `CoverImageUrl` as a plain required string field, not a file — keeping the JSON commands simple and consistent with `UpdateClub`'s emblem pattern (URL stored on the entity, not the binary). Mobile does: upload image → get URL → submit create/update with that URL. Orphaned images (uploaded but never referenced) are accepted as an out-of-scope cleanup concern, same as the existing player-photo/emblem flows.

### 6. Table/entity naming and schema
`NewsItem` entity (avoids colliding with the C# `News` naming clash risk in `namespace ... .Features.Coaches.News`), table `News` in schema `app` (`AppDbContext`), `IEntityTypeConfiguration<NewsItem>` under `Infrastructure/Persistence/Configuration/Entities/`. Index on `(Status, PublishedAt)` to support the published-list query's default sort (`PublishedAt DESC`).

## API Contract (authoritative for Mobile integration)

Base path: `/api/coach/news`. All endpoints require authentication (`RequireAuthorization()`); role-restricted ones are marked. All errors return RFC 7807 `ProblemDetails`.

### `NewsSummaryResponse` (list item DTO)
```json
{
  "id": "string",
  "title": "string",
  "subtitle": "string",
  "coverImageUrl": "string",
  "status": "Draft | Published",
  "publishedAt": "2026-07-30T10:00:00Z | null"
}
```

### `NewsDetailResponse` (detail DTO — superset of summary)
```json
{
  "id": "string",
  "title": "string",
  "subtitle": "string",
  "body": "string",
  "coverImageUrl": "string",
  "status": "Draft | Published",
  "publishedAt": "2026-07-30T10:00:00Z | null",
  "createdAt": "2026-07-28T09:00:00Z",
  "updatedAt": "2026-07-30T09:30:00Z"
}
```

### Endpoints

| Method | Route | Auth | Request | Response | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/coach/news?pageNumber=1&pageSize=20` | Any authenticated role | — | `200 OK` — `NewsSummaryResponse[]` + `X-Total-Count` header | Published-only, sorted `PublishedAt DESC`. Cached (`ICacheRequest`), invalidated on create/update/publish/delete. |
| `GET` | `/api/coach/news/drafts?pageNumber=1&pageSize=20` | `Coach,Administrator` | — | `200 OK` — `NewsSummaryResponse[]` + `X-Total-Count` header | Draft-only, sorted `CreatedAt DESC`. Not cached. |
| `GET` | `/api/coach/news/{id}` | Any authenticated role | — | `200 OK` — `NewsDetailResponse`; `404 NotFound` if missing OR if draft and caller lacks Coach/Administrator | See Decision 3. |
| `POST` | `/api/coach/news/image` | `Coach,Administrator` | `multipart/form-data`, field `file` | `200 OK` — `{ "url": "string" }`; `400 BadRequest` if missing/invalid file | Upload cover image, get URL to use in create/update. |
| `POST` | `/api/coach/news` | `Coach,Administrator` | `CreateNewsCommand` (below) | `201 Created` — `{ "id": "string" }`, `Location` header; `400 BadRequest` on validation failure | `Status` in request chooses Draft or Published; if Published, `PublishedAt` is set server-side to now. |
| `PUT` | `/api/coach/news/{id}` | `Coach,Administrator` | `UpdateNewsCommand` (below) | `204 NoContent`; `404 NotFound` if missing; `400 BadRequest` on validation failure | Allowed on both Draft and Published items. Does not change `Status`/`PublishedAt`. |
| `POST` | `/api/coach/news/{id}/publish` | `Coach,Administrator` | — | `200 OK` — `NewsDetailResponse`; `404 NotFound` if missing; `409 Conflict` if already Published | Sets `Status = Published`, `PublishedAt = now`. |
| `DELETE` | `/api/coach/news/{id}` | `Coach,Administrator` | — | `204 NoContent`; `404 NotFound` if missing | Allowed on both Draft and Published (per business confirmation). |

### `CreateNewsCommand`
```json
{
  "title": "string, required, max 200",
  "subtitle": "string, required, max 300",
  "body": "string, required",
  "coverImageUrl": "string, required (from POST /image)",
  "status": "Draft | Published, required"
}
```

### `UpdateNewsCommand`
```json
{
  "title": "string, required, max 200",
  "subtitle": "string, required, max 300",
  "body": "string, required",
  "coverImageUrl": "string, required"
}
```

## Risks / Trade-offs

- **[Risk]** Splitting list/drafts into two endpoints (Decision 4) means Mobile must call two different endpoints depending on the screen (public feed vs. "my drafts" authoring screen) instead of one with a query param. → Mitigation: this is documented explicitly here for the mobile-specialist; the trade-off buys a stronger, easier-to-test authorization boundary.
- **[Risk]** `404` instead of `403` for a Familia caller hitting a draft's detail URL could be confusing if they got the link legitimately (they shouldn't, since drafts never appear in any Familia-visible list). → Accepted: consistent with not leaking draft existence.
- **[Risk]** Cover image is a required two-step upload-then-reference flow, which means a `CreateNews` call with an invalid/unreachable `coverImageUrl` string is not caught until Mobile actually tries to render it (backend only validates it's a non-empty string). → Mitigation: out of scope to validate URL reachability server-side; consistent with how `UpdateClub`'s emblem URL is handled today.

## Migration Plan

1. Add `NewsStatus` SmartEnum (`Domain/Entities/News/NewsStatus.cs`) and `NewsItem` entity (`Domain/Entities/News/NewsItem.cs`).
2. Add `IEntityTypeConfiguration<NewsItem>` + `AppDbContext.News` DbSet.
3. Generate migration: `.\manage-migrations.ps1 -Action create -MigrationName AddNews -Context AppDbContext`.
4. Add feature files under `Features/Coaches/News/`: `GetNews.cs`, `GetNewsDrafts.cs`, `GetNewsById.cs`, `UploadNewsImage.cs`, `CreateNews.cs`, `UpdateNews.cs`, `PublishNews.cs`, `DeleteNews.cs` — each with its FluentValidation validator co-located.
5. Add xUnit + Moq tests (handler tests + authorization/visibility tests for drafts), written first (TDD Red), then implementation (Green).
6. `dotnet build` + `dotnet test` before considering the change done. Additive migration only (new table); rollback = drop table/migration if reverted.

## Mobile Design

### Context (Mobile)

`Mobile/src/screens/NewsScreen.tsx` exists today as a placeholder (`ScreenHeader` + "Próximamente..."), already wired as `NewsTab` (first tab, `newspaper-outline` icon) in `CalendarTabs` (`Mobile/src/navigation/RootNavigator.tsx`). No `Mobile/src/api/news.ts` exists yet. The nearest structural templates are `Mobile/src/api/team.ts` (typed function per endpoint, no class wrapper), `Mobile/src/screens/PlayerSeasonCardsScreen.tsx` (loading/error/data `useState` + `useEffect` fetch pattern), and `TeamTabStack`/`CompetitionTabStack` in `RootNavigator.tsx` (nested native-stack inside a tab, for pushing to a detail/sub-screen while keeping the tab bar and `AppHeaderTitle`/`UserAvatarMenu` header — see the `EventDetail` precedent, commit `1af1553`).

### Goals / Non-Goals (Mobile)

**Goals:**
- Single feed on `NewsScreen`: published news (newspaper-front-page card — large cover photo + headline) visible to every authenticated role, via `GET /api/coach/news`.
- Coach/Administrator additionally see their drafts in the same feed (via `GET /api/coach/news/drafts`), visually tagged "Borrador", positioned above the published items (most actionable first).
- Tapping any card opens `NewsDetailScreen` (full title, subtitle, cover photo, body, formatted date) via `GET /api/coach/news/{id}`.
- Coach/Administrator-only FAB on `NewsScreen` opens `NewsFormScreen` in create mode; Coach/Administrator-only Editar/Eliminar on `NewsDetailScreen` open `NewsFormScreen` in edit mode / call delete.
- Cover photo picked from the device gallery (`expo-image-picker` — confirm exact API against `https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/` before implementing) and uploaded via the two-step flow: `POST /api/coach/news/image` first, then the returned `url` is sent with `POST`/`PUT`.
- Role gating (FAB, Editar/Eliminar, drafts-in-feed) reads roles from `useAuth()` (`roles.includes('Coach') || roles.includes('Administrator')`) — never a second token read.

**Non-Goals:**
- No offline cache/optimistic updates for the feed — same simple fetch-on-focus pattern as other screens.
- No rich-text editor for `body` — a plain multiline `TextInput`, matching the backend's plain-string contract (design.md Non-Goals above).
- No un-publish action in the UI (the API doesn't support it — Decision 5 above); `NewsFormScreen` in edit mode never shows a status toggle, only Editar text fields + photo.
- No changes to `Front/`.

### Decisions (Mobile)

**1. One combined feed, not separate "Published"/"Drafts" screens.** The user confirmed drafts should appear in the *same* `NewsScreen` list, marked with a badge, rather than a separate tab/screen. `NewsScreen` issues two calls in parallel when the caller is Coach/Administrator (`Promise.all([getNews(1, PAGE_SIZE), getNewsDrafts(1, PAGE_SIZE)])`), skips the drafts call entirely for other roles (avoids a guaranteed 403), and renders `drafts + published` (drafts first) in one `FlatList`.

**2. `NewsTabStack`: a new nested native-stack under `NewsTab`.** Today `NewsTab` renders `NewsScreen` directly (no stack), so there's no way to push to a detail/create/edit screen without leaving the tab. Mirroring `TeamTabStack`/`CompetitionTabStack`, add:
```
const NewsStack = createNativeStackNavigator();
export const NewsTabStack = () => (
  <NewsStack.Navigator screenOptions={{ headerShown: false }}>
    <NewsStack.Screen name="NewsList" component={NewsScreen} />
    <NewsStack.Screen name="NewsDetail" component={NewsDetailScreen}
      options={eventDetailScreenOptions} />
    <NewsStack.Screen name="NewsForm" component={NewsFormScreen}
      options={eventDetailScreenOptions} />
  </NewsStack.Navigator>
);
```
`Tab.Screen name="NewsTab"` now renders `NewsTabStack` instead of `NewsScreen` directly — the tab's own `name`, `tabBarLabel`, and `tabBarIcon` are unchanged (per the stable-route-name rule), only its `component` changes. `eventDetailScreenOptions` (already defined in `RootNavigator.tsx` for `EventDetail`) is reused as-is for header/back behavior consistency with the rest of the app.
**Alternative considered**: a top-level `Stack.Screen` outside the tab (like `TeamSwitcher`) — rejected because it would hide the bottom tab bar on detail/create/edit, inconsistent with the `EventDetail` precedent (commit `1af1553`, "keep bottom tab bar and native header on event detail").

**3. `NewsFormScreen` shared between create and edit.** A `mode: 'create' | 'edit'` + optional `newsId` route param decide: create shows a Draft/Publish segmented choice at submit time (`POST /api/coach/news` with the chosen `status`), edit has no status control and calls `PUT /api/coach/news/{id}` (status/publishedAt are never touched by edit, per the API contract). Both modes share the same field layout (title, subtitle, body, cover photo) and the same two-step image upload helper.

**4. `api/news.ts` shape**, following `team.ts`'s typed-function-no-class pattern:
```ts
export interface NewsSummary { id: string; title: string; subtitle: string; coverImageUrl: string; status: 'Draft' | 'Published'; publishedAt: string | null; }
export interface NewsDetail extends NewsSummary { body: string; createdAt: string; updatedAt: string; }
export const getNews = (pageNumber: number, pageSize: number): Promise<{ items: NewsSummary[]; totalCount: number }> => ...;
export const getNewsDrafts = (pageNumber: number, pageSize: number): Promise<{ items: NewsSummary[]; totalCount: number }> => ...;
export const getNewsById = (id: string): Promise<NewsDetail> => ...;
export const uploadNewsImage = (fileUri: string): Promise<{ url: string }> => ...;
export const createNews = (payload: { title: string; subtitle: string; body: string; coverImageUrl: string; status: 'Draft' | 'Published' }): Promise<{ id: string }> => ...;
export const updateNews = (id: string, payload: { title: string; subtitle: string; body: string; coverImageUrl: string }): Promise<void> => ...;
export const publishNews = (id: string): Promise<NewsDetail> => ...;
export const deleteNews = (id: string): Promise<void> => ...;
```
`getNews`/`getNewsDrafts` read the `X-Total-Count` response header (same convention Mobile already follows for other paginated endpoints) and return it alongside `items` rather than exposing the raw Axios response to screens.

**5. Errors follow the existing Mobile pattern**: every screen's `catch` sets `error` to `e.response?.data?.detail || '<fallback en español>'` (e.g. `'No se pudieron cargar las noticias'`, `'No se pudo guardar la noticia'`, `'No se pudo eliminar la noticia'`).

### Risks / Trade-offs (Mobile)

- **[Risk]** Two parallel list calls (`getNews` + `getNewsDrafts`) for Coach/Administrator means a drafts-endpoint failure could sour the whole feed. → **Mitigation**: treat a failed `getNewsDrafts` call as "no drafts to show" (log/ignore) rather than failing the screen — the published feed must still render for a Coach even if the drafts call errors.
- **[Risk]** `NewsFormScreen`'s two-step image upload (pick → upload → get URL → hold in local state → submit) means a user who abandons the form after uploading leaves an orphaned image server-side. → **Accepted**: matches the backend's own accepted trade-off (design.md Decision 5) for `UploadPlayerPhoto`/`UpdateClub` emblem.
- **[Risk]** Exact `expo-image-picker` (or equivalent) API surface is unverified against Expo v57 at proposal time. → **Mitigation**: `Mobile/AGENTS.md` requirement — consult `https://docs.expo.dev/versions/v57.0.0/` for the exact picker API before writing `NewsFormScreen`'s image-pick code; do not assume prior-version behavior.

## Open Questions

- None blocking. Confirm with mobile-specialist before hardcoding: exact `status` string casing (`"Draft"`/`"Published"`, PascalCase as shown) and that `X-Total-Count` header (not a JSON envelope) is an acceptable pagination pattern for Mobile, since it's the existing backend convention (`GetSportEvents`-style).
