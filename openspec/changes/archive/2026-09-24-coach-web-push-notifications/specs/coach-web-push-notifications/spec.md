## ADDED Requirements

### Requirement: A browser can subscribe to Web Push
The system SHALL expose `GET /api/push/vapid-public-key` returning the server's VAPID public key, and `POST /api/push/subscriptions` accepting `{ endpoint, p256dhKey, authKey }` from an authenticated user. A second subscribe call with the same `endpoint` SHALL update, not duplicate, the stored subscription.

#### Scenario: A user subscribes their browser
- **WHEN** an authenticated user calls `POST /api/push/subscriptions` with a valid endpoint and keys
- **THEN** the system persists a `WebPushSubscription` row linked to that user and returns `200 OK`

#### Scenario: Re-subscribing the same browser does not duplicate
- **WHEN** an authenticated user calls `POST /api/push/subscriptions` twice with the same `endpoint`
- **THEN** only one `WebPushSubscription` row exists for that `endpoint` afterwards

### Requirement: A user can unsubscribe
The system SHALL expose `DELETE /api/push/subscriptions` accepting `{ endpoint }`, deleting the subscription only if it belongs to the calling user.

#### Scenario: A user unsubscribes their own browser
- **WHEN** an authenticated user calls `DELETE /api/push/subscriptions` with an endpoint they own
- **THEN** the system deletes that `WebPushSubscription` row and returns `200 OK`

#### Scenario: A user cannot unsubscribe another user's subscription
- **WHEN** an authenticated user calls `DELETE /api/push/subscriptions` with an endpoint owned by a different user
- **THEN** the system returns `404 NotFound` and does not delete the row

### Requirement: A convocation being created notifies the player and their approved family members
The system SHALL, when a `TeamPlayer` is convocated to a `SportEvent` (single or bulk), create a `Notification` (type `ConvocationCreated`) and attempt Web Push delivery for the player (if they have app access) and every family member with `LinkedUserId` set and an `Approved` registration status.

#### Scenario: Convocating a player notifies their approved family member
- **WHEN** a coach convocates a `TeamPlayer` who has one family member with `LinkedUserId` set and `Approved` status
- **THEN** the system creates a `Notification` row for that family member's `UserId` with type `ConvocationCreated`

#### Scenario: A family member without an approved account is not notified
- **WHEN** a coach convocates a `TeamPlayer` whose family member has no `LinkedUserId` or a non-`Approved` status
- **THEN** the system does not create a `Notification` row for that family member

### Requirement: Accepting or rejecting a convocation notifies the coach
The system SHALL, when a convocation's status changes via `PUT /api/events/{eventId}/convocations/{convocationId}/status`, create a `Notification` (type `ConvocationStatusChanged`) for every user with the `Coach` role on that convocation's team.

#### Scenario: A player accepting their call-up notifies the team's coach
- **WHEN** a player accepts their convocation
- **THEN** the system creates a `Notification` row with type `ConvocationStatusChanged` for the `UserId` of the team's coach

### Requirement: A sanction being created or changing status notifies the sanctioned player and family
The system SHALL, on `POST` (create) or `PUT` (update) to `/api/catalog/teamplayer/{id}/sanctions[/{sanctionId}]`, create a `Notification` (type `SanctionChanged`) for the affected player and their approved family members, with `DeepLinkPath` pointing to `/coach/sanctions?highlight={sanctionId}`.

#### Scenario: Creating a sanction notifies the player's family member
- **WHEN** a coach creates a sanction for a `TeamPlayer` with an approved family member
- **THEN** the system creates a `Notification` row for that family member with type `SanctionChanged` and a `DeepLinkPath` containing the new sanction's id

### Requirement: Publishing a news item notifies all players and family members
The system SHALL, when `PublishNews` succeeds, create a `Notification` (type `NewsPublished`) for every user with `Player` or `FamilyMember` role reachable within the news' scope, independently of the existing Mobile push dispatch for the same event.

