## Why

Web Push notifications (convocatorias, sanciones, noticias…) only reach users who have explicitly granted the browser permission and subscribed from Ajustes > Notificaciones. Many production users never visit that section, so they miss call-ups. The permission cannot be granted on the user's behalf (it is a browser/OS decision), so the only lever is to prompt them visibly. Coaches also have no way to know which of their players/families can actually be reached by push.

## What Changes

- **Frontend (Coach SPA)**: a prominent banner at the top of the Coach Dashboard (`/coach/dashboard`) — "¿Quieres recibir las notificaciones de las convocatorias? Haz clic aquí y actívalas." — shown only when the browser supports push, the current browser has no push subscription, and the permission is not `denied`. Clicking it navigates to `/coach/settings` with the `notifications` section preselected (existing `location.state.section` mechanism). The banner disappears once the browser is subscribed.
- **Backend**: `SubscribeWebPush` detects when a subscription is a **new device** (its `endpoint` was not stored before) and, in that case only, calls a new `IWebPushNotificationDispatcher.DispatchNotificationsActivatedAsync(userId)`.
- The new dispatch method resolves the subscriber's linked team players (as player or as family member), the coaches of those teams (same `ResolveTeamCoachUserIdsAsync` rule used for convocation status changes), excludes the subscriber themself, and creates a `Notification` (type `NotificationsActivated`) + Web Push for each coach. Failures never fail the subscription (existing try/catch-isolated pattern).
- **BREAKING**: none — fully additive. No migration (reuses `Notifications` and `WebPushSubscriptions` tables).

## Capabilities

### New Capabilities
- `coach-push-activation-banner`: Dashboard banner prompting push activation and coach notification when a player/family member subscribes a new device.

## Impact

- Backend (`Back/ExtractionApi`): `SubscribeWebPush.cs` (inject dispatcher, new-device detection), `IWebPushNotificationDispatcher.cs` + `WebPushNotificationDispatcher.cs` (new method), tests in `RFFM.Api.Tests/UnitTests/`.
- Frontend (`Front/`, Coach app only): new `PushActivationBanner` component under `pages/Dashboard/components/` (+ CSS Module + tests), rendered from `Dashboard.tsx`; a small hook to read the browser push status using the existing `pushSubscriptionService.ts` helpers.
- Out of scope: Mobile (Expo) app, re-prompting users who denied the permission, bulk-enabling preferences in the DB.
