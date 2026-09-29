## 1. Backend — Dispatcher method (~2h)

- [x] Red: add tests to `RFFM.Api.Tests/UnitTests/WebPushNotificationDispatcherTests.cs` for `DispatchNotificationsActivatedAsync` (player → coach with alias; family → "Un familiar de…"; self excluded; unlinked user → no rows; sender throws → no exception).
- [x] Green: add `DispatchNotificationsActivatedAsync(string userId, CancellationToken ct)` to `IWebPushNotificationDispatcher` + `WebPushNotificationDispatcher` (design.md Decision 3), reusing `ResolveTeamCoachUserIdsAsync` and `DispatchToUsersAsync`.
- **Verify**: `dotnet test --filter WebPushNotificationDispatcher`.

## 2. Backend — Hook into SubscribeWebPush (~1h)

- [x] Red: existing `RFFM.Api.Tests/UnitTests/PushSubscriptionHandlerTests.cs` — new endpoint calls the dispatcher once; existing endpoint does not.
- [x] Green: inject `IWebPushNotificationDispatcher` into `SubscribeWebPush.Handler`; call it only when `existing is null`, after `SaveChangesAsync` (design.md Decision 2).
- **Verify**: `dotnet build` + `dotnet test`.

## 3. Frontend — Banner (~2h)

- [x] Red: `pages/Dashboard/components/__tests__/PushActivationBanner.test.tsx` (mock `pushSubscriptionService`): shown when unsubscribed; hidden when subscribed / unsupported / denied; click navigates to `/coach/settings` with `state.section = "notifications"`.
- [x] Green: `pages/Dashboard/hooks/usePushActivationStatus.ts`, `pages/Dashboard/components/PushActivationBanner.tsx` + `PushActivationBanner.module.css` (design.md Decision 1), rendered in `Dashboard.tsx` above `DashboardCards`.
- [ ] Visual check at ~375px and desktop in the Coach theme.
- **Verify**: `npm run test` + `npm run build`.

## 4. Validation

- [x] `openspec validate coach-push-activation-banner --strict`.
- [ ] Full back + front suites green; ask the user before committing.
