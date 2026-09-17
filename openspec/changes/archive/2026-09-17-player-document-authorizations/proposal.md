## Why

Coaches currently track paper authorizations (e.g. "permission to train physical conditioning outside club facilities") manually, with no way to see at a glance which players/families still owe a signed document for the season, and no digital trail of who uploaded/approved what. Families have no self-service way to submit these documents. This proposal adds a reusable, season-scoped document/authorization tracking capability to the backend so a following frontend change (Coach app) can build the UI on top of a stable contract.

## What Changes

- Add a reusable **document type catalog** (`DocumentType`), starting with a single seeded type ("Autorización para realizar físico fuera de las instalaciones"), extensible to future types without schema changes.
- Add a **per-player, per-season document instance** (`PlayerDocument`) tracking: document type, team player, season, status (`Pending` → `Delivered` → `Approved`/`Rejected`), uploaded file (PDF/JPEG/PNG via existing `IStorageService`), who uploaded it (self vs coach-on-behalf), and who reviewed it.
- Season change does **not** carry over prior-season status: a new season means every applicable player starts back at `Pending` for that document type (no migration/copy of the previous season's `PlayerDocument` row — a fresh one is created only once an upload happens, and "no row yet" reads as `Pending` on the list/report endpoints).
- New endpoints (Coach-scoped): list document types, list a team's players' status for a type+season, upload/replace on behalf of a player, approve/reject, generate a per-team/per-type/per-season PDF report of delivery status.
- New endpoints (Player/FamilyMember-scoped): list my own documents (all types/seasons for my linked `TeamPlayer`), upload my own document.
- **BREAKING**: none — fully additive, new tables/endpoints only.

## Capabilities

### New Capabilities
- `player-document-authorizations`: catalog of document types, per-season per-player document upload/status workflow, role-scoped access (self-service for Player/FamilyMember, team-wide for Coach), and PDF delivery-status report generation.

### Modified Capabilities
(none — no existing requirement changes)

## Impact

- Backend only (`Back/ExtractionApi`): new domain entities (`DocumentType`, `PlayerDocument`) in `AppDbContext` (schema `app`), new EF migration, new vertical-slice features under `Features/Coaches/PlayerDocuments/`, reuse of `IStorageService` (new `player-documents` storage bucket) and `QuestPDF` (new report generator alongside `SeasonPrepPdfGenerator`).
- No frontend changes in this proposal — the Coach-app UI is a separate, coordinated follow-up change that will consume the contract defined in `design.md`.
- No changes to `IdentityDbContext` or `FederationDbContext`; existing `Player`/`FamilyMember`/`Coach` roles and `UserTeam.LinkedTeamPlayerId` scoping are reused as-is.
