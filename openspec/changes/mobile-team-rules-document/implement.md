# Implement — Backend (mobile-team-rules-document)

Backend-only script. Mobile side is out of scope for this pass (see tasks.md §4-7, owned by
mobile-specialist). Executed directly by back-specialist, TDD (Red → Green → Refactor).

## 1. Domain

- `Back/ExtractionApi/src/RFFM.Api/Domain/Aggregates/UserClubs/Team.cs`: add
  `public string? RulesDocumentUrl { get; set; }` next to `UrlPhoto`, and
  `public void UpdateRulesDocumentUrl(string? url) => RulesDocumentUrl = url;` next to
  `UpdateUrlPhoto`. Mirrors the exact mutable-setter style of `UrlPhoto`. **DONE.**

## 2. Migration

- Generate `AddRulesDocumentUrlToTeam` against `AppDbContext` from
  `Back/ExtractionApi` via `.\manage-migrations.ps1 -Action create -MigrationName
  AddRulesDocumentUrlToTeam -Context AppDbContext`.
- Expected shape (nullable `text` column, `app` schema, `Teams` table), no default, no backfill —
  simpler than `20260502141302_AddTeamJoinCode.cs` (no uniqueness/index/backfill needed).

## 3. Feature route + permission seed

- Add `TeamRulesDocument` to `Back/ExtractionApi/src/RFFM.Api/Domain/Entities/CoachFeatureRoutes.cs`
  (value `"/mobile/team-rules"`), grouped with the other `/mobile/*` routes.
- Add seed rows in `Back/ExtractionApi/src/RFFM.Host/DependencyInjection/WebApplicationExtensions.cs`
  → `SeedFeaturePermissionsAsync`: `("TeamRulesDocument", CoachFeatureRoutes.TeamRulesDocument,
  "Coach", 3, false)` and `("TeamRulesDocument", CoachFeatureRoutes.TeamRulesDocument,
  "ClubDirector", 3, false)` (ReadWrite — upload is Coach/Admin only; Administrator bypasses the
  check entirely per `FeaturePermissionBehavior`). No row for Player/FamilyMember: the `GET` query
  only carries `IRequireTeamMembership`, not `IRequireFeaturePermission`, so it isn't gated by this
  table at all — every team member can read once they pass the membership check.

## 4. Upload endpoint

New file `Back/ExtractionApi/src/RFFM.Api/Features/Mobile/Teams/Commands/UploadTeamRulesDocument.cs`,
mirroring `Features/Coaches/Teams/Commands/UploadTeamPhoto.cs` structurally but adding
`IRequireTeamMembership` (route carries `{teamId}`) alongside `IRequireFeaturePermission`:

- Route: `POST api/mobile/teams/{teamId}/rules-document`, `.DisableAntiforgery()`.
- `UploadTeamRulesDocumentCommand : IRequest<UploadTeamRulesDocumentResult>,
  IRequireFeaturePermission, IRequireTeamMembership` — `TeamId`, `File` (`IFormFile`).
  `FeatureRoute => CoachFeatureRoutes.TeamRulesDocument`, `RequiredPermission => "ReadWrite"`.
- `UploadTeamRulesDocumentResult { string Url; DateTime UploadedAt; }`.
- Handler: loads `Team` by `TeamId` (throws `DomainException` `TeamNotFound` if missing, same
  pattern as `GetTeamCalendar.Handler`), uploads via `IStorageService.UploadAsync("team-rules-documents",
  fileName, file, ct)` (new bucket/prefix, per design.md §"Storage"), deletes the previous blob via
  `IStorageService.DeleteAsync` if `team.RulesDocumentUrl` was set (same replace pattern as
  `UploadScenarioMediaHandler`), calls `team.UpdateRulesDocumentUrl(url)` — no manual
  `SaveChangesAsync` (handled elsewhere/DbContext tracking + explicit `SaveChangesAsync` call
  consistent with existing Team handlers, since this project does not have a
  `SaveDatabaseChangesPipelineBehavior`; follow the exact save pattern already used by sibling Team
  command handlers).
- Validator `UploadTeamRulesDocumentValidator : AbstractValidator<UploadTeamRulesDocumentCommand>`:
  content-type must be exactly `"application/pdf"`, file non-null/non-empty, size ≤ 20 * 1024 * 1024
  bytes — mirrors `UploadScenarioMediaValidator`'s shape.

## 5. Get endpoint

New file `Back/ExtractionApi/src/RFFM.Api/Features/Mobile/Teams/Queries/GetTeamRulesDocument.cs`:

