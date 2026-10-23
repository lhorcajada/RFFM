## MODIFIED Requirements

### Requirement: Accepting or rejecting a convocation notifies the coach
The system SHALL, when a Coach or Administrator changes a convocation's status via `PUT /api/events/{eventId}/convocations/{convocationId}/status`, create a `Notification` (type `ConvocationStatusChanged`) for every user with the `Coach` role on that convocation's team. The notification SHALL NOT be created when the change is made by a Player or FamilyMember, nor when the event is a league match (event type `Partido`), where the coach is the one deciding the convocation.

#### Scenario: A coach changing a training convocation notifies the team's coach
- **WHEN** a coach changes the status of a convocation to a training
- **THEN** the system creates a `Notification` row with type `ConvocationStatusChanged` for the `UserId` of the team's coach

#### Scenario: A player responding does not notify the coach
- **WHEN** a player accepts their convocation
- **THEN** no `ConvocationStatusChanged` notification is created

#### Scenario: A coach changing a league match convocation does not notify
- **WHEN** a coach changes the status of a convocation to a league match
- **THEN** no `ConvocationStatusChanged` notification is created
