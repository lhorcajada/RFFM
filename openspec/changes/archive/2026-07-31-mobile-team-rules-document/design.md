## Context

Mobile's Equipo area (`TeamMenuScreen` → `TeamTabStack` in `RootNavigator.tsx`) currently offers
"Plantilla" (`PlayersTab`), "Lesiones" (`InjuriesTab`) and "Sanciones" (`SanctionsTab`) — all
read-only, all fed by existing `Back/` endpoints. There is no concept of a team-level document
today: `Team` (`Domain/Aggregates/UserClubs/Team.cs`) only has `UrlPhoto` as a nullable storage
reference, updated via the trivial intention method `UpdateUrlPhoto(string? urlPhoto)`. Mobile has
no file picker or PDF-viewing capability yet — `expo-image-picker` is the only picker library, used
only for images.

This is a genuinely cross-stack change: the backend contract (migration + vertical slice) was
already designed by `back-specialist` and is treated as fixed input here, not renegotiated. This
document also covers the Mobile-side design (screen, navigation, upload flow, PDF viewer) which is
new decision-making territory for this change.

## Goals / Non-Goals

**Goals:**
- Every team member can open "Normas del equipo" from the Equipo menu and read the team's rules PDF
  in-app, or see "Aún no disponible" if none has been uploaded.
- Coach/Admin can pick a PDF from the device and upload/replace it from the same screen.
- Enforce PDF-only, ≤20 MB both client-side (fast feedback) and server-side (source of truth).
- Follow existing Mobile conventions exactly: single Axios instance, `useAuth()` for token/roles,
  stable `Screen`/route `name`s, `coachColors` theme tokens, data-loading pattern
  (`loading/error/data` + `e.response?.data?.detail` fallback).
- Follow existing backend conventions: vertical slice under `Features/Mobile/Teams/`,
  `IRequireFeaturePermission` + `IRequireTeamMembership` on the command/query, FluentValidation for
  content-type/size, no manual `SaveChangesAsync`.

**Non-Goals:**
- No document history/versioning — upload always replaces the previous file (single `RulesDocumentUrl`
  column, old blob orphaned/deleted per `IStorageService` behavior used by `UploadTeamPhoto`).
- No per-role visibility rules on the PDF itself — if it exists, every role can read it.
- No changes to `Front/` (SPA) — explicitly excluded by the user.
- No offline caching/sync strategy beyond the transient local file used to render the PDF.

## Decisions

### 1. Backend contract (given, not redesigned here)
- Migration `AddRulesDocumentUrlToTeam`: nullable `RulesDocumentUrl` (text) column on `Team`
  (`app` schema), following the exact shape of `20260502141302_AddTeamJoinCode.cs` but nullable with
  no default. Domain: `public string? RulesDocumentUrl { get; set; }` +
  `UpdateRulesDocumentUrl(string? url) => RulesDocumentUrl = url;`, mirroring `UrlPhoto`/
  `UpdateUrlPhoto` exactly (same mutable-setter style, for consistency with that specific property
  rather than the private-set convention used elsewhere on `Team`).
- New file `Features/Mobile/Teams/UploadTeamRulesDocument.cs` (command) and
  `Features/Mobile/Teams/GetTeamRulesDocument.cs` (query), placed under `Features/Mobile/Teams/`
  (new folder) rather than `Features/Coaches/Teams/` because the routes are `api/mobile/...` and
  must be reachable by all team roles for the `GET`, matching the `Features/Mobile/Competitions/`
  precedent (`record` types implementing `IRequireFeaturePermission`/`IRequireTeamMembership`
  directly, `TeamId` route param satisfies `IRequireTeamMembership.TeamId`).
- `UploadTeamRulesDocumentCommand : IRequest<UploadTeamRulesDocumentResult>, IRequireFeaturePermission, IRequireTeamMembership`
  — `RequiredPermission => "ReadWrite"`, scoped to Coach/Admin via the existing feature-route
  permission table (same mechanism as `UploadTeamPhotoCommand`). Validator (`AbstractValidator<...>`)
  rejects non-`application/pdf` content type and files >20 MB (20 * 1024 * 1024 bytes), mirroring
  `UploadTeamPhoto`'s validator shape (content-type whitelist, non-empty file).
- `GetTeamRulesDocumentQuery : IQueryApp<...>, IRequireTeamMembership` (no
  `IRequireFeaturePermission` — every team member, including Player/FamilyMember, can read).
  Handler: `204 NoContent` when `RulesDocumentUrl` is null, `Results.File(bytes, "application/pdf")`
  when present, `404` only if the team itself doesn't exist (distinct domain-not-found path,
  mirrors `GetTeamPhoto`'s `NotFound()` branch but keyed off team existence, not document
  existence).