- Route: `GET api/mobile/teams/{teamId}/rules-document`.
- `GetTeamRulesDocumentQuery : IQueryApp<GetTeamRulesDocumentResult?>, IRequireTeamMembership` (no
  `IRequireFeaturePermission` — every role, including Player/FamilyMember, can read).
- Handler: loads `Team` by `TeamId` (throws `DomainException` `TeamNotFound` if missing →endpoint
  maps to 404), returns `null` if `team.RulesDocumentUrl` is null (endpoint maps to `204`),
  otherwise downloads via `IStorageService.DownloadAsync(url, ct)` and returns
  `Results.File(content, "application/pdf")`.

## 6. Tests (write first, Red → Green)

- `UploadTeamRulesDocumentValidatorTests.cs` — non-PDF rejected, >20MB rejected, empty file
  rejected, valid `application/pdf` within limit accepted. Mirrors
  `UploadScenarioMediaValidatorTests.cs`.
- `UploadTeamRulesDocumentHandlerTests.cs` — happy path sets `RulesDocumentUrl` + returns result,
  replaces/deletes previous document, team-not-found throws `DomainException`. Mirrors
  `UploadScenarioMediaHandlerTests.cs` (Postgres fixture, `Mock<IStorageService>`).
- `GetTeamRulesDocumentHandlerTests.cs` — returns content when present, returns null when absent,
  throws `DomainException` when team missing. Mirrors `GetTeamCalendarHandlerTests.cs`.
- Membership/permission enforcement itself is exercised by the existing generic
  `TeamMembershipBehavior`/`FeaturePermissionBehavior` (already covered by
  `FeaturePermissionBehaviorTests.cs`) — not re-tested per-feature, consistent with how
  `GetTeamCalendar`/`ConfirmAttendance` handle it.

## 7. Verification

- `dotnet build` — must pass.
- `dotnet test` — full suite green, no skipped tests.
- Mark tasks.md §1–3 checkboxes done; leave §4–8 for mobile-specialist / follow-up.

---

# Implement — Mobile (mobile-team-rules-document)

Mobile-only script (tasks.md §4–7), executed directly by mobile-specialist, TDD (Red → Green →
Refactor). Backend contract above is treated as given/fixed input; mocked in all Mobile tests
since backend work ran in parallel.

## 1. Dependencies (task 4)

- Installed via `npx expo install expo-document-picker react-native-webview
  expo-file-system` (resolves SDK-54-compatible versions automatically):
  `expo-document-picker@~14.0.8`, `react-native-webview@13.15.0`, `expo-file-system@~19.0.23`.
  No `app.json` config plugin entries required for basic (non-native-config) usage of any of the
  three.
- Confirmed installed Expo is `54.0.36` (not v57 — `Mobile/AGENTS.md`'s "check the exact version"
  instruction applies; the docs URL in design.md was a placeholder). Verified the exact API
  surface directly against the packages' own `.d.ts` files under `node_modules` rather than the
  website (offline-safe, same source of truth):
  - `expo-file-system@19.0.23` ships the **new class-based `File`/`Paths` API** as the package's
    default export in SDK 54 (legacy `writeAsStringAsync`/`downloadAsync`-with-headers API lives
    under `expo-file-system/legacy` and was **not** used). Chosen surface: `new File(Paths.cache,
    fileName)`, `.exists`, `.create()`, `.write(Uint8Array)`, `.delete()`, `.uri` — resolves
    design.md's Decision 5 open question in favor of the new API since it's the SDK's current
    default and needs no extra headers plumbing (the shared Axios instance already attaches the
    Bearer token via its request interceptor).
  - `expo-document-picker@14.0.8`'s `getDocumentAsync({ type })` resolves
    `{ canceled: boolean, assets: [{ uri, name, size, mimeType }] | null }` — matches design.md
    Decision 7 exactly (`asset.mimeType`, `asset.size` used for client-side validation).
  - `react-native-webview@13.15.0`'s actual Android local-`file://` PDF rendering behavior was
    **not** verified on a device/emulator in this session (no such environment available) — flagged
    in tasks.md 8.5 as a manual QA follow-up, per design.md's documented risk/mitigation.
- Added `expo-document-picker`, `expo-file-system`, and `react-native-webview` to
  `transformIgnorePatterns` in `Mobile/jest.config.js` (all three ship ESM builds under
  `node_modules` that Jest's default transform ignores otherwise, causing
  `SyntaxError: Cannot use import statement outside a module`).
