# user-activity-audit-log-ui Specification

## Purpose
TBD - created by archiving change user-activity-audit-log-frontend. Update Purpose after archive.
## Requirements
### Requirement: Page-access instrumentation
The frontend SHALL record a page-access audit event via `POST /api/audit-log/page-access` when an authenticated user enters any auditable top-level section of the Federation or Coach app (the exact enumeration is defined in `design.md` Decisions 1–2), exactly once per section entry, without blocking rendering or surfacing a failure to the user.

#### Scenario: Entering an auditable section records one page-access event
- **WHEN** an authenticated user navigates to an auditable top-level page (e.g. `/coach/squad`)
- **THEN** the frontend calls `POST /api/audit-log/page-access` with `{ pageIdentifier: "Squad" }` exactly once for that mount

#### Scenario: Re-rendering the same section does not duplicate the event
- **WHEN** the same auditable page component re-renders without unmounting (e.g. a prop change, a state update)
- **THEN** the frontend does not call `POST /api/audit-log/page-access` again for that mount

#### Scenario: A failed page-access call never surfaces to the user
- **WHEN** `POST /api/audit-log/page-access` fails (network error, 4xx/5xx)
- **THEN** the page renders normally with no error toast, no blocked UI, and no retry loop

#### Scenario: Drill-down and sub-action routes are not instrumented
- **WHEN** a user navigates to a route explicitly excluded in `design.md` Decisions 1–2 (e.g. a specific match's Acta, `convocations/match`, `squad/new`)
- **THEN** the frontend does not call `POST /api/audit-log/page-access` for that navigation

### Requirement: Audit-log screen — Federation app
The Federation app SHALL provide an audit-log screen at `/federation/audit-log`, reachable only by users holding the `Federation` role, showing the unfiltered result of `GET /api/audit-log` with client-side narrowing filters (club, team, user, event type, date range) and pagination, rendered as a responsive card/list layout — never a table.

#### Scenario: Federation role can view the audit log
- **WHEN** a user with the `Federation` role navigates to `/federation/audit-log`
- **THEN** the screen loads and displays audit events returned by `GET /api/audit-log`, paginated

#### Scenario: Player/FamilyMember cannot reach the Federation audit screen by direct URL
- **WHEN** a user with only the `Player` or `FamilyMember` role navigates directly to `/federation/audit-log`
- **THEN** the frontend blocks access and does not render the audit list (redirect/guard, consistent with `RequireAuth`'s existing denial behavior)

#### Scenario: Empty result set shows an empty state, not a blank screen
- **WHEN** `GET /api/audit-log` returns zero matching events for the current filters
- **THEN** the screen shows an explicit empty state message instead of an empty list with no feedback

#### Scenario: A failed search shows an error state
- **WHEN** `GET /api/audit-log` fails
- **THEN** the screen shows an error state distinct from the loading and empty states

### Requirement: Audit-log screen — Coach app
The Coach app SHALL provide an audit-log screen at `/coach/audit-log`, gated by the `AuditLog` feature route (visible to `Coach`, `ClubDirector`, `Administrator`; `Player`/`FamilyMember` excluded), showing the server-scoped result of `GET /api/audit-log` with client-side narrowing filters and pagination, rendered as a responsive card/list layout — never a table.

#### Scenario: Coach/ClubDirector/Administrator can view the audit log once the feature route is granted
- **WHEN** a user holding `Coach`, `ClubDirector` or `Administrator` and the `AuditLog` feature permission navigates to `/coach/audit-log`
- **THEN** the screen loads and displays audit events returned by `GET /api/audit-log`, scoped server-side to that user's clubs/teams

#### Scenario: Player/FamilyMember cannot reach the Coach audit screen by direct URL
- **WHEN** a user with the `Player` or `FamilyMember` role navigates directly to `/coach/audit-log`
- **THEN** `RequireFeaturePermission` (with `allowPlayerAccess={false}`) blocks access and redirects, without rendering the audit list

#### Scenario: A user without the AuditLog feature permission is redirected
- **WHEN** an authenticated Coach-app user without the `AuditLog` feature permission navigates to `/coach/audit-log`
- **THEN** `RequireFeaturePermission` redirects to the default Coach dashboard and shows the standard "no tienes permiso" snackbar

### Requirement: Audit event types are shown in Spanish
The audit-log screen SHALL translate each `AuditEventType` value returned by the backend (`PageAccess`, `ConvocationAccepted`, `ConvocationRejected`, `PlayerEdited`) into a Spanish label before rendering it to the user.

#### Scenario: A ConvocationRejected event renders in Spanish
- **WHEN** the audit list includes an event with `eventType: "ConvocationRejected"`
- **THEN** the rendered card shows the Spanish label ("Convocatoria rechazada"), not the raw backend enum string

