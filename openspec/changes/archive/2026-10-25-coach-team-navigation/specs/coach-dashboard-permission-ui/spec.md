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
  Estadísticas de rivales), Injured, Sanctions, Lottery, and News entries are rendered; Rivals, Trainings,
  GameModel, and SeasonAccess entries are not rendered

#### Scenario: Coach sees all catalogued entries
- **WHEN** a user with role `Coach` opens the team menu
- **THEN** all catalogued feature entries are rendered, matching the cards the team dashboard showed before this change

#### Scenario: Administrator sees all entries despite no seeded rows
- **WHEN** a user with role `Administrator` opens the team menu
- **THEN** all catalogued feature entries are rendered even though `GET /api/permissions/me` returns an
  empty `featurePermissions` array for that role
