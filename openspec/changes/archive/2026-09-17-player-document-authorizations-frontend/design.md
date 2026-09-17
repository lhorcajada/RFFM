## Context

Backend contract is fully designed and validated in `openspec/changes/player-document-authorizations/design.md` ("API Contract (for the front-specialist)" section) — treat it as frozen; do not re-derive routes/DTOs, reference that file at implementation time. Its `implement.md` has since been generated and validated by back-specialist (not yet executed) and resolved three points that affect this design directly (see the "Resolved" notes below): the exact `FeaturePermission`-seeded feature routes/roles, `teamPlayerId` on `MyProfile`, and the removal of `seasonId` from the two team-scoped endpoints. Six endpoints total, all under `/api/catalog/...`, all authenticated, role-scoped via `Coach`/`ClubDirector` (team-wide) vs. `Player`/`FamilyMember` (self-service, limited to their own `UserTeam.LinkedTeamPlayerId`).

Closest existing frontend precedents (found by inspecting the repo, not invented):
- `Front/src/apps/coach/pages/injured/Injured.tsx` — MUI `Tabs`/`Tab` + `activeTab` state pattern for a team-scoped page with role-gated write actions; `InjuryProtocolDocuments.tsx` is the closest sibling for "upload/list/delete PDF, download via storage" UI, including the same `ConfirmDialog` (never `window.confirm`) and blob-download-via-`fetchPublicStorageFile` fix already baked into that component.
- `Front/src/apps/coach/services/teamplayerService.ts` — service file shape (typed `client.get/post/put/delete` wrappers, `type XxxResponse`, no `any` except one pre-existing `TeamPlayerResponse.player: any` that is NOT a pattern to copy).
- `Front/src/apps/coach/hooks/isPlayerRole.ts` / `useIsPlayerRole.ts` — the existing, tested way to branch UI between Coach/Administrator and Player/FamilyMember without duplicating role logic.
- `Front/src/apps/coach/components/RequireFeaturePermission.tsx` + `constants/featureRoutes.ts` (`COACH_FEATURE_ROUTES`) — every reachable Coach-app page is gated by a `featureRoute` string that must exist as a `FeaturePermission` row per role on the backend (`GET /api/permissions/me`). **Resolved (2026-09-16, backend `player-document-authorizations` implement.md)**: the backend has seeded exactly the two routes this design needs — `CoachFeatureRoutes.MyDocuments = "/coach/my-documents"` (ReadWrite for `Player`/`FamilyMember`) and `CoachFeatureRoutes.PlayerDocuments = "/coach/player-documents"` (ReadWrite for `Coach`/`ClubDirector`). The frontend only needs to use these literal string values in `COACH_FEATURE_ROUTES` — no further backend coordination needed.
- `Front/src/apps/coach/services/coachApi.ts` (`MyProfile`) — **Resolved (2026-09-16)**: the backend added `teamPlayerId` to `GET /api/users/me/profile` (resolved server-side via `UserTeam.LinkedTeamPlayerId`). `MyDocuments.tsx` can use `profile.teamPlayerId` directly; no roster-scan workaround needed.
- `Front/src/apps/coach/pages/team-dashboard/TeamDashboardCards.tsx` — where team-scoped feature tiles (Lesionados, Sanciones, ...) are registered, gated by `hasFeatureAccess(COACH_FEATURE_ROUTES.X)`; this is where a new "Documentos" tile belongs for the Coach-facing view.

## Goals / Non-Goals

**Goals:**
- Player/FamilyMember: a "Mis documentos" view showing status per document type for their own linked player, with upload/re-upload.
- Coach/ClubDirector: a team-tracking view (roster x one document type), with upload-on-behalf, approve/reject, and PDF report download.
- Zero `<table>`/MUI `Table` usage; both listings are card-based and mobile-first (~360-400px first).
- Reuse existing patterns exactly: `ConfirmDialog` for destructive/irreversible actions, `rffm.show_snackbar` for outcomes, single Axios instance, CSS Modules, MUI Coach theme.

