## Why

The "Ver convocatoria" popup (`Front/src/apps/coach/pages/convocations/components/ConvocationDetailsDialog.tsx`)
and the WhatsApp summary (`Front/src/apps/coach/pages/convocations/utils/convocationSummary.ts`,
`buildWhatsAppText`) currently show two hardcoded warning lines about kits/espinilleras baked
into frontend code. Coaches want to edit these notes per team instead of having fixed text
they cannot change — e.g. a team without a strict kit rule, or one that wants to add a note
about carpooling or weather gear. This change adds a persisted, per-team, editable notes list
that the frontend will read and render instead of the fixed strings.

## What Changes

- New backend vertical slice: CRUD for team convocation notes, scoped by `teamId`.
  - `GET /api/teams/{teamId}/notes` — list notes in creation order; lazily seeds the two
    existing hardcoded warnings the first time a team with zero notes is queried.
  - `POST /api/teams/{teamId}/notes` — create a note (`Coach` role only).
  - `PUT /api/teams/{teamId}/notes/{noteId}` — edit a note's text (`Coach` role only).
  - `DELETE /api/teams/{teamId}/notes/{noteId}` — delete a note (`Coach` role only).
- New domain entity `TeamNote` (`Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/TeamNote.cs`)
  with an EF Core migration for its table.
- Read access follows the exact same authorization criterion already used for
  `GET /api/events/{eventId}/convocations` (feature-permission gate on
  `CoachFeatureRoutes.Convocations`, plus team-membership check for `Player`/`FamilyMember`),
  so anyone who can already view a convocation can also view its team's notes.
**Frontend delivery (2026-09-04 addendum):** `front-specialist` consumed this contract and
replaced the hardcoded strings — new `teamNoteService.ts`, a `TeamNotesEditor.tsx` component
(read-only for non-Coach roles, full CRUD for `Coach`) reachable from its own "Notas"
button/dialog in `ConvocationMatchHeader.tsx`, and both `ConvocationDetailsDialog.tsx` and
`buildWhatsAppText` now render the team's notes instead of the fixed warning lines. See
`tasks.md` §6 for the full file list.

## Capabilities

### New Capabilities
- `team-convocation-notes`: per-team, coach-editable list of free-text notes shown on the
  convocation report (popup + WhatsApp export), with default seed content and full CRUD.

### Modified Capabilities
(none — no existing spec covers convocation notes)

## Impact

- Affected code: `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/`,
  `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Notes/` (new folder),
  `Back/ExtractionApi/src/RFFM.Api/Infrastructure/Persistence/` (DbContext, entity
  configuration, migration), `Back/ExtractionApi/tests/RFFM.Api.Tests/`.
- No frontend files touched by this change.
- New table `TeamNotes` in the `app` schema (via `AppDbContext`).
