## 1. Backend — Domain + Persistence (~2h)

- [x] `Domain/Entities/WebPushNotifications/WebPushSubscription.cs` — entity + `Create()` factory (design.md Decision 1).
- [x] `Domain/Entities/WebPushNotifications/Notification.cs` — entity + `Create()`/`MarkAsRead()` (design.md Decision 1).
- [x] EF `IEntityTypeConfiguration<T>` for both (indexes: unique `Endpoint`, `(UserId, CreatedAt)`).
- [x] Add `DbSet<WebPushSubscription> WebPushSubscriptions` and `DbSet<Notification> Notifications` to `AppDbContext.cs`.
- [x] Domain unit tests (`RFFM.Api.Tests`): `WebPushSubscription_Create_Should_Fail_When_*`, `Notification_Create_Should_Be_Successful`, `Notification_MarkAsRead_Should_Set_IsRead` — write first (Red), then implement (Green).
- [x] Migration: `.\manage-migrations.ps1 -Action create -MigrationName AddWebPushNotifications -Context AppDbContext`.
- **Verify**: `dotnet build`, `dotnet test --filter WebPush|Notification`.

## 2. Backend — WebPush sending infra (~2h)

- [x] Add `WebPush` NuGet package to `Directory.Packages.props` + `RFFM.Api.csproj`.
- [x] `Features/Coaches/Notifications/Services/IWebPushSender.cs` + `WebPushSender.cs` (wraps `WebPushClient`, reads `WebPush:PublicKey/PrivateKey/Subject` from config).
- [x] Add `WebPush` config section to `appsettings.Development.json` (placeholder values) and document required prod secrets.
- [x] Unit tests with mocked `WebPushClient`/`IWebPushSender` for the dispatcher (see task 3) — not for `WebPushSender` itself (thin wrapper over a 3rd-party client, per testing.md §12.1 "avoid trivial tests").
- **Verify**: `dotnet build`.

## 3. Backend — Dispatcher + recipient resolution (~2h)

- [x] `Features/Coaches/Notifications/Services/IWebPushNotificationDispatcher.cs` + `WebPushNotificationDispatcher.cs` (design.md Decision 2): 5 methods, try/catch + `ILogger` per method, dead-subscription pruning on 410/404.
- [x] Recipient resolution queries (family/player via `TeamPlayerFamilyMember.LinkedUserId` + `FamilyMemberRegistrationStatus.Resolve`; coach via `UserTeam`).
- [x] Register in `ServiceCollectionExtensions.cs`.
- [x] Unit tests (xUnit + Moq): one test per dispatch method — asserts `Notification` rows created for the right recipients, `IWebPushSender.SendAsync` called with expected payload, and that a thrown exception from `IWebPushSender` does NOT propagate (Red → Green for each).
- **Verify**: `dotnet test --filter WebPushNotificationDispatcher`.

## 4. Backend — Hook into existing handlers (~2h)

- [x] `AddConvocations.cs`: inject dispatcher, call `DispatchConvocationCreatedAsync` at end of `AddConvocationHandler.Handle` and the bulk handler.
- [x] `UpdateConvocationStatus.cs`: call `DispatchConvocationStatusChangedAsync` next to existing `IAuditLogger` call.
- [x] `SetPlayerSanction.cs`: inject dispatcher into `MapPost`/`MapPut` lambdas, call `DispatchSanctionChangedAsync` after `SaveChangesAsync`.
- [x] `PublishNews.cs`: call `DispatchNewsPublishedAsync` (new dispatcher) alongside the existing Mobile dispatcher call.
- [x] `SetPlayerInjury.cs`: inject dispatcher into `MapPost`/`MapPut` lambdas, call `DispatchInjuryChangedAsync` after `SaveChangesAsync`.
- [x] Update/extend existing handler tests (`UpdateConvocationStatusHandlerTests.cs` etc. — already modified per git status, check for conflicts) to assert the new dispatcher is invoked, using a mock — existing business-logic assertions must keep passing unchanged.
- **Verify**: `dotnet test` (full suite — these are shared, sensitive files).

## 5. Backend — Subscription + inbox endpoints (~2h)

- [x] `Features/Coaches/Notifications/GetVapidPublicKey.cs`.
- [x] `Features/Coaches/Notifications/SubscribeWebPush.cs` (+ Validator).
- [x] `Features/Coaches/Notifications/UnsubscribeWebPush.cs`.
- [x] `Features/Coaches/Notifications/SearchNotifications.cs` (paginated, `X-Total-Count`, own-user-only, mirrors `SearchAuditLog.cs`).
- [x] `Features/Coaches/Notifications/MarkNotificationRead.cs` (ownership check → 404 if not the caller's).
- [x] Functional/unit tests for each: happy path, validation failure, ownership/authorization failure.
- **Verify**: `dotnet build && dotnet test`.

## 6. Frontend — Service Worker + subscription flow (~2h)

- [x] `Front/public/sw.js`: `push` + `notificationclick` handlers (design.md Decision 6).
- [x] SW registration at app bootstrap (guarded by feature detection).
- [x] `Front/src/apps/coach/services/pushSubscriptionService.ts`: `getVapidPublicKey()`, `subscribe()`, `unsubscribe()`.
- [x] Foreground bridge: SW `postMessage` → `rffm.show_snackbar` dispatch.
- [x] Vitest: mock `navigator.serviceWorker`/`PushManager`, test subscribe/unsubscribe call the right service functions and handle permission-denied gracefully.
- **Verify**: `npm run build && npm run test`.

## 7. Frontend — Settings toggle (~1-2h)

- [x] Add "Notificaciones" 4th section to `Settings.tsx` (`categoryItem` pattern), toggle button showing current permission/subscription state.
- [x] Vitest: renders toggle, requests permission on click, shows subscribed/unsubscribed state, shows snackbar on failure.
- **Verify**: `npm run test -- Settings`.

## 8. Frontend — Notifications page (~2h)

- [x] `Front/src/apps/coach/services/notificationService.ts` (mirrors `auditLogService.ts`).
- [x] `Front/src/apps/coach/pages/notifications/Notifications.tsx`, reusing `AuditLogView`-style card+pagination.
- [x] Route `notifications` in `routes.tsx` (`RequireFeaturePermission`, lazy).
- [x] Click on a card navigates via `DeepLinkPath` and calls mark-as-read.
- [x] Vitest: loading/empty/error/data states, pagination, click navigation + mark-as-read call.
- **Verify**: `npm run build && npm run test`.

## 9. Frontend — Deep-link support in Sanctions/Injured (~2h)

- [x] `Sanctions.tsx`/`Injured.tsx`: read `?highlight={id}` query param, scroll to + visually highlight the matching card.
- [x] Vitest: given a `highlight` param matching an existing row, asserts the row gets the highlighted state/class.
- **Verify**: `npm run test -- sanctions|injured`.

## 10. End-to-end verification (~1h)

- [x] Full backend suite: `dotnet test`.
- [x] Full frontend suite: `npm run build && npm run test`.
- [x] Manual smoke test in browser (per CLAUDE.md UI-change rule): subscribe, trigger each of the 5 events, confirm native notification + snackbar + inbox row + click navigation for at least 2 of the 5 event types.
