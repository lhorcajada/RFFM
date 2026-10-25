# coach-dashboard-permission-ui Specification

## Purpose
TBD - created by archiving change restrict-player-role-coach-dashboard-frontend. Update Purpose after archive.
## Requirements
### Requirement: Coach dashboard cards are filtered by the caller's feature permissions
The Coach-app team menu entries and home dashboard cards SHALL only render an entry whose underlying
feature route appears in the current user's `featurePermissions` (team menu: `buildTeamSections`,
rendered by `/coach/menu`; home dashboard: `DashboardCards`) (from `GET /api/permissions/me`), or whose caller has role `Administrator`
(which the backend does not seed explicitly and therefore bypasses the permission list check on the
frontend the same way it bypasses `FeaturePermissionBehavior` on the backend).

#### Scenario: Player sees only the allowed entries
- **WHEN** a user with role `Player` opens the team menu
- **THEN** the Squad, Events, AttendanceSummary, Convocations-based (Calendario, Resultados, Clasificación,
  Estadísticas de rivales), Injured, Sanctions, Lottery, and News entries are rendered; Rivals, Trainings,
  GameModel, and SeasonAccess entries are not rendered

#### Scenario: Coach sees all catalogued entries
- **WHEN** a user with role `Coach` opens the team menu
- **THEN** all catalogued feature entries are rendered, matching the cards the team dashboard showed before this change

#### Scenario: Administrator sees all entries despite no seeded rows
- **WHEN** a user with role `Administrator` opens the team menu
- **THEN** all catalogued feature entries are rendered even though `GET /api/permissions/me` returns an
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