- Added `Mobile/__mocks__/react-native-webview.js` (a Jest manual mock, auto-applied to every test
  file that transitively imports `react-native-webview` without needing an explicit `jest.mock()`
  call) — needed because `react-native-webview`'s real module eagerly resolves the native
  `RNCWebViewModule` at import time via `TurboModuleRegistry.getEnforcing`, which crashes under
  Jest (no native binary). This was required for every existing navigation test
  (`CalendarTabs.test.tsx`, `NewsTabStack.test.tsx`, etc.) that imports `RootNavigator`, which now
  transitively imports `TeamRulesScreen` → `react-native-webview`.

## 2. API client (task 5)

- `Mobile/src/api/__tests__/teamRulesDocument.test.ts` written first (Red): mocks `../client`'s
  `api.get`/`api.post` and `expo-file-system`'s `File`/`Paths`; covers 204→`null`, 200→bytes
  written to a cache file, error propagation for both GET and POST.
- `Mobile/src/api/teamRulesDocument.ts` (Green): `getTeamRulesDocument(teamId)` GETs
  `/api/mobile/teams/{teamId}/rules-document` with `responseType: 'arraybuffer'` and
  `validateStatus` accepting both 200/204, writes the response bytes to
  `new File(Paths.cache, 'team-rules-{teamId}.pdf')` (deleting any stale cached copy first),
  returns `{ localUri: file.uri }` or `null`. `uploadTeamRulesDocument(teamId, fileUri, fileName)`
  POSTs multipart `FormData` (`type: 'application/pdf'`) to the same route, mirroring
  `uploadNewsImage`'s shape in `news.ts`.

## 3. TeamRulesScreen (task 6)

- `Mobile/src/screens/__tests__/TeamRulesScreen.test.tsx` written first (Red): mocks
  `useRoute`/`useAuth`/`teamRulesDocument` api module/`expo-document-picker`/
  `react-native-webview`/`ScreenHeader`; 13 cases covering loading, empty state (with/without
  upload button per role), PDF-present state (with/without replace button per role), fetch-error
  with and without backend `detail`, client-side non-PDF rejection, client-side >20MB rejection,
  successful upload + refetch, and cancel-picker no-op.
- `Mobile/src/screens/TeamRulesScreen.tsx` (Green): standard `loading/error/data` pattern
  (`useState` + `useEffect` → `fetchDocument`, `catch` → `e.response?.data?.detail || 'No se pudo
  cargar el documento'`), `COACH_ADMIN_ROLES = ['coach', 'administrator']` role gate (same pattern
  as `NewsScreen.tsx`), `WebView` from `react-native-webview` (`source={{ uri: localUri }}`) for
  the PDF-present state, `DocumentPicker.getDocumentAsync({ type: 'application/pdf' })` → reject
  non-`application/pdf` (`'El archivo debe ser un PDF'`) or `size > 20 * 1024 * 1024`
  (`'El archivo no puede superar los 20 MB'`) before any network call → `uploadTeamRulesDocument`
  → `fetchDocument()` refetch on success.

## 4. Navigation (task 7)

- `Mobile/src/screens/TeamMenuScreen.tsx`: added the fourth `MenuItemConfig` (`label: 'Normas del
  equipo'`, `icon: 'document-text-outline'`, `target: 'RulesTab'`, `testID: 'menu-rules'`) —
  existing `PlayersTab`/`InjuriesTab`/`SanctionsTab` entries and route `name`s untouched.
- `Mobile/src/navigation/RootNavigator.tsx`: added `<TeamStack.Screen name="RulesTab"
  component={TeamRulesScreen} initialParams={{ teamId }} />` as the fourth screen in
  `TeamTabStack`, after `SanctionsTab`.
- Updated `Mobile/src/screens/__tests__/TeamMenuScreen.test.tsx` (4-item assertion + new
  navigation test for `RulesTab`) and `Mobile/src/navigation/__tests__/TeamTabStack.test.tsx`
  (route order + `initialParams` forwarding for `RulesTab`), following the exact pattern already
  used for `InjuriesTab`/`SanctionsTab` in both files.

## 5. Verification

- `npm test` in `Mobile/` — **426/426 passed, 47 suites, 0 skipped** (includes all
  pre-existing suites, unaffected).
- `openspec validate mobile-team-rules-document --strict` — no errors.
- Confirmed no changes under `Front/`.
- Deviations from design.md: none material — Decision 5's two `expo-file-system` alternatives
  resolved in favor of the new `File`/`Paths` class API (see §1 above), which design.md left as an
  open, implementation-time choice rather than a fixed decision.

