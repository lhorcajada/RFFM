## Context

The SPA (Coach app) has no way to reach a user outside the open tab. Mobile already has an Expo push system (`Domain/Entities/PushNotifications/PushToken`, `Features/Mobile/PushNotifications/*`, `IPushNotificationDispatcher`). Per explicit decision, this change does **not** touch or extend that system — it is Expo-token-shaped and mobile-only. We build a parallel, SPA-only Web Push (VAPID) system with its own entities, dispatcher and endpoints, following the same architectural *patterns* (vertical slice, try/catch-isolated dispatch, EF-discovered configs) without sharing code or tables.

## Decision 1 — Two persisted entities, both in `AppDbContext` (schema `app`)

**`WebPushSubscription`** — one row per browser subscription (a user can have several: multiple tabs/browsers).

```csharp
namespace RFFM.Api.Domain.Entities.WebPushNotifications
{
    public class WebPushSubscription : BaseEntity
    {
        public string UserId { get; private set; } = null!;
        public string Endpoint { get; private set; } = null!;
        public string P256dhKey { get; private set; } = null!;
        public string AuthKey { get; private set; } = null!;
        public DateTime CreatedAt { get; private set; }

        private WebPushSubscription() { }

        public static WebPushSubscription Create(string userId, string endpoint, string p256dhKey, string authKey)
        {
            if (string.IsNullOrWhiteSpace(userId)) throw new ArgumentException("El usuario es obligatorio.");
            if (string.IsNullOrWhiteSpace(endpoint)) throw new ArgumentException("El endpoint es obligatorio.");
            if (string.IsNullOrWhiteSpace(p256dhKey) || string.IsNullOrWhiteSpace(authKey))
                throw new ArgumentException("Las claves de suscripción son obligatorias.");

            return new WebPushSubscription
            {
                UserId = userId, Endpoint = endpoint, P256dhKey = p256dhKey, AuthKey = authKey,
                CreatedAt = DateTime.UtcNow
            };
        }
    }
}
```

Unique index on `Endpoint` (re-subscribing the same browser updates, never duplicates). Deleting a subscription = unsubscribe.

**`Notification`** — one row per (event, recipient), independent of whether push delivery succeeded. This is what backs the in-app inbox.

```csharp
namespace RFFM.Api.Domain.Entities.WebPushNotifications
{
    public class Notification : BaseEntity
    {
        public string UserId { get; private set; } = null!;
        public string Type { get; private set; } = null!;       // "ConvocationCreated", "ConvocationStatusChanged", "SanctionChanged", "NewsPublished", "InjuryChanged"
        public string Title { get; private set; } = null!;
        public string Body { get; private set; } = null!;
        public string? DeepLinkPath { get; private set; }        // e.g. "/coach/sanctions?highlight={sanctionId}"
        public bool IsRead { get; private set; }
        public DateTime CreatedAt { get; private set; }

        private Notification() { }

        public static Notification Create(string userId, string type, string title, string body, string? deepLinkPath)
            => new()
            {
                UserId = userId, Type = type, Title = title, Body = body,
                DeepLinkPath = deepLinkPath, IsRead = false, CreatedAt = DateTime.UtcNow
            };

        public void MarkAsRead() => IsRead = true;
    }
}
```

Index on `(UserId, CreatedAt)` for the paginated inbox query.

## Decision 2 — `IWebPushNotificationDispatcher`, one method per event, isolated failures

```csharp
namespace RFFM.Api.Features.Coaches.Notifications.Services
{
    public interface IWebPushNotificationDispatcher
    {
        Task DispatchConvocationCreatedAsync(string teamPlayerId, string eventId, CancellationToken ct = default);
        Task DispatchConvocationStatusChangedAsync(string convocationId, CancellationToken ct = default);
        Task DispatchSanctionChangedAsync(string sanctionId, CancellationToken ct = default);
        Task DispatchNewsPublishedAsync(string newsId, CancellationToken ct = default);
        Task DispatchInjuryChangedAsync(string injuryId, CancellationToken ct = default);
    }
}
```

