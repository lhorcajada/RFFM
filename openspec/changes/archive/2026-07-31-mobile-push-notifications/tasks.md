## 1. Domain

- [x] 1.1 Add `PushToken` entity (`Domain/Entities/PushNotifications/PushToken.cs`): `UserId`, `DeviceId`, `ExpoPushToken`, `Platform`, `NewsEnabled`, `CalendarEnabled`, `CreatedAt`, `UpdatedAt`, with intention-revealing methods (`Create(...)`, `UpdateToken(...)`, `UpdatePreferences(...)`) rather than public setters.

## 2. Persistence

- [x] 2.1 Add `IEntityTypeConfiguration<PushToken>` under `Infrastructure/Persistence/Configuration/Entities/PushTokenEntityConfiguration.cs`: table `PushTokens`, schema `app`, unique index on `(UserId, DeviceId)`.
- [x] 2.2 Add `AppDbContext.PushTokens` `DbSet<PushToken>` property.
- [x] 2.3 Generate migration `AddPushTokens` via `.\manage-migrations.ps1 -Action create -MigrationName AddPushTokens -Context AppDbContext`; verify it applies cleanly.

## 3. Expo Push API client

- [x] 3.1 Write failing tests for `ExpoPushService.SendAsync` (mocked `HttpMessageHandler`): successful send, partial failure returns the failed tokens, `DeviceNotRegistered` entries identified for pruning, batches >100 messages split into multiple requests.
- [x] 3.2 Implement `Features/Mobile/PushNotifications/Services/IExpoPushService.cs` / `ExpoPushService.cs` (`IHttpClientFactory`, named client `ExpoPush`, base address `https://exp.host/`). Register in `ServiceCollectionExtensions.cs`. Make tests pass.

## 4. Notification dispatcher

- [x] 4.1 Write failing tests for `PushNotificationDispatcher`: resolves audience for a news event (all tokens with `NewsEnabled`), resolves audience for a calendar event scoped to `TeamId` (tokens of users linked via `UserTeam`/`UserClub` with `CalendarEnabled`), calls `IExpoPushService.SendAsync` with the right `data` payload shape, prunes tokens reported `DeviceNotRegistered`, swallows/logs send failures without throwing.
- [x] 4.2 Implement `Features/Mobile/PushNotifications/PushNotificationDispatcher.cs` (`IPushNotificationDispatcher`). Register in `ServiceCollectionExtensions.cs`. Make tests pass.

## 5. Feature: Register push token

- [x] 5.1 Write failing tests for `RegisterPushTokenCommand` handler and validator (creates when new `(UserId, DeviceId)`, updates `ExpoPushToken`/`UpdatedAt` when existing, required-field validation).
- [x] 5.2 Implement `Features/Mobile/PushNotifications/RegisterPushToken.cs` (`IFeatureModule`, `IRequest<Unit>`, `ICurrentUserService`, validator manually registered). Make tests pass.

## 6. Feature: Unregister push token

- [x] 6.1 Write failing tests for `UnregisterPushTokenCommand` handler (deletes existing; no-op `204` when device not found — must not throw).
- [x] 6.2 Implement `Features/Mobile/PushNotifications/UnregisterPushToken.cs`. Make tests pass.

## 7. Feature: Update push preferences

- [x] 7.1 Write failing tests for `UpdatePushPreferencesCommand` handler (updates `NewsEnabled`/`CalendarEnabled`; `404` when device not registered for the current user).
- [x] 7.2 Implement `Features/Mobile/PushNotifications/UpdatePushPreferences.cs`. Make tests pass.

## 8. Wire triggers into existing flows

- [x] 8.1 Write/extend failing tests asserting `PublishNewsHandler` calls `IPushNotificationDispatcher.DispatchNewsPublishedAsync(...)` after `SaveChangesAsync` (mock the dispatcher, verify call + argument shape).
- [x] 8.2 Update `Features/Coaches/News/PublishNews.cs`: inject `IPushNotificationDispatcher` into `PublishNewsHandler`, call it after `SaveChangesAsync`. Make tests pass.
- [x] 8.3 Write/extend failing tests asserting `CreateSportEvent`/`UpdateSportEvent`/`DeleteSportEvent` call `IPushNotificationDispatcher.DispatchCalendarChangedAsync(...)` after their `SaveChangesAsync`.
- [x] 8.4 Update `Features/Coaches/SportEvents/Commands/CreateSportEvent.cs`, `UpdateSportEvent.cs`, `DeleteSportEvent.cs`: inject `IPushNotificationDispatcher` as a lambda parameter, call it after `SaveChangesAsync`. Make tests pass.

## 9. Verification (Backend)

