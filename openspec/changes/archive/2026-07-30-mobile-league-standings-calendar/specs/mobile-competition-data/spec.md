## ADDED Requirements

### Requirement: Mobile team classification
The system SHALL expose `GET /api/mobile/teams/{teamId}/classification`, returning the league classification table for the RFFM competition/group resolved directly from the requested `{teamId}`'s own `Team.RffmCompetitionId`/`Team.RffmGroupId`. The endpoint SHALL require authentication, `IRequireFeaturePermission` (Read) on the `CompetitionData` feature route, and `IRequireTeamMembership` for `{teamId}`.

#### Scenario: Team is associated with a competition
- **WHEN** an authenticated Coach/Player/FamilyMember calls `GET /api/mobile/teams/{teamId}/classification` for a team they belong to whose `RffmCompetitionId`/`RffmGroupId` are both set
- **THEN** the system returns `200 OK` with the classification rows for that competition/group, projected into the Mobile classification DTO

#### Scenario: Team is not yet associated with a competition
- **WHEN** an authenticated user calls the endpoint for a team whose `RffmCompetitionId` or `RffmGroupId` is `null`
- **THEN** the system returns `200 OK` with an empty classification (no rows), not an error

#### Scenario: Caller does not belong to the requested team
- **WHEN** a Player or FamilyMember calls the endpoint with a `{teamId}` they are not a member of
- **THEN** the system returns a `403`-mapped `ProblemDetails` response via `TeamMembershipBehavior`, and no classification data is returned

### Requirement: Mobile team calendar
The system SHALL expose `GET /api/mobile/teams/{teamId}/calendar`, returning the full matchday-by-matchday calendar (including finished match results) for the RFFM competition/group resolved directly from the requested `{teamId}`'s own `Team.RffmCompetitionId`/`Team.RffmGroupId`. The endpoint SHALL require the same authentication and permission checks as the classification endpoint.

#### Scenario: Team is associated with a competition
- **WHEN** an authenticated user calls `GET /api/mobile/teams/{teamId}/calendar` for a team they belong to whose `RffmCompetitionId`/`RffmGroupId` are both set
- **THEN** the system returns `200 OK` with every matchday and its matches (including scores for finished matches), projected into the Mobile calendar DTO

#### Scenario: Team is not yet associated with a competition
- **WHEN** an authenticated user calls the endpoint for a team whose `RffmCompetitionId` or `RffmGroupId` is `null`
- **THEN** the system returns `200 OK` with an empty calendar (no matchdays), not an error

### Requirement: Mobile team next match
The system SHALL expose `GET /api/mobile/teams/{teamId}/next-match`, returning the team's next unplayed fixture derived from the same calendar data, or an empty result if none exists (e.g. end of season) or the team is not yet associated with a competition. The endpoint SHALL require the same authentication and permission checks as the classification endpoint.

#### Scenario: Team has a future scheduled match
- **WHEN** an authenticated user calls `GET /api/mobile/teams/{teamId}/next-match` for a team whose `RffmCompetitionId`/`RffmGroupId` are both set and the calendar contains at least one match on or after today that has not been played
- **THEN** the system returns `200 OK` with the earliest such match

#### Scenario: No future match exists
- **WHEN** the calendar has no unplayed match on or after today (season finished), or the team is not yet associated with a competition (`RffmCompetitionId`/`RffmGroupId` is `null`)
- **THEN** the system returns `200 OK` with an empty/null next-match result, not an error