Each method: (1) resolves recipient `UserId`s for that event, (2) writes one `Notification` row per recipient, (3) sends a Web Push payload to every `WebPushSubscription` of those users via `IWebPushSender` (wraps the `WebPush` NuGet package + VAPID keys from config), (4) on a `410 Gone`/`404` response from a push endpoint, deletes that subscription (dead endpoint), (5) wraps everything in try/catch + `ILogger` warning — a push failure must never fail the business command, matching the existing Mobile dispatcher's Risk #1 guarantee.

Recipient resolution per event (read-only queries against `AppDbContext`, new code — not reusing `GetConvocationNotificationRecipients`, which is WhatsApp/phone-shaped, not `UserId`-shaped):
- **Convocation created**: `TeamPlayer.FamilyMembers` where `LinkedUserId` is set and `FamilyMemberRegistrationStatus.Resolve(...) == Approved`, plus the linked `Player` user if the player itself has app access.
- **Convocation accepted/rejected**: the `Coach`(es) of the `Convocation`'s `Team`, via `UserTeam` (role `Coach`).
- **Sanction / Injury changed**: same family/player resolution as convocation created, scoped to that `TeamPlayer`.
- **News published**: every `UserTeam`/`UserClub` with role `Player` or `FamilyMember` reachable from the news' scope (mirrors the existing `PublishNewsHandler` audience logic already used for Mobile's `DispatchNewsPublishedAsync`).

DI registration in `ServiceCollectionExtensions.cs` (new lines, alongside the existing Mobile ones, not replacing them):
```csharp
services.AddScoped<IWebPushSender, WebPushSender>();
services.AddScoped<IWebPushNotificationDispatcher, WebPushNotificationDispatcher>();
```

## Decision 3 — Hook points (side effect only, no contract change)

| Event | File | Insertion point |
|---|---|---|
| Convocation created | `Features/Coaches/Convocations/AddConvocations.cs` | end of `AddConvocationHandler.Handle` (and the bulk handler) |
| Convocation status changed | `Features/Coaches/Convocations/UpdateConvocationStatus.cs` | end of `Handler.Handle`, same spot as the existing `IAuditLogger` call |
| Sanction created/updated | `Features/Coaches/Players/Commands/SetPlayerSanction.cs` | inline lambda, after `SaveChangesAsync` in both the `MapPost` (create) and `MapPut` (update) endpoints — these are Minimal-API-inline, not Mediator handlers, so the dispatcher is injected directly into the lambda |
| News published | `Features/Coaches/News/PublishNews.cs` | end of `PublishNewsHandler.Handle`, next to the existing `_dispatcher.DispatchNewsPublishedAsync` (Mobile) call — two independent dispatcher calls, one per channel |
| Injury created/updated | `Features/Coaches/Players/Commands/SetPlayerInjury.cs` | inline lambda, after `SaveChangesAsync` in `MapPost`/`MapPut` |

## Decision 4 — New endpoints (`Features/Coaches/Notifications/`)

- `GET /api/push/vapid-public-key` → `{ publicKey: string }` (anonymous-safe, but requires auth like everything else here).
- `POST /api/push/subscriptions` (`SubscribeWebPush`) — body `{ endpoint, p256dhKey, authKey }`, upserts by `Endpoint`.
- `DELETE /api/push/subscriptions` (`UnsubscribeWebPush`) — body `{ endpoint }`, deletes if owned by the caller.
- `GET /api/notifications?pageNumber=1&pageSize=25` (`SearchNotifications`) — current user's own rows only (`UserId` from JWT claims), ordered by `CreatedAt desc`, `X-Total-Count` header, same pattern as `SearchAuditLog.cs`.
- `POST /api/notifications/{id}/read` (`MarkNotificationRead`) — ownership-checked.

## Decision 5 — Migration

```
.\manage-migrations.ps1 -Action create -MigrationName AddWebPushNotifications -Context AppDbContext
```
Adds `WebPushSubscriptions` and `Notifications` tables. No changes to `IdentityDbContext`/`FederationDbContext`.

## Decision 6 — Frontend Service Worker (from scratch)

No PWA infra exists (`Front/public/` doesn't even exist). Plain hand-written SW, no `vite-plugin-pwa` (avoids pulling in a full PWA/offline-caching story we don't need):

