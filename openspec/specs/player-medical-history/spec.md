# player-medical-history Specification

## Purpose
TBD - created by archiving change player-medical-family-history-import. Update Purpose after archive.
## Requirements
### Requirement: Player stores medical notes and previous-club provenance
`Player` SHALL store optional free-text `Enfermedades` (illnesses), `Alergias` (allergies) and `Procedencia` (previous external club) fields. These fields SHALL be returned by `GET /api/catalog/teamplayer/{id}` and accepted by `PUT /api/catalog/teamplayer/{id}` within `PlayerInfo`.

#### Scenario: Coach saves medical notes and provenance
- **GIVEN** a user with role `Coach`
- **WHEN** they call `PUT /api/catalog/teamplayer/{id}` with `playerInfo.enfermedades`, `playerInfo.alergias` and `playerInfo.procedencia` set
- **THEN** the request succeeds and `GET /api/catalog/teamplayer/{id}` returns those same values

#### Scenario: Linked Player/FamilyMember can also update medical notes and provenance
- **GIVEN** a user with role `Player` or `FamilyMember` linked to the target `TeamPlayer` (`UserTeam.LinkedTeamPlayerId`)
- **WHEN** they call `PUT /api/catalog/teamplayer/{id}` with `playerInfo.enfermedades`, `playerInfo.alergias` and `playerInfo.procedencia` set, alongside a `playerInfo.name` that should be ignored per existing role restrictions
- **THEN** the request succeeds, `enfermedades`/`alergias`/`procedencia` are persisted, and `name` remains unchanged

### Requirement: Family member stores a DNI without strict checksum validation
Each family member (`TeamPlayerFamilies`) SHALL support an optional `Dni` field, accepted and returned by the same `FamilyRequest`/`FamilyResponse` used for name/phone/email/relationship. Unlike the player's own `Dni`, this field SHALL NOT be validated against the Spanish DNI/NIE checksum — malformed values SHALL be stored as submitted.

#### Scenario: Saving a family member's DNI
- **GIVEN** a user authorized to edit a team player's family info
- **WHEN** they call `PUT /api/catalog/teamplayer/{id}` with a family member entry that includes `dni`
- **THEN** the request succeeds and the response's matching family member includes that `dni`

#### Scenario: A malformed tutor DNI is still saved
- **GIVEN** a user authorized to edit a team player's family info
- **WHEN** they submit a family member `dni` that does not pass the standard DNI/NIE checksum
- **THEN** the request still succeeds and the value is persisted as submitted

