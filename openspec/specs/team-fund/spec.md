# team-fund Specification

## Purpose
Tracks a per-team persisted balance ("bolsa del equipo") fed automatically by recorded sanction
payments (`amountPaid` on `TeamPlayerSanction`), exposed via a read endpoint and surfaced in the
coach app's sanctions summary header and app-wide header icon (visible to every user, unlike the
role-restricted pending-sanctions badge). The ledger design leaves room for future manual
adjustments and non-sanction income/expense sources without a schema change.
## Requirements
### Requirement: Team fund balance is persisted as a ledger of movements
The system SHALL persist a per-`Team` fund balance ("bolsa del equipo") as a `TeamFundMovement` ledger — one row per balance-affecting event (`TeamId`, signed `Amount`, `Source` enum value `SanctionPayment` or `ManualAdjustment`, nullable `SourceSanctionId`, `OccurredAt`, optional `Description`) — rather than a single recomputed counter. The current balance for a team SHALL be `SUM(Amount)` over that team's movement rows (`0` when none exist). Each `TeamPlayerSanction` SHALL have at most one `TeamFundMovement` with `Source: SanctionPayment` (enforced by a unique index on `SourceSanctionId` where not null).

#### Scenario: Balance with no movements is zero
- **WHEN** a team has no `TeamFundMovement` rows
- **THEN** its computed balance is `0`

#### Scenario: Balance sums all movements for the team
- **WHEN** a team has multiple `TeamFundMovement` rows with different `Amount` values
- **THEN** its computed balance equals the sum of all those `Amount` values

### Requirement: Recording a sanction payment credits the team fund
When a sanction is created via `POST /api/catalog/teamplayer/{id}/sanctions` with a non-null, positive `amountPaid`, the system SHALL insert one `TeamFundMovement` row with `Amount: amountPaid`, `Source: SanctionPayment`, and `SourceSanctionId` set to the new sanction's id. A missing or zero `amountPaid` on creation SHALL create no movement row.

#### Scenario: Creating a sanction with an initial payment credits the fund
- **WHEN** a Coach creates a sanction with `fine: 100` and `amountPaid: 40`
- **THEN** a `TeamFundMovement` row is created with `Amount: 40`, `Source: "SanctionPayment"`, and `SourceSanctionId` equal to the new sanction's id, and the team's fund balance increases by `40`

#### Scenario: Creating a sanction without a payment does not affect the fund
- **WHEN** a Coach creates a sanction with no `amountPaid` (or `amountPaid: 0`)
- **THEN** no `TeamFundMovement` row is created and the team's fund balance is unchanged

#### Scenario: Multiple sanctions on the same team sum into one shared balance
- **WHEN** two independent sanctions for the same team each record a payment via `amountPaid`
- **THEN** the team's fund balance equals the sum of both payments

### Requirement: Editing a sanction's amountPaid adjusts its linked movement in place
When a sanction is updated via `PUT /api/catalog/teamplayer/{id}/sanctions/{sanctionId}` and its `amountPaid` changes, the system SHALL update the sanction's existing linked `TeamFundMovement` row's `Amount` to the new `amountPaid` value (never inserting a second row for the same sanction). If no linked movement exists yet and the new `amountPaid` is positive, the system SHALL insert one, same as on creation. Both an increase and a decrease in `amountPaid` SHALL adjust the team's fund balance by exactly the difference. Setting `amountPaid` to `null`/`0` on a sanction that has a linked movement SHALL set that movement's `Amount` to `0` (the row is kept, not deleted).

#### Scenario: Increasing amountPaid updates the same movement row
- **WHEN** a Coach updates a sanction's `amountPaid` from `40` to `70`
- **THEN** the sanction's existing `TeamFundMovement` row's `Amount` becomes `70` (no new row is created) and the team's fund balance increases by `30`

#### Scenario: Decreasing amountPaid reduces the balance by the difference
- **WHEN** a Coach updates a sanction's `amountPaid` from `70` to `30`
- **THEN** the sanction's existing `TeamFundMovement` row's `Amount` becomes `30` and the team's fund balance decreases by `40`

#### Scenario: Clearing amountPaid zeroes the linked movement without deleting it
- **WHEN** a Coach updates a sanction's `amountPaid` from a positive value to `null`
- **THEN** the sanction's existing `TeamFundMovement` row's `Amount` becomes `0` (the row still exists) and the team's fund balance decreases by the amount that was previously recorded

