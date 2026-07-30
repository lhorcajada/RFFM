# coach-team-competition-association Specification

## Purpose
TBD - created by archiving change mobile-league-standings-calendar. Update Purpose after archive.
## Requirements
### Requirement: Associate a team with its RFFM competition/group after creation
The system SHALL expose `PUT /api/catalog/team/{id}/competition`, allowing a Coach (or Administrator) to set or update an existing team's `RffmCompetitionId` (RFFM's own competition id, same id space as `GET /competitions`) and `RffmGroupId` (RFFM's own group id, same id space as `GET /groups?competitionId=`) after the team has already been created. The endpoint SHALL require `IRequireFeaturePermission` with `RequiredPermission = "ReadWrite"` on the `CoachFeatureRoutes.ClubTeams` feature route, matching `UpdateTeam`/`DeleteTeam`. Both `RffmCompetitionId` and `RffmGroupId` MAY independently be `null` in the request to clear an existing association. This requirement is distinct from, and does not modify, the pre-existing local Liga/Grupo catalog association (`Team.LeagueId`/`LeagueGroup`, `GET /api/catalog/leagues/{categoryId}`), which remains available unchanged.

#### Scenario: Associating a team with a competition and group
- **WHEN** a Coach with `ReadWrite` permission on `ClubTeams` calls `PUT /api/catalog/team/{id}/competition` for an existing team, with `RffmCompetitionId` and `RffmGroupId` set to a competition/group pair obtained from `GET /competitions` and `GET /groups?competitionId=`
- **THEN** the system returns `200 OK`, persists `Team.RffmCompetitionId` and `Team.RffmGroupId` with the requested values, and invalidates the `TeamConstants.CachePrefix` cache

#### Scenario: Clearing an existing association
- **WHEN** a Coach calls the endpoint for a team that already has `RffmCompetitionId`/`RffmGroupId` set, with both fields explicitly `null` in the request
- **THEN** the system returns `200 OK` and persists `Team.RffmCompetitionId` and `Team.RffmGroupId` as `null`, reverting the team to the "not associated" state

#### Scenario: Team does not exist
- **WHEN** a Coach calls the endpoint with a `{id}` that does not resolve to any existing `Team`
- **THEN** the system returns a `404`-mapped `ProblemDetails` response

#### Scenario: Caller lacks ReadWrite permission on ClubTeams
- **WHEN** a user without `ReadWrite` permission on the `ClubTeams` feature route calls the endpoint
- **THEN** the system returns a `403`-mapped `ProblemDetails` response via `FeaturePermissionBehavior`, and no change is persisted

#### Scenario: Invalid (non-positive) id values
- **WHEN** a Coach calls the endpoint with `RffmCompetitionId` or `RffmGroupId` set to `0` or a negative number
- **THEN** the system returns a `400`-mapped `ValidationProblemDetails` response via `FluentValidation`, and no change is persisted

