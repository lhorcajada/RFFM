## Why

The Coach SPA has no real-time notification channel: coaches, players and family members only find out about a new call-up, a sanction, an injury update or a published news item by opening the app and checking. Mobile (Expo) already solved this for its own app with `PushToken` + `IPushNotificationDispatcher` (Expo push service), but that system is Expo-specific and does not cover the SPA. This proposal adds a **separate, SPA-only Web Push channel** (Service Worker + VAPID) plus an in-app persisted notification list, so users get notified even when the browser tab is closed, and can always review what they missed from a dedicated page.

## What Changes

- New backend vertical slice `Features/Coaches/Notifications/`: `WebPushSubscription` entity (schema `app`) storing the browser's PushSubscription (endpoint, p256dh, auth keys) per user; `Notification` entity persisting every notification sent (recipient, type, title, body, deep-link target, read/unread, timestamp).
- New `IWebPushNotificationDispatcher` (separate from the existing Mobile `IPushNotificationDispatcher` — no shared code, no shared tables, per explicit decision) hooked into 5 existing handlers: convocation created, convocation accepted/rejected, sanction created/status-changed, news published, injury created/updated.
- New endpoints: subscribe/unsubscribe web push, get VAPID public key, paginated `GET` of the current user's notifications, mark-as-read.
- New NuGet dependency: `WebPush` (VAPID signing + push delivery), justified since no VAPID library exists in the repo yet.
- Frontend: Service Worker (`Front/public/sw.js`, built from scratch — no PWA infra exists today), subscription flow wired to Settings.tsx, new paginated Notifications page (card-based, no tables), foreground notifications shown via the existing `rffm.show_snackbar` bus event.
- Adds `:id`-based deep-link routes to Sanctions and Injured pages (today flat lists) so a notification click can open the exact record, matching the existing `news/:id` pattern.
- **BREAKING**: none — fully additive.

## Capabilities

### New Capabilities
- `coach-web-push-notifications`: VAPID subscription management, persisted notification records, dispatch on 5 business events, paginated notification inbox, deep-linking from notification to source record.

## Impact

- Backend (`Back/ExtractionApi`): new entities/migration in `AppDbContext`, new `Features/Coaches/Notifications/` slice, edits to `AddConvocations.cs`, `UpdateConvocationStatus.cs`, `SetPlayerSanction.cs`, `PublishNews.cs`, `SetPlayerInjury.cs` to call the new dispatcher (side effect only, no contract change), new `WebPush` package reference.
- Frontend (`Front/`, Coach app only): new Service Worker + registration, new `pushSubscriptionService.ts` / `notificationService.ts`, new Notifications page + route, Settings.tsx toggle, `:id` routes added to Sanctions/Injured.