### Requirement: Deleting a sanction reverses its recorded payment
When a sanction is deleted via `DELETE /api/catalog/teamplayer/{id}/sanctions/{sanctionId}` and it has a linked `TeamFundMovement`, the system SHALL set that movement's `Amount` to `0` (the row is kept for audit continuity, not deleted) as part of the same operation, reducing the team's fund balance by whatever amount had been recorded. This applies only to `Pending` sanctions with a recorded `amountPaid`, since `Fulfilled` sanctions cannot be deleted (see the `player-sanctions` capability's delete rules).

#### Scenario: Deleting a pending sanction with a recorded payment reverses the fund credit
- **WHEN** a Coach deletes a `Pending` sanction that has a linked `TeamFundMovement` with `Amount: 40`
- **THEN** the sanction is deleted, the linked movement's `Amount` becomes `0`, and the team's fund balance decreases by `40`

### Requirement: Read the team fund balance and movement history
The system SHALL expose `GET /api/catalog/team/{teamId}/fund`, open to every authenticated role, returning `{ teamId, balance, movements[] }` where `balance` is the sum of the team's `TeamFundMovement` rows and `movements` is the same rows ordered by `occurredAt` descending, each with `{ id, amount, source, sourceSanctionId, occurredAt, description }`.

#### Scenario: Team with no movements returns a zero balance and empty history
- **WHEN** an authenticated user calls `GET /api/catalog/team/{teamId}/fund` for a team with no `TeamFundMovement` rows
- **THEN** the system returns `200 OK` with `balance: 0` and an empty `movements` array

#### Scenario: Team with movements returns the summed balance and ordered history
- **WHEN** an authenticated user calls `GET /api/catalog/team/{teamId}/fund` for a team with several `TeamFundMovement` rows
- **THEN** the system returns `200 OK` with `balance` equal to the sum of those rows' `amount` values and `movements` ordered by `occurredAt` descending

#### Scenario: Read access is open to every authenticated role
- **WHEN** an authenticated user with the `Player` role calls `GET /api/catalog/team/{teamId}/fund`
- **THEN** the system returns `200 OK` (read access is not restricted to Coach/Administrator)

### Requirement: Sanctions summary header shows fund balance alongside fine totals
The system SHALL show, in the sanctions list's header (`Sanctions.tsx`), three summary figures: the total fined amount (sum of `fine` across all sanctions shown), the total pending amount (sum of `pendingAmount` across all sanctions shown), and the team's current fund balance (from `GET /api/catalog/team/{teamId}/fund`), each with its own icon.

#### Scenario: Summary header shows all three totals
- **WHEN** a user opens the sanctions list for a team with recorded sanctions and fund movements
- **THEN** the header shows the total fined amount, the total pending amount, and the team's current fund balance

### Requirement: Team fund balance icon is visible to every user in the app header
The system SHALL show a team-fund-balance icon in the app header showing the resolved team's current balance, for any authenticated user whose account resolves to a team — unlike the pending-sanctions notification icon in the same header, which SHALL remain restricted to the `Player` and `FamilyMember` roles. The team SHALL be resolved via the caller's own profile team association when present, falling back to the coach's configured preferred team. If neither resolves a team, the icon SHALL be hidden rather than shown with no data. Clicking the icon SHALL navigate to the sanctions page for the resolved team.

#### Scenario: Coach sees the fund balance icon even though they never see the sanctions badge
- **WHEN** an authenticated Coach with a resolved team (via their preferred-team configuration) opens any page rendering the app header
- **THEN** the team-fund-balance icon is shown with their team's current balance, even though the pending-sanctions badge (Player/FamilyMember only) is not shown to them

#### Scenario: Player/FamilyMember sees the fund balance icon alongside their sanctions badge
- **WHEN** an authenticated Player or FamilyMember with a resolved team opens any page rendering the app header
- **THEN** both the team-fund-balance icon and the pending-sanctions badge are shown

#### Scenario: No resolvable team hides the fund balance icon
- **WHEN** an authenticated user's profile has no team association and no coach preferred-team configuration resolves one
- **THEN** the team-fund-balance icon is not shown

