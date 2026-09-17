# Implement: player-document-authorizations-frontend

Self-contained technical script for the `openspec-implementer` subagent. Read `proposal.md`,
`design.md`, `specs/player-document-authorizations-ui/spec.md` and `tasks.md` in this change
directory first — this script expands `tasks.md` into exact file contents/diffs so you should not
need to re-derive decisions, but the referenced docs are the source of truth if anything here is
ambiguous.

**Mandatory methodology: TDD Red → Green → Refactor for every unit below.** For each file pair
(test + implementation): write the test first, run it and confirm it fails for the right reason
(Red), write the minimal implementation to pass (Green), then refactor only if needed while
keeping tests green. Do not write implementation code before its test exists and has been run
red. Target ≥75% coverage on every new/modified file. No `it.skip`/`xit`. No `any` anywhere.

Backend contract is **frozen and resolved** (do not re-derive): six endpoints under
`/api/catalog/...`, documented in `openspec/changes/player-document-authorizations/design.md`
"API Contract" section, with these three corrections already folded into this frontend design:
- `GET /api/catalog/team/{teamId}/documents` and `GET /api/catalog/team/{teamId}/documents/report`
  take **only** `documentTypeId` as a query param — **no `seasonId`** (Team is already
  season-scoped).
- `GET /api/users/me/profile` now returns `teamPlayerId: string | null` in addition to existing
  `playerId`/`teamId`.
- Backend has seeded `FeaturePermission` rows for `CoachFeatureRoutes.MyDocuments =
  "/coach/my-documents"` (ReadWrite: `Player`, `FamilyMember`) and `CoachFeatureRoutes.PlayerDocuments
  = "/coach/player-documents"` (ReadWrite: `Coach`, `ClubDirector`).

All work is under `Front/src/apps/coach/` and `Front/src/shared/components/ui/`. Do not touch
`Back/ExtractionApi/`.

---

## 1. Service layer

### 1.1 Extend `MyProfile` (`Front/src/apps/coach/services/coachApi.ts`)

