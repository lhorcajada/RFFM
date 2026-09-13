## Why

The Coach "Lesionados" page (`coach/injured?teamId=`) only lists individual player injuries in a
plain MUI `Table`, which does not fit the mobile-first/cards rule (`frontend-architecture.md` §7)
and breaks on narrow screens. There is also no place to document the team's injury-response
protocol (what to do when a player gets injured) or to share reference PDFs (first-aid sheets,
insurance forms, emergency contacts) with the rest of the staff/family — this currently lives
outside the app, if anywhere.

## What Changes

- Rework the Injured page into 3 tabs: **Lesionados** (existing listing, converted from a `Table`
  to responsive cards, edit/discharge actions restricted to Coach), **Protocolo** (rich-text
  content describing the injury protocol; Coach can create/edit/delete, all other authenticated
  roles get read-only view), **Documentos** (multiple PDF attachments linked to the protocol;
  Coach can upload/delete, all authenticated roles can download).
- New backend entity `TeamInjuryProtocol` (one per team, rich-text `Content`) and
  `TeamInjuryProtocolAttachment` (many per protocol: file name, storage URL, content type,
  uploaded date), reusing the existing `IStorageService` (same pattern as `UploadPlayerPhoto`)
  for the PDF files — new bucket, not disk paths hardcoded elsewhere.
- New frontend dependency: `@tiptap/react` + `@tiptap/starter-kit` (no rich-text editor exists in
  the repo today) for the Protocolo tab; read-only rendering reuses the same editor in
  non-editable mode for non-Coach roles.

## Capabilities

### New Capabilities
- `injury-protocol`: team-scoped rich-text protocol with Coach-only write access and PDF
  attachments downloadable by all authenticated roles.

### Modified Capabilities
- (page-level only, no existing spec capability found for "Lesionados" listing itself) Injured
  page becomes tabbed; listing becomes responsive cards instead of a table.

## Impact

- Backend: new `Domain/Entities/Teams/TeamInjuryProtocol.cs` and
  `TeamInjuryProtocolAttachment.cs`, EF configurations, migration (schema `app`), new feature
  file(s) under `Features/Coaches/Teams/` (or `Features/Coaches/InjuryProtocol/`) for
  get/create-or-update/delete protocol and upload/list/download/delete attachments, `AppDbContext`
  registration.
- Frontend: `Front/src/apps/coach/pages/injured/Injured.tsx` (tabs), new components for the
  protocol editor and documents list/upload, new `injuryProtocolService.ts`, `package.json`
  addition (TipTap), CSS Modules for card layout replacing the table.
