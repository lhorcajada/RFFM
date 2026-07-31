## Why

Coaches and clubs need a way to publish a team's internal rules (normas del equipo) as a single
reference document that every family/player can read from the mobile app, without emailing PDFs or
relying on the SPA. There is currently no `Team`-scoped document storage or viewer in Mobile or the
backend.

## What Changes

- **Backend** (`Back/ExtractionApi/`): add a nullable `RulesDocumentUrl` column to `Team`
  (migration `AddRulesDocumentUrlToTeam`, domain method `Team.UpdateRulesDocumentUrl(string? url)`
  mirroring `UpdateUrlPhoto`), plus a new vertical-slice feature under `Features/Mobile/Teams/`
  exposing:
  - `POST /api/mobile/teams/{teamId}/rules-document` — Coach/Admin only, multipart upload, validates
    `application/pdf` content type and ≤20 MB size, stores via `IStorageService.UploadAsync`,
    replaces any previous document.
  - `GET /api/mobile/teams/{teamId}/rules-document` — any team member, returns the PDF bytes
    (`200`), `204` if none uploaded yet, `404` if the team doesn't exist.
- **Mobile** (`Mobile/`): add a "Normas del equipo" option to the Equipo menu (`TeamMenuScreen`,
  alongside Plantilla/Lesiones/Sanciones) and a new `RulesTab` screen that:
  - Downloads and displays the PDF in-app for every role, or shows "Aún no disponible" when none exists.
  - Lets Coach/Admin pick a PDF from the device (`expo-document-picker`, new dependency) and upload
    it via the new backend endpoint, replacing any existing document.
  - Renders the PDF using **`react-native-webview`** (new dependency, pointed at a locally cached
    copy of the file downloaded with `expo-file-system`, also a new dependency) — see design.md for
    the alternative considered and why it was picked.
- New Jest + Testing Library for RN tests for the new screen and API client; new xUnit tests for the
  backend command/query and validator.

## Capabilities

### New Capabilities
- `mobile-team-rules-document`: Team members can view a team's rules PDF from Mobile; Coach/Admin
  can upload/replace it. Covers both the Mobile screen/upload flow and the backend endpoints that
  back it.

### Modified Capabilities
(none — no existing spec requirements change)

## Impact

- Backend: new migration, new `Domain/Aggregates/UserClubs/Team.cs` method, new
  `Features/Mobile/Teams/` slice, new xUnit tests.
- Mobile: new `Mobile/src/api/teamRulesDocument.ts`, new
  `Mobile/src/screens/TeamRulesScreen.tsx`, modified `TeamMenuScreen.tsx` and
  `navigation/RootNavigator.tsx` (new `RulesTab`), new `package.json` dependencies
  (`expo-document-picker`, `react-native-webview`, `expo-file-system` — pending user approval before
  install).
- No changes to `Front/` (SPA) — Front-only scope explicitly excluded per acceptance criteria.
