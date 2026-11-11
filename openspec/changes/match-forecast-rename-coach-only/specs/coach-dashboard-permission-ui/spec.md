## MODIFIED Requirements

### Requirement: Coach dashboard cards are filtered by the caller's feature permissions
The Coach-app team menu entries and home dashboard cards SHALL only render an entry whose underlying
feature route appears in the current user's `featurePermissions` (team menu: `buildTeamSections`,
rendered by `/coach/menu`; home dashboard: `DashboardCards`) (from `GET /api/permissions/me`), or whose caller has role `Administrator`
(which the backend does not seed explicitly and therefore bypasses the permission list check on the
frontend the same way it bypasses `FeaturePermissionBehavior` on the backend).

#### Scenario: Player sees only the allowed entries
- **WHEN** a user with role `Player` opens the team menu
- **THEN** the Squad, Events, AttendanceSummary, Convocations-based (Calendario, Resultados, Clasificación,
  Pronóstico de partidos), Injured, Sanctions, Lottery, and News entries are rendered; Rivals, Trainings,
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
route's page content. The routes `/coach/match-forecast` and `/coach/match-forecast/simulation` SHALL be
mapped to the convocations feature, and the former routes `/coach/rival-stats` and
`/coach/rival-stats/simulation` SHALL redirect to them without bypassing this check.

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

#### Scenario: Player navigates directly to the match forecast routes
- **WHEN** a user with role `Player` enters the URL for `/coach/match-forecast` or
  `/coach/match-forecast/simulation`
- **THEN** the corresponding page renders normally, without the controls reserved for the Coach role

#### Scenario: Former rival-stats routes keep the permission check
- **WHEN** a user enters `/coach/rival-stats` or `/coach/rival-stats/simulation`
- **THEN** the app redirects to `/coach/match-forecast` or `/coach/match-forecast/simulation` and the
  convocations feature permission check applies to the destination: a user whose `featurePermissions` lack
  the convocations feature (and who is not `Administrator`) is redirected away and the page content is
  never rendered

#### Scenario: Staff role navigates to any catalogued route
- **WHEN** a user with role `Coach`, `ClubDirector`, or `Administrator` enters the URL for any
  catalogued Coach route
- **THEN** the corresponding page renders normally (no regression for staff roles)
