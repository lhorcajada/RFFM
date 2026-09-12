## MODIFIED Requirements

### Requirement: Create a sanction for a team player
The system SHALL expose `POST /api/catalog/teamplayer/{id}/sanctions`, restricted to the `Coach` and `Administrator` roles, to create a new sanction record with a required `category` (`Competition` or `InternalDiscipline`), `startDate`, and `sanctionType`, and optional `description`, `estimatedEnd`, `fine` (a non-negative monetary amount), `amountPaid` (a non-negative monetary amount not exceeding `fine`), `sportivePunishmentType` (`Deconvocation` or `MinutesLimit`), `targetEventId` (required when `sportivePunishmentType` is set), and `minutesLimit` (required and positive when `sportivePunishmentType` is `MinutesLimit`; must be omitted otherwise). A missing/invalid `category`, missing `sanctionType`, non-existent team player, `amountPaid` greater than `fine`, a `sportivePunishmentType` without a `targetEventId`, or a `minutesLimit` supplied without `sportivePunishmentType: "MinutesLimit"` (or missing when it is) SHALL be rejected with `400` `ProblemDetails`/`ValidationProblem`. Manually created sanctions SHALL always have `isAutomatic: false`. The response SHALL include a derived `status` (`"Pending"` when `endDate` is null, `"Fulfilled"` otherwise) and a computed `pendingAmount` (`fine - amountPaid`, or `null` when `fine` is null). When `amountPaid` is a non-null, positive value, this SHALL also credit the team's fund balance (see the `team-fund` capability's "Recording a sanction payment credits the team fund").

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
- **THEN** the system returns `201 Created` with `amountPaid: 40` and `pendingAmount: 60`, and the team's fund balance increases by `40`

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

#### Scenario: Creating a sanction with no payment does not affect the team fund
- **WHEN** an authenticated Coach POSTs a valid sanction with no `amountPaid` (or `amountPaid: 0`)
- **THEN** the system returns `201 Created` and the team's fund balance is unchanged

### Requirement: Update a sanction
The system SHALL expose `PUT /api/catalog/teamplayer/{id}/sanctions/{sanctionId}`, restricted to the `Coach` and `Administrator` roles, allowing all editable fields (including `category`, `endDate`, `fine`, `amountPaid`, `sportivePunishmentType`, `targetEventId`, and `minutesLimit`) to be replaced, subject to the same validation as creation (`amountPaid <= fine`, `sportivePunishmentType`/`targetEventId`/`minutesLimit` consistency). Setting a non-null `endDate` marks the sanction `Fulfilled` (served/lifted); the response's derived `status` reflects this. `isAutomatic` and the originating `sourceEventId` (for automatically created sanctions) are never modified by this endpoint. When `amountPaid` changes, this SHALL also adjust the team's fund balance in place (see the `team-fund` capability's "Editing a sanction's amountPaid adjusts its linked movement in place") — including reducing the balance when `amountPaid` decreases or is cleared.

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
- **THEN** the system returns `200 OK` with the updated `amountPaid` and a recomputed `pendingAmount`, and the team's fund balance increases by the newly recorded amount

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

#### Scenario: Decreasing amountPaid reduces the team fund balance
- **WHEN** an authenticated Coach PUTs an update decreasing an existing sanction's `amountPaid`
- **THEN** the system returns `200 OK` and the team's fund balance decreases by the difference

### Requirement: Delete a sanction
The system SHALL expose `DELETE /api/catalog/teamplayer/{id}/sanctions/{sanctionId}`, restricted to the `Coach` and `Administrator` roles, permanently removing the sanction record — unless the sanction's derived `status` is `"Fulfilled"` (`endDate` is non-null), in which case the system SHALL reject the deletion with `409 Conflict` and a `ProblemDetails` body and the record SHALL remain, **except** when the sanction's `sportivePunishmentType` is `"Deconvocation"` and its `targetEventId`'s event date is still in the future: in that case the system SHALL permit the deletion, remove the sanction record, and revert the forced convocation (see "Deconvocation-type sportive sanction forces the player's convocation") for `targetEventId` back to `Pending` with no excuse type, provided the convocation's current state still matches what the forcing produced (`Deconvoke` status with the "Sanción deportiva" excuse); if the convocation no longer matches that state, the sanction SHALL still be deleted but the response SHALL include a warning `detail` indicating the convocation must be corrected manually. If the deleted sanction has a linked `TeamFundMovement` (a recorded `amountPaid`), the system SHALL zero out that movement's `Amount` as part of the same operation, reducing the team's fund balance accordingly (see the `team-fund` capability's "Deleting a sanction reverses its recorded payment") — the movement row itself is kept, not deleted.

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

#### Scenario: Deleting a pending sanction with a recorded payment reverses the team fund credit
- **WHEN** an authenticated Coach DELETEs a `Pending` sanction that has a recorded `amountPaid` (a linked `TeamFundMovement`)
- **THEN** the system returns `204 No Content`, the linked movement's `Amount` becomes `0`, and the team's fund balance decreases by the amount that had been recorded

## ADDED Requirements

### Requirement: Sanctioned player's photo shown in the sanctions list
The sanctions list (`Sanctions.tsx`) SHALL show each sanctioned player's photo alongside their name, resolved the same way every other roster-like screen resolves a player photo (`PlayerResponse.urlPhoto` → `playerService.fetchPlayerPhoto()` → object-URL `<img>`), falling back to the shared default avatar when no photo is available or resolution fails.

#### Scenario: Player with a photo shows it in their sanction row
- **WHEN** a sanctioned player has a non-null `urlPhoto`
- **THEN** the sanctions list resolves and renders that photo next to the player's name

#### Scenario: Player without a photo shows the default avatar
- **WHEN** a sanctioned player has no `urlPhoto`, or photo resolution fails
- **THEN** the sanctions list renders the shared default avatar in place of the photo
