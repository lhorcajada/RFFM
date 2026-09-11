## MODIFIED Requirements

### Requirement: Create a sanction for a team player
The system SHALL expose `POST /api/catalog/teamplayer/{id}/sanctions`, restricted to the `Coach` and `Administrator` roles, to create a new sanction record with a required `category` (`Competition` or `InternalDiscipline`), `startDate`, and `sanctionType`, and optional `description`, `estimatedEnd`, `fine` (a non-negative monetary amount), `amountPaid` (a non-negative monetary amount not exceeding `fine`), `sportivePunishmentType` (`Deconvocation` or `MinutesLimit`), `targetEventId` (required when `sportivePunishmentType` is set), and `minutesLimit` (required and positive when `sportivePunishmentType` is `MinutesLimit`; must be omitted otherwise). A missing/invalid `category`, missing `sanctionType`, non-existent team player, `amountPaid` greater than `fine`, a `sportivePunishmentType` without a `targetEventId`, or a `minutesLimit` supplied without `sportivePunishmentType: "MinutesLimit"` (or missing when it is) SHALL be rejected with `400` `ProblemDetails`/`ValidationProblem`. Manually created sanctions SHALL always have `isAutomatic: false`. The response SHALL include a derived `status` (`"Pending"` when `endDate` is null, `"Fulfilled"` otherwise) and a computed `pendingAmount` (`fine - amountPaid`, or `null` when `fine` is null).

#### Scenario: Coach creates a competition sanction
- **WHEN** an authenticated Coach POSTs a valid sanction with `category: "Competition"` for an existing team player
- **THEN** the system returns `201 Created` with the created sanction record, including `category: "Competition"`, `isAutomatic: false`, `status: "Pending"`, and a null `endDate`

#### Scenario: Coach creates an internal discipline sanction
- **WHEN** an authenticated Coach POSTs a valid sanction with `category: "InternalDiscipline"` for an existing team player
- **THEN** the system returns `201 Created` with the created sanction record, including `category: "InternalDiscipline"`

#### Scenario: Coach creates a sanction with a fine
- **WHEN** an authenticated Coach POSTs a valid sanction including a `fine` amount
- **THEN** the system returns `201 Created` with the created sanction record's `fine` set to that amount and `pendingAmount` equal to `fine`

#### Scenario: Coach creates a sanction with a fine and a partial payment
- **WHEN** an authenticated Coach POSTs a valid sanction with `fine: 100` and `amountPaid: 40`
- **THEN** the system returns `201 Created` with `amountPaid: 40` and `pendingAmount: 60`

#### Scenario: amountPaid greater than fine is rejected
- **WHEN** an authenticated Coach POSTs a sanction with `fine: 50` and `amountPaid: 60`
- **THEN** the system returns `400` with a `ProblemDetails`/validation body and does not create a record