---

# Implement — Bug fix follow-up: Android blank-PDF fix (bundled PDF.js viewer)

Executed by mobile-specialist, TDD (Red → Green → Refactor). Confirmed root cause: Android's
`WebView` has no built-in PDF renderer (unlike iOS's WKWebView), so `source={{ uri: 'file://…pdf' }}`
renders blank — a materially different bug from the earlier `ERR_ACCESS_DENIED`/`originWhitelist`
fix (that one blocked *navigation*; this one is about rendering capability once navigation is
already allowed). `react-native-pdf` (needs `expo-dev-client`) and Google Docs Viewer (needs a
public URL) were re-confirmed as ruled out per the user's constraints (Expo Go, offline).

## 1. Extract PDF.js as bundled JS string constants

- `npm install --no-save pdfjs-dist@2.16.105` (last version with a classic UMD build —
  `build/pdf.min.js` / `build/pdf.worker.min.js`, global `pdfjsLib`; v3+ only ships ES modules,
  which Chromium blocks as `type="module"` scripts from `file://` origins). Verified **not**
  saved to `Mobile/package.json`/`package-lock.json`.
- `Mobile/scripts/generatePdfjsAssets.js` (new, checked in): reads those two build files and
  writes `Mobile/src/pdfViewer/pdfjsAssets.generated.ts` (`PDFJS_MIN_JS`, `PDFJS_WORKER_MIN_JS`
  string constants, `JSON.stringify`-escaped, ~1.32 MB total). Ran once via `node
  scripts/generatePdfjsAssets.js`; regenerate the same way if `pdfjs-dist` needs a version bump.
  Removed `node_modules/pdfjs-dist` afterward (`npm install` to resync) since it's not a runtime
  dependency.

## 2. Viewer HTML + orchestration

- `Mobile/src/pdfViewer/viewerHtmlTemplate.ts` (new): exports `PDF_VIEWER_HTML`, a minimal static
  page that loads `pdf.min.js`/`pdf.worker.min.js` via relative `<script src>`, reads the PDF's
  `file://` URI from `?file=`, and renders all pages as stacked `<canvas>` elements via
  `pdfjsLib.getDocument(...)`.
- `Mobile/src/pdfViewer/preparePdfViewer.ts` (new, TDD Red→Green via
  `Mobile/src/pdfViewer/__tests__/preparePdfViewer.test.ts`, 4 tests): `preparePdfViewerAssets
  (pdfFileUri): Promise<string>` writes `pdf.min.js`/`pdf.worker.min.js` once (cached, only
  written if missing) and `viewer.html` (always rewritten) into
  `Paths.cache/pdfjs-viewer/` using the same `File`/`Directory` `expo-file-system` primitives
  already used by `teamRulesDocument.ts`; returns
  `file:///…/pdfjs-viewer/viewer.html?file=<encodeURIComponent(pdfFileUri)>`.

## 3. Screen wiring

- `Mobile/src/screens/TeamRulesScreen.tsx`: added `viewerUri` state; `fetchDocument` now calls
  `preparePdfViewerAssets(result.localUri)` right after a successful `getTeamRulesDocument`, and
  the `WebView`'s `source` is `{ uri: viewerUri }` instead of `{ uri: localUri }`. Failures during
  asset preparation flow through the existing `try/catch`/`error` state unchanged.
- `Mobile/src/screens/__tests__/TeamRulesScreen.test.tsx`: added
  `jest.mock('../../pdfViewer/preparePdfViewer')` with a default resolved implementation in
  `beforeEach`; added 2 new tests — WebView is pointed at the prepared viewer URL (not the raw
  PDF), and a preparation failure surfaces the existing fetch-error UI/message.

## 4. Verification

- `npm test` in `Mobile/` — **48 suites / 433 tests passed, 0 skipped** (was 47/426 before this
  fix; +1 new suite `preparePdfViewer.test.ts` with 4 tests, +2 new tests in
  `TeamRulesScreen.test.tsx`).
- `openspec/changes/mobile-team-rules-document/design.md` updated with a "Deviation" section
  documenting this change vs. the original Decision 6.
- No changes under `Front/` or `Back/`.
- Not committed/pushed per this session's instructions.

## 5. Third pass — zoom/legibility bug (device testing)

Real-device testing surfaced a second bug: the PDF rendered but was tiny and pinch-to-zoom did
nothing.

- Root cause 1: the `<meta name="viewport">` in `viewerHtmlTemplate.ts` had
  `maximum-scale=1.0, user-scalable=no`, which explicitly blocks the WebView's native pinch-zoom
  over the HTML content. Changed to
  `minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes`.
- Root cause 2: each page's PDF.js canvas rendered at a fixed scale (`1.5`/`1.2` based only on
  `devicePixelRatio > 1`), unrelated to the actual WebView viewport width — so on most phones the
  page rendered far too small relative to the screen, and `canvas { max-width: 100% }` then
  shrank/blurred it further instead of showing native-resolution text.