#### Scenario: Publishing a news item notifies eligible users
- **WHEN** a coach publishes a news item
- **THEN** the system creates a `Notification` row with type `NewsPublished` for every in-scope player and family-member user

### Requirement: An injury being created or updated notifies the player and family
The system SHALL, on `POST` (create) or `PUT` (update) to `/api/catalog/teamplayer/{id}/injuries[/{injuryId}]`, create a `Notification` (type `InjuryChanged`) for the affected player and their approved family members, with `DeepLinkPath` pointing to `/coach/injured?highlight={injuryId}`.

#### Scenario: Updating an injury notifies the player's family member
- **WHEN** a coach updates an existing injury for a `TeamPlayer` with an approved family member
- **THEN** the system creates a `Notification` row for that family member with type `InjuryChanged` and a `DeepLinkPath` containing the injury's id

### Requirement: A push delivery failure never fails the triggering business action
The system SHALL isolate any exception raised while sending a Web Push message (network error, invalid subscription, VAPID error) so that the triggering command (convocation, sanction, news, injury) still completes successfully.

#### Scenario: Push delivery fails but the business action still succeeds
- **WHEN** a triggering action's `Notification`/push dispatch throws an exception during send
- **THEN** the triggering command still returns success and its own persisted state (e.g. the new convocation) is unaffected

### Requirement: A dead subscription is pruned automatically
The system SHALL delete a `WebPushSubscription` when the push service reports it as gone (`404`/`410`) during a send attempt.

#### Scenario: A stale subscription is removed after a 410 response
- **WHEN** a Web Push send to a given subscription's endpoint returns `410 Gone`
- **THEN** the system deletes that `WebPushSubscription` row

### Requirement: A user can list their own notifications, paginated
The system SHALL expose `GET /api/notifications?pageNumber&pageSize`, returning only the calling user's own `Notification` rows, ordered by `CreatedAt` descending, with total count in the `X-Total-Count` response header.

#### Scenario: A user retrieves their notification inbox
- **WHEN** an authenticated user calls `GET /api/notifications?pageNumber=1&pageSize=25`
- **THEN** the system returns only that user's `Notification` rows, newest first, with an `X-Total-Count` header

#### Scenario: A user cannot see another user's notifications
- **WHEN** an authenticated user calls `GET /api/notifications`
- **THEN** the response never includes a `Notification` row belonging to a different `UserId`

### Requirement: A user can mark their own notification as read
The system SHALL expose `POST /api/notifications/{id}/read`, succeeding only when the notification belongs to the calling user.

#### Scenario: Marking own notification as read succeeds
- **WHEN** an authenticated user calls `POST /api/notifications/{id}/read` for a notification they own
- **THEN** the system sets `IsRead: true` on that row and returns `200 OK`

#### Scenario: Marking another user's notification as read fails
- **WHEN** an authenticated user calls `POST /api/notifications/{id}/read` for a notification owned by a different user
- **THEN** the system returns `404 NotFound` and does not modify the row

### Requirement: Convocation notifications are explicit and deep-link to the event
The system SHALL build `ConvocationCreated` and `ConvocationStatusChanged` notification bodies from the player's alias, the event name and the event date, and SHALL set `DeepLinkPath` to `/coach/attendance/{eventId}`. For `ConvocationStatusChanged` the wording SHALL reflect the convocation's new status. Coach recipients SHALL include coaches linked per team (`UserTeam`) and coaches or directors linked at club level (`UserClub`).

#### Scenario: A status change notification names the player, status, event and date
- **WHEN** a player rejects their convocation to "Partido vs Rival CF" on 15/10/2026
- **THEN** the coach's `Notification` body contains the player's alias, "ha rechazado", the event name and "15/10/2026", and its `DeepLinkPath` is `/coach/attendance/{eventId}`

#### Scenario: A club-level coach with no per-team row is notified
- **WHEN** a convocation status changes for a team whose only coach is linked through `UserClub` with role Coach
- **THEN** that coach receives a `ConvocationStatusChanged` notification
