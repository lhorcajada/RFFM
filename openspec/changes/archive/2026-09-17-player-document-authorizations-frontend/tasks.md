## 1. Service layer (TDD)

- [ ] 1.1 Write failing Vitest tests for `playerDocumentService.ts`: `getDocumentTypes`, `getPlayerDocuments`, `getTeamDocumentsStatus`, `uploadPlayerDocument`, `reviewPlayerDocument`, `downloadTeamDocumentsReport` — assert request method, URL, params/body shape, and multipart `FormData` field name (`file`) for uploads, mocking the shared Axios client. `getTeamDocumentsStatus`/`downloadTeamDocumentsReport` take only `teamId` + `documentTypeId` — assert no `seasonId` param is sent.
- [ ] 1.2 Implement `Front/src/apps/coach/services/playerDocumentService.ts` per design.md Decision 6 to make the tests pass — typed `DocumentTypeResponse`, `PlayerDocumentResponse`, `PlayerDocumentStatus`, `TeamPlayerDocumentStatusResponse`, no `any`, no `seasonId`.
- [ ] 1.3 Write failing tests for the error-code-to-Spanish-message map (design.md Decision 7) covering all 7 codes plus an unmapped-code fallback.
- [ ] 1.4 Implement the error map (co-located helper or inline in the service file) to pass 1.3.
- [ ] 1.5 Extend `MyProfile` in `Front/src/apps/coach/services/coachApi.ts` with `teamPlayerId?: string | null`, with a test asserting the field is read through from the response.
- [ ] 1.6 Run `npm run test` for the new service tests only; confirm green.

## 2. Shared status chip

- [ ] 2.1 Write failing tests for `PlayerDocumentStatusChip.tsx` (`shared/components/ui/`): renders correct Spanish label + MUI color per status (Pendiente/Entregado/Aprobado/Rechazado).
- [ ] 2.2 Implement `PlayerDocumentStatusChip.tsx` + co-located `.module.css` to pass, mirroring `AvailabilityBadge`/`ReadinessBadge` structure.

## 3. Self-service "Mis documentos" page

- [ ] 3.1 Write failing tests for `MyDocumentCard.tsx`: renders status chip, shows upload control only when status is `Pending`/`Rejected`, shows a download link when a file exists, shows the "will return to Delivered" notice when re-uploading over `Approved`/`Rejected`.
- [ ] 3.2 Implement `MyDocumentCard.tsx` + `.module.css` to pass.
- [ ] 3.3 Write failing tests for `MyDocumentUploadDialog.tsx`: client-side rejects non-PDF/JPEG/PNG and >10MB files with a Spanish snackbar event before calling the service; accepts valid files and calls `uploadPlayerDocument`.
- [ ] 3.4 Implement `MyDocumentUploadDialog.tsx` + `.module.css` to pass.
- [ ] 3.5 Write failing tests for `MyDocuments.tsx` page: reads `teamPlayerId` from `getMyProfile()`, redirects to `/appSelector` with `state: { needsTeamRelink: true }` when `teamPlayerId` is missing (mirrors `usePlayerAutoLoad`'s existing missing-`teamId` handling), renders one card per document type from `getDocumentTypes()` + `getPlayerDocuments()`, shows loading/empty/error states, dispatches `rffm.show_snackbar` on backend error codes via the shared map.
- [ ] 3.6 Implement `MyDocuments.tsx` + `.module.css` to pass.
- [ ] 3.7 Verify no `<table>`/MUI `Table` anywhere in this page's component tree.

## 4. Coach team-tracking page

- [ ] 4.1 Write failing tests for `TeamPlayerDocumentCard.tsx`: renders player name/dorsal/status, shows upload-on-behalf control, shows approve button only when `Delivered`, opens review dialog for reject.
- [ ] 4.2 Implement `TeamPlayerDocumentCard.tsx` + `.module.css` to pass.
- [ ] 4.3 Write failing tests for `TeamPlayerDocumentReviewDialog.tsx`: approve calls `reviewPlayerDocument(..., true, null)`; reject with a note calls `reviewPlayerDocument(..., false, note)`; uses `ConfirmDialog`-consistent UX (never `window.confirm`).
- [ ] 4.4 Implement `TeamPlayerDocumentReviewDialog.tsx` + `.module.css` to pass.
- [ ] 4.5 Write failing tests for `DocumentReportButton.tsx`: calls `downloadTeamDocumentsReport(teamId, documentTypeId)` (no `seasonId`) and triggers a file download (assert blob handling, not real DOM download).
- [ ] 4.6 Implement `DocumentReportButton.tsx` + `.module.css` to pass.
- [ ] 4.7 Write failing tests for `PlayerDocumentsTracking.tsx` page: document-type `<Select>` populated from `getDocumentTypes()`, roster cards from `getTeamDocumentsStatus(teamId, documentTypeId)`, `PlayerDocumentNotDelivered` on a stale review attempt shows a snackbar without changing state.
- [ ] 4.8 Implement `PlayerDocumentsTracking.tsx` + `.module.css` to pass.
- [ ] 4.9 Verify no `<table>`/MUI `Table` anywhere in this page's component tree; verify layout at a ~375px viewport.

## 5. Routing, permissions, entry points

- [ ] 5.1 Add `MyDocuments: "/coach/my-documents"` and `PlayerDocuments: "/coach/player-documents"` entries to `COACH_FEATURE_ROUTES` (`constants/featureRoutes.ts`) — exact literal strings matching the backend-seeded `FeaturePermission` rows.
- [ ] 5.2 Add lazy routes `/coach/my-documents` and `/coach/player-documents` to `apps/coach/routes.tsx`, wrapped in `RequireFeaturePermission` with `allowPlayerAccess={true}`/`{false}` respectively (design.md Decision 3).
- [ ] 5.3 Add a "Mis documentos" tile to `TeamDashboardCards.tsx` visible when `isPlayer`, and a "Documentos" tile visible via `hasFeatureAccess(COACH_FEATURE_ROUTES.PlayerDocuments)`, mirroring the existing `Injured`/`Sanctions` tile pattern.
- [ ] 5.4 Write/adjust route-guard tests confirming a Player-role user is redirected away from `/coach/player-documents` and a Coach-role user can reach `/coach/my-documents` without being blocked.

## 6. Verification

- [ ] 6.1 Run full `npm run test` suite; confirm 100% pass, no skipped tests, ≥75% coverage on new/modified files.
- [ ] 6.2 Run `npm run build`; fix any TypeScript strict-mode errors.
- [ ] 6.3 Run `openspec validate player-document-authorizations-frontend --strict` and fix any reported issues before requesting archive.
