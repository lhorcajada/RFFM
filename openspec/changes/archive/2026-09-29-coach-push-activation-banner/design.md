## Context

The web push system (archived change `2026-09-24-coach-web-push-notifications`) is in place: `SubscribeWebPush` (`POST /api/push/subscriptions`) stores one `WebPushSubscription` per browser endpoint, and `WebPushNotificationDispatcher` persists a `Notification` + sends Web Push per recipient, isolating every failure with try/catch + `ILogger`. The Settings page already supports opening directly on the notifications section via `location.state.section = "notifications"` (and defaults to it for player/family users). This change adds a prompt on the Dashboard and a coach-facing notification; it creates no new tables.

## Decision 1 — Banner visibility is decided client-side, per browser

Push subscriptions are per browser, so "is this user reachable here?" is only knowable in the browser. The banner is shown when **all** hold:

1. `isPushNotificationsSupported()` is `true`;
2. `Notification.permission !== "denied"` (a denied permission cannot be re-prompted by the page — the banner would lead nowhere);
3. `getCurrentPushSubscriptionStatus()` resolves `false`.

While the status is loading, nothing is rendered (no flicker). It is shown to every role (coaches also receive convocation-status pushes). It is not dismissable: it disappears once the browser is subscribed.

Implementation: `pages/Dashboard/hooks/usePushActivationStatus.ts` returns `{ shouldPrompt: boolean }` using the existing helpers from `services/pushSubscriptionService.ts` (no direct `navigator` code in the component). `pages/Dashboard/components/PushActivationBanner.tsx` + `PushActivationBanner.module.css` renders an MUI `Alert`/`Paper` with a `Button` ("Activar notificaciones") that calls `navigate("/coach/settings", { state: { section: "notifications" } })`. Styling uses Coach theme tokens (orange accent) via CSS Modules; responsive (stacks vertically below `sm`). Rendered in `Dashboard.tsx` above `DashboardCards`.

## Decision 2 — "New device" = endpoint not previously stored

`SubscribeWebPush.Handler` already looks up `existing` by `Endpoint`. `isNewDevice = existing is null`. Only when `isNewDevice` is true, after `SaveChangesAsync`, it calls `await _dispatcher.DispatchNotificationsActivatedAsync(userId, ct)`. Re-subscribing the same browser (refresh of keys) does not notify coaches. The dispatcher never throws (Decision 3), so the endpoint's `200 OK` contract is unchanged.

## Decision 3 — Recipient resolution and message

New method on `IWebPushNotificationDispatcher`:

```csharp
Task DispatchNotificationsActivatedAsync(string userId, CancellationToken ct = default);
```

1. Linked team players of `userId`:
   - as player: `UserTeam` rows with `ApplicationUserId == userId`, `RoleId == Membership.Player.Id`, `LinkedTeamPlayerId != null`;
   - as family: `TeamPlayerFamilyMembers` with `LinkedUserId == userId`.
2. For each linked `TeamPlayer`: its `TeamId` and `Player.Alias`.
3. Coaches per team via the existing `ResolveTeamCoachUserIdsAsync(teamId)`; exclude `userId`.
4. Group by coach: one `Notification` per coach (type `NotificationsActivated`, title `"Notificaciones activadas"`), body:
   - player: `"{alias} ha activado las notificaciones."`
   - family: `"Un familiar de {alias} ha activado las notificaciones."`
   - several players for the same coach: the phrases joined by `" "`.
   Deep link: `/coach/team-users`.
5. Nothing linked (e.g. a pure coach subscribing) → no notification.

Wrapped in try/catch + `LogWarning`, same as the other dispatch methods; delivery reuses `DispatchToUsersAsync` (refactored minimally to accept per-user bodies, or called once per distinct body group).

## Testing

- Backend (`RFFM.Api.Tests/UnitTests/WebPushNotificationDispatcherTests.cs`, existing in-memory `AppDbContext` + mocked `IWebPushSender` pattern): player subscribes → coach notified with alias; family subscribes → body "Un familiar de…"; subscriber is also coach of the team → not self-notified; unlinked user → no rows; sender throws → no exception.
- Backend (`SubscribeWebPushTests.cs`, new): new endpoint → dispatcher called once; existing endpoint → dispatcher not called.
- Frontend (Vitest, `pages/Dashboard/components/__tests__/PushActivationBanner.test.tsx`, mocking `pushSubscriptionService`): shown when unsubscribed; hidden when subscribed; hidden when unsupported; hidden when permission denied; click navigates to settings with `section: "notifications"`.
