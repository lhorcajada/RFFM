# federation-rffm-season Specification

## Purpose
TBD - created by archiving change rffm-season-selector. Update Purpose after archive.
## Requirements
### Requirement: RFFM season has a single configured default
The backend SHALL read the current RFFM "temporada" code from `Rffm:CurrentSeasonId` configuration
(`RffmOptions`) instead of hardcoding it, so every RFFM-scraping endpoint stays correct across
season rollovers by changing one value.

#### Scenario: An endpoint omits the season parameter
- **WHEN** `GET /clubs/search`, `GET /clubs/{clubCode}/teams`, `GET /acta/{codActa}`, or
  `GET /players/{id}` is called without an explicit season/temporada value
- **THEN** the backend uses `RffmOptions.CurrentSeasonId` as the effective season

### Requirement: Club search and club teams accept an explicit season
`GET /clubs/search` and `GET /clubs/{clubCode}/teams` SHALL accept an optional `temporada` query
parameter and forward it to the RFFM scraping calls, including it in their cache keys so results
for different seasons are never mixed.

#### Scenario: Explicit season is provided
- **WHEN** `GET /clubs/search?search=X&temporada=21` is called
- **THEN** the RFFM request includes `temporada=21` and the cached response is keyed by that
  season, independent of any cached response for a different season

### Requirement: Users can select and persist their RFFM season
The backend SHALL expose `GET /rffm/seasons` (current season, the authenticated user's saved
preference if any, and the list of selectable seasons) and `PUT /rffm/season-preference` (upserts
the authenticated user's preferred season), and the frontend SHALL offer a season selector, shared
between the Federation and Coach apps, that seeds itself from this preference and updates it on
change.

#### Scenario: User has no saved preference yet
- **WHEN** `GET /rffm/seasons` is called by an authenticated user with no `RffmSeasonPreference` row
- **THEN** the response's `preferredSeasonId` is `null` and `currentSeasonId` reflects the
  configured default

#### Scenario: User selects a different season
- **WHEN** the user picks a season in the `RffmSeasonSelector` UI
- **THEN** `PUT /rffm/season-preference` is called with the chosen season, and a later
  `GET /rffm/seasons` call returns that season as `preferredSeasonId`

#### Scenario: Federation and Coach apps share one preference
- **WHEN** the user changes the season while using the Federation app
- **THEN** the Coach app's season selector reflects the same choice, since both authenticate as the
  same backend user and read the same `RffmSeasonPreference` row

### Requirement: Coach's own Season entity is untouched
This change SHALL NOT modify or merge with Coach's own `Season` entity (season-access, season-plan,
roster) — the RFFM temporada code and Coach's DB-backed season are separate concepts with
independent lifecycles.

#### Scenario: Coach's ClubPlayerSearch keeps both selectors
- **WHEN** a coach uses `ClubPlayerSearch`
- **THEN** the existing Coach `Season` selector (used to gate categories/teams) and the new
  `RffmSeasonSelector` (used only for the RFFM club/team lookup) are both present and independent

