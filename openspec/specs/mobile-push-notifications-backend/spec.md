# mobile-push-notifications-backend Specification

## Purpose
TBD - created by archiving change mobile-push-notifications. Update Purpose after archive.
## Requirements
### Requirement: A device registers an Expo push token, upserted by user and device
The backend SHALL expose `POST /api/mobile/push-tokens` (authenticated) that creates or updates a `PushToken` keyed by `(UserId, DeviceId)` from `RegisterPushTokenRequest { deviceId, expoPushToken, platform }`.

#### Scenario: First registration for a device
- **WHEN** an authenticated user calls `POST /api/mobile/push-tokens` with a `deviceId` never seen before for that user
- **THEN** a new `PushToken` row is created with `NewsEnabled = true` and `CalendarEnabled = true`, and the response is `204 NoContent`

#### Scenario: Re-registration updates the existing token
- **WHEN** an authenticated user calls `POST /api/mobile/push-tokens` with a `deviceId` already registered for that user, and a different `expoPushToken`
- **THEN** the existing `PushToken` row's `ExpoPushToken` and `UpdatedAt` are updated, no duplicate row is created, and the response is `204 NoContent`

### Requirement: A device unregisters its push token on logout
The backend SHALL expose `DELETE /api/mobile/push-tokens/{deviceId}` (authenticated) that deletes the caller's `PushToken` for that device.

#### Scenario: Unregister an existing token
- **WHEN** an authenticated user calls `DELETE /api/mobile/push-tokens/{deviceId}` for a device they previously registered
- **THEN** the `PushToken` row is deleted and the response is `204 NoContent`

#### Scenario: Unregister a token that was never registered
- **WHEN** an authenticated user calls `DELETE /api/mobile/push-tokens/{deviceId}` for a `deviceId` with no matching `PushToken`
- **THEN** the response is still `204 NoContent` and no error is raised

### Requirement: Per-device notification category preferences can be updated
The backend SHALL expose `PATCH /api/mobile/push-tokens/{deviceId}/preferences` (authenticated) that updates `NewsEnabled`/`CalendarEnabled` on the caller's `PushToken` for that device.

#### Scenario: Update preferences for a registered device
- **WHEN** an authenticated user calls the preferences endpoint with `{ "newsEnabled": false, "calendarEnabled": true }` for a device they registered
- **THEN** the `PushToken` row is updated accordingly and the response is `204 NoContent`

#### Scenario: Update preferences for an unregistered device
- **WHEN** an authenticated user calls the preferences endpoint for a `deviceId` with no matching `PushToken`
- **THEN** the response is `404 NotFound` with a `ProblemDetails` body

### Requirement: Publishing news notifies devices with the Noticias category enabled
When `PublishNewsCommand` successfully transitions a news item to `Published`, the backend SHALL send an Expo push notification to every registered `PushToken` with `NewsEnabled = true`, with `data = { type: "news", id: <newsId> }`.

#### Scenario: News published notifies opted-in devices
- **WHEN** a Coach publishes a news item and two devices have `NewsEnabled = true`, one has `NewsEnabled = false`
- **THEN** the Expo Push API is called with messages targeting only the two opted-in devices' tokens

#### Scenario: Notification failure does not break the publish
- **WHEN** the Expo Push API call fails or times out during a news publish
- **THEN** `PublishNewsCommand` still returns success and the news item remains `Published`

### Requirement: Calendar event changes notify devices linked to the affected team
When a `SportEvent` is created, updated, or deleted, the backend SHALL send an Expo push notification to every `PushToken` belonging to a user linked (directly or via club membership) to the event's `TeamId` with `CalendarEnabled = true`, with `data = { type: "calendar", id: <eventId>, teamId: <teamId> }`.

#### Scenario: Sport event created notifies the team's opted-in devices
- **WHEN** a coach creates a `SportEvent` for `TeamId = "T1"` and a user linked to `T1` has `CalendarEnabled = true`
- **THEN** the Expo Push API is called targeting that user's registered token(s)

#### Scenario: Users of unrelated teams are not notified
- **WHEN** a `SportEvent` is created for `TeamId = "T1"`
- **THEN** users only linked to a different team are not included in the notification audience

#### Scenario: Notification failure does not break the calendar write
- **WHEN** the Expo Push API call fails during a sport-event create/update/delete
- **THEN** the sport-event command still returns success and the change is persisted

### Requirement: Tokens reported as unregistered by Expo are pruned
When the Expo Push API responds to a send with `status: "error"` and `details.error: "DeviceNotRegistered"` for a given token, the backend SHALL delete the corresponding `PushToken` row.

#### Scenario: Stale token is removed after a failed send
- **WHEN** a notification send to a given `ExpoPushToken` returns `DeviceNotRegistered`
- **THEN** the `PushToken` row for that token is deleted and no further sends target it

