## 1. Backend: domain + migration

- [x] 1.1 Add `RulesDocumentUrl` (nullable string) property and `UpdateRulesDocumentUrl(string? url)`
  method to `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Team.cs`, mirroring
  `UrlPhoto`/`UpdateUrlPhoto` exactly.
- [x] 1.2 Generate EF Core migration `AddRulesDocumentUrlToTeam` (nullable `text` column, `app`
  schema, `Teams` table) from the Infrastructure project with the Host as startup project, following
  `20260502141302_AddTeamJoinCode.cs`'s shape but nullable/no default.
- [x] 1.3 Apply the migration locally and verify the column exists via `.\manage-migrations.ps1` or
  equivalent; confirm `dotnet build` passes.

## 2. Backend: upload endpoint

- [x] 2.1 Write failing xUnit tests for `UploadTeamRulesDocumentCommand`/`Handler` (happy path,
  rejects non-PDF content type, rejects >20 MB, replaces existing `RulesDocumentUrl`, enforces
  Coach/Admin via `IRequireFeaturePermission`, enforces team membership).
- [x] 2.2 Implement `Back/ExtractionApi/src/RFFM.Api/Features/Mobile/Teams/Commands/UploadTeamRulesDocument.cs`:
  `IFeatureModule` registering `MapPost("api/mobile/teams/{teamId}/rules-document", ...)` with
  `.DisableAntiforgery()`, `UploadTeamRulesDocumentCommand : IRequest<UploadTeamRulesDocumentResult>,
  IRequireFeaturePermission, IRequireTeamMembership` (`RequiredPermission => "ReadWrite"`), handler
  using `IStorageService.UploadAsync` and `Team.UpdateRulesDocumentUrl`, FluentValidation validator
  for content-type/size, `UploadTeamRulesDocumentResult { Url, UploadedAt }`. Placed under
  `Commands/` subfolder (not directly in `Features/Mobile/Teams/`) to match the existing
  `Features/Mobile/Teams/Queries/` sibling convention.
- [x] 2.3 Run the new tests plus the existing `Features/Coaches/Teams/` and `Features/Mobile/` test
  suites — all green.

## 3. Backend: get endpoint

- [x] 3.1 Write failing xUnit tests for `GetTeamRulesDocumentQuery`/`Handler` (200 + bytes when
  present, 204 when `RulesDocumentUrl` is null, 404 when team doesn't exist, accessible by
  Player/FamilyMember roles too).
- [x] 3.2 Implement `Back/ExtractionApi/src/RFFM.Api/Features/Mobile/Teams/Queries/GetTeamRulesDocument.cs`:
  `MapGet("api/mobile/teams/{teamId}/rules-document", ...)`, `GetTeamRulesDocumentQuery :
  IQueryApp<...>, IRequireTeamMembership` (no `IRequireFeaturePermission`), handler using
  `IStorageService.DownloadAsync`, returns `Results.File(bytes, "application/pdf")` / `NoContent()` /
  `NotFound()` per spec (`NotFoundException` mapped to 404 by the global ProblemDetails handler).
- [x] 3.3 Run the new tests plus the full backend suite affected — all green (373/373).

## 4. Mobile: dependencies