#### Scenario: Coach creates a deconvocation-type sportive sanction
- **WHEN** an authenticated Coach POSTs a valid sanction with `sportivePunishmentType: "Deconvocation"` and a `targetEventId` referencing an existing event
- **THEN** the system returns `201 Created` with `sportivePunishmentType: "Deconvocation"`, `targetEventId` set, `minutesLimit: null`, and `status: "Fulfilled"` (the system forces the player's convocation for `targetEventId` to `Deconvoke` as part of creating the sanction — see "Deconvocation-type sportive sanction forces the player's convocation")

#### Scenario: Coach creates a minutes-limit sportive sanction
- **WHEN** an authenticated Coach POSTs a valid sanction with `sportivePunishmentType: "MinutesLimit"`, a `targetEventId`, and `minutesLimit: 10`
- **THEN** the system returns `201 Created` with `sportivePunishmentType: "MinutesLimit"`, `targetEventId` set, and `minutesLimit: 10`

#### Scenario: sportivePunishmentType without targetEventId is rejected
- **WHEN** an authenticated Coach POSTs a sanction with `sportivePunishmentType: "MinutesLimit"` and no `targetEventId`
- **THEN** the system returns `400` with a `ProblemDetails`/validation body and does not create a record

#### Scenario: minutesLimit without MinutesLimit type is rejected
- **WHEN** an authenticated Coach POSTs a sanction with `minutesLimit: 10` and `sportivePunishmentType: "Deconvocation"` (or omitted)
- **THEN** the system returns `400` with a `ProblemDetails`/validation body and does not create a record

#### Scenario: targetEventId does not reference an existing event
- **WHEN** an authenticated Coach POSTs a sanction with `sportivePunishmentType` set and a `targetEventId` that does not match any existing event
- **THEN** the system returns `404` and does not create a record

#### Scenario: Disallowed role cannot create a sanction
- **WHEN** an authenticated user with the `Player` or `FamilyMember` role POSTs a sanction
- **THEN** the system returns `403 Forbidden`

#### Scenario: Missing or unknown category is rejected
- **WHEN** an authenticated Coach POSTs a sanction with an empty or unrecognized `category` value
- **THEN** the system returns `400` with a `ProblemDetails` body and does not create a record

#### Scenario: Team player does not exist
- **WHEN** an authenticated Coach POSTs a sanction for a non-existent team player `id`
- **THEN** the system returns `404`

### Requirement: Update a sanction
The system SHALL expose `PUT /api/catalog/teamplayer/{id}/sanctions/{sanctionId}`, restricted to the `Coach` and `Administrator` roles, allowing all editable fields (including `category`, `endDate`, `fine`, `amountPaid`, `sportivePunishmentType`, `targetEventId`, and `minutesLimit`) to be replaced, subject to the same validation as creation (`amountPaid <= fine`, `sportivePunishmentType`/`targetEventId`/`minutesLimit` consistency). Setting a non-null `endDate` marks the sanction `Fulfilled` (served/lifted); the response's derived `status` reflects this. `isAutomatic` and the originating `sourceEventId` (for automatically created sanctions) are never modified by this endpoint.

When the edit changes a `"Deconvocation"`-type sanction's `targetEventId`: if the sanction's current `targetEventId` refers to an event that has not yet happened, the system SHALL revert that event's forced convocation back to `Pending` with no excuse type (provided it still matches the state the forcing produced) and force the new `targetEventId`'s convocation to `Deconvoke` with the "Sanción deportiva" excuse, same as creation. If the sanction's current `targetEventId` refers to an event that has already happened, the system SHALL reject the change to `targetEventId` with `409 Conflict`, leaving the sanction and both convocations unmodified. Removing the `"Deconvocation"` punishment from a sanction whose target event has not yet happened SHALL likewise revert the forced convocation. Edits that leave `sportivePunishmentType`, `targetEventId`, and `minutesLimit` unchanged (e.g. only `fine`, `description`, `category`) SHALL always be permitted regardless of the sanction's `status`.

#### Scenario: Coach updates a sanction's fields
- **WHEN** an authenticated Coach PUTs valid updated values for an existing sanction of an existing team player
- **THEN** the system returns `200 OK` with the updated sanction record reflecting the new values

#### Scenario: Coach lifts a sanction by setting endDate
- **WHEN** an authenticated Coach PUTs an update including a non-null `endDate` for an active sanction
- **THEN** the system returns `200 OK` and the returned record's `endDate` is set and `status` is `"Fulfilled"`

#### Scenario: Coach adds a fine and description to an automatic sanction
- **WHEN** an authenticated Coach PUTs an update setting `fine` and `description` for a sanction with `isAutomatic: true`
- **THEN** the system returns `200 OK` with the updated `fine`/`description`, and `isAutomatic` remains `true`

#### Scenario: Coach records a payment against an existing fine
- **WHEN** an authenticated Coach PUTs an update setting `amountPaid` on a sanction whose `fine` is already set
- **THEN** the system returns `200 OK` with the updated `amountPaid` and a recomputed `pendingAmount`

#### Scenario: Coach moves a deconvocation sanction to a different future event
- **WHEN** an authenticated Coach PUTs an update changing an existing `"Deconvocation"`-type sanction's `targetEventId` from event A (not yet happened) to event B (an existing, different event)
- **THEN** the system returns `200 OK`, event A's convocation is reverted to `Pending` with no excuse type, and event B's convocation is forced to `Deconvoke` with the "Sanción deportiva" excuse

#### Scenario: Coach cannot move a deconvocation sanction away from an already-passed event
- **WHEN** an authenticated Coach PUTs an update changing an existing `"Deconvocation"`-type sanction's `targetEventId`, and the sanction's current `targetEventId` refers to an event that has already happened
- **THEN** the system returns `409 Conflict` with a `ProblemDetails` body and neither the sanction nor either convocation is modified

#### Scenario: Coach removes the deconvocation punishment from a sanction targeting a future event
- **WHEN** an authenticated Coach PUTs an update clearing `sportivePunishmentType`/`targetEventId` on an existing `"Deconvocation"`-type sanction whose target event has not yet happened
- **THEN** the system returns `200 OK` and the player's convocation for the former `targetEventId` is reverted to `Pending` with no excuse type

#### Scenario: Coach edits unrelated fields on a fulfilled past-event deconvocation sanction
- **WHEN** an authenticated Coach PUTs an update changing only `fine`/`description` (not `sportivePunishmentType`, `targetEventId`, or `minutesLimit`) on a `"Deconvocation"`-type sanction whose target event has already happened
- **THEN** the system returns `200 OK` with the updated fields, and the sanction's punishment/target/status are unchanged

#### Scenario: Disallowed role cannot update a sanction
- **WHEN** an authenticated user with the `Player` or `FamilyMember` role PUTs an update to a sanction
- **THEN** the system returns `403 Forbidden`

#### Scenario: Sanction or team player does not exist
- **WHEN** an authenticated Coach PUTs an update referencing a non-existent `sanctionId` or `id`
- **THEN** the system returns `404`

### Requirement: Delete a sanction
The system SHALL expose `DELETE /api/catalog/teamplayer/{id}/sanctions/{sanctionId}`, restricted to the `Coach` and `Administrator` roles, permanently removing the sanction record — unless the sanction's derived `status` is `"Fulfilled"` (`endDate` is non-null), in which case the system SHALL reject the deletion with `409 Conflict` and a `ProblemDetails` body and the record SHALL remain, **except** when the sanction's `sportivePunishmentType` is `"Deconvocation"` and its `targetEventId`'s event date is still in the future: in that case the system SHALL permit the deletion, remove the sanction record, and revert the forced convocation (see "Deconvocation-type sportive sanction forces the player's convocation") for `targetEventId` back to `Pending` with no excuse type, provided the convocation's current state still matches what the forcing produced (`Deconvoke` status with the "Sanción deportiva" excuse); if the convocation no longer matches that state, the sanction SHALL still be deleted but the response SHALL include a warning `detail` indicating the convocation must be corrected manually.

#### Scenario: Coach deletes a pending sanction
- **WHEN** an authenticated Coach DELETEs an existing sanction whose `endDate` is null
- **THEN** the system returns `204 No Content` and the record no longer appears in subsequent GET calls

#### Scenario: Coach cannot delete a fulfilled economic or minutes-limit sanction
- **WHEN** an authenticated Coach DELETEs an existing sanction whose `endDate` is non-null (`status: "Fulfilled"`) and whose `sportivePunishmentType` is not `"Deconvocation"`, or is `"Deconvocation"` targeting an event whose date has already passed
- **THEN** the system returns `409 Conflict` with a `ProblemDetails` body and the record still appears in subsequent GET calls

#### Scenario: Coach deletes a fulfilled deconvocation sanction targeting a future event
- **WHEN** an authenticated Coach DELETEs an existing `"Deconvocation"`-type sanction (`status: "Fulfilled"`) whose `targetEventId` refers to an event that has not yet happened
- **THEN** the system returns `204 No Content`, the record no longer appears in subsequent GET calls, and the player's convocation for `targetEventId` is reverted from `Deconvoke` back to `Pending` with no excuse type

#### Scenario: Disallowed role cannot delete a sanction
- **WHEN** an authenticated user with the `Player` or `FamilyMember` role DELETEs a sanction
- **THEN** the system returns `403 Forbidden`

#### Scenario: Sanction or team player does not exist
- **WHEN** an authenticated Coach DELETEs a non-existent `sanctionId` or `id`
- **THEN** the system returns `404`

## ADDED Requirements

### Requirement: Deconvocation-type sportive sanction forces the player's convocation
When a sanction is created (or updated to newly target an event, per "Update a sanction") with `sportivePunishmentType: "Deconvocation"` and a `targetEventId` referencing an existing event, the system SHALL, in the same operation: (a) transition the `TeamPlayer`'s existing `Convocation` for `targetEventId` to `Deconvoke` with the "Sanción deportiva" excuse, overriding any current status/excuse, or, if no `Convocation` exists yet for that `TeamPlayer`/`targetEventId` pair, create one directly in `Deconvoke` status with the "Sanción deportiva" excuse; and (b) set the sanction's `endDate` to the current time, marking it `Fulfilled`. This forcing does not go through, and is not blocked by, the active-automatic-sanction check used when convocating a player through `POST /api/events/{eventId}/convocations` or its bulk variant.

#### Scenario: Creating a deconvocation sanction forces an existing convocation to Deconvoke
- **WHEN** a Coach creates a `"Deconvocation"`-type sanction with a `targetEventId` for a `TeamPlayer` who already has a `Convocation` (in any status) for that event
- **THEN** the system returns `201 Created` with the sanction's `status: "Fulfilled"`, and the player's convocation for `targetEventId` is now `Deconvoke` with excuse type "Sanción deportiva"

#### Scenario: Creating a deconvocation sanction creates a convocation when none exists yet
- **WHEN** a Coach creates a `"Deconvocation"`-type sanction with a `targetEventId` for a `TeamPlayer` who has no `Convocation` record yet for that event
- **THEN** the system returns `201 Created` with the sanction's `status: "Fulfilled"`, and a new convocation is created for that player/event already in `Deconvoke` status with excuse type "Sanción deportiva"

#### Scenario: A later bulk convocation call skips the forced-deconvoked player
- **WHEN** a Coach triggers `POST /api/events/{eventId}/convocations/bulk` for an event where a player already has a convocation forced to `Deconvoke` by a sanction
- **THEN** that player's convocation is left unchanged (already-convocated players are skipped, same as any other pre-existing convocation)

### Requirement: Manual Deconvoke transition still auto-fulfills a matching pending sanction (defensive path)
When a `Convocation`'s status is updated to `Deconvoke` via `PUT /api/events/{eventId}/convocations/{convocationId}/status`, the system SHALL check for a `Pending` sanction (`endDate` null) belonging to the same `TeamPlayer` with `sportivePunishmentType: "Deconvocation"` and `targetEventId` equal to the convocation's event. If found, the system SHALL set that sanction's `endDate` to the current time (marking it `Fulfilled`) and SHALL set the convocation's excuse type to the "Sanción deportiva" excuse, overriding any `excuseTypeId` supplied in the request. In normal operation this sanction would already have forced the transition at creation time (see "Deconvocation-type sportive sanction forces the player's convocation"); this check remains as a defensive/legacy-data path — e.g. for sanctions created before this capability existed, or where the forced convocation was later reverted by hand outside the delete/edit flow.

#### Scenario: Deconvoking the player for the sanctioned event fulfills the sanction
- **WHEN** a Coach sets a convocation's status to `Deconvoke` for a `TeamPlayer` who has a `Pending` `Deconvocation`-type sanction targeting that same event
- **THEN** the system returns `200 OK`, the sanction's `endDate` becomes non-null (`status: "Fulfilled"`), and the convocation's excuse type is "Sanción deportiva"

#### Scenario: Deconvoking for an unrelated event does not fulfill the sanction
- **WHEN** a Coach sets a convocation's status to `Deconvoke` for a `TeamPlayer` who has a `Pending` `Deconvocation`-type sanction targeting a different event
- **THEN** the sanction's `endDate` remains null (`status: "Pending"`)

### Requirement: Manually reverting a forced convocation reopens the fulfilled sanction

When a `Convocation`'s status is updated away from `Deconvoke` to any other status via `PUT /api/events/{eventId}/convocations/{convocationId}/status`, and the convocation's status was `Deconvoke` immediately before this update, the system SHALL check for a `Fulfilled` sanction (`endDate` non-null) belonging to the same `TeamPlayer` with `sportivePunishmentType: "Deconvocation"` and `targetEventId` equal to the convocation's event. If found, the system SHALL set that sanction's `endDate` back to `null`, reopening it to `status: "Pending"`. This applies regardless of whether the convocation's event date has already passed.

#### Scenario: Reverting a sanction-forced deconvocation reopens the sanction

- **WHEN** a Coach updates a convocation's status from `Deconvoke` to `Pending` (or `Accepted`, or `Justified`) for a `TeamPlayer` who has a `Fulfilled` `Deconvocation`-type sanction targeting that same event
- **THEN** the system returns `200 OK` and the sanction's `endDate` becomes `null` (`status: "Pending"`)

#### Scenario: Reverting an unrelated Deconvoke convocation does not reopen an unrelated sanction

- **WHEN** a Coach updates a convocation's status from `Deconvoke` to `Pending` for a `TeamPlayer` who has no `Deconvocation`-type sanction targeting that event
- **THEN** the update succeeds and no sanction is modified

#### Scenario: Reopening a sanction is allowed even for a past event

- **WHEN** a Coach updates a convocation's status away from `Deconvoke` for an event whose date has already passed, and a `Fulfilled` `Deconvocation`-type sanction targets that event for the same player
- **THEN** the sanction is reopened to `status: "Pending"` the same as for a future event; the system does not reject the reopening on account of the event being in the past

#### Scenario: Updating a convocation that is already not Deconvoke does not affect any sanction

- **WHEN** a Coach updates a convocation's status from `Pending` to `Accepted` (i.e. the previous status was not `Deconvoke`)
- **THEN** no `Deconvocation`-type sanction is checked or modified, regardless of whether one exists for that player/event

### Requirement: Minutes-limit sportive sanction auto-fulfills when respected
When `POST /api/events/{eventId}/match-participation` is saved with `matchPhase: "finished"`, the system SHALL check, for every player in the request, for a `Pending` sanction (`endDate` null) belonging to that `TeamPlayer` with `sportivePunishmentType: "MinutesLimit"` and `targetEventId` equal to the event. If found and the player's saved `minutesPlayed` for that event is less than or equal to the sanction's `minutesLimit`, the system SHALL set that sanction's `endDate` to the current time (marking it `Fulfilled`).

#### Scenario: Playing within the minute cap fulfills the sanction
- **WHEN** a finished match's participation is saved with a player's `minutesPlayed` less than or equal to their `Pending` `MinutesLimit` sanction's `minutesLimit` for that same event
- **THEN** the sanction's `endDate` becomes non-null (`status: "Fulfilled"`)

#### Scenario: Exceeding the minute cap does not fulfill the sanction
- **WHEN** a finished match's participation is saved with a player's `minutesPlayed` greater than their `Pending` `MinutesLimit` sanction's `minutesLimit` for that same event
- **THEN** the sanction's `endDate` remains null (`status: "Pending"`)

#### Scenario: Minutes-limit fulfillment is scoped to the target event only
- **WHEN** a finished match's participation is saved for an event that is not the sanction's `targetEventId`
- **THEN** the sanction is unaffected regardless of `minutesPlayed`

### Requirement: List active minute-limit sanctions for an event
The system SHALL expose `GET /api/events/{eventId}/sanctions/minute-limits`, accessible to any authenticated role, returning every `Pending` `MinutesLimit`-type sanction whose `targetEventId` equals `eventId`, as a JSON array of `{ teamPlayerId, sanctionId, minutesLimit }`.

#### Scenario: Coach fetches minute-limit sanctions before a live match
- **WHEN** an authenticated Coach calls `GET /api/events/{eventId}/sanctions/minute-limits` for an event with two `Pending` `MinutesLimit` sanctions targeting it
- **THEN** the system returns `200 OK` with both entries, each including `teamPlayerId` and `minutesLimit`

#### Scenario: Fulfilled minute-limit sanctions are excluded
- **WHEN** a `MinutesLimit` sanction targeting the event already has a non-null `endDate`
- **THEN** it is not included in the response

#### Scenario: Event with no minute-limit sanctions returns an empty array
- **WHEN** an authenticated user calls `GET /api/events/{eventId}/sanctions/minute-limits` for an event with no such sanctions
- **THEN** the system returns `200 OK` with an empty array