- Fix: added `Mobile/src/pdfViewer/pdfScale.ts` (new, TDD Red→Green via
  `Mobile/src/pdfViewer/__tests__/pdfScale.test.ts`, 7 tests) exporting two pure functions:
  - `computeRenderScale(viewportWidth, pageWidthAtScale1, devicePixelRatio)` — fit-to-width scale
    (viewport width ÷ native page width) multiplied by `devicePixelRatio`, so the canvas *backing
    buffer* renders at native pixel density (sharp text under pinch-zoom).
  - `computeDisplaySize(renderedWidth, renderedHeight, devicePixelRatio)` — divides the rendered
    (backing-buffer) size back down by `devicePixelRatio` to get the CSS display size, so the
    page still visually fits the screen width by default ("render big, display small via CSS").
  - Both fall back to a safe `devicePixelRatio` (≥0 else 1) when width/ratio inputs are 0/unknown.
- `viewerHtmlTemplate.ts`'s inline `<script>` re-implements the same two functions verbatim (it
  runs as a plain string inside the WebView, not through a bundler, so it can't `import` from
  `pdfScale.ts` — a comment in both files calls out to keep them in sync). Per page: reads
  `document.documentElement.clientWidth` and `page.getViewport({ scale: 1 }).width`, computes
  `renderScale` via the formula above, renders the canvas backing buffer at that scale, then sets
  `canvas.style.width`/`height` via `computeDisplaySize` so the on-screen size stays fit-to-width.
  Removed `canvas { max-width: 100% }` from the CSS since the display size is now computed in JS,
  and letting it exceed the container is required for pinch-zoom to have somewhere to expand into.
- Checked `react-native-webview@13.15.0` (`WebViewTypes.d.ts`): `scalesPageToFit` (Android-only)
  defaults to `true` already, so no prop change was needed in `TeamRulesScreen.tsx`; no other prop
  on that `WebView` (`originWhitelist`, `allowFileAccess`, `allowUniversalAccessFromFileURLs`)
  disables zoom.
- `npm test` — **49 suites / 440 tests passed** (was 48/433; +1 new suite `pdfScale.test.ts` with
  7 tests, no existing tests touched).

## Manual verification still needed (cannot be confirmed by Jest)

`react-native-webview` runs a real native Android/iOS WebView — Jest/RNTL only exercises the pure
JS logic (`preparePdfViewerAssets`'s file-writing decisions, the screen's state wiring), never the
actual rendering engine. To confirm the fix works end-to-end, run manually on an Android
device/emulator (`npm start` → open in Expo Go on Android):

1. As Coach/Admin, upload a real multi-page PDF (a few MB) as the team's rules document.
2. Reopen "Normas del equipo" as any role (Coach and a Player/FamilyMember account) and confirm the
   PDF renders (not blank) with all pages visible via vertical scroll.
3. Kill the app, relaunch with the device in airplane mode, and confirm the previously-viewed
   document still renders from cache (offline path).
4. Try a near-20 MB PDF to sanity-check rendering performance/memory on a real device is
   acceptable (not just in the 1-2 page test case).
5. If step 2 still shows blank/broken on some Android WebView version, capture the WebView's
   console output — the `WebView` component does not currently wire `onError`/`injectedJavaScript`
   console forwarding; add `onMessage`/`console.log`→`window.ReactNativeWebView.postMessage`
   bridging temporarily if deeper debugging is needed.
6. Confirm the PDF now renders at a legible default size (fits screen width, not tiny) on both
   Android and iOS.
7. Confirm pinch-to-zoom works smoothly on both platforms and that zoomed-in text stays sharp
   (not pixelated) — this validates the native-resolution backing-buffer approach in practice,
   not just the formula in `pdfScale.test.ts`.
8. Confirm zooming/panning doesn't fight with the screen's own scroll (the WebView should own
   pinch/zoom gestures over the PDF content without the outer screen intercepting them).
