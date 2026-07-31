## Context

No push-notification capability exists today. Mobile (Coach/Familia) needs device tokens registered against the backend and a way to send notifications when news is published or a calendar (`SportEvent`) event is created/updated/deleted. The nearest backend templates are `Features/Mobile/Teams/Queries/GetMyTeams.cs` and `Features/Mobile/Attendance/Commands/ConfirmAttendance.cs` (Mediator `IRequest` + `ICurrentUserService`, the convention for `Features/Mobile/*`) for the token endpoints, `Features/Federation/Competitions/Services/CalendarService.cs` (`IHttpClientFactory`-based external service) for `IExpoPushService`, and `Domain/Entities/News/NewsItem.cs` + `NewsItemEntityConfiguration.cs` for the `PushToken` entity. On Mobile, `AuthContext.tsx` (`login`/`logout`) and `RootNavigator.tsx` (tab stacks, `NewsTabStack`/`CalendarTabStack`) are the two integration points.

Note: `SportEvents` commands (`CreateSportEvent.cs`, `UpdateSportEvent.cs`, `DeleteSportEvent.cs`) predate the `Features/Mobile/*` Mediator convention and use raw Minimal API lambdas with `AppDbContext` injected directly — this design hooks into that existing style rather than converting them to Mediator, to keep the diff minimal.

## Goals / Non-Goals

**Goals:**
- Backend: register/unregister an Expo push token per `(UserId, DeviceId)`; send a push notification via the Expo Push API when news is published, or a `SportEvent` is created, updated, or deleted.
- Backend: prune tokens that Expo reports as `DeviceNotRegistered` on send.
- Mobile: request notification permission after login, register/refresh the token, unregister on logout.
- Mobile: foreground notifications show a local alert/banner (via `expo-notifications` handler); background/killed-state taps deep-link into the right screen.
- Mobile: app icon badge count reflects unread notifications; cleared when the relevant tab/screen is opened.
- Mobile: a settings toggle per category (Noticias / Calendario) that the backend respects when deciding whether to send to a given token.
- Full TDD: xUnit + Moq (backend), Jest + Testing Library for RN (mobile), written first.

