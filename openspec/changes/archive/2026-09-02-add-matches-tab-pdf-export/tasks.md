## 1. Tests first (Red)

- [x] 1.1 New `matchAttendancePdfExport.test.ts`: mock the `jspdf` module with a lightweight fake (`text`/`save`/`addPage`/no-op setters) that records captured text strings and saved filenames. Test that `exportMatchesSummaryPdf(rows, columns)` emits each player's `playerName` in the exact order `rows` was passed (not alphabetical, not re-sorted by dorsal) and calls `save()` with a filename starting with `resumen_partidos`.
- [x] 1.2 Test `exportMatchesSummaryPdf` includes the aggregate figures (`totalMatches`, `startedMatches`, `notCalledMatches`, `seasonMinutesPlayed`) as captured text for each player.
- [x] 1.3 Test `exportMatchesFullPdf` includes, for a given player, each match's `column.label`, `rival`, the state label (e.g. "Titular"), and minutes (`"78'"`) as captured text — and that `save()` is called with a filename starting with `partidos_completo`.
- [x] 1.4 Test `exportMatchesFullPdf` includes the "Amistoso" text for a friendly column and omits it entirely when no column is friendly.
- [x] 1.5 Test both functions preserve `rows` order even when it doesn't match ascending dorsal or alphabetical name (construct `rows` deliberately out of both orders and assert the captured-name order matches input order).
- [x] 1.6 Confirm all of the above fail against the current codebase (module doesn't exist yet) before implementing.
- [x] 1.7 `AttendanceMatchesTab.tsx` tests: extend/adjacent test file(s) asserting — "Exportar resumen" and "Exportar completo" buttons render for a Coach role and are absent for Player/FamilyPlayer/FamilyMember roles (mock `coachAuthService.getRoles()`, same pattern as `AttendanceTrainingsTab.exportButtonRole.test.tsx`); clicking each button calls the corresponding mocked export function with the tab's `rows`/`columns` props; each button is disabled while its export promise is pending (mock export function returning a controllable/deferred promise) and re-enabled after it resolves. Confirm Red before implementing.

## 2. Implementation (Green)

- [x] 2.1 `Front/src/apps/coach/pages/attendance/components/summary/matchAttendancePdfExport.ts`: implement `exportMatchesSummaryPdf(rows, columns, teamName?)` and `exportMatchesFullPdf(rows, columns, teamName?)` using direct `jsPDF` drawing (no `html2canvas`), following `squadPdfExport.ts`'s margin/page-break/helper patterns. `exportMatchesSummaryPdf` draws, per player in `rows` order: dorsal badge (blue/red via a locally-duplicated `isGoalkeeperPosition`), name, the four aggregate values, and the last-`FORM_STRIP_MAX_MATCHES` (5) match states as compact indicators. `exportMatchesFullPdf` draws the same per-player header plus a full per-match detail block (`column.label`, `rival`, formatted date, "Amistoso" tag when `isFriendly`, state label, minutes) for every column, with page breaks between players/blocks as needed.
- [x] 2.2 `AttendanceMatchesTab.tsx`: add the `canExportExcel`-equivalent role check (reuse the same `coachAuthService.getRoles()` + `["player","familyplayer","familymember"]` pattern), two `Button`s ("Exportar resumen", "Exportar completo") with `startIcon` (PDF icon), each wrapped in its own `try { setExportingX(true); await exportX(rows, columns); } finally { setExportingX(false); }`, disabled while exporting with a "Generando PDF..." label swap.
- [x] 2.3 `AttendanceSummary.module.css`: adjust `.matchToolbar`/`.matchToolbarRight` layout (new `.matchToolbarButtons` wrapper, `margin-left: auto` on `.matchToolbarRight` instead of a fixed `justify-content: flex-end` on the parent) so the new buttons sit at the toolbar's start and the existing chips/refresh stay pinned to the end regardless of whether the buttons are rendered; add the same mobile full-width button treatment `.trainingToolbar` already has, scoped to `.matchToolbarButtons`.

## 3. Verification

- [x] 3.1 Run `npm run test -- matchAttendancePdfExport` — confirm all tests from 1.1-1.6 pass.
- [x] 3.2 Run `npm run test -- AttendanceMatchesTab` — confirm the new button tests (1.7) and all pre-existing tests in that file still pass.
- [x] 3.3 Run `npm run test -- AttendanceSummaryContent AttendanceTrainingsTab AttendanceDashboardTab` — confirm no regression from the shared CSS module change.
- [x] 3.4 Run `npm run build` — confirm no TypeScript/strict errors.
- [x] 3.5 Mark this change's tasks complete; do not commit, push, or archive — leave for explicit user review per `.claude/rules/git.md` §6.3.
