## Why

RFFM has no audit trail of sensitive user actions. There is no way to answer "who accepted/rejected this call-up and why", "who edited this player's data and when", or "who accessed the audit-relevant sections of the app". Federation and club directors need this for accountability and dispute resolution (e.g. a rejected call-up with no recorded reason, or a player edit nobody can attribute). This proposal adds a transversal audit-logging capability to the backend: infrastructure to record events, instrumentation of the three specific flows requested (page access, call-up accept/reject, player edit), and a scoped query endpoint for a future audit screen.

## What Changes

- Add a new domain entity (`UserActivityLog`) and `AppDbContext` table (schema `app`) recording: user, role, club, team, timestamp, IP, action/page, result, and an optional reason (required for call-up rejections).
- Add a new vertical-slice feature to **record a page-access event** — a lightweight command the frontend (Coach and Federation apps) calls when entering a specific audited section. Defines the `PageIdentifier` contract (reusing the existing `PagePermission.PageIdentifier` concept) so front-specialist knows what to instrument.
- Add an inject­able `IAuditLogger` infrastructure service (not a pipeline behavior — see `design.md` for rationale) used to emit audit events from inside handlers without coupling features together.
- **Instrument existing handlers** (no behavior change to their business logic): `UpdateConvocationStatus.cs` (accept/reject call-up — reason required on reject) and `UpdatePlayer.cs` (player edit).
- Add a new **paginated search query** (`GET /api/audit-log`) with filters (club, team, user, event type, date range), enforcing scope server-side: Federation sees everything, ClubDirector sees only their club's teams, Coach sees only their own team. Player/FamilyMember get `403 Forbidden`.
- Retention: indefinite, no automated deletion (explicit decision, see `design.md`).
- **BREAKING**: none — fully additive; existing endpoints keep their current request/response contracts.

## Capabilities

### New Capabilities
- `user-activity-audit-log`: audit event data model, event-emission mechanism (`IAuditLogger`), page-access recording endpoint, instrumentation of call-up accept/reject and player-edit handlers, and a scope-aware paginated query endpoint for reading audit records.

### Modified Capabilities
(none — no existing requirement changes; `UpdateConvocationStatus` and `UpdatePlayer` gain a side effect, not a behavior/contract change)

## Impact

- Backend only (`Back/ExtractionApi`): new domain entity `UserActivityLog` in `AppDbContext` (schema `app`), new EF migration with indexes on `(ClubId, Timestamp)` and `(TeamId, Timestamp)`, new vertical-slice features under `Features/Audit/`, new `IAuditLogger`/`AuditLogger` in `Infrastructure/Services/`, edits to `Features/Coaches/Convocations/UpdateConvocationStatus.cs` and `Features/Coaches/Players/Commands/UpdatePlayer.cs` to call `IAuditLogger`.
- No frontend changes in this proposal — calling the page-access endpoint from Coach/Federation apps and building the audit screen are separate, coordinated follow-up changes (front-specialist) that consume the contracts defined in `design.md`.
- No changes to `IdentityDbContext` or `FederationDbContext`; existing `UserClub`/`UserTeam`/`AppRoles` relations are reused as-is to determine query scope.
