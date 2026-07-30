## ADDED Requirements

### Requirement: Only the team's coach or the club's director may update a team
The `UpdateTeam` command (`PUT /api/catalog/team/{id}`) SHALL only succeed when the authenticated
user is a club-level `Coach` or `Directive` (`UserClub.RoleId`) of the team's club, or a
team-level `Coach` (`UserTeam.RoleId`) of the target team. Any other authenticated user SHALL
receive a `403 Forbidden` and the team's data SHALL remain unchanged.

Note: today, the coach that creates a club is recorded as `UserClub.RoleId == Coach`
(club-scoped, assigned in `CreateClub`), not as a per-team `UserTeam` row — `UserTeam` is
populated only when a player/family member joins via a team join code. The team-level `Coach`
check is kept as an additional, currently-unused path for forward compatibility.

#### Scenario: Club-level coach updates a team of their club
- **GIVEN** a user with `UserClub.RoleId == Coach` for a team's club
- **WHEN** that user calls `PUT /api/catalog/team/{id}` for that team with valid data
- **THEN** the request succeeds and the team's data is updated

#### Scenario: Directive of the club updates a team of that club
- **GIVEN** a user with `UserClub.RoleId == Directive` for a team's club
- **WHEN** that user calls `PUT /api/catalog/team/{id}` for any team of that club with valid data
- **THEN** the request succeeds and the team's data is updated

#### Scenario: Unrelated user is rejected
- **GIVEN** a user with no `Coach`/`Directive` relationship to the team's club and no `Coach`
  relationship to the team itself
- **WHEN** that user calls `PUT /api/catalog/team/{id}` for that team
- **THEN** the request fails with `403 Forbidden` and the team's data in the database is unchanged

#### Scenario: Coach of a different club is rejected
- **GIVEN** a user who is `Coach`/`Directive` of a club that does not own the target team, and has
  no relationship to the target team itself
- **WHEN** that user calls `PUT /api/catalog/team/{id}` for the target team
- **THEN** the request fails with `403 Forbidden`
