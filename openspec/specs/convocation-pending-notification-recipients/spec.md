# convocation-pending-notification-recipients Specification

## Purpose
TBD - created by archiving change convocation-pending-confirmation-whatsapp. Update Purpose after archive.
## Requirements
### Requirement: Resolve WhatsApp-eligible family recipients for selected pending players
The system SHALL provide a read-only endpoint that, given a sport event and a set of
`teamPlayerId`s, returns for each requested player the family members eligible to receive a
WhatsApp notification about that event: family members with an approved (registered) app
account **and** a non-empty phone number. Players with zero eligible family members SHALL be
included in the response with an empty recipients list, not omitted.

#### Scenario: Player has one or more family members with a registered, phone-equipped account
- **WHEN** the coach requests notification recipients for an event and a `teamPlayerId` whose
  player has a family member with `RegistrationStatus == Approved` and a non-empty phone number
- **THEN** the response includes that player with one entry per such family member, containing
  the family member's id, name, last name, phone, and relationship label

#### Scenario: Player has no family member with a registered account
- **WHEN** the coach requests notification recipients for a `teamPlayerId` whose family members
  are all `RegistrationStatus == None` or `Pending`, or the player has no family members at all
- **THEN** the response includes that player with an empty `FamilyMembers` array

#### Scenario: Family member has a registered account but no phone number on file
- **WHEN** a player's family member has `RegistrationStatus == Approved` but an empty or missing
  `Phone`
- **THEN** that family member is excluded from the recipients list for that player (it does not
  count as an eligible recipient)

#### Scenario: Requested player is not actually convoked to the given event
- **WHEN** a `teamPlayerId` in the request has no `Convocation` for the given `eventId` (e.g. it
  was removed after the coach loaded the screen)
- **THEN** the endpoint does not error for the whole request; that player is simply absent from,
  or returned with an empty recipients list in, the response rather than blocking the other
  requested players

#### Scenario: Caller lacks read access to the event's team
- **WHEN** the authenticated coach does not have `Read` permission on `Convocations` for the
  event's team
- **THEN** the request is rejected with a `ProblemDetails` authorization error and no recipient
  data is returned

