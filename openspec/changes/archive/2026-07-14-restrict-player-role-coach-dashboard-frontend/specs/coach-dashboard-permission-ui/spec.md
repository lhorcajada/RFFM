## ADDED Requirements

### Requirement: Coach dashboard cards are filtered by the caller's feature permissions
The Coach-app dashboard (`TeamDashboardCards` and `DashboardCards`) SHALL only render a card whose
underlying feature route appears in the current user's `featurePermissions` (from
`GET /api/permissions/me`), or whose caller has role `Administrator` (which the backend does not seed
explicitly and therefore bypasses the permission list check on the frontend the same way it bypasses
`FeaturePermissionBehavior` on the backend).

#### Scenario: Player sees only the 8 allowed cards
- **WHEN** a user with role `Player` loads the team dashboard
- **THEN** only the Squad, Events, AttendanceSummary, Convocations, Injured, Sanctions, Lottery, and
  News cards are rendered; Rivals, Trainings, GameModel, and SeasonAccess cards are not rendered

#### Scenario: Coach sees all catalogued cards
- **WHEN** a user with role `Coach` loads the team dashboard
- **THEN** all catalogued feature cards are rendered, matching pre-change behavior

#### Scenario: Administrator sees all cards despite no seeded rows
- **WHEN** a user with role `Administrator` loads the dashboard
- **THEN** all catalogued feature cards are rendered even though `GET /api/permissions/me` returns an
  empty `featurePermissions` array for that role

### Requirement: Direct URL navigation to a non-permitted Coach route is blocked
The system SHALL redirect a user away from a Coach-app route whose mapped `featureRoute` is not present
in the caller's `featurePermissions` (and the caller is not `Administrator`), instead of rendering that
route's page content.

#### Scenario: Player navigates directly to a blocked route
- **WHEN** a user with role `Player` enters the URL for `/coach/settings` (or `/coach/rivals`,
  `/coach/trainings`, `/coach/game-model`, `/coach/season-access`, `/coach/clubs` and sub-routes)
- **THEN** the app redirects the user away (e.g. to `/coach/dashboard`) and the blocked page's content is
  never rendered

#### Scenario: Player navigates directly to an allowed route
- **WHEN** a user with role `Player` enters the URL for `/coach/squad`, `/coach/attendance`,
  `/coach/attendance/summary`, `/coach/convocations`, `/coach/injured`, `/coach/sanctions`,
  `/coach/lottery`, or `/coach/news`
- **THEN** the corresponding page renders normally

#### Scenario: Staff role navigates to any catalogued route
- **WHEN** a user with role `Coach`, `ClubDirector`, or `Administrator` enters the URL for any
  catalogued Coach route
- **THEN** the corresponding page renders normally (no regression for staff roles)
