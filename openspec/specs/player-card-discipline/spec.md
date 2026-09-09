# player-card-discipline Specification

## Purpose
TBD - created by archiving change player-card-tracking-and-suspensions. Update Purpose after archive.
## Requirements
### Requirement: Match history exposes cards, rival, event type and substitution windows
`GET /api/catalog/team-player/{teamPlayerId}/match-history` SHALL include, per match record,
the count of yellow and red cards attributed to that player in that match, the rival's name,
the event type id and name, and the full list of substitution windows for that match (each
window's minute, half and swaps), in addition to the existing minutes/goals/score fields.

#### Scenario: Match record includes card counts
- **WHEN** a finished match participation has 2 yellow cards and 0 red cards attributed to the
  player in its `CardsJson`
- **THEN** the corresponding match-history record reports `yellowCards: 2` and `redCards: 0`

#### Scenario: Rival cards are not counted for the player
- **WHEN** a finished match participation's `CardsJson` includes a card with
  `isRivalPlayer: true`
- **THEN** that card is not counted in the player's `yellowCards`/`redCards` for that match

#### Scenario: Match record includes rival and event type
- **WHEN** a finished match participation belongs to a `SportEvent` with a `Rival` and an
  `EventTypeId`
- **THEN** the corresponding match-history record includes the rival's name and the event
  type's id and name

#### Scenario: Match record includes full substitution history
- **WHEN** a finished match participation's `SubstitutionWindowsJson` contains multiple windows
  in which the player enters and later leaves the field more than once
- **THEN** the corresponding match-history record's substitution windows list every window,
  preserving minute and swap data, instead of only the first entry and last exit

### Requirement: Cyclic and historical yellow-card counts drive automatic suspension
For each `TeamPlayer`, the system SHALL derive (never persist as an independent counter) a
historical total of yellow cards across all finished match-type (`"Partido"`) participations,
and a cyclic count (0 through 5) of yellow cards in match-type participations dated after the
`StartDate` of that player's most recent automatic 5-yellow-card sanction, if any. Reaching a
cyclic count of 5, or receiving a red card, in a finished `"Partido"`-type match SHALL trigger
automatic suspension (see the automatic sanction requirement below). Yellow/red cards received
in `"Amistoso"` or `"Torneo"` events SHALL NOT count toward these totals or trigger suspension.

#### Scenario: Fifth cyclic yellow card triggers suspension
- **WHEN** a player already has 4 yellow cards counted since their last automatic 5-yellow
  sanction (or ever, if none exists) and receives a yellow card in a newly finished `"Partido"`
- **THEN** the cyclic count reaches 5 and an automatic sanction is created for that player

#### Scenario: Friendly and tournament cards do not count
- **WHEN** a player receives a yellow or red card in a finished `"Amistoso"` or `"Torneo"` event
- **THEN** that card is excluded from both the historical and cyclic yellow-card counts and does
  not trigger a suspension

#### Scenario: Cyclic count resets after an automatic 5-yellow sanction
- **WHEN** a player's cyclic count has reached 5 and an automatic sanction was created with
  `StartDate` equal to that triggering match's date
- **THEN** subsequent cyclic-count calculations only include `"Partido"`-type matches dated
  after that `StartDate`

### Requirement: Automatic sanction on 5th cyclic yellow card or a red card
The system SHALL automatically create a `TeamPlayerSanction` when a `"Partido"`-type
`SportEvent` is saved as `finished` via `POST /api/events/{eventId}/match-participation` and,
as a result of that save, a player reaches a cyclic yellow-card count of 5 or receives a red
card in that match. The created sanction SHALL have category `Competition`, `IsAutomatic: true`,
a null `EndDate`, `SourceEventId` set to that event's id, and a `SanctionType`/`Description`
stating the automatic reason (5 accumulated yellow cards, or a red card). The system SHALL NOT
create a duplicate sanction for the same `SourceEventId` and reason when the same finished match
is saved again without a change in the triggering cards.

#### Scenario: Automatic sanction created for 5 yellow cards
- **WHEN** saving a finished `"Partido"` causes a player's cyclic yellow-card count to reach 5
- **THEN** a `TeamPlayerSanction` is created with `IsAutomatic: true` and a `SanctionType`
  describing the accumulated-yellow-cards reason

#### Scenario: Automatic sanction created for a red card
- **WHEN** saving a finished `"Partido"` includes a red card for a player
- **THEN** a `TeamPlayerSanction` is created with `IsAutomatic: true` and a `SanctionType`
  describing the red-card/expulsion reason

#### Scenario: Re-saving the same match does not duplicate the sanction
- **WHEN** a finished `"Partido"` that already triggered an automatic sanction for a player is
  saved again without changing that player's cards
- **THEN** no additional `TeamPlayerSanction` is created for that event/player/reason

#### Scenario: Friendly matches never trigger an automatic sanction
- **WHEN** a player reaches 5 accumulated yellow cards or receives a red card in a finished
  `"Amistoso"` or `"Torneo"` event
- **THEN** no automatic `TeamPlayerSanction` is created

### Requirement: Active automatic sanction blocks convocation to later matches
`POST /api/events/{eventId}/convocations` SHALL reject (with a `400` `ProblemDetails` and no
`Convocation` created) an attempt to convocate a `TeamPlayer` who has an active automatic
sanction (`IsAutomatic: true`, `EndDate: null`) whose `StartDate` is before the target event's
date. `POST /api/events/{eventId}/convocations/bulk` SHALL silently skip such players instead of
failing the whole bulk operation. Once the coach lifts the sanction (setting `EndDate` via the
existing sanction-update endpoint), convocation SHALL be allowed again.

#### Scenario: Convocation is blocked for an actively sanctioned player
- **WHEN** a Coach POSTs a convocation for a `TeamPlayer` with an active automatic sanction
  whose `StartDate` is before the target event's date
- **THEN** the system returns `400` with a `ProblemDetails` body and does not create the
  convocation

#### Scenario: Convocation is allowed once the sanction is lifted
- **WHEN** a Coach POSTs a convocation for a `TeamPlayer` whose automatic sanction now has a
  non-null `EndDate`
- **THEN** the system creates the convocation as usual

#### Scenario: Bulk convocation skips sanctioned players without failing
- **WHEN** a Coach POSTs a bulk convocation for a team that includes a player with an active
  automatic sanction
- **THEN** every other eligible player is convocated and the sanctioned player is silently
  omitted, with no error response

