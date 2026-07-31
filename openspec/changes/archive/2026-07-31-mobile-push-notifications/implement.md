Technical script for implementing `mobile-push-notifications`. Follow `tasks.md` in order, strict TDD (Red → Green → Refactor) for every numbered task. Do not skip the failing-test step. Reference `design.md` for the authoritative API contract and architectural decisions; reference `proposal.md` for scope (news + calendar changes only — convocatorias/resultados are explicitly out of scope).

## Backend script (tasks 1-9)

Base path for all new backend files: `Back/ExtractionApi/src/RFFM.Api/`.

### 1-2. Domain + Persistence

- `Domain/Entities/PushNotifications/PushToken.cs`: mirror `Domain/Entities/News/NewsItem.cs`'s style — `BaseEntity`, private setters, private constructor, static `Create(string userId, string deviceId, string expoPushToken, string platform)` factory (throws `ArgumentException` on blank required fields, defaults `NewsEnabled = true`, `CalendarEnabled = true`), `UpdateToken(string expoPushToken)`, `UpdatePreferences(bool newsEnabled, bool calendarEnabled)`.
- `Infrastructure/Persistence/Configuration/Entities/PushTokenEntityConfiguration.cs`: mirror `NewsItemEntityConfiguration.cs`. `builder.ToTable("PushTokens")`, `builder.HasIndex(p => new { p.UserId, p.DeviceId }).IsUnique()`.
- Add `public DbSet<PushToken> PushTokens { get; set; }` to `Infrastructure/Persistence/AppDbContext.cs` (near the `News` DbSet).
- Run `.\manage-migrations.ps1 -Action create -MigrationName AddPushTokens -Context AppDbContext` from `Back/ExtractionApi/`.

### 3. Expo Push API client

`Features/Mobile/PushNotifications/Services/ExpoPushService.cs`:
```csharp
public interface IExpoPushService
{
    Task<IReadOnlyCollection<string>> SendAsync(IReadOnlyCollection<ExpoPushMessage> messages, CancellationToken ct = default);
}

public record ExpoPushMessage(string To, string Title, string Body, IDictionary<string, object> Data);
```
`SendAsync` chunks `messages` into batches of ≤100, POSTs each batch (JSON array body) to the `ExpoPush` named `HttpClient` at `/--/api/v2/push/send`, parses the `data[]` response array positionally against the batch, and returns the `To` tokens whose entry has `status == "error"` and `details.error == "DeviceNotRegistered"`. Swallow/log (do not throw) on non-2xx or malformed response — return an empty pruned-token list in that case, since a transport failure isn't the same as a confirmed-dead token.

DI in `ServiceCollectionExtensions.cs`:
```csharp
services.AddHttpClient("ExpoPush", c => c.BaseAddress = new Uri("https://exp.host/"));
services.AddScoped<IExpoPushService, ExpoPushService>();
```

Test with a mocked `HttpMessageHandler` (`Moq.Protected` or a small test double), same style already used for any existing `HttpClient`-based service test in the solution — grep for one before writing a new mocking helper.

### 4. Dispatcher