Red: add to `Front/src/apps/coach/services/__tests__/coachApi.test.ts` (create this test file if it
doesn't exist yet — check first) a test asserting `getMyProfile()` returns a `teamPlayerId` field
straight from the mocked Axios response (mock `client.get` to resolve
`{ data: { roleName: "Player", playerId: "p1", teamId: "t1", teamPlayerId: "tp1" } }`, assert the
returned object's `teamPlayerId === "tp1"`). Run it, confirm it fails only because the type doesn't
have the field yet (TypeScript compile or runtime — either is fine for this trivial addition).

Green: in `coachApi.ts`, change:
```ts
export interface MyProfile {
  roleName: string;
  playerId?: string | null;
  teamId?: string | null;
}
```
to:
```ts
export interface MyProfile {
  roleName: string;
  playerId?: string | null;
  teamId?: string | null;
  teamPlayerId?: string | null;
}
```
No other change needed — `getMyProfile()` already returns `resp.data` as-is.

### 1.2 New file `Front/src/apps/coach/services/playerDocumentService.ts`

Red: create `Front/src/apps/coach/services/__tests__/playerDocumentService.test.ts`. Mock
`../../../core/api/client` (relative from the `__tests__` folder: `../../../../core/api/client`)
the same way other service tests in this repo mock the shared client (check an existing
`services/__tests__/*.test.ts` for the exact `vi.mock` shape before writing this — follow that
file's mocking convention, do not invent a new one). Write one `it` per function below, asserting:
- `getDocumentTypes()` → `client.get("/api/catalog/document-types")`, returns the array.
- `getPlayerDocuments(teamPlayerId)` → `client.get(`/api/catalog/teamplayer/${teamPlayerId}/documents`)`.
- `getTeamDocumentsStatus(teamId, documentTypeId)` → `client.get(`/api/catalog/team/${teamId}/documents`, { params: { documentTypeId } })` — **assert no `seasonId` key is present in the params object**.
- `uploadPlayerDocument(teamPlayerId, documentTypeId, file)` → builds a `FormData` with field name
  `"file"` (assert via `expect(formDataArg.get("file")).toBe(file)` or by spying on
  `FormData.prototype.append`), `POST`s to
  `/api/catalog/teamplayer/${teamPlayerId}/documents/${documentTypeId}`.
- `reviewPlayerDocument(teamPlayerId, documentTypeId, approve, note)` → `client.patch(`/api/catalog/teamplayer/${teamPlayerId}/documents/${documentTypeId}/review`, { approve, note })`.
- `downloadTeamDocumentsReport(teamId, documentTypeId)` → `client.get(`/api/catalog/team/${teamId}/documents/report`, { params: { documentTypeId }, responseType: "blob" })`, returns the `Blob`. **Assert no `seasonId` key.**

Run the suite, confirm every test fails (module doesn't exist yet).

Green: implement `playerDocumentService.ts`:
```ts
import client from "../../../core/api/client";

export type DocumentTypeResponse = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type PlayerDocumentStatus = "Pending" | "Delivered" | "Approved" | "Rejected";

export type PlayerDocumentResponse = {
  documentTypeId: string;
  documentTypeName: string;
  teamPlayerId: string;
  status: PlayerDocumentStatus;
  fileName: string | null;
  url: string | null;
  contentType: string | null;
  uploadedAt: string | null;
  uploadedOnBehalf: boolean | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type TeamPlayerDocumentStatusResponse = {
  teamPlayerId: string;
  playerId: string;
  playerName: string;
  dorsal: number | null;
  status: PlayerDocumentStatus;
  uploadedAt: string | null;
  reviewedAt: string | null;
};

export async function getDocumentTypes(): Promise<DocumentTypeResponse[]> {
  const resp = await client.get<DocumentTypeResponse[]>("/api/catalog/document-types");
  return resp.data ?? [];
}

export async function getPlayerDocuments(teamPlayerId: string): Promise<PlayerDocumentResponse[]> {
  const resp = await client.get<PlayerDocumentResponse[]>(
    `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/documents`
  );
  return resp.data ?? [];
}

export async function getTeamDocumentsStatus(
  teamId: string,
  documentTypeId: string
): Promise<TeamPlayerDocumentStatusResponse[]> {
  const resp = await client.get<TeamPlayerDocumentStatusResponse[]>(
    `/api/catalog/team/${encodeURIComponent(teamId)}/documents`,
    { params: { documentTypeId } }
  );
  return resp.data ?? [];
}

export async function uploadPlayerDocument(
  teamPlayerId: string,
  documentTypeId: string,
  file: File
): Promise<PlayerDocumentResponse> {
  const form = new FormData();
  form.append("file", file, file.name);
  const resp = await client.post<PlayerDocumentResponse>(
    `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/documents/${encodeURIComponent(documentTypeId)}`,
    form
  );
  return resp.data;
}

export async function reviewPlayerDocument(
  teamPlayerId: string,
  documentTypeId: string,
  approve: boolean,
  note: string | null
): Promise<PlayerDocumentResponse> {
  const resp = await client.patch<PlayerDocumentResponse>(
    `/api/catalog/teamplayer/${encodeURIComponent(teamPlayerId)}/documents/${encodeURIComponent(documentTypeId)}/review`,
    { approve, note }
  );
  return resp.data;
}

export async function downloadTeamDocumentsReport(
  teamId: string,
  documentTypeId: string
): Promise<Blob> {
  const resp = await client.get(`/api/catalog/team/${encodeURIComponent(teamId)}/documents/report`, {
    params: { documentTypeId },
    responseType: "blob",
  });
  return resp.data as Blob;
}

export default {
  getDocumentTypes,
  getPlayerDocuments,
  getTeamDocumentsStatus,
  uploadPlayerDocument,
  reviewPlayerDocument,
  downloadTeamDocumentsReport,
};
```
Note: do not set `headers: { "Content-Type": "multipart/form-data" }` manually on the upload call —
check `playerService.ts#uploadPlayerPhoto` and the shared client's request interceptor first; if
Axios/the shared client already handles the boundary header automatically for `FormData` bodies in
this codebase's other multipart calls, follow that exact convention instead of hardcoding it (do
not introduce an `as any` cast to force it through — if a type escape hatch seems necessary, that's
a signal to look at how `uploadPlayerPhoto` or `addPlayerToTeam` actually did it and copy that,
including any accepted deviation).

Run tests, confirm green.

### 1.3 Error-code map

Red: add tests (same test file or a new `__tests__/playerDocumentErrors.test.ts`) for a function
`mapPlayerDocumentError(code: string | undefined): { message: string; severity: "error" | "warning" }`
covering all 7 codes below plus an `undefined`/unknown-code fallback
(`{ message: "Ha ocurrido un error. Inténtalo de nuevo.", severity: "error" }`).

Green: implement `mapPlayerDocumentError` (co-located in `playerDocumentService.ts` or a new
`playerDocumentErrors.ts` in the same `services/` folder — implementer's choice, keep it simple)
with this exact table:

| Code | Spanish message | severity |
|---|---|---|
| `DocumentTypeNotFound` | "El tipo de documento no existe." | error |
| `TeamPlayerNotFound` | "No se encontró al jugador." | error |
| `PlayerDocumentAccessForbidden` | "No tienes permiso para acceder a este documento." | error |
| `PlayerDocumentInvalidFile` | "Archivo no válido. Debe ser un PDF, JPG o PNG." | warning |
| `PlayerDocumentFileTooLarge` | "El archivo supera el tamaño máximo permitido (10 MB)." | warning |
| `PlayerDocumentNotFound` | "Todavía no se ha entregado ningún documento." | warning |
| `PlayerDocumentNotDelivered` | "Este documento no está pendiente de revisión (puede que se haya vuelto a subir). Actualiza la página." | warning |

Read the error code from `error.response?.data?.code` at the call site (existing convention — see
`FamilyMemberAccountStatus.tsx`, `trainingService.ts` — do not use `extensions.code`).

Run `npm run test -- playerDocumentService` (or the equivalent scoped Vitest invocation used
elsewhere in this repo's test files) and confirm all of section 1 is green before moving on.

---

## 2. Shared status chip: `Front/src/shared/components/ui/PlayerDocumentStatusChip/`

Red: `Front/src/shared/components/ui/PlayerDocumentStatusChip/__tests__/PlayerDocumentStatusChip.test.tsx`.
Render with each of the 4 status values, assert (via `getByText`) the correct Spanish label:
Pending→"Pendiente", Delivered→"Entregado", Approved→"Aprobado", Rejected→"Rechazado". Use
Testing Library, `render()` from `@testing-library/react`.

Green: `PlayerDocumentStatusChip.tsx`:
```tsx
import { Chip } from "@mui/material";
import type { PlayerDocumentStatus } from "../../../../apps/coach/services/playerDocumentService";
import styles from "./PlayerDocumentStatusChip.module.css";

type Props = { status: PlayerDocumentStatus };

const LABELS: Record<PlayerDocumentStatus, string> = {
  Pending: "Pendiente",
  Delivered: "Entregado",
  Approved: "Aprobado",
  Rejected: "Rechazado",
};

const COLORS: Record<PlayerDocumentStatus, "default" | "info" | "success" | "error"> = {
  Pending: "default",
  Delivered: "info",
  Approved: "success",
  Rejected: "error",
};

export default function PlayerDocumentStatusChip({ status }: Props) {
  return (
    <Chip
      label={LABELS[status]}
      color={COLORS[status]}
      size="small"
      className={styles.chip}
    />
  );
}
```
`PlayerDocumentStatusChip.module.css` can be minimal (e.g. `.chip { font-weight: 600; }`) — do not
hardcode new colors, the `color` prop already uses MUI theme palette tones. If importing a type
from `apps/coach/services/...` into `shared/components/ui/...` feels backwards (shared importing
from an app), instead define `PlayerDocumentStatus` as a local literal union in this component and
have `playerDocumentService.ts` import/re-export it from here, OR simply duplicate the 4-value
union type in both places with a comment — pick whichever the existing repo convention favors by
checking how `AvailabilityBadge`/`MetricBadge` (both in `apps/coach/components/`, not `shared/`)
handle similar generic-metric types; if there's no existing "shared component importing an app
type" precedent, keep this component's type definition local and duplicated rather than
cross-importing.

---

## 3. Self-service "Mis documentos" page

Directory: `Front/src/apps/coach/pages/my-documents/`.

### 3.1 `components/MyDocumentCard.tsx`

Red: `pages/my-documents/components/__tests__/MyDocumentCard.test.tsx`. Cases:
- Renders `PlayerDocumentStatusChip` with the doc's status and the doc type name.
- Shows an "upload"/"volver a subir" button when `status` is `Pending` or `Rejected`; hides it
  (or shows disabled) when `Delivered`/`Approved`.
- Shows a "Descargar" link/button when `url` is non-null.
- When `status` is `Approved` or `Rejected` **and** the upload dialog is about to open, shows the
  re-upload notice: "Al subir un nuevo archivo, el documento volverá a estado 'Entregado' y deberá
  revisarse de nuevo." (exact wording from design.md) before the file is actually sent.

Green: props `{ document: PlayerDocumentResponse; onUploaded: () => void }`. Renders a MUI
`Card`/`Paper` (never `Table`). Upload button opens `MyDocumentUploadDialog` (section 3.2). Download
uses `fetchPublicStorageFile` from `Front/src/shared/services/imageService.ts` exactly like
`InjuryProtocolDocuments.tsx`'s `handleDownload` (create an object URL, synthesize an `<a
download>`, click, revoke) — reuse that exact snippet, adjusted for `document.fileName`/`document.url`.

### 3.2 `components/MyDocumentUploadDialog.tsx`

Red: `pages/my-documents/components/__tests__/MyDocumentUploadDialog.test.tsx`. Cases:
- Selecting a file with an unsupported MIME type (not `application/pdf`, `image/jpeg`,
  `image/png`) dispatches `rffm.show_snackbar` with the `PlayerDocumentInvalidFile` message and
  does **not** call `uploadPlayerDocument`.
- Selecting a file over 10MB (`10 * 1024 * 1024` bytes) dispatches `rffm.show_snackbar` with the
  `PlayerDocumentFileTooLarge` message and does not call the service.
- Selecting a valid file calls `uploadPlayerDocument(teamPlayerId, documentTypeId, file)` and, on
  success, calls `onUploaded()` and dispatches a success snackbar.
- On a backend error (mock the service rejecting with `{ response: { data: { code:
  "PlayerDocumentInvalidFile" } } }`), dispatches the mapped Spanish message via snackbar.

Green: plain MUI `Dialog` (NOT `ConfirmDialog` — this isn't a destructive confirmation, per
`react.md` §10.1) with a hidden file `<input type="file">` triggered by a button, same
ref/`onChange` pattern as `InjuryProtocolDocuments.tsx`'s `fileInputRef`/`handleFileSelected`. Client
-side validation constants:
```ts
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
```
Dispatch snackbar via the same `notify(message, severity)` helper pattern as
`InjuryProtocolDocuments.tsx` (`window.dispatchEvent(new CustomEvent("rffm.show_snackbar", {
detail: { message, severity } }))`).

### 3.3 `MyDocuments.tsx` (page)

Red: `pages/my-documents/__tests__/MyDocuments.test.tsx`. Cases:
- Mocks `getMyProfile()` returning `teamPlayerId: null` → asserts a redirect/navigation to
  `/appSelector` with `state: { needsTeamRelink: true }` (use `MemoryRouter` + a spy on
  `useNavigate`, same technique `usePlayerAutoLoad`'s own tests likely already use — check
  `pages/Dashboard/hooks/__tests__/` for that exact assertion style if a test file exists there).
- Mocks `getMyProfile()` returning a valid `teamPlayerId`, `getDocumentTypes()` returning 2 types,
  `getPlayerDocuments(teamPlayerId)` returning matching statuses → asserts 2 `MyDocumentCard`
  renders (or 2 cards' worth of content — status chip text for each).
- Loading state renders a spinner before data resolves.
- Empty state (`getDocumentTypes()` returns `[]`) renders an `EmptyState`
  (`shared/components/ui/EmptyState/EmptyState`) with an appropriate Spanish message.
- A rejected `getPlayerDocuments` call (mocked backend error code) dispatches the mapped snackbar.

Green:
```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircularProgress, Stack } from "@mui/material";
import BaseLayout from "../../../../shared/components/ui/BaseLayout/BaseLayout";
import ContentLayout from "../../../../shared/components/ui/ContentLayout/ContentLayout";
import EmptyState from "../../../../shared/components/ui/EmptyState/EmptyState";
import { getMyProfile } from "../../services/coachApi";
import {
  getDocumentTypes,
  getPlayerDocuments,
  type DocumentTypeResponse,
  type PlayerDocumentResponse,
} from "../../services/playerDocumentService";
import MyDocumentCard from "./components/MyDocumentCard";
import styles from "./MyDocuments.module.css";

export default function MyDocuments() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [teamPlayerId, setTeamPlayerId] = useState<string | null>(null);
  const [types, setTypes] = useState<DocumentTypeResponse[]>([]);
  const [documents, setDocuments] = useState<PlayerDocumentResponse[]>([]);

  async function load() {
    setLoading(true);
    const profile = await getMyProfile();
    if (!profile?.teamPlayerId) {
      navigate("/appSelector", { replace: true, state: { needsTeamRelink: true } });
      return;
    }
    setTeamPlayerId(profile.teamPlayerId);
    const [docTypes, myDocs] = await Promise.all([
      getDocumentTypes(),
      getPlayerDocuments(profile.teamPlayerId),
    ]);
    setTypes(docTypes);
    setDocuments(myDocs);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // merge active document types with the (possibly-Pending, synthesized) statuses already
  // returned by getPlayerDocuments — the backend already synthesizes Pending rows for every
  // active type, so `documents` should already have one entry per `types` entry; render from
  // `documents` directly, falling back to `types` only if `documents` is empty pre-load.

  return (
    <BaseLayout hideFooterMenu>
      <ContentLayout title="Mis documentos" subtitle="Autorizaciones y documentos de tu jugador">
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={32} />
          </Stack>
        ) : documents.length === 0 ? (
          <EmptyState title="No hay documentos" description="No hay tipos de documento configurados." />
        ) : (
          <div className={styles.cardsGrid}>
            {documents.map((doc) => (
              <MyDocumentCard
                key={doc.documentTypeId}
                document={doc}
                teamPlayerId={teamPlayerId as string}
                onUploaded={load}
              />
            ))}
          </div>
        )}
      </ContentLayout>
    </BaseLayout>
  );
}
```
Adjust exact prop names/wiring to match whatever `MyDocumentCard`/`MyDocumentUploadDialog` ended up
needing in 3.1/3.2 — the snippet above is the shape, not a byte-for-byte requirement. Wrap any
service call error handling with the `mapPlayerDocumentError` helper + snackbar dispatch, per
spec.md's error scenarios.

`MyDocuments.module.css`: `.cardsGrid { display: grid; grid-template-columns:
repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }` (or whatever grid values the closest sibling
`InjuryProtocolDocuments.module.css`/`InjuredPlayersList.module.css` already use — copy those exact
values for visual consistency instead of inventing new spacing).

Verify: no `<table>`/MUI `Table` in this page's tree (grep the rendered output or just confirm by
code review — none of the components above use `Table`).

---

## 4. Coach team-tracking page

Directory: `Front/src/apps/coach/pages/player-documents/`.

### 4.1 `components/TeamPlayerDocumentCard.tsx`

Red: tests asserting: renders player name, dorsal (or "—" if null), status chip; shows an
"upload on behalf" control always available to Coach/ClubDirector regardless of status (re-upload
allowed at any status per the backend's re-upload-always-allowed contract); shows "Aprobar" button
only when `status === "Delivered"`; shows "Rechazar" button only when `status === "Delivered"`,
opening `TeamPlayerDocumentReviewDialog` in reject mode.

Green: MUI `Card`, props `{ row: TeamPlayerDocumentStatusResponse; documentTypeId: string; teamId: string; onChanged: () => void }`. Upload-on-behalf reuses the same hidden-file-input pattern as
`InjuryProtocolDocuments.tsx`, calling `uploadPlayerDocument(row.teamPlayerId, documentTypeId,
file)` with the same client-side PDF/JPEG/PNG + 10MB validation as `MyDocumentUploadDialog`
(consider extracting the validation constants/function into a small shared helper used by both
dialogs instead of duplicating the two constants — implementer's judgment, not required if time is
tight, but do not let the two limits drift apart).

### 4.2 `components/TeamPlayerDocumentReviewDialog.tsx`

Red: tests: approve path calls `reviewPlayerDocument(teamPlayerId, documentTypeId, true, null)`
immediately (no note field shown/required for approve); reject path requires opening a small
dialog with an optional note `TextField`, calling `reviewPlayerDocument(teamPlayerId,
documentTypeId, false, note)` on confirm. Use `ConfirmDialog`
(`shared/components/ui/ConfirmDialog/ConfirmDialog.tsx`) for the reject confirmation step (rejecting
a family's submitted document is a consequential action) — pass the note `TextField` as the
`description` `React.ReactNode` prop (it accepts `ReactNode`, not just a string, per its type).

Green: implement per the above; on success call `onChanged()` prop (re-fetch the row) and dispatch
a success/error snackbar via the `mapPlayerDocumentError` helper on failure (in particular handle
`PlayerDocumentNotDelivered` — show its mapped message, do not change local state, per spec.md's
"Reviewing a document that is not currently delivered" scenario).

### 4.3 `components/DocumentReportButton.tsx`

Red: test that clicking the button calls `downloadTeamDocumentsReport(teamId, documentTypeId)` and,
on the resolved `Blob`, triggers a download (assert via a spied `URL.createObjectURL`/anchor click,
same technique as `InjuryProtocolDocuments.tsx#handleDownload`, or by checking whatever blob-download
test pattern the `seasonPrepAllTeamsService`/`SeasonPrepPage` tests already use in this repo — search
for an existing test asserting a PDF blob download and mirror its assertion style verbatim rather
than inventing a new one).

Green: `<Button>` with loading state, calls the service, builds `anchor.href =
URL.createObjectURL(blob); anchor.download = "..."; anchor.click(); URL.revokeObjectURL(...)`. Use a
reasonable filename fallback if the backend doesn't expose one via response headers in this simple
client wrapper (e.g. `Documentos_${documentTypeId}.pdf`).

### 4.4 `PlayerDocumentsTracking.tsx` (page)

Red: tests: `documentTypeId` `<Select>` populated from `getDocumentTypes()`; selecting a type calls
`getTeamDocumentsStatus(teamId, documentTypeId)` (no `seasonId` arg) and renders one
`TeamPlayerDocumentCard` per row; a mocked `PlayerDocumentNotDelivered` error from a review action
(bubbled up through a card) shows the mapped snackbar without removing/changing the row locally.

Green: page shell using `useTeamAndClub()` for `teamId` (same as `Injured.tsx`/`Sanctions.tsx`),
local `documentTypeId` state (no URL param, per design.md Decision 3), `<Select>` from MUI populated
via `getDocumentTypes()`, roster list from `getTeamDocumentsStatus`, `<DocumentReportButton
teamId={team.id} documentTypeId={documentTypeId} />` in the action bar. Cards render in the same
`.cardsGrid` layout pattern as section 3. Loading/empty states via `CircularProgress`/`EmptyState`.

`PlayerDocumentsTracking.module.css`, `TeamPlayerDocumentCard.module.css`,
`TeamPlayerDocumentReviewDialog.module.css`, `DocumentReportButton.module.css`: co-located, mirror
spacing/typography from `InjuryProtocolDocuments.module.css`/`InjuredPlayersList.module.css`.

Verify: no `<table>`/MUI `Table`; check the page renders sanely at a 375px viewport width (Testing
Library doesn't do visual viewport checks — this is a manual/code-review check: confirm the CSS
grid uses `auto-fill`/`minmax` so it naturally reflows to 1 column at narrow widths, don't hardcode
a fixed column count).

---

## 5. Routing, permissions, entry points

### 5.1 `Front/src/apps/coach/constants/featureRoutes.ts`

Add, inside the `COACH_FEATURE_ROUTES` object (place them near the other "Allowed for Player"
entries for `MyDocuments` and near the "Blocked for Player" group for `PlayerDocuments`, matching
the file's existing comment groupings):
```ts
MyDocuments: "/coach/my-documents",
PlayerDocuments: "/coach/player-documents",
```
No test needed for this file alone (it's a plain constants object) — its correctness is exercised
by the route-guard tests in 5.4.

### 5.2 `Front/src/apps/coach/routes.tsx`

Add lazy imports near the other `const X = lazy(() => import(...))` declarations:
```ts
const MyDocuments = lazy(() => import("./pages/my-documents/MyDocuments"));
const PlayerDocumentsTracking = lazy(() => import("./pages/player-documents/PlayerDocumentsTracking"));
```
Add routes (place near `injured`/`sanctions` for locality):
```tsx
<Route
  path="my-documents"
  element={
    <RequireFeaturePermission featureRoute={COACH_FEATURE_ROUTES.MyDocuments}>
      <MyDocuments />
    </RequireFeaturePermission>
  }
/>
<Route
  path="player-documents"
  element={
    <RequireFeaturePermission
      featureRoute={COACH_FEATURE_ROUTES.PlayerDocuments}
      allowPlayerAccess={false}
    >
      <PlayerDocumentsTracking />
    </RequireFeaturePermission>
  }
/>
```
(`allowPlayerAccess` defaults to `true`, which is correct for `my-documents` — no need to pass it
explicitly there, matching how other "allowed for player" routes in this file omit the prop.)

### 5.3 `Front/src/apps/coach/pages/team-dashboard/TeamDashboardCards.tsx`

Add two tiles following the exact existing pattern used for the `Injured`/`Sanctions` tiles
(`visible: hasFeatureAccess(COACH_FEATURE_ROUTES.X)`, an illustration import, a `title`):
- "Mis documentos" tile: `visible: isPlayer && hasFeatureAccess(COACH_FEATURE_ROUTES.MyDocuments)`,
  navigates to `/coach/my-documents`.
- "Documentos" tile: `visible: !isPlayer && hasFeatureAccess(COACH_FEATURE_ROUTES.PlayerDocuments)`,
  navigates to `/coach/player-documents`.

Reuse an existing MUI icon (no new illustration asset needed unless the implementer wants to check
for an existing "document"-style icon already imported elsewhere in this file, e.g.
`DescriptionOutlined`/`AssignmentOutlined` from `@mui/icons-material` — pick whichever fits the
existing tile visual style best).

### 5.4 Route-guard tests

In whichever existing test file already covers `routes.tsx`/`RequireFeaturePermission` behavior
(search for one before creating a new one — if none exists at the routes level, add focused tests
next to `RequireFeaturePermission.tsx`'s own existing test file instead, asserting: a mocked
`usePermissions().hasFeatureAccess` returning `true` only for `COACH_FEATURE_ROUTES.MyDocuments`
lets a `Player`-role render through; the same setup redirects away from
`COACH_FEATURE_ROUTES.PlayerDocuments`).

---

## 6. Verification (run all, fix failures before declaring done)

```bash
cd Front
npm run test        # full suite, 100% pass, no skipped tests
npm run build        # TypeScript strict — zero errors
```

Report final coverage numbers for the new files if the test runner prints them (Vitest coverage
report), confirming ≥75% on every new/modified file listed above. Do not proceed to archive or
further changes — implementation ends at "tests + build green"; archiving is a separate,
orchestrator-driven step.
