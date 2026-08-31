## ADDED Requirements

### Requirement: Sport event responses expose a stable match category
`GET /api/sport-events/{teamId}` SHALL include a `MatchCategory` field on every returned event,
derived from `EventTypeId`, so clients can classify an event as a league, friendly, or tournament
match without matching against the localized `SportEventType.Name`.

#### Scenario: League match event
- **WHEN** a `SportEvent` has `EventTypeId = 1` (Match)
- **THEN** the response's `MatchCategory` is `"League"`

#### Scenario: Friendly match event
- **WHEN** a `SportEvent` has `EventTypeId = 4` (FriendlyMatch)
- **THEN** the response's `MatchCategory` is `"Friendly"`

#### Scenario: Tournament match event
- **WHEN** a `SportEvent` has `EventTypeId = 6` (Tournament)
- **THEN** the response's `MatchCategory` is `"Tournament"`

#### Scenario: Non-match event
- **WHEN** a `SportEvent` has `EventTypeId = 2` (Training), `3` (Meeting), or `5` (AccessTrials)
- **THEN** the response's `MatchCategory` is `null`

### Requirement: Calendar sync idempotently upserts friendlies and tournaments
`POST /api/sport-events/sync-calendar` SHALL accept optional `Friendlies` and `Tournaments` arrays,
using the same item shape as the existing `Matches` array, and SHALL upsert each into `SportEvent`
rows with `EventTypeId` 4 (Friendly) and 6 (Tournament) respectively, applying the same
find-or-create identity rule already used for league matches (match by `CodActa` when present,
otherwise by `TeamId` + `EventTypeId` + same-day `EveDateTime`) so that calling the endpoint again
with the same input updates the existing rows instead of creating duplicates.

#### Scenario: First sync creates a new friendly
- **WHEN** `sync-calendar` is called with a `Friendlies` item for a team that has no matching
  existing `SportEvent`
- **THEN** a new `SportEvent` is created with `EventTypeId = 4` and the response's `Created` count
  increments

#### Scenario: Repeated sync updates the same friendly instead of duplicating it
- **WHEN** `sync-calendar` is called twice in a row with the same `Friendlies` item (same team,
  rival, and date)
- **THEN** the second call updates the existing `SportEvent` row (`Updated` count increments) and
  no second row is created

#### Scenario: First sync creates a new tournament fixture
- **WHEN** `sync-calendar` is called with a `Tournaments` item for a team that has no matching
  existing `SportEvent`
- **THEN** a new `SportEvent` is created with `EventTypeId = 6` and the response's `Created` count
  increments

#### Scenario: Repeated sync updates the same tournament fixture instead of duplicating it
- **WHEN** `sync-calendar` is called twice in a row with the same `Tournaments` item (same team,
  rival, and date)
- **THEN** the second call updates the existing `SportEvent` row (`Updated` count increments) and
  no second row is created

#### Scenario: Friendly and league match on the same day do not collide
- **WHEN** a team already has a league `SportEvent` (`EventTypeId = 1`) on a given date and
  `sync-calendar` is called with a `Friendlies` item for the same team and the same date
- **THEN** a separate new friendly `SportEvent` (`EventTypeId = 4`) is created, and the existing
  league event is left unmodified

#### Scenario: Existing league sync behavior is unchanged
- **WHEN** `sync-calendar` is called with only a `Matches` array (no `Friendlies` or `Tournaments`)
- **THEN** behavior is identical to before this change — league matches are upserted by `CodActa`
  or `TeamId` + same-day date, and the response shape is unchanged