`Features/Mobile/PushNotifications/PushNotificationDispatcher.cs`:
```csharp
public interface IPushNotificationDispatcher
{
    Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default);
    Task DispatchCalendarChangedAsync(string eventId, string teamId, CancellationToken ct = default);
}
```
- `DispatchNewsPublishedAsync`: query `db.PushTokens.Where(p => p.NewsEnabled)`, build one `ExpoPushMessage` per token (`Title = "Nueva noticia"`, `Body` = a short generic string, `Data = { type: "news", id: newsId }`), call `IExpoPushService.SendAsync`, delete pruned tokens, `SaveChangesAsync`.
- `DispatchCalendarChangedAsync`: resolve the audience the same way `GetMyTeams.cs` resolves teams but inverted — users linked to `teamId` via `UserTeam.TeamId == teamId` OR via `UserClub` joined to the team's `ClubId` (look up `Team.ClubId` for `teamId` first) — then join to `PushTokens.Where(p => p.CalendarEnabled)` on `UserId`. Build messages with `Data = { type: "calendar", id: eventId, teamId }`, send, prune, save.
- Wrap the `IExpoPushService.SendAsync` call in try/catch; log and return normally on any exception (design.md Risk #1 — never let a notification failure bubble into the caller).

Register `services.AddScoped<IPushNotificationDispatcher, PushNotificationDispatcher>();`.

### 5-7. Token endpoints

Mirror `Features/Mobile/Attendance/Commands/ConfirmAttendance.cs` exactly (route + `IRequest<Unit>` + `ICurrentUserService` handler + co-located `AbstractValidator`):

- `Features/Mobile/PushNotifications/RegisterPushToken.cs` — `POST /api/mobile/push-tokens`. Handler: find `PushTokens` by `(currentUser.UserId, request.DeviceId)`; if found call `UpdateToken`, else `db.PushTokens.Add(PushToken.Create(...))`; `SaveChangesAsync`; return `Unit.Value`. Endpoint returns `Results.NoContent()`.
- `Features/Mobile/PushNotifications/UnregisterPushToken.cs` — `DELETE /api/mobile/push-tokens/{deviceId}`. Handler: find by `(UserId, DeviceId)`; if found, remove + save; if not found, do nothing (still success). Endpoint returns `Results.NoContent()`.
- `Features/Mobile/PushNotifications/UpdatePushPreferences.cs` — `PATCH /api/mobile/push-tokens/{deviceId}/preferences`. Handler: find by `(UserId, DeviceId)`; if not found throw `NotFoundException` (mirror the exception type `PublishNewsHandler` throws); else `UpdatePreferences(...)` + save. Endpoint returns `Results.NoContent()`.

Register each validator manually in `ServiceCollectionExtensions.cs`, matching the `CreateNewsCommand`/`UpdateNewsCommand` lines already there.

### 8. Wire triggers

- `PublishNews.cs`: add `IPushNotificationDispatcher dispatcher` to `PublishNewsHandler`'s constructor; call `await dispatcher.DispatchNewsPublishedAsync(news.Id, ct);` immediately after `await _db.SaveChangesAsync(ct);`, before building the response.
- `CreateSportEvent.cs`, `UpdateSportEvent.cs`, `DeleteSportEvent.cs`: add `IPushNotificationDispatcher dispatcher` as an extra parameter to each route lambda; call `await dispatcher.DispatchCalendarChangedAsync(ev.Id, ev.TeamId, cancellationToken);` right after the final `SaveChangesAsync` in each (for `CreateSportEvent`, after the recurrence-instances save if recurrence was requested, else after the initial save — call once per created event or just once for the master event, per design's non-goal of not over-notifying for recurrence spam; only dispatch for the master `ev`, not each generated instance). `DeleteSportEvent.cs`: capture `ev.TeamId` before deleting the row (needed by dispatcher after the row is gone).

### 9. Verification

`dotnet build`, `dotnet test`, then `openspec validate mobile-push-notifications --strict` (rerun from repo root — must still say "valid").

---

## Mobile script (tasks 10-17)

Base path for all new files: `Mobile/src/`. **Before writing any `expo-notifications` code**, fetch `https://docs.expo.dev/versions/v57.0.0/sdk/notifications/` and confirm the exact permission-request and token-fetch API against SDK 54 — do not assume prior-SDK behavior (`Mobile/AGENTS.md`).

### 10. Dependencies + device id

- `npx expo install expo-notifications expo-crypto` from `Mobile/`.
- `notifications/pushToken.ts`:
```ts
export const getOrCreateDeviceId = async (): Promise<string> => { /* SecureStore get, else Crypto.randomUUID(), save, return */ };
export const requestPushToken = async (): Promise<string | null> => { /* request permission; if denied return null; else Notifications.getExpoPushTokenAsync(...) */ };
```
Add a new `SecureStore` key constant in `src/auth/secureStore.ts` (or a local constant in `pushToken.ts` if `secureStore.ts` isn't meant to grow unrelated keys — follow whichever is less invasive given the current file).

### 11. API client

`notifications/api.ts`, typed-function pattern like `api/team.ts`:
```ts
export const registerPushToken = (deviceId: string, expoPushToken: string, platform: 'ios' | 'android'): Promise<void> => ...;
export const unregisterPushToken = (deviceId: string): Promise<void> => ...;
export const updatePushPreferences = (deviceId: string, newsEnabled: boolean, calendarEnabled: boolean): Promise<void> => ...;
```

### 12. Navigation ref + deep-link mapping

`navigation/navigationRef.ts`:
```ts
import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();
```
Attach `ref={navigationRef}` to `<NavigationContainer>` in `RootNavigator.tsx`.

`notifications/notificationNavigation.ts`:
```ts
export const navigateFromNotificationData = (data: { type?: string; id?: string; teamId?: string }) => {
  if (!navigationRef.isReady() || !data?.type) return; // caller queues/retries on NavigationContainer's onReady
  if (data.type === 'news') {
    navigationRef.navigate('Calendar', { screen: 'NewsTab', params: { screen: 'NewsDetail', params: { newsId: data.id } } });
  } else if (data.type === 'calendar') {
    navigationRef.navigate('Calendar', { screen: 'CalendarTab', params: { screen: 'EventDetail', params: { eventId: data.id, teamId: data.teamId } } });
  }
};
```

### 13. Listeners, badge, init/teardown

`notifications/index.ts`:
```ts
export const initPushNotifications = async (): Promise<void> => {
  try {
    Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: true }) });
    const deviceId = await getOrCreateDeviceId();
    const token = await requestPushToken();
    if (token) await registerPushToken(deviceId, token, Platform.OS as 'ios' | 'android');
    Notifications.addNotificationReceivedListener(() => { Notifications.getBadgeCountAsync().then(c => Notifications.setBadgeCountAsync(c + 1)); });
    Notifications.addNotificationResponseReceivedListener(r => navigateFromNotificationData(r.notification.request.content.data));
    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) navigateFromNotificationData(last.notification.request.content.data);
  } catch (e) {
    console.error('Push notification init failed:', e);
  }
};

export const teardownPushNotifications = async (): Promise<void> => {
  try {
    const deviceId = await getOrCreateDeviceId();
    await unregisterPushToken(deviceId);
  } catch (e) {
    console.error('Push notification teardown failed:', e);
  }
};
```
Verify exact `Notifications.setNotificationHandler` shape against the v57 docs — field names have changed across SDK versions.

### 14. AuthContext wiring

In `login()`, after `setIsAuthenticated(true)`: `initPushNotifications();` — call without `await` so a slow/failed permission flow never delays navigation past login (fire-and-forget, errors caught inside `initPushNotifications` itself). In `logout()`, `await teardownPushNotifications();` before `SecureStore.deleteToken()`.

### 15. Badge clearing

In `NewsScreen.tsx` and `CalendarScreen.tsx`, add:
```ts
useFocusEffect(useCallback(() => { Notifications.setBadgeCountAsync(0); }, []));
```

### 16. NotificationSettingsScreen

New screen with two `Switch` rows (default `true`/`true`), a save button calling `updatePushPreferences(deviceId, newsEnabled, calendarEnabled)`, Spanish error fallback on failure. Register on the top-level `Stack.Navigator` in `RootNavigator.tsx` (next to `TeamSwitcher`). Add a menu entry in `Mobile/src/navigation/UserAvatarMenu.tsx` navigating to it.

### 17. Verification

`npm test` in `Mobile/`, then `openspec validate mobile-push-notifications --strict` from repo root.