- `Front/public/sw.js`: listens to `push` (parses JSON payload `{ title, body, deepLinkPath }`, calls `self.registration.showNotification`) and `notificationclick` (`clients.openWindow(deepLinkPath)`, focuses existing tab if open).
- Registered once at app bootstrap (`navigator.serviceWorker.register('/sw.js')`), guarded by `'serviceWorker' in navigator`.
- Permission + subscribe flow lives in the new Settings.tsx "Notificaciones" section (new 4th `selectedSection`, same `categoryItem`/`categoryItemActive` pattern already used for `"seasons" | "clubs" | "teams"`): button calls `Notification.requestPermission()`, then `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <converted VAPID key> })`, then posts the result to `pushSubscriptionService.subscribe(...)`.
- Foreground delivery: when the tab is open and a push arrives, the SW `postMessage`s the app, which re-dispatches it as `window.dispatchEvent(new CustomEvent('rffm.show_snackbar', { detail: { message: body, severity: 'info' } }))` — same bus contract already used everywhere else, and clicking that snackbar reuses the same deep-link navigation as the native notification.

## Decision 7 — Frontend Notifications page

New page `apps/coach/pages/notifications/Notifications.tsx`, route `notifications` in `routes.tsx` (same lazy + `RequireFeaturePermission` pattern as `AuditLog`), reusing the exact card+pagination structure of `shared/components/ui/AuditLogView/AuditLogView.tsx` (Card/CardContent/Stack/Chip, MUI `Pagination`, `X-Total-Count` header parsing) — no new pagination pattern invented. New `notificationService.ts` mirrors `auditLogService.ts` exactly (typed request/response, `client.get`, header-based total count).

## Decision 8 — Deep-link routes added to Sanctions and Injured

Both pages are flat lists today (`sanctions`, `injured`, no `:id`). Per confirmed decision, add `:id`-aware behavior matching `news/:id`: a `sanctionId`/`injuryId` query param (`?highlight={id}`) read by the existing list page to scroll to and visually highlight that card — no new route needed (avoids splitting into a separate detail page that doesn't exist in the domain model), just an optional query param consumed by the already-rendered list. `DeepLinkPath` stored on `Notification` for these two types uses this shape: `/coach/sanctions?highlight={sanctionId}`, `/coach/injured?highlight={injuryId}`.

## Risks / Trade-offs

- **Two independent push systems** (Mobile Expo + SPA Web Push) means two places to maintain recipient-resolution logic for the same domain events (e.g. "who should hear about this news"). Accepted per explicit user decision to keep them fully separate; a future consolidation is out of scope here.
- **VAPID keys** are new secrets — added to `appsettings.Development.json` / production secrets under a new `WebPush:{PublicKey,PrivateKey,Subject}` section, never committed with real values.
- Non-goals: no notification preferences/muting per type in this change (all 5 events always notify); no Federation-app support; no multi-device dedup beyond one row per endpoint.

## Implementation notes (deviations from the original design, discovered during delivery)

- **Coach resolution** (`ConvocationStatusChanged`): resolved as `UserTeam.RoleId=Coach` for the team **or** `UserClub.RoleId in {Coach, Directive}` for the team's club, mirroring `TeamEditAuthorization.CanEditAsync`. The original `UserTeam`-only rule missed club-level coaches (joined via club invitation code), who have no per-team row.
- **Notifications page** is routed **without** `RequireFeaturePermission` (personal inbox, already scoped server-side by user id); a "Notificaciones" tile is shown in `team-dashboard` for every role, since Player/FamilyMember are auto-redirected there from `/coach/dashboard`.
- **Settings for Player/FamilyMember**: `Settings` `FeaturePermission` (Read) seeded for both roles; `Settings.tsx` shows only the "Notificaciones" section for them. The push toggle (`NotificationSettings`) is also embedded at the top of the Notifications page so it is reachable without Settings.
- **Convocation notification content**: player alias, event name and date (`dd/MM/yyyy`); the verb depends on the convocation status (`ha aceptado` / `ha rechazado` / `ha justificado su ausencia en`). Deep link is `/coach/attendance/{eventId}` (falls back to `/coach/convocations/match` if the event cannot be found).
- **Browser push subscription is per origin, not per app user**: switching user in the same browser requires toggling notifications off/on to re-bind the subscription to the new user.
- **Operational**: `WebPush:PublicKey/PrivateKey/Subject` must be configured per environment (dev keys live in the git-ignored `appsettings.Development.json`); production needs its own key pair.