- [x] 4.1 Confirm with the user which of `expo-document-picker`, `react-native-webview`,
  `expo-file-system` to install (per design.md Decision 6/7); install approved packages in
  `Mobile/package.json` and add any required Expo config plugin entries to `Mobile/app.json`.
  (User approved all 3; installed via `npx expo install` — no config plugin entries needed for
  basic usage. Also added the three packages plus `react-native-webview` to Jest's
  `transformIgnorePatterns` in `Mobile/jest.config.js`, and added
  `Mobile/__mocks__/react-native-webview.js` as a manual mock so screens/navigation importing
  `TeamRulesScreen` don't hit the native `RNCWebViewModule` in tests.)
- [x] 4.2 Verify the exact API surface for the installed Expo SDK version (`Mobile/node_modules/expo/package.json`)
  against `https://docs.expo.dev/versions/v57.0.0/` (or the matching version) for
  `expo-document-picker`'s `getDocumentAsync`, `expo-file-system`'s download/write API, and
  `react-native-webview`'s local-file PDF rendering behavior on Android, per
  `Mobile/AGENTS.md`/`.claude/rules/react-native.md` §0 — note any deviations before writing screen
  code. (Installed Expo is 54.0.36, not 57 — verified against the installed packages' own
  `.d.ts` type declarations directly: `expo-file-system@19.0.23` ships SDK 54's new `File`/`Paths`
  class-based API by default — no `writeAsStringAsync`/`downloadAsync` legacy calls used, per
  Decision 5's `File.write(Uint8Array)`. `expo-document-picker@14.0.8`'s `getDocumentAsync`
  returns `{ canceled, assets: [{ uri, name, size, mimeType }] }`, matching Decision 7 exactly.
  `react-native-webview@13.15.0`'s Android/local-file rendering was not verified on a physical
  device/emulator in this session — flagged as a manual QA follow-up per task 8.5.)

## 5. Mobile: API client

- [x] 5.1 Write failing tests for `Mobile/src/api/teamRulesDocument.ts` in
  `Mobile/src/api/__tests__/teamRulesDocument.test.ts` — `getTeamRulesDocument` (200 with bytes →
  local file written, 204 → `null`, error propagation) and `uploadTeamRulesDocument` (success shape,
  error propagation).
- [x] 5.2 Implement `Mobile/src/api/teamRulesDocument.ts` (`getTeamRulesDocument(teamId)`,
  `uploadTeamRulesDocument(teamId, fileUri, fileName)`) via the shared `api` client, per design.md
  Decisions 3 and 5, to make tests pass.

## 6. Mobile: TeamRulesScreen

- [x] 6.1 Write failing tests for `Mobile/src/screens/TeamRulesScreen.tsx` in
  `Mobile/src/screens/__tests__/TeamRulesScreen.test.tsx` covering: loading state, "Aún no
  disponible" empty state, PDF viewer rendered when a document exists, upload/replace control shown
  only for Coach/Admin roles, client-side rejection of non-PDF and >20 MB picks (no API call made),
  successful upload updates the displayed document, error state on fetch/upload failure.
- [x] 6.2 Implement `Mobile/src/screens/TeamRulesScreen.tsx`: standard data-loading pattern, PDF
  viewer via `react-native-webview` pointed at the locally cached file URI, `expo-document-picker`
  upload flow with client-side type/size validation, `COACH_ADMIN_ROLES` role gate (matching
  `NewsScreen.tsx`/`NewsDetailScreen.tsx`'s pattern) for the upload/replace control.
- [x] 6.3 Run the new tests — all green.

## 7. Mobile: navigation

- [x] 7.1 Write/update failing test in `Mobile/src/navigation/__tests__/` (or
  `TeamMenuScreen`'s own test file) asserting a fourth menu item ("Normas del equipo",
  `document-text-outline`, target `RulesTab`) is rendered and navigates correctly, and that
  `RulesTab` is registered on `TeamTabStack` — without altering the existing `name`s/labels of
  `PlayersTab`/`InjuriesTab`/`SanctionsTab`.
- [x] 7.2 Update `Mobile/src/screens/TeamMenuScreen.tsx`: add the fourth `MenuItemConfig` entry.
- [x] 7.3 Update `Mobile/src/navigation/RootNavigator.tsx`: add `RulesTab` (component
  `TeamRulesScreen`, `initialParams={{ teamId }}`) to `TeamTabStack`.
- [x] 7.4 Run the updated navigation/menu tests — all green.

## 8. Verification

- [x] 8.1 Run `dotnet build` and `dotnet test` in `Back/ExtractionApi/` — full suite green, no
  skipped tests. (373/373 passed.)
- [x] 8.2 Run `npm test` in `Mobile/` — full suite green, no skipped tests. (426/426 passed, 47
  suites.)
- [x] 8.3 Run `openspec validate mobile-team-rules-document --strict` — no errors.
- [x] 8.4 Confirm no changes were made under `Front/`. (Confirmed — `git status` shows no `Front/`
  changes.)
- [ ] 8.5 Manually smoke-test the upload/view flow with a Coach account and a Player/FamilyMember
  account — deferred as a follow-up manual QA step; no physical/simulator run was performed in this
  session.
- [x] 8.6 Bug fix: replaced the raw `source={{ uri: localUri }}` WebView PDF loading with a
  bundled PDF.js viewer (`Mobile/src/pdfViewer/`) after confirming Android's WebView renders a
  blank page for local `file://…pdf` URIs (no native PDF support, unlike WKWebView on iOS). See
  design.md's "Deviation" section for the full rationale. `npm test` — 48/48 suites, 433/433 tests
  passed, 0 skipped.
- [ ] 8.7 Manually verify actual PDF rendering (multi-page scroll, near-20MB file) in the PDF.js
  viewer on a real Android device/emulator — not verified in this session (no device/emulator
  available). See "Manual verification still needed" note in implement.md for exact steps.