**Non-Goals:**
- No admin UI to create/edit `DocumentType` rows (backend seeds exactly one type; the UI must work generically for N types returned by `GET /api/catalog/document-types` but does not manage the catalog itself).
- No `Mobile/` (Expo) changes — Coach app web SPA only, per the user's request.
- No retrying/queueing of failed uploads beyond a manual retry button — no offline support.
- No season selector on the team-tracking page — `Team` is already season-scoped (`Team.SeasonId`) in this codebase, so `seasonId` was removed entirely from the two team-scoped backend endpoints (see Decision 6); there is nothing for a season picker to control.

## Decisions

### 1. Same change vs. separate OpenSpec change: **separate** (`player-document-authorizations-frontend`)
The backend proposal's own "What Changes"/"Impact" sections state explicitly: *"No frontend changes in this proposal — the Coach-app UI is a separate, coordinated follow-up change that will consume the contract defined in design.md."* That is a direct instruction from the already-validated backend spec, not a judgment call — honoring it keeps the backend change archivable/deployable independently of frontend timing, matches the repo's git-status precedent (the backend change currently sits unarchived precisely so this frontend follow-up can reference it), and avoids re-opening/re-validating an already-approved backend spec file. (Contrast with `add-injury-protocol-and-documents-tabs`, which *was* single-change cross-stack — but that change's own proposal never declared a frontend split; this one does, so we follow its explicit instruction instead of defaulting to the other precedent.)

**Alternative considered**: append `specs/player-document-authorizations-ui/` + frontend tasks into the existing backend change. Rejected because it contradicts the backend proposal's own stated scope and would force re-validating a change already marked ready.

### 2. Page structure: two new pages, not tabs bolted onto an existing page
- **`pages/my-documents/MyDocuments.tsx`** — new top-level page for Player/FamilyMember. Not nested under `PlayerDetail.tsx` (that page is Coach-facing, gated by `COACH_FEATURE_ROUTES.Squad`, and player-role users don't reach it today for their own record — there is no existing "my own PlayerDetail" concept in this frontend to piggyback on). A dedicated page keeps the self-service flow simple and matches how `TeamRulesDocument` (also "read for every role, distinct page") is structured: one small standalone page, not a tab on a bigger Coach page.
- **`pages/player-documents/PlayerDocumentsTracking.tsx`** — new top-level page for Coach/ClubDirector, team-scoped (`teamId` from `useTeamAndClub()`), one document-type selector, listing every roster player as a card. Kept separate from `Injured.tsx`'s tabs rather than added as a 4th tab there, because document authorizations are a distinct domain concept from injuries (the archived `add-injury-protocol-and-documents-tabs` change's "Documentos" tab is PDFs *about the injury protocol itself*, unrelated to per-player signed authorizations) — conflating them under the same tab bar would mislead users about what "Documentos" means.

**Alternative considered**: add a "Documentos" tab to `Injured.tsx`. Rejected — different domain concept (see above), and `Injured.tsx` is already Coach/Squad-gated, which would block the Player/FamilyMember self-service view entirely.

### 3. Routing
```
apps/coach/routes.tsx additions:
  /coach/my-documents           -> MyDocuments.tsx        (RequireFeaturePermission featureRoute=COACH_FEATURE_ROUTES.MyDocuments, allowPlayerAccess=true)
  /coach/player-documents       -> PlayerDocumentsTracking.tsx (RequireFeaturePermission featureRoute=COACH_FEATURE_ROUTES.PlayerDocuments, allowPlayerAccess=false)
```
Both lazy-loaded (`React.lazy`) following every other entry in `routes.tsx`. `MyDocuments` needs no route params — it resolves "my own player" directly from `profile.teamPlayerId` (Decision 5). `PlayerDocumentsTracking` reads `teamId` the same way `Injured.tsx`/`Sanctions.tsx` do (`useTeamAndClub()`), and keeps `documentTypeId` as local component state with a `<Select>` populated from `GET /api/catalog/document-types`, not a route param — mirrors how `Attendance.tsx`/`Convocations.tsx` keep filter state local rather than in the URL. No season param anywhere (Decision 6).

### 4. `COACH_FEATURE_ROUTES` entries — **resolved, backend has seeded these**
`featureRoutes.ts` documents that its values "must match the `featureRoute` values returned by `GET /api/permissions/me` exactly". The backend `player-document-authorizations` change (implement.md, generated and validated 2026-09-16, not yet executed) seeds exactly these two routes:
```
MyDocuments: "/coach/my-documents"         // FeaturePermission: ReadWrite for Player, FamilyMember
PlayerDocuments: "/coach/player-documents" // FeaturePermission: ReadWrite for Coach, ClubDirector
```
The frontend adds these two literal string values to `COACH_FEATURE_ROUTES` (task 5.1) — no further backend coordination is needed. `RequireFeaturePermission`'s `allowPlayerAccess` prop stays a frontend-only UX nicety (it just also excludes `useIsPlayerRole()` users on top of `hasFeatureAccess`); the actual role gating comes from the backend's `GET /api/permissions/me` response for the two routes above, so `allowPlayerAccess={false}` on `/coach/player-documents` is correct (Coach/ClubDirector are never "player role" per `isPlayerRole.ts`) and `allowPlayerAccess={true}` on `/coach/my-documents` is correct (Player/FamilyMember must reach it).

### 5. Resolving "my own `teamPlayerId`" (self-service view) — **resolved, no workaround needed**
The backend added `teamPlayerId` to `GET /api/users/me/profile` (resolved server-side via `UserTeam.LinkedTeamPlayerId`). `MyDocuments.tsx` reads `profile.teamPlayerId` directly from `getMyProfile()` (extend the existing `MyProfile` type in `coachApi.ts` with `teamPlayerId?: string | null`) — no roster-scan, no extra `getPlayersByTeam` call, no new hook. The originally-proposed `useMyTeamPlayerId.ts` hook is dropped from this design; `MyDocuments.tsx` calls `getMyProfile()` once and, if `teamPlayerId` is missing (e.g. account not yet linked), shows the same "needs re-link" empty state `usePlayerAutoLoad` already uses elsewhere (redirect to `/appSelector` with `state: { needsTeamRelink: true }`) rather than inventing a new empty state.

### 6. `playerDocumentService.ts` — API surface
New file `Front/src/apps/coach/services/playerDocumentService.ts`, single Axios instance (`core/api/client.ts`), typed responses (`type`, no `any`):
```ts
export type DocumentTypeResponse = { id: string; name: string; description: string | null; isActive: boolean };

export type PlayerDocumentStatus = "Pending" | "Delivered" | "Approved" | "Rejected";

export type PlayerDocumentResponse = {
  documentTypeId: string; documentTypeName: string; teamPlayerId: string;
  status: PlayerDocumentStatus;
  fileName: string | null; url: string | null; contentType: string | null;
  uploadedAt: string | null; uploadedOnBehalf: boolean | null;
  reviewedAt: string | null; reviewNote: string | null;
};

export type TeamPlayerDocumentStatusResponse = {
  teamPlayerId: string; playerId: string; playerName: string; dorsal: number | null;
  status: PlayerDocumentStatus; uploadedAt: string | null; reviewedAt: string | null;
};

export async function getDocumentTypes(): Promise<DocumentTypeResponse[]>;
export async function getPlayerDocuments(teamPlayerId: string): Promise<PlayerDocumentResponse[]>;
export async function getTeamDocumentsStatus(teamId: string, documentTypeId: string): Promise<TeamPlayerDocumentStatusResponse[]>;
export async function uploadPlayerDocument(teamPlayerId: string, documentTypeId: string, file: File): Promise<PlayerDocumentResponse>;
export async function reviewPlayerDocument(teamPlayerId: string, documentTypeId: string, approve: boolean, note: string | null): Promise<PlayerDocumentResponse>;
export async function downloadTeamDocumentsReport(teamId: string, documentTypeId: string): Promise<Blob>;
```
**Note (resolved 2026-09-16)**: `seasonId` does **not** exist on `getTeamDocumentsStatus`/`downloadTeamDocumentsReport` — the backend removed it entirely from both endpoints because `Team` is already season-scoped (`Team.SeasonId`) in this codebase, so a separate `seasonId` query param was redundant. Do not add it as an optional parameter during implementation even though the original backend design draft mentioned it.
- `uploadPlayerDocument` builds a `FormData` with field `file`, `POST`s multipart — same shape as `playerService.ts`'s `uploadPlayerPhoto`.
- `downloadTeamDocumentsReport` uses `{ responseType: "blob" }` (same as `seasonPrepAllTeamsService.exportSeasonPrepAllTeams`); the calling component builds an `<a>`/`URL.createObjectURL` download exactly like the existing PDF-export call sites (`SeasonPrepPage`/`Injured` report buttons — replicate whichever concrete call site tasks.md finds still active at implementation time).
- File download for the *document itself* (viewing an uploaded PDF/image) reuses `shared/services/imageService.ts#fetchPublicStorageFile(url)` exactly like `InjuryProtocolDocuments.tsx` does — no new download endpoint needed, `PlayerDocumentResponse.url` is the same kind of storage URL.

### 7. Error mapping (ProblemDetails → Spanish snackbar)
Existing convention in this codebase reads the error code as `error.response?.data?.code` (see `FamilyMemberAccountStatus.tsx`, `trainingService.ts`), not a nested `extensions.code` — components/services must follow that same shape. A shared map (co-located in `playerDocumentService.ts` or a small `playerDocumentErrors.ts` helper) translates the new backend codes to Spanish, then callers dispatch `rffm.show_snackbar`:

| Code | Spanish message | severity |
|---|---|---|
| `DocumentTypeNotFound` | "El tipo de documento no existe." | error |
| `TeamPlayerNotFound` | "No se encontró al jugador." | error |
| `PlayerDocumentAccessForbidden` | "No tienes permiso para acceder a este documento." | error |
| `PlayerDocumentInvalidFile` | "Archivo no válido. Debe ser un PDF, JPG o PNG." | warning |
| `PlayerDocumentFileTooLarge` | "El archivo supera el tamaño máximo permitido (10 MB)." | warning |
| `PlayerDocumentNotFound` | "Todavía no se ha entregado ningún documento." | warning |
| `PlayerDocumentNotDelivered` | "Este documento no está pendiente de revisión (puede que se haya vuelto a subir). Actualiza la página." | warning |

Any unmapped code/network error falls back to the existing generic message pattern already used elsewhere (e.g. `"Ha ocurrido un error. Inténtalo de nuevo."`).

### 8. Component breakdown
```
pages/my-documents/
  MyDocuments.tsx                       — page shell, reads teamPlayerId from getMyProfile() (Decision 5), fetches getPlayerDocuments
  MyDocuments.module.css
  components/
    MyDocumentCard.tsx                  — one card per document type: status chip, upload/re-upload button, download link
    MyDocumentCard.module.css
    MyDocumentUploadDialog.tsx          — file picker + submit, reuses ConfirmDialog styling conventions (not a destructive action, but same modal patterns) — actually a plain MUI Dialog with file input, not ConfirmDialog (that's reserved for destructive confirmations per react.md §10.1)
    MyDocumentUploadDialog.module.css

pages/player-documents/
  PlayerDocumentsTracking.tsx           — page shell: document-type <Select>, teamId from useTeamAndClub()
  PlayerDocumentsTracking.module.css
  components/
    TeamPlayerDocumentCard.tsx          — one card per roster player: status chip, upload-on-behalf, approve/reject buttons (ConfirmDialog for reject, since rejecting is a meaningful/reversible-but-consequential action — approve is a single click + snackbar, reject asks for an optional note via a small dialog)
    TeamPlayerDocumentCard.module.css
    TeamPlayerDocumentReviewDialog.tsx  — approve/reject with optional note textfield
    TeamPlayerDocumentReviewDialog.module.css
    DocumentReportButton.tsx            — triggers downloadTeamDocumentsReport + blob download
```
Both `*Card` components render as MUI `Card`/`Paper` in a responsive stacked/grid layout (`display: grid; grid-template-columns: repeat(auto-fill, minmax(...))` in the CSS Module), never `Table`.

### 9. Status chip visuals
A small shared `PlayerDocumentStatusChip.tsx` (in `shared/components/ui/` since it's a generic status concept, not Coach-specific styling — though it consumes Coach theme colors when rendered inside the Coach app, same as `AvailabilityBadge`/`ReadinessBadge` do today) maps `PlayerDocumentStatus` to a MUI `Chip` color/label: Pending=default/gray "Pendiente", Delivered=info/blue "Entregado", Approved=success/green "Aprobado", Rejected=error/red "Rechazado". Mirrors `AvailabilityBadge`/`ReadinessBadge` exactly (co-located `.module.css`, no inline `sx` color hardcoding).

## Risks / Trade-offs

- **[Risk]** Re-upload after `Approved`/`Rejected` silently resets status to `Delivered` per the backend design — the family-facing UI must make this obvious (e.g., a short inline notice on re-upload: "Al subir un nuevo archivo, el documento volverá a estado 'Entregado' y deberá revisarse de nuevo") so users aren't confused when a previously "Aprobado" badge changes. → **Mitigation**: explicit UI copy, covered by a test asserting the notice renders before upload is confirmed.
- **[Risk]** `profile.teamPlayerId` could be `null`/missing for an account that hasn't completed the Player/FamilyMember-to-`TeamPlayer` link yet. → **Mitigation**: `MyDocuments.tsx` treats a missing `teamPlayerId` the same way `usePlayerAutoLoad` already treats a missing `profile.teamId` — redirect to `/appSelector` with `state: { needsTeamRelink: true }` — no new empty-state pattern invented.

## Migration Plan

1. Build `playerDocumentService.ts` (TDD: mock-based Vitest tests for each function's request shape and error mapping) — no UI yet. No `seasonId` parameter anywhere (Decision 6).
2. Build `MyDocuments.tsx` + children (Player/FamilyMember self-service) with tests, using `profile.teamPlayerId` directly.
3. Build `PlayerDocumentsTracking.tsx` + children (Coach/ClubDirector team-tracking, review, report) with tests.
4. Add `MyDocuments`/`PlayerDocuments` to `COACH_FEATURE_ROUTES` with the exact backend-seeded literal route strings (Decision 4), wire routes with `RequireFeaturePermission`, add dashboard tiles on `TeamDashboardCards.tsx`.
5. `npm run build` + `npm run test` (Vitest + Testing Library only — confirmed in scope by the user; no Playwright E2E for this change).
6. Rollback: purely additive new files/routes; reverting is deleting the new pages/service/routes, no data migration involved on the frontend. The backend-seeded `FeaturePermission` rows are backend-owned and unaffected by a frontend rollback.

## Open Questions

None remaining. All four prior open items are resolved:
1. Feature-route/permission seeding — resolved: backend seeds `MyDocuments`/`PlayerDocuments` routes exactly as proposed (Decision 4).
2. `teamPlayerId` on `MyProfile` — resolved: backend added it (Decision 5).
3. Dashboard tile entry points — confirmed by the user: tiles on `TeamDashboardCards.tsx` as originally proposed.
4. Test scope — confirmed by the user: Vitest + Testing Library only, no Playwright E2E for this change.
