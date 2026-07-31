## Why

The Mobile app (Coach/Familia) has no way to reach users outside the app. Families and coaches currently must open the app to discover news or calendar changes. This proposal adds Expo push notifications end-to-end for the two event types that have a clear backend command to hook into: backend registers device tokens and sends notifications via the Expo Push API when news is published or a calendar event is created/updated/deleted; Mobile requests permission, registers the token, and deep-links to the right screen when a notification is tapped.

Convocatorias and resultados de partidos are out of scope: that data is sourced from a periodic federation sync (`SyncCalendarFromFederation`) rather than a direct write command, so detecting "new" callups/results requires diffing sync state — a separate, better-scoped OpenSpec change once that diffing approach is designed. The token registration/unregistration plumbing and `IExpoPushService` built here are reused as-is when that follow-up lands.

## What Changes

- **Backend**: new `PushNotifications` feature under `Features/Mobile/PushNotifications/` with `RegisterPushTokenCommand` (`POST /api/mobile/push-tokens`, upserts by `UserId` + `DeviceId`) and `UnregisterPushTokenCommand` (`DELETE /api/mobile/push-tokens/{deviceId}`), following the existing Mediator vertical-slice pattern used by `Features/Mobile/Auth`.
- New `PushToken` entity (`UserId`, `ExpoPushToken`, `DeviceId`, `Platform`, `CreatedAt`, `UpdatedAt`) in `AppDbContext`, EF configuration + migration, mirroring the `NewsItem` entity pattern.
- New `IExpoPushService` (registered via `IHttpClientFactory`, mirroring `CalendarService`) that POSTs to `https://exp.host/--/api/v2/push/send`, batches receipts, and prunes tokens that come back `DeviceNotRegistered`.
- Notification triggers wired into existing flows: `PublishNews` (news published), `CreateSportEvent`/`UpdateSportEvent`/`DeleteSportEvent` (calendar changes).
- **Mobile**: add `expo-notifications` (SDK 54), a `src/notifications/` module handling permission request (post-login), token registration (hooked into `AuthContext.login`) and unregistration (hooked into `AuthContext.logout`), foreground/background listeners, and badge count management.
- **Mobile**: tap-to-navigate deep-linking into `EventDetail` (calendar/convocatoria/match, param `eventId`) and `NewsDetail` (param `newsId`) via the notification's `data` payload, using the existing `RootNavigator` ref.
- Per-category notification preferences (Noticias / Calendario, toggle each) stored alongside the push token, editable from a new Mobile settings screen.

## Capabilities

### New Capabilities
- `mobile-push-notifications-backend`: token registration/unregistration endpoints, Expo Push API integration, and triggers on news-published and calendar-change events.
- `mobile-push-notifications`: Mobile permission flow, token lifecycle, foreground/background handling, badge count, tap-to-navigate, and per-category preferences.

### Out of Scope
- Convocatoria and match-result notifications (require diffing `SyncCalendarFromFederation` state) — deferred to a follow-up OpenSpec change.

## Impact

- **Backend** (`Back/ExtractionApi/`): new feature files, `PushToken` entity + EF config + migration, `IExpoPushService`, hooks added to `PublishNews.cs`, `CreateSportEvent.cs`, `UpdateSportEvent.cs`, `DeleteSportEvent.cs`.
- **Mobile** (`Mobile/`): new `expo-notifications` dependency, `src/notifications/` module, `AuthContext.tsx` hooks, new settings screen + `api/pushNotifications.ts`, `RootNavigator.tsx` gains a navigation ref for deep-linking from a killed/background state.
- No changes to `Front/` in this change.
