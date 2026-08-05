## Why

The current "Normas del equipo" feature (shipped in `mobile-team-rules-document`) stores a single opaque PDF per team: Coach/Admin uploads a file, every team member downloads and renders it via a bundled PDF.js viewer in Mobile. This has proven costly (three native dependencies, a custom PDF.js-in-WebView pipeline, no in-app editing, no accessibility, no reuse of the content in the Front SPA) and inflexible (any rule change means the coach re-authoring an external PDF and re-uploading). Coaches need to create and edit individual rules (title, what counts as a violation, what the consequence is, optional detail/bullets) as structured data, from both the Coach web app and Mobile, and every team member should read them natively instead of through a document viewer.

## What Changes

- **Backend** (`Back/ExtractionApi/`): **BREAKING** — remove `Team.RulesDocumentUrl` and the two PDF endpoints (`Features/Mobile/Teams/Commands/UploadTeamRulesDocument.cs`, `Features/Mobile/Teams/Queries/GetTeamRulesDocument.cs`). Add two new domain entities, `TeamRulesSet` (1:1 with `Team`) and `TeamRule` (ordered list owned by `TeamRulesSet`), a new migration, and a vertical-slice feature exposing structured CRUD: `GET`/`PUT`/`DELETE` on `api/mobile/teams/{teamId}/rules` (Mobile) and an equivalent `api/coaches/teams/{teamId}/rules` (Front SPA), sharing the same command/query/handler. A data migration seeds the one real team currently holding the FEPE CADETE rules PDF with its structured equivalent, then drops `RulesDocumentUrl`.
- **Front** (`Front/`, app `coach`): new "Normas del equipo" page under team management (view + edit form: metadata fields, ordered rule list with add/edit/delete/reorder), a new `teamRulesService.ts`, gated by `RequireFeaturePermission`.
- **Mobile** (`Mobile/`): `TeamRulesScreen.tsx` stops downloading/rendering a PDF and instead renders the structured rules natively (table-style summary + expandable long-form detail per rule); a new Coach/Admin-only edit flow (add/edit/delete/reorder rules, edit metadata) reachable from the same screen. `react-native-webview`, `expo-document-picker`, `expo-file-system`, and the bespoke `src/pdfViewer/` module become unused by this feature — flagged in Impact for removal if nothing else in the app depends on them (verified: nothing else does).
- TDD in all three layers per project rules (xUnit+Moq backend, Vitest+Testing Library Front, Jest+Testing Library RN Mobile).

## Capabilities

### New Capabilities
- `team-rules`: a team has one structured rules set (title, subtitle, intro note, optional closing/application notes, ordered list of rules with short title, optional highlight phrase, violation/consequence summaries, optional long description, optional bullet points, optional consequence detail). Any team member can read it (Mobile); Coach/Admin can create, edit, reorder, and delete it, from both Front (Coach app) and Mobile. Backend exposes the same command/query under both `api/coaches/teams/{teamId}/rules` and `api/mobile/teams/{teamId}/rules`.

### Modified Capabilities
- `mobile-team-rules-document`: all four existing requirements (document viewing, document upload by Coach/Admin, format/size constraints, backend document endpoints) are **removed** — replaced entirely by `team-rules`. See `specs/mobile-team-rules-document/spec.md` in this change for the removal deltas with migration notes.

## Impact

- **Backend**: new `Domain/Aggregates/UserClubs/TeamRulesSet.cs`, `TeamRule.cs`; new EF configs; migration dropping `RulesDocumentUrl` and adding `TeamRulesSets`/`TeamRules` tables with a one-time data migration seeding the FEPE CADETE team; removed `Features/Mobile/Teams/Commands/UploadTeamRulesDocument.cs`, `Features/Mobile/Teams/Queries/GetTeamRulesDocument.cs`; new `Features/Mobile/Teams/` read/write slice + new `Features/Coaches/Teams/` read/write slice reusing the same Mediator types; new xUnit tests, old ones removed.
- **Front**: new page(s) under `apps/coach/pages/` (name TBD in design.md), new `apps/coach/services/teamRulesService.ts`, new route entry, new Vitest tests.
- **Mobile**: rewritten `src/screens/TeamRulesScreen.tsx`, new `src/api/teamRules.ts` (replacing `teamRulesDocument.ts`), removed `src/pdfViewer/` and its generated assets, new Jest tests; `package.json` loses `react-native-webview`, `expo-document-picker`, `expo-file-system` **only if** confirmed unused elsewhere at implementation time (not removed as part of this proposal — flagged for user approval).
- **Storage**: the `team-rules-documents` local/Supabase bucket becomes unused by new code; existing blobs are not actively deleted by this change (out of scope — no orphan-cleanup job).