- Storage: same `IStorageService.UploadAsync`/`DownloadAsync` pair already used by
  `UploadTeamPhoto`/`GetTeamPhoto`, new bucket/prefix convention `team-rules-documents/{teamId}` (or
  reuse the existing team-photo bucket with a distinct key — finalized during implementation,
  not a spec-level decision).

### 2. Mobile screen placement: new tab inside `TeamTabStack`, not a new bottom tab
Add a fourth `TeamStack.Screen` (`RulesTab`, component `TeamRulesScreen`) to `TeamTabStack` in
`RootNavigator.tsx`, and a fourth `MenuItemConfig` entry in `TeamMenuScreen.tsx` (icon
`document-text-outline`, label "Normas del equipo", target `RulesTab`), exactly matching how
`InjuriesTab`/`SanctionsTab` were added. **Alternative considered**: a new top-level bottom tab —
rejected because the acceptance criteria explicitly places this "junto a Plantilla, Lesiones,
Sanciones", which live inside the Equipo menu/stack, not the bottom tab bar.

### 3. New Mobile API client: `Mobile/src/api/teamRulesDocument.ts`
Two functions, mirroring `uploadNewsImage`'s `FormData` pattern and `team.ts`'s typed-function
style (no class wrapper):
- `getTeamRulesDocument(teamId): Promise<{ localUri: string } | null>` — GETs
  `/api/mobile/teams/{teamId}/rules-document` with `responseType: 'arraybuffer'`, returns `null` on
  `204`, otherwise writes the bytes to a cache file (see Decision 5) and returns its local URI.
- `uploadTeamRulesDocument(teamId, fileUri, fileName): Promise<{ url: string; uploadedAt: string }>`
  — POSTs multipart `FormData` with `type: 'application/pdf'` to
  `/api/mobile/teams/{teamId}/rules-document`, same shape as `uploadNewsImage`.

### 4. New screen: `Mobile/src/screens/TeamRulesScreen.tsx`
Standard data-loading pattern (`loading/error/data` state, `useEffect` → `fetchRulesDocument`,
`catch` → `e.response?.data?.detail || 'No se pudo cargar el documento'`). Renders:
- Loading: `ActivityIndicator`.
- No document (`data === null`): centered text "Aún no disponible" (+ upload button if
  Coach/Admin, same `COACH_ADMIN_ROLES` role check already used in `NewsScreen.tsx`/
  `NewsDetailScreen.tsx`).
- Document present: PDF viewer (Decision 6) + a "Reemplazar documento" button for Coach/Admin only.
- Upload flow: `expo-document-picker`'s `getDocumentAsync({ type: 'application/pdf' })` → client-side
  size check (reject >20 MB with a Spanish error before calling the API, to fail fast) → 
  `uploadTeamRulesDocument` → refetch/replace local state on success.

### 5. Authenticated PDF download via `expo-file-system`, not a bare URL
The `GET` endpoint requires a Bearer token (`IRequireTeamMembership`), so the PDF cannot be opened
by simply pointing a viewer at the raw URL (no way to attach auth headers to a passive `uri` load).
Decision: fetch the PDF through the existing authenticated Axios instance
(`responseType: 'arraybuffer'`), then persist the bytes to `FileSystem.cacheDirectory` (exact API —
`writeAsStringAsync` w/ base64 vs. the newer `File` API — to be confirmed against
`https://docs.expo.dev/versions/v57.0.0/` for the installed Expo SDK version at implementation time,
per `Mobile/AGENTS.md`/`.claude/rules/react-native.md` §0). The resulting local `file://` URI is what
gets handed to the viewer. **Alternative considered**: `expo-file-system`'s `downloadAsync(url, dest, { headers })`
which supports auth headers directly and would avoid buffering the whole file in JS memory — likely
the better implementation choice given a 20 MB ceiling, left as an implementation-time decision
between the two `expo-file-system` approaches; both satisfy the same design contract (a local
`file://` URI feeding the viewer).

### 6. PDF viewer: `react-native-webview` pointed at the local cached file
Chosen over alternatives:
- **`expo-web-browser` (`openBrowserAsync`)** — simplest (no extra native surface), but only accepts
  a URL, so it cannot carry the Bearer token, and it opens an OS-level browser sheet rather than an
  in-app view — a materially different UX from "leer el PDF dentro de la app".