**Non-Goals:**
- No convocatoria/match-result notifications (see proposal.md — deferred, no direct write command to hook into).
- No rich push content (images, actions) — title + body + a small `data` payload (`type`, `id`) only.
- No Android notification channels beyond the Expo default channel — a single default channel is enough for two categories at this stage.
- No Front (React SPA) work.
- No delivery-receipt polling loop (Expo's second `getPushNotificationReceiptsAsync` step) — fire-and-check-immediate-errors only, matching the scope of "send + prune on `DeviceNotRegistered`".

## Decisions

### 1. `PushToken` as its own entity in `AppDbContext`, keyed by `(UserId, DeviceId)`
One user can have multiple devices; `DeviceId` (Expo's `Constants.installationId` equivalent, or a generated UUID persisted in `SecureStore`) disambiguates them so a login on a new phone doesn't evict the token registered on an old one. Registration is an upsert: `RegisterPushTokenCommand` finds by `(UserId, DeviceId)` and updates `ExpoPushToken`/`UpdatedAt`, or creates. Mirrors `NewsItem`'s private-setter + factory-method style (`PushToken.Create(...)`, `UpdateToken(...)`).

### 2. Token endpoints follow the `Features/Mobile/*` Mediator convention, not the `SportEvents` raw-lambda style
`Features/Mobile/PushNotifications/RegisterPushToken.cs` and `UnregisterPushToken.cs` use `IRequest<Unit>` + `ICurrentUserService` (like `ConfirmAttendance`), since they're new Mobile-owned endpoints with no existing raw-lambda sibling to match, and the Mediator style gives FluentValidation for free.

### 3. `IExpoPushService` as a thin `IHttpClientFactory`-based client, called synchronously (fire-and-forget-safe) from existing write flows
Mirrors `ICalendarService`. `SendAsync(IReadOnlyCollection<ExpoPushMessage> messages, CancellationToken ct)` POSTs to `https://exp.host/--/api/v2/push/send` (batches of up to 100 per Expo's limit), reads the response `data[]` array, and returns the indices/tokens that came back `status: "error", details: { error: "DeviceNotRegistered" }` so the caller can prune them. Registered as `services.AddScoped<IExpoPushService, ExpoPushService>()` in `ServiceCollectionExtensions.cs`, alongside a named `HttpClient` if a base address is convenient (`services.AddHttpClient("ExpoPush", c => c.BaseAddress = new Uri("https://exp.host/"))`).

### 4. Notification triggers call a shared `IPushNotificationDispatcher`, invoked after `SaveChangesAsync` in each trigger site
A small orchestration service (`Features/Mobile/PushNotifications/PushNotificationDispatcher.cs`) resolves the target audience for an event (e.g. "everyone with a token and the Calendario category enabled and linked to `TeamId`" for a `SportEvent` change, "everyone with a token and the Noticias category enabled" for news), builds `ExpoPushMessage`s, calls `IExpoPushService.SendAsync`, and prunes `DeviceNotRegistered` tokens. `PublishNewsHandler` (`Features/Coaches/News/PublishNews.cs`) calls it after `SaveChangesAsync`; `CreateSportEvent`/`UpdateSportEvent`/`DeleteSportEvent` lambdas call it after their own `SaveChangesAsync`. Audience resolution for calendar events uses `UserTeam`/`UserClub` joins (same tables `GetMyTeams.cs` already joins) filtered to `SportEvent.TeamId`.

### 5. Category preference stored as two booleans on `PushToken`, not a separate table
`NewsEnabled` / `CalendarEnabled` (default `true`) live directly on `PushToken` — a device-level preference, not a user-level one, since two devices for the same user could reasonably want different settings (e.g. a tablet that's Familia-only muted for calendar spam). `PATCH /api/mobile/push-tokens/{deviceId}/preferences` updates them.

### 6. Deep-linking via a module-level `navigationRef` (`createNavigationContainerRef`)
`RootNavigator.tsx` currently has no ref exposed for navigation-from-outside-a-component (needed because a notification tap can fire before any screen has mounted, e.g. cold start). Add `export const navigationRef = createNavigationContainerRef()` in a new `Mobile/src/navigation/navigationRef.ts`, attach it via `<NavigationContainer ref={navigationRef}>`, and use it from `src/notifications/notificationNavigation.ts` to call `navigationRef.navigate('Calendar', { screen: 'NewsTab', params: { screen: 'NewsDetail', params: { newsId } } })` (news) or `navigationRef.navigate('Calendar', { screen: 'CalendarTab', params: { screen: 'EventDetail', params: { eventId, teamId } } })` (calendar), matching the nested-stack navigation shape already used by `CalendarTabStack`/`NewsTabStack`. If `navigationRef.isReady()` is false (cold start race), the pending navigation is queued and flushed once ready.

### 7. Badge count: increment locally on receipt, clear on relevant tab focus
`expo-notifications`' `setBadgeCountAsync` is the source of truth for the OS badge. `src/notifications/index.ts` increments it on every foreground/background notification received (via `Notifications.addNotificationReceivedListener`) and Mobile clears it (`setBadgeCountAsync(0)`) on `NewsTab`/`CalendarTab` focus (`useFocusEffect`), not globally on app open — a badge for one category shouldn't vanish just because the user opened an unrelated tab.

## API Contract (authoritative for Mobile integration)

Base path: `/api/mobile/push-tokens`. All endpoints require authentication (`RequireAuthorization()`). All errors return RFC 7807 `ProblemDetails`.

| Method | Route | Request | Response | Notes |
|---|---|---|---|---|
| `POST` | `/api/mobile/push-tokens` | `RegisterPushTokenRequest` (below) | `204 NoContent` | Upsert by `(UserId, DeviceId)`. |
| `DELETE` | `/api/mobile/push-tokens/{deviceId}` | — | `204 NoContent` | No-op (still `204`) if the token doesn't exist — logout must not fail on a token that was never registered. |
| `PATCH` | `/api/mobile/push-tokens/{deviceId}/preferences` | `UpdatePushPreferencesRequest` (below) | `204 NoContent`; `404 NotFound` if device not registered | |

### `RegisterPushTokenRequest`
```json
{ "deviceId": "string, required", "expoPushToken": "string, required", "platform": "ios | android" }
```

### `UpdatePushPreferencesRequest`
```json
{ "newsEnabled": true, "calendarEnabled": true }
```

### Notification `data` payload shape (Expo push message, consumed by Mobile)
```json
// news
{ "type": "news", "id": "<newsId>" }
// calendar
{ "type": "calendar", "id": "<eventId>", "teamId": "<teamId>" }
```

## Risks / Trade-offs

- **[Risk]** Sending notifications synchronously inside the request that triggered them (news publish, sport-event write) adds Expo Push API latency to that request's response time. → **Accepted**: batches are small (club-scale audiences), and `IExpoPushService.SendAsync` has its own short timeout; a slow/failed send is logged and swallowed, never fails the parent command (creating a calendar event must not 500 because Expo is down).
- **[Risk]** `DeviceId` must be stable across app restarts for the upsert-by-device-id logic to work; if Mobile ever regenerates it, duplicate tokens accumulate. → **Mitigation**: Mobile generates `DeviceId` once and persists it in `SecureStore` (never regenerated), documented in the Mobile Decisions below.
- **[Risk]** No delivery-receipt polling (Non-Goal) means a token that's technically invalid but doesn't fail synchronously (Expo queues it, receipt fails later) won't be pruned by this change. → **Accepted**: acceptable staleness for v1; a follow-up can add receipt polling.

## Migration Plan

1. Add `PushToken` entity (`Domain/Entities/PushNotifications/PushToken.cs`): `UserId`, `DeviceId`, `ExpoPushToken`, `Platform`, `NewsEnabled`, `CalendarEnabled`, `CreatedAt`, `UpdatedAt`.
2. Add `IEntityTypeConfiguration<PushToken>` (unique index on `(UserId, DeviceId)`) + `AppDbContext.PushTokens` `DbSet`.
3. Generate migration: `.\manage-migrations.ps1 -Action create -MigrationName AddPushTokens -Context AppDbContext`.
4. Add `IExpoPushService`/`ExpoPushService` + DI registration (`AddHttpClient("ExpoPush", ...)`, `AddScoped<IExpoPushService, ExpoPushService>()`).
5. Add `IPushNotificationDispatcher`/`PushNotificationDispatcher` + DI registration.
6. Add `Features/Mobile/PushNotifications/`: `RegisterPushToken.cs`, `UnregisterPushToken.cs`, `UpdatePushPreferences.cs`, each with its FluentValidation validator co-located and manually registered in `ServiceCollectionExtensions.cs` (matching the `CreateNewsCommand`/`UpdateNewsCommand` validator registration pattern).
7. Wire `IPushNotificationDispatcher` into `PublishNewsHandler` (after `SaveChangesAsync`) and into `CreateSportEvent`/`UpdateSportEvent`/`DeleteSportEvent` lambdas (after their `SaveChangesAsync`), injecting the dispatcher as an extra lambda/handler parameter.
8. xUnit + Moq tests written first (TDD Red) for: token upsert/unregister/preferences handlers, `ExpoPushService` (mocked `HttpMessageHandler`), `PushNotificationDispatcher` audience resolution and `DeviceNotRegistered` pruning, then the dispatcher-call wiring in `PublishNews`/`CreateSportEvent`/`UpdateSportEvent`/`DeleteSportEvent` tests.
9. `dotnet build` + `dotnet test` before handing off to Mobile.

## Mobile Design

### Context (Mobile)

No push package installed (`expo-notifications` absent from `Mobile/package.json`). Expo SDK is `^54.0.0` — per `Mobile/AGENTS.md`, verify the exact `expo-notifications` API against `https://docs.expo.dev/versions/v57.0.0/sdk/notifications/` before writing code (permission API, `Notifications.getExpoPushTokenAsync` project-id requirement, Android channel setup) rather than assuming an older SDK's behavior. `RootNavigator.tsx` has no `navigationRef` today (Decision 6). `AuthContext.tsx` `login`/`logout` are the two hook points.

### Goals / Non-Goals (Mobile)

**Goals:**
- Permission requested once, right after a successful `login()` (not on app boot, so an unauthenticated user is never prompted).
- Token obtained via `expo-notifications`, persisted `DeviceId` in `SecureStore`, registered via `POST /api/mobile/push-tokens` on login and whenever the token refreshes (`Notifications.addPushTokenListener`).
- `logout()` calls `DELETE /api/mobile/push-tokens/{deviceId}` before clearing local auth state.
- Foreground notifications: `Notifications.setNotificationHandler` shows an alert/banner (not silent).
- Background/killed-state tap: `Notifications.addNotificationResponseReceivedListener` (+ `getLastNotificationResponseAsync` for cold start) reads `request.content.data` and deep-links via `navigationRef` (Decision 6).
- Badge count incremented on receipt, cleared on relevant tab focus (Decision 7).
- New `NotificationSettingsScreen` (reachable from `UserAvatarMenu`) with two toggles (Noticias / Calendario) calling `PATCH /api/mobile/push-tokens/{deviceId}/preferences`.

**Non-Goals:**
- No custom notification sound/rich media.
- No in-app notification inbox/history list — only the OS notification tray + badge.
- No changes to `Front/`.

### Decisions (Mobile)

**1. `src/notifications/` module, not inline in `AuthContext.tsx`.** `src/notifications/pushToken.ts` (get-or-create persisted `DeviceId`, request permission, get Expo push token), `src/notifications/api.ts` (typed `registerPushToken`/`unregisterPushToken`/`updatePushPreferences`, mirroring `team.ts`'s no-class pattern), `src/notifications/notificationNavigation.ts` (data-payload → `navigationRef.navigate(...)` mapping), `src/notifications/index.ts` (wires the `expo-notifications` listeners + badge logic, exposes `initPushNotifications()` / `teardownPushNotifications()`). `AuthContext.tsx` calls `initPushNotifications()` in `login()` after the token is stored, and `teardownPushNotifications()` in `logout()` before clearing state.

**2. `DeviceId` generated once via `expo-crypto`'s `randomUUID()` (or `expo-application`'s stable id if available per the v57 docs check) and persisted in `SecureStore` under a new key**, read-or-create on first call — never regenerated, per design.md Risk #2.

**3. `navigationRef` module (`Mobile/src/navigation/navigationRef.ts`)** exports `export const navigationRef = createNavigationContainerRef()`; `RootNavigator`'s `<NavigationContainer>` gets `ref={navigationRef}`. `notificationNavigation.ts` checks `navigationRef.isReady()`; if not ready (cold start), it retries via a short-lived listener on `NavigationContainer`'s `onReady` prop rather than a fixed timeout.

**4. Badge clearing hooked into `NewsScreen` and `CalendarScreen` via `useFocusEffect(() => { Notifications.setBadgeCountAsync(0); })`** — simplest option given there's no per-category badge count tracked separately; acceptable since a Calendario notification's badge clears when the user visits Calendario, same idea for Noticias.

**5. `NotificationSettingsScreen`** is a plain form screen (two `Switch` rows, save button) added to the top-level `Stack.Navigator` (alongside `TeamSwitcher`), reachable via a new item in `UserAvatarMenu.tsx`'s menu. Loads current prefs by keeping them in `AuthContext`-adjacent local state set at registration time (register response doesn't need to echo prefs — screen defaults both switches to `true` unless a `GET` is added; if the user wants defaults reflected accurately after a backend restart, `GET /api/mobile/push-tokens/{deviceId}` can be added in a follow-up — out of scope here since preferences default `true` and the write-only `PATCH` is sufficient for "opt out").

**6. Errors follow the existing Mobile pattern**: `catch` sets a Spanish fallback (`'No se pudo activar las notificaciones'`, `'No se pudieron guardar las preferencias'`); a failed push-token registration must never block login — `initPushNotifications()` is called and its promise is not awaited by `login()`'s success path (fire-and-forget with an internal try/catch), so a denied permission or network hiccup doesn't prevent the user from reaching `TeamSwitcher`.

### Risks / Trade-offs (Mobile)

- **[Risk]** `expo-notifications`' exact permission/token API is unverified against SDK 54/v57 docs at design time. → **Mitigation**: `Mobile/AGENTS.md` requirement — consult the versioned docs before writing `pushToken.ts`.
- **[Risk]** Fire-and-forget registration (Decision 6 above) means a registration failure is silent to the user beyond a possible toast. → **Accepted**: matches the product goal that push is an enhancement, not a login blocker.
- **[Risk]** No `GET` preferences endpoint means `NotificationSettingsScreen` can't reflect a previously-saved non-default state after an app reinstall (new `DeviceId`). → **Accepted** for v1 (Decision 5); flagged as a known gap.

## Open Questions

- None blocking. Confirm with mobile-specialist before hardcoding: the exact `expo-notifications` permission/token API surface for SDK 54 (must be checked against the versioned docs per `Mobile/AGENTS.md`, not assumed here), and whether `expo-crypto` or `expo-application` is preferred for the persisted `DeviceId` generator.
