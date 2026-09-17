## Why

The backend change `player-document-authorizations` (already validated) ships a full API for tracking per-season signed player documents/authorizations (starting with "autorización para hacer físico fuera de las instalaciones"), but its own proposal explicitly scopes out UI work: "No frontend changes in this proposal — the Coach-app UI is a separate, coordinated follow-up change." Coaches currently have no way to see who has/hasn't delivered a required document, and families have no self-service upload flow — this change closes that gap in the Coach app (`Front/src/apps/coach/`), which serves Coach, Player and FamilyMember roles alike.

## What Changes

- New self-service "Mis documentos" view (Player/FamilyMember) showing per-document-type status (Pending/Delivered/Approved/Rejected) for their own linked player, with upload/re-upload.
- New Coach team-tracking view listing every roster player's status for a chosen document type (+ optional season), with upload-on-behalf, approve/reject, and PDF report download.
- New `apps/coach/services/playerDocumentService.ts` wrapping the 6 backend endpoints already defined in `player-document-authorizations/design.md`.
- New route(s) under `apps/coach/routes.tsx`, gated by the existing `RequireFeaturePermission`/`COACH_FEATURE_ROUTES` mechanism.
- **BREAKING**: none — additive UI only, no existing page's behavior changes.

## Capabilities

### New Capabilities
- `player-document-authorizations-ui`: Coach-app frontend for the player-document-authorizations backend contract — self-service document view for Player/FamilyMember, team-tracking + review + PDF report for Coach/Administrator.

### Modified Capabilities
(none — no existing frontend spec capability changes; this only adds new pages/services)

## Impact

- Frontend only (`Front/src/apps/coach/`): new pages (`pages/my-documents/`, `pages/player-documents/` or similar — finalized in design.md), new service `services/playerDocumentService.ts`, new CSS Modules, new route entries in `routes.tsx`.
- Depends on backend change `player-document-authorizations` being deployed (endpoints under `/api/catalog/document-types`, `/api/catalog/teamplayer/{id}/documents`, `/api/catalog/team/{id}/documents`) — this frontend change cannot be verified end-to-end until that backend ships, but can be built/tested against a mocked service layer per `frontend-testing.md`.
- Open dependency on the existing `FeaturePermission`/`COACH_FEATURE_ROUTES` system (backend-seeded `Domain/Entities/CoachFeatureRoutes.cs` + permission rows): a new feature route likely needs seeding for the new page(s) to be reachable by non-Coach roles — flagged in design.md as requiring back-specialist coordination, not implemented here.
