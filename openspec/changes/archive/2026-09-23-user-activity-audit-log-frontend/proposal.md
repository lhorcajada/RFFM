## Why

The backend change `user-activity-audit-log` (validated, not yet implemented) ships `POST /api/audit-log/page-access` and `GET /api/audit-log`, but its own proposal explicitly scopes out UI work: "No frontend changes in this proposal — calling the page-access endpoint from Coach/Federation apps and building the audit screen are separate, coordinated follow-up changes." Right now nothing calls the page-access endpoint, and there is no way for Federation, ClubDirector or Coach users to actually read the audit trail — the backend capability is invisible without this change.

## What Changes

- New shared hook `useAuditPageAccess(pageIdentifier, options?)` (fire-and-forget `POST /api/audit-log/page-access` on mount, once per pageIdentifier) wired into every auditable top-level section of both the Federation app and the Coach app.
- New shared service `auditLogService.ts` (recordPageAccess + searchAuditLog, fully typed, no `any`).
- New audit-log screen in the Coach app (`apps/coach/pages/audit-log/AuditLog.tsx`), gated by a new `COACH_FEATURE_ROUTES.AuditLog` feature route (visible to Coach/ClubDirector/Administrator; Player/FamilyMember excluded via `allowPlayerAccess={false}`).
- New audit-log screen in the Federation app (`apps/federation/pages/AuditLog/AuditLog.tsx`), gated by an app-level `Federation`-only role check (Player/FamilyMember, who are allowed into the Federation app shell, must not reach this route).
- Both screens render the same shared, theme-agnostic presentational component (`shared/components/ui/AuditLogView/`) — cards/list, never a table, responsive mobile-first — to avoid duplicating filter/pagination/empty-state logic across two themes.
- **BREAKING**: none — additive only.

## Capabilities

### New Capabilities
- `user-activity-audit-log-ui`: Frontend consumption of the `user-activity-audit-log` backend contract — page-access instrumentation across both apps' auditable sections, and a role-gated audit-log screen (list + filters) in each app.

### Modified Capabilities
(none — no existing frontend spec capability changes; this only adds new pages/hooks/services and two new route entries)

## Impact

- Frontend only (`Front/src/`): new `shared/services/auditLogService.ts`, `shared/hooks/useAuditPageAccess.ts`, `shared/components/ui/AuditLogView/`, `apps/coach/pages/audit-log/`, `apps/federation/pages/AuditLog/`; edits to `apps/coach/routes.tsx`, `apps/coach/constants/featureRoutes.ts`, `apps/federation/routes.tsx`, and a hook-call addition inside ~20 existing top-level page components across both apps (see design.md for the exact enumeration).
- Depends on the backend change `user-activity-audit-log` being implemented and deployed (`POST /api/audit-log/page-access`, `GET /api/audit-log`) — this frontend change cannot be verified end-to-end until that ships, but is built/tested against a mocked service layer per `frontend-testing.md`.
- New Coach feature route (`AuditLog`) needs a backend `FeaturePermission`/`CoachFeatureRoutes` seed row for Coach/ClubDirector/Administrator — same cross-change dependency pattern flagged in the `player-document-authorizations-frontend` precedent; requires back-specialist coordination, not implemented here.
