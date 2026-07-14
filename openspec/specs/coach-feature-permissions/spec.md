# coach-feature-permissions Specification

## Purpose
TBD - created by archiving change restrict-player-role-coach-features. Update Purpose after archive.
## Requirements
### Requirement: Player role is restricted to the 8 approved Coach dashboard features
The system SHALL only grant the `Player` role read access to the following Coach feature routes:
`/coach/squad`, `/coach/attendance`, `/coach/attendance/summary`, `/coach/convocations`,
`/coach/injured`, `/coach/sanctions`, `/coach/lottery`, `/coach/news`. Any Coach endpoint whose
command/query implements `IRequireFeaturePermission` with a `FeatureRoute` outside this list SHALL
reject a `Player` caller with a 403 `ProblemDetails` response.

#### Scenario: Player calls an allowed feature's read endpoint
- **WHEN** a user with role `Player` sends a query annotated with `FeatureRoute = "/coach/squad"` and
  `RequiredPermission = "Read"`
- **THEN** the request succeeds and returns the expected data

#### Scenario: Player calls a non-allowed feature's endpoint directly
- **WHEN** a user with role `Player` sends a command/query annotated with `FeatureRoute = "/coach/settings"`
  (or any other route not in the allowed list)
- **THEN** the system returns HTTP 403 with a `ProblemDetails` body and the request is not processed

#### Scenario: Player attempts a write on an allowed-read-only feature
- **WHEN** a user with role `Player` sends a command annotated with `FeatureRoute = "/coach/squad"` and
  `RequiredPermission = "Write"` or `"ReadWrite"`
- **THEN** the system returns HTTP 403 because `Player`'s seeded permission for that route is `Read` only

### Requirement: Administrator, Coach, ClubDirector retain full access to catalogued Coach features
The system SHALL NOT regress existing access for `Administrator` (which bypasses the check entirely),
`Coach`, and `ClubDirector` on any catalogued `FeatureRoute`, and SHALL preserve `ClubMember` access to
`GameModels` (route `/coach/game-model`) matching its existing frontend visibility.

#### Scenario: Coach calls a previously-open, now-annotated endpoint
- **WHEN** a user with role `Coach` sends a command/query on any catalogued `FeatureRoute`
- **THEN** the request succeeds as before this change

#### Scenario: ClubMember accesses GameModels
- **WHEN** a user with role `ClubMember` sends a request annotated with `FeatureRoute = "/coach/game-model"`
- **THEN** the request succeeds

### Requirement: Unrecognized role/route combination fails closed
The system SHALL reject any authenticated non-Administrator role that has no seeded `FeaturePermission`
row for a given `FeatureRoute`, rather than defaulting to allow.

#### Scenario: Role with no seeded permission calls a guarded endpoint
- **WHEN** a user with role `FamilyMember` (or any role without a seeded row for that route) calls a
  command/query annotated with a catalogued `FeatureRoute`
- **THEN** the system returns HTTP 403