- **`react-native-pdf` (+ `react-native-blob-util` peer)** — purpose-built PDF renderer with
  reliable rendering and page navigation on both platforms, but adds two native dependencies with
  more linking/config surface for a first version of this feature.
- **`react-native-webview`** (chosen) — a single, Expo-supported, widely used dependency (already
  the de-facto standard companion to `expo-file-system`-downloaded files in the Expo ecosystem);
  `source={{ uri: localFileUri }}` renders PDFs reliably on iOS (WKWebView has native PDF support)
  and on modern Android WebView/Chromium (also renders local PDFs via `file://` without extra
  plugins in current Expo SDK versions — to be verified against the versioned docs at
  implementation time, since this is exactly the kind of Expo-version-sensitive behavior
  `Mobile/AGENTS.md` warns about). If Android rendering proves unreliable during implementation, the
  fallback is `expo-sharing`'s `shareAsync` ("abrir con...") as a last resort, kept out of the tasks
  list unless it's actually needed.

All three of `expo-document-picker`, `react-native-webview`, and `expo-file-system` are **new
dependencies** and must be approved by the user before `npm install` runs (per this agent's scope —
no code/deps are installed as part of this proposal/design/tasks step).

### 7. Client-side size/type validation before upload
`expo-document-picker`'s result exposes `size` and `mimeType` — reject immediately (Spanish error,
no network call) if `mimeType !== 'application/pdf'` or `size > 20 * 1024 * 1024`, then rely on the
backend validator as the authoritative check (never trust client-side validation alone).

## Risks / Trade-offs

- **[Risk] Android PDF rendering inside `WebView` from a local `file://` URI is version-sensitive**
  → **Mitigation**: verify against `https://docs.expo.dev/versions/v57.0.0/` (or whatever the
  installed Expo SDK docs are) during implementation before writing the screen; keep
  `expo-sharing`-based fallback as a documented escape hatch, not built speculatively.
- **[Risk] Buffering a 20 MB file through JS (`arraybuffer` Axios response) on low-end devices** →
  **Mitigation**: prefer `expo-file-system`'s `downloadAsync` with an `Authorization` header over
  manual Axios + base64 write, decided at implementation time (Decision 5).
- **[Risk] Three new native/Expo dependencies in one change** → **Mitigation**: all three are
  mainstream, actively maintained, Expo-config-plugin-free for basic usage; flagged explicitly in
  proposal.md for user approval before install, not snuck in silently.
- **[Risk] Backend contract already fixed by `back-specialist` before this design** → **Mitigation**:
  treated as given input, not re-derived; any backend deviation found during implementation must be
  raised with `back-specialist`, not silently changed here.

## Open Questions

- Exact `expo-file-system` API surface to use (`writeAsStringAsync`/base64 vs. `downloadAsync` with
  headers vs. the newer `File`/`Paths` API) — deferred to implementation time, to be confirmed
  against the installed Expo SDK's versioned docs.
- Storage bucket/prefix convention for the rules document (new bucket vs. reusing the team-photo
  bucket with a distinct key) — deferred to backend implementation, not a spec-level concern.

## Deviation (post-implementation bug fix): Decision 6 revised — bundled PDF.js viewer

**Confirmed after implementation**: pointing `WebView`'s `source={{ uri: localFileUri }}` at a
`file://…pdf` URI renders a **blank page on Android**. Unlike iOS's WKWebView (which has a native
PDF renderer), Android's WebView (Chromium-based `android.webkit.WebView`) has **no built-in PDF
viewer** — this is independent of the `originWhitelist`/`ERR_ACCESS_DENIED` fix that was already
applied; that fix only unblocked the file:// *navigation*, it did not add PDF rendering capability.

Ruled out again at fix time, same constraints as Decision 6 plus one new one:
- `react-native-pdf` — still rejected: requires `expo-dev-client`, and the project is on Expo Go
  with no `eas.json`/dev client configured (hard constraint, not just a preference).
- Google Docs Viewer (`https://docs.google.com/viewer?url=…`) — rejected: requires a **public**
  URL; the rules document is only reachable through an authenticated endpoint, and the whole
  point of caching it locally is to render it **offline** once downloaded.

**Chosen fix**: bundle Mozilla's PDF.js (the same rendering engine every desktop browser's native
PDF viewer uses) inside the app and load it as a small local HTML/JS app inside the `WebView`,
pointed at the already-cached local PDF file.

