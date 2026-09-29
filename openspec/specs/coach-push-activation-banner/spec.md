# coach-push-activation-banner Specification

## Purpose
TBD - created by archiving change coach-push-activation-banner. Update Purpose after archive.
## Requirements
### Requirement: The Coach Dashboard prompts users to activate push notifications
The system SHALL show a banner on `/coach/dashboard` and `/coach/team-dashboard` (where players and family members land) with the text "¿Quieres recibir las notificaciones de las convocatorias? Haz clic aquí y actívalas." when the browser supports Web Push, the notification permission is not `denied`, and the current browser has no push subscription. Activating the banner SHALL navigate to `/coach/settings` with the notifications section selected.

#### Scenario: A user without a subscription sees the banner
- **WHEN** a user opens the Coach Dashboard in a browser that supports push, has not denied the permission and has no push subscription
- **THEN** the banner prompting to activate notifications is displayed

#### Scenario: A player landing on the team dashboard sees the banner
- **WHEN** a player without a push subscription opens `/coach/team-dashboard`
- **THEN** the banner prompting to activate notifications is displayed

#### Scenario: A subscribed user does not see the banner
- **WHEN** a user opens the Coach Dashboard in a browser that already has a push subscription
- **THEN** no activation banner is displayed

#### Scenario: A browser without push support does not see the banner
- **WHEN** a user opens the Coach Dashboard in a browser without Service Worker/PushManager/Notification support
- **THEN** no activation banner is displayed

#### Scenario: A user who denied the permission does not see the banner
- **WHEN** a user opens the Coach Dashboard and `Notification.permission` is `denied`
- **THEN** no activation banner is displayed

#### Scenario: Clicking the banner opens notification settings
- **WHEN** the user clicks the banner's activation button
- **THEN** the app navigates to `/coach/settings` with the `notifications` section selected

### Requirement: Coaches are notified when a player or family member activates notifications on a new device
The system SHALL, when `POST /api/push/subscriptions` stores an `endpoint` that did not exist before, create a `Notification` (type `NotificationsActivated`) and attempt Web Push delivery for every coach of the teams of the team players linked to the subscribing user (as player or as family member), excluding the subscribing user. A failure while notifying SHALL NOT fail the subscription request.

#### Scenario: A player activating notifications notifies their team's coach
- **WHEN** a user linked as player to a `TeamPlayer` subscribes a new browser endpoint
- **THEN** the system creates a `NotificationsActivated` notification for the team's coach whose body contains the player's alias

#### Scenario: A family member activating notifications notifies the coach
- **WHEN** a user linked as family member to a `TeamPlayer` subscribes a new browser endpoint
- **THEN** the system creates a `NotificationsActivated` notification for the team's coach with body "Un familiar de {alias} ha activado las notificaciones."

#### Scenario: Re-subscribing an existing endpoint does not notify
- **WHEN** a user subscribes an endpoint that is already stored
- **THEN** no `NotificationsActivated` notification is created

#### Scenario: A user with no linked team player does not notify anyone
- **WHEN** a user with no player or family link subscribes a new endpoint
- **THEN** no `NotificationsActivated` notification is created

#### Scenario: The subscriber is not notified about themself
- **WHEN** a user who is both linked to a `TeamPlayer` and coach of that team subscribes a new endpoint
- **THEN** no `NotificationsActivated` notification is created for that same user

#### Scenario: A delivery failure does not fail the subscription
- **WHEN** sending the Web Push to the coach throws an exception
- **THEN** `POST /api/push/subscriptions` still returns `200 OK` and the subscription is stored

