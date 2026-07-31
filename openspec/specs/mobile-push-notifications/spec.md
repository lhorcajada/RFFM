# mobile-push-notifications Specification

## Purpose
TBD - created by archiving change mobile-push-notifications. Update Purpose after archive.
## Requirements
### Requirement: Notification permission is requested once, after login
The Mobile app SHALL request notification permission and register the resulting Expo push token only after a successful `login()`, never on app boot for an unauthenticated user.

#### Scenario: Permission requested after successful login
- **WHEN** a user logs in successfully
- **THEN** the app requests notification permission and, if granted, obtains and registers an Expo push token via `POST /api/mobile/push-tokens`

#### Scenario: Login succeeds even if permission is denied
- **WHEN** a user logs in successfully and then denies the notification permission prompt
- **THEN** the app still navigates past login (registration is skipped, no error is shown to block navigation)

### Requirement: The push token is unregistered on logout
The Mobile app SHALL call `DELETE /api/mobile/push-tokens/{deviceId}` before clearing local authentication state on logout.

#### Scenario: Logout unregisters the device token
- **WHEN** an authenticated user with a registered push token logs out
- **THEN** the app calls the unregister endpoint for its `deviceId` before clearing the stored auth token

### Requirement: Tapping a notification deep-links to the corresponding screen
The Mobile app SHALL navigate to `NewsDetail` (param `newsId`) for a `data.type = "news"` payload, and to `EventDetail` (params `eventId`, `teamId`) for a `data.type = "calendar"` payload, both from a background/killed-state tap and from a cold start (`getLastNotificationResponseAsync`).

#### Scenario: Tapping a news notification opens the news detail
- **WHEN** the user taps a delivered notification with `data = { type: "news", id: "N1" }`
- **THEN** the app navigates to `NewsDetail` with `newsId = "N1"`

#### Scenario: Tapping a calendar notification opens the event detail
- **WHEN** the user taps a delivered notification with `data = { type: "calendar", id: "E1", teamId: "T1" }`
- **THEN** the app navigates to `EventDetail` with `eventId = "E1"` and `teamId = "T1"`

#### Scenario: Cold start from a notification tap navigates once ready
- **WHEN** the app is launched by tapping a notification (killed-state) and the navigation container was not yet ready when the response arrived
- **THEN** the app still navigates to the correct screen once the navigation container becomes ready, without crashing

### Requirement: The app badge count updates on notification receipt and clears on relevant tab focus
The Mobile app SHALL increment the OS badge count when a notification is received (foreground or background) and reset it to zero when the user focuses `NewsTab` or `CalendarTab`.

#### Scenario: Badge increments on receipt
- **WHEN** a push notification is received while the app is in the foreground or background
- **THEN** the app icon badge count increases

#### Scenario: Badge clears on opening the relevant tab
- **WHEN** the user navigates to `NewsTab` (or `CalendarTab`)
- **THEN** the app icon badge count is reset to zero

### Requirement: Per-category notification preferences are editable from a settings screen
The Mobile app SHALL provide `NotificationSettingsScreen` with two toggles (Noticias, Calendario), defaulting to enabled, that call `PATCH /api/mobile/push-tokens/{deviceId}/preferences` on save.

#### Scenario: Toggling and saving a preference
- **WHEN** an authenticated user opens `NotificationSettingsScreen`, disables "Calendario", and saves
- **THEN** the app calls the preferences endpoint with `{ newsEnabled: true, calendarEnabled: false }` for its `deviceId`

#### Scenario: Save failure shows a Spanish fallback message
- **WHEN** the preferences save request fails
- **THEN** the screen shows a Spanish fallback error message (e.g. `'No se pudieron guardar las preferencias'`) and does not crash

