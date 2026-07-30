# coach-team-update-league-persistence Specification

## Purpose
TBD - created by archiving change fix-update-team-league-not-persisted. Update Purpose after archive.
## Requirements
### Requirement: Updating a team persists LeagueId and LeagueGroup
The system SHALL persist `LeagueId` and `LeagueGroup` when handling `PUT /api/catalog/team/{id}`, in addition to the `Name`, `CategoryId`, `ClubId`, and `UrlPhoto` fields already persisted by `UpdateTeamHandler`. The request body's `TeamModel.LeagueId`/`TeamModel.LeagueGroup` values SHALL be applied to the `Team` entity via its existing `UpdateLeagueId`/`UpdateLeagueGroup` domain methods and saved in the same transaction as the other updated fields.

#### Scenario: Assigning a Liga to a team that had none
- **WHEN** a Coach calls `PUT /api/catalog/team/{id}` for a team whose current `LeagueId`/`LeagueGroup` are `null`, with a request body setting `LeagueId` to an existing `League.Id` and `LeagueGroup` to a numeric value
- **THEN** the system returns `200 OK` and the team's persisted `LeagueId`/`LeagueGroup` reflect the requested values

#### Scenario: Changing an existing Liga/Grupo association
- **WHEN** a Coach calls `PUT /api/catalog/team/{id}` for a team that already has `LeagueId`/`LeagueGroup` set, with a request body setting them to different values
- **THEN** the system returns `200 OK` and the team's persisted `LeagueId`/`LeagueGroup` reflect the new requested values, not the previous ones

#### Scenario: Clearing an existing Liga/Grupo association
- **WHEN** a Coach calls `PUT /api/catalog/team/{id}` for a team that already has `LeagueId`/`LeagueGroup` set, with a request body setting both to `null`
- **THEN** the system returns `200 OK` and the team's persisted `LeagueId`/`LeagueGroup` become `null`

#### Scenario: Regression — the bug being fixed
- **WHEN** `UpdateTeamHandler.Handle` is invoked with a `TeamModel.LeagueId`/`LeagueGroup` different from the team's currently persisted values
- **THEN** the persisted `Team` entity's `LeagueId`/`LeagueGroup` SHALL equal the request's values after `SaveChangesAsync` completes — this scenario reproduces the pre-fix bug (where the persisted values remained unchanged despite `200 OK`) and MUST be covered by a test that fails against the pre-fix handler and passes after the fix