- `pdfjs-dist@2.16.105` (last version publishing a classic, non-ES-module UMD build —
  `build/pdf.min.js` + `build/pdf.worker.min.js`, exposing a global `pdfjsLib`) was installed
  **transiently** (`--no-save`) purely to extract those two build files; it is **not** a runtime
  dependency of the app and does not appear in `package.json`/`package-lock.json`. Versions ≥3
  only ship `.mjs` (ES module) builds — `type="module"` scripts are blocked by Chromium's CORS
  policy when the document is loaded from a `file://` origin, which would break exactly this use
  case, hence the pin to the last UMD release.
- `Mobile/scripts/generatePdfjsAssets.js` (checked in, run once with `node
  scripts/generatePdfjsAssets.js` after a local `npm install --no-save pdfjs-dist@2.16.105`)
  reads those two build files and writes them as `JSON.stringify`-escaped string constants into
  `Mobile/src/pdfViewer/pdfjsAssets.generated.ts`. This sidesteps needing any `metro.config.js`
  `resolver.assetExts` change or an `expo-asset`/`Asset.fromModule` download step — the ~1.3 MB of
  PDF.js source is just plain JS string literals as far as Metro is concerned, so it bundles
  identically to any other TypeScript module and works unmodified in Expo Go.
- `Mobile/src/pdfViewer/viewerHtmlTemplate.ts` exports a small static HTML shell
  (`PDF_VIEWER_HTML`) that loads `pdf.min.js`/`pdf.worker.min.js` via relative `<script src="...">`
  tags, reads the PDF's `file://` URI from a `?file=` query param, and renders every page onto a
  stacked, scrollable `<canvas>` list via `pdfjsLib.getDocument(...).promise`.
- `Mobile/src/pdfViewer/preparePdfViewer.ts` (`preparePdfViewerAssets(pdfFileUri): Promise<string>`)
  writes `pdf.min.js`/`pdf.worker.min.js`/`viewer.html` into
  `Paths.cache/pdfjs-viewer/` (the two JS files only once, cached across calls; `viewer.html`
  rewritten every call since it's tiny and must reflect the current template) using the same
  `File`/`Directory` (`expo-file-system` new class-based API, SDK 54) primitives already used in
  `teamRulesDocument.ts`, then returns
  `file:///…/pdfjs-viewer/viewer.html?file=<encoded pdfFileUri>`. Writing everything to the **same
  directory** (rather than embedding PDF.js or the PDF itself as base64 inside one giant HTML
  string passed via `source={{ html }}`) avoids a known Android WebView pitfall where very large
  `loadDataWithBaseURL` payloads can silently fail due to IPC/transaction size limits; loading a
  small `viewer.html` by `file://` URI keeps only a tiny payload crossing the RN↔native bridge,
  with the big JS/PDF payloads fetched directly by the WebView's own engine as sub-resources.
- `TeamRulesScreen.tsx` calls `preparePdfViewerAssets(result.localUri)` right after
  `getTeamRulesDocument` resolves with a cached file, and points the `WebView` at the resulting
  viewer URL (`source={{ uri: viewerUri }}`) instead of the raw cached PDF URI. Failures during
  asset preparation (e.g. disk I/O errors) are caught by the existing `try/catch` in
  `fetchDocument` and surfaced through the same `error` state/fallback message as any other fetch
  failure.
- Offline behavior is preserved: once `pdf.min.js`/`pdf.worker.min.js`/`viewer.html` exist in cache
  and the PDF itself is cached (`teamRulesDocument.ts`'s existing behavior, unchanged), the entire
  render path is local `file://` I/O — no network access needed to view an already-downloaded
  document.
- `allowFileAccess`/`allowFileAccessFromFileURLs`/`allowUniversalAccessFromFileURLs` on the
  `WebView` (already present from the earlier `ERR_ACCESS_DENIED` fix) remain required: they allow
  the `viewer.html` document (`file://` origin) to load its sibling `pdf.min.js`/
  `pdf.worker.min.js` and to `fetch()`/XHR the PDF file, which may live in a different cache
  subdirectory.
- iOS is unaffected by this change in practice (WKWebView already renders `file://…pdf` natively),
  but since the same `TeamRulesScreen` code path now always routes through the PDF.js viewer on
  both platforms, iOS also renders through PDF.js — acceptable since PDF.js is the same engine
  Firefox and Chrome desktop use for their native PDF viewers, and it keeps one code path instead
  of branching by `Platform.OS`.

**Not verified in this session** (no Android device/emulator available): actual on-device
rendering, scroll behavior, and performance for a realistic (multi-page, near-20 MB) PDF. See
`tasks.md` §8.5/8.6 for the manual QA follow-up.
