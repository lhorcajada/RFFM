## MODIFIED Requirements

### Requirement: The Coach Dashboard prompts users to activate push notifications
The system SHALL show a prompt to activate push notifications on `/coach/dashboard` and `/coach/team-dashboard` (where players and family members land) when the browser supports Web Push, the notification permission is not `denied`, and the current browser has no push subscription. On `/coach/team-dashboard` the prompt SHALL be the banner with the text "¿Quieres recibir las notificaciones de las convocatorias? Haz clic aquí y actívalas.". On `/coach/dashboard` the prompt SHALL adapt to the screen size: a side card next to the preferred-team block from 1200 px ("NO TE PIERDAS NADA" + "¿Quieres recibir las notificaciones de las convocatorias? Actívalas aquí." + button "Activar notificaciones"), a full-width strip between 600 and 1199 px (same text + button "Activar") and, below 600 px, a compact row that is a single button labelled "Activar notificaciones de convocatorias". Activating any of them SHALL navigate to `/coach/settings` with the notifications section selected.

#### Scenario: A user without a subscription sees the banner
- **WHEN** a user opens the Coach Dashboard in a browser that supports push, has not denied the permission and has no push subscription
- **THEN** the prompt to activate notifications is displayed

#### Scenario: A player landing on the team dashboard sees the banner
- **WHEN** a player without a push subscription opens `/coach/team-dashboard`
- **THEN** the banner prompting to activate notifications is displayed

#### Scenario: A subscribed user does not see the banner
- **WHEN** a user opens the Coach Dashboard in a browser that already has a push subscription
- **THEN** no activation prompt is displayed

#### Scenario: A browser without push support does not see the banner
- **WHEN** a user opens the Coach Dashboard in a browser without Service Worker/PushManager/Notification support
- **THEN** no activation prompt is displayed

#### Scenario: A user who denied the permission does not see the banner
- **WHEN** a user opens the Coach Dashboard and `Notification.permission` is `denied`
- **THEN** no activation prompt is displayed

#### Scenario: Clicking the banner opens notification settings
- **WHEN** the user clicks the prompt's activation button
- **THEN** the app navigates to `/coach/settings` with the `notifications` section selected

#### Scenario: The compact mobile row opens notification settings
- **WHEN** the user taps the compact row on `/coach/dashboard` below 600 px
- **THEN** the app navigates to `/coach/settings` with the `notifications` section selected