- [x] 9.1 Run `dotnet build` — must pass with no new warnings/errors.
- [x] 9.2 Run `dotnet test` — full suite green, including new PushNotifications tests.
- [ ] 9.3 Manually smoke-test against a local run (`dotnet run --project src/RFFM.Host`): register token → publish news → verify Expo API call payload (log or breakpoint, no real device required) → create/update/delete a sport event → verify dispatch → unregister → update preferences.
- [x] 9.4 Confirm the API contract in `design.md` matches the actual shipped DTOs/routes exactly before handing off to mobile-specialist.

---

All Mobile tasks below follow strict TDD (Red → Green → Refactor): write the failing Jest + Testing Library for RN test first, watch it fail, implement the minimal code to pass, then refactor keeping the suite green. Backend tasks 1-9 must be shipped (or the endpoints otherwise available in the target environment) before Mobile tasks are exercised end-to-end. Before writing any `expo-notifications` code, consult `https://docs.expo.dev/versions/v57.0.0/sdk/notifications/` per `Mobile/AGENTS.md` and confirm the exact permission/token API against SDK 54.

## 10. Mobile: dependencies and device id

- [x] 10.1 Add `expo-notifications` (and `expo-crypto` if chosen for `DeviceId` generation) via `npx expo install expo-notifications expo-crypto` — confirm resolved versions match Expo SDK 54.
- [x] 10.2 Write failing tests in `Mobile/src/notifications/__tests__/pushToken.test.ts` for `getOrCreateDeviceId()` (creates once, persists in `SecureStore`, returns the same id on subsequent calls) and `requestPushToken()` (requests permission, returns Expo push token on grant, returns `null` on denial, never throws).
- [x] 10.3 Implement `Mobile/src/notifications/pushToken.ts`. Make tests pass.

## 11. Mobile: API client

- [x] 11.1 Write failing tests in `Mobile/src/notifications/__tests__/api.test.ts` for `registerPushToken`, `unregisterPushToken`, `updatePushPreferences` — request shape and error propagation.
- [x] 11.2 Implement `Mobile/src/notifications/api.ts` (typed functions via the shared `api` client). Make tests pass.

## 12. Mobile: navigation ref and deep-link mapping

- [x] 12.1 Write failing tests in `Mobile/src/navigation/__tests__/navigationRef.test.ts` (ref exists, `isReady()` guarded) and `Mobile/src/notifications/__tests__/notificationNavigation.test.ts` (news payload navigates to `NewsDetail` with `newsId`; calendar payload navigates to `EventDetail` with `eventId`/`teamId`; unknown `type` is a no-op, not a crash).
- [x] 12.2 Implement `Mobile/src/navigation/navigationRef.ts` and `Mobile/src/notifications/notificationNavigation.ts`; attach `ref={navigationRef}` to `RootNavigator`'s `NavigationContainer`. Make tests pass.

## 13. Mobile: notification listeners, badge, init/teardown

- [x] 13.1 Write failing tests in `Mobile/src/notifications/__tests__/index.test.ts` for `initPushNotifications()` (requests token, registers it, sets up received/response listeners, checks `getLastNotificationResponseAsync` for cold start) and `teardownPushNotifications()` (removes listeners, calls `unregisterPushToken`), including: registration failure does not throw out of `initPushNotifications()`.
- [x] 13.2 Implement `Mobile/src/notifications/index.ts`. Make tests pass.

## 14. Mobile: wire into AuthContext

- [x] 14.1 Write/extend failing tests in `Mobile/src/auth/__tests__/AuthContext.test.tsx` (or equivalent) asserting `login()` success calls `initPushNotifications()` without awaiting/blocking navigation on its result, and `logout()` calls `teardownPushNotifications()` before clearing token state.
- [x] 14.2 Update `Mobile/src/auth/AuthContext.tsx`. Make tests pass.

## 15. Mobile: badge clearing on tab focus

- [x] 15.1 Write failing tests asserting `NewsScreen` and `CalendarScreen` call `Notifications.setBadgeCountAsync(0)` on focus (`useFocusEffect`).
- [x] 15.2 Update `Mobile/src/screens/NewsScreen.tsx` and `Mobile/src/screens/CalendarScreen.tsx`. Make tests pass.

## 16. Mobile: NotificationSettingsScreen

- [x] 16.1 Write failing tests in `Mobile/src/screens/__tests__/NotificationSettingsScreen.test.tsx`: renders two switches (Noticias, Calendario) defaulted on; toggling and saving calls `updatePushPreferences` with the new values; save error sets a Spanish fallback message.
- [x] 16.2 Implement `Mobile/src/screens/NotificationSettingsScreen.tsx`, register it on the top-level `Stack.Navigator` in `RootNavigator.tsx`, add an entry point from `Mobile/src/navigation/UserAvatarMenu.tsx`. Make tests pass.

## 17. Mobile: Verification

- [x] 17.1 Run `npm test` in `Mobile/` — full suite green, no skipped tests.
- [x] 17.2 Run `openspec validate mobile-push-notifications --strict` — no errors.
- [x] 17.3 Confirm no changes were made under `Front/` in the Mobile tasks' diff.
