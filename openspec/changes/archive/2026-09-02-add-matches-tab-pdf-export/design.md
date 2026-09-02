## Context

`AttendanceMatchesTab.tsx` renders one `Accordion` card per player from `rows: PlayerMatchSummary[]` / `columns: MatchAttendanceColumn[]` (see `types.ts`). Each row already carries everything needed: `playerName`, `photoUrl`, `dorsal`, `position`, the four aggregate counters, and `cells` (per-match state + minutes), keyed by `column.eventId`. `columns` is chronologically ordered; `rows` arrives already sorted by the parent (`AttendanceSummaryContent.tsx`) — dorsal ascending, associated player first — and the card list renders that order verbatim. No new data is required from the backend.

The sibling "Entrenamientos" tab already has a working export precedent: `trainingAttendanceExcel.ts` (ExcelJS, `async function` building a `Blob` + anchor-click download) wired to a `Button` in `.trainingToolbar` with a local `exportingExcel` boolean disabling the button and swapping its label while the async export runs. `squadPdfExport.ts` is the closest **PDF** precedent in the repo: direct `jsPDF` drawing (no `html2canvas`/DOM capture), with reusable page-break-aware section drawers, `MH`/`MV` margin constants, and a color-by-score helper. It does **not** embed player photos — it draws a dorsal/name/position header bar instead.

## Goals / Non-Goals

**Goals:**
- Two buttons, "Exportar resumen" and "Exportar completo", in `AttendanceMatchesTab.tsx`'s `.matchToolbar`, visible to the same roles as `AttendanceTrainingsTab`'s Excel button (i.e. hidden for Player/FamilyPlayer/FamilyMember).
- "Exportar resumen": one row per player with exactly what the collapsed card shows — dorsal (jersey-colored by position), name, the four aggregate chips, and the form strip (same last-5-matches cap as the on-screen card, since that's what "visible in the collapsed card" means).
- "Exportar completo": the resumen content plus, per player, a full match-by-match block (jornada + rival + date + Amistoso tag + state + minutes) for every column, not just the last 5.
- Both exports iterate `rows` in the exact order the prop arrives — no sorting logic duplicated or reintroduced in the export module.
- Buttons show a disabled/loading state while generating, matching the `exportingExcel` UX pattern from `AttendanceTrainingsTab.tsx`.

**Non-Goals:**
- Embedding the actual player photo image in the PDF. `photoUrl` values are `blob:` object URLs created per-session by `playerService.fetchPlayerPhoto`; turning them into a `jsPDF`-embeddable raster per player would require an extra async image-decode step per player with its own failure handling, for a payoff (a small headshot next to a name the coach already knows) that `squadPdfExport.ts` also judged not worth it for its own player cards. The jersey-colored dorsal badge already carries the position-color signal from the card.
- Changing `AttendanceSummaryContent.tsx`'s data-fetching, sorting, or the `PlayerMatchSummary`/`MatchAttendanceColumn` types.
- Touching `AttendanceTrainingsTab.tsx`'s existing Excel export or `AttendanceDashboardTab.tsx`.
- A combined players+trainings PDF, or any backend involvement — this is presentation of data the tab already has.

## Decisions

1. **Direct `jsPDF` drawing (`squadPdfExport.ts` pattern), not `html2canvas` DOM capture.**
   `html2canvas`-based exports (`pdfService.ts`, `ConvocatoriaPrint.tsx`) rasterize a rendered DOM subtree, which means the export can only reproduce whatever is currently mounted/expanded on screen and is effectively untestable under Vitest/jsdom (canvas rasterization of real layout isn't meaningful there). Direct `jsPDF` drawing lets the export module read straight from `rows`/`columns` — independent of which cards happen to be expanded — and lets tests assert on the actual `jsPDF` calls (player names, match labels, order) via a lightweight `jspdf` mock, the same testability tradeoff `squadPdfExport.ts` already made.
   *Alternative considered*: reuse `exportElementToPdf`/`exportElementsToPdf` from `shared/services/pdfService.ts` on the rendered card list. Rejected — it would force every card open before exporting (visually and in the DOM) and couples the "completo" export to whatever cards are currently expanded, which conflicts with "resumen" only ever wanting the collapsed view regardless of on-screen state.

2. **New file `matchAttendancePdfExport.ts` next to `trainingAttendanceExcel.ts`, exporting two named functions — not a shared "attendance PDF" abstraction with Trainings.**
   `exportMatchesSummaryPdf(rows, columns, teamName?)` and `exportMatchesFullPdf(rows, columns, teamName?)`, both `async` (mirroring `exportTrainingAttendanceToExcel`'s signature/shape even though the `jsPDF` work itself is synchronous) so the calling button can `await` them inside the same `try { setExporting(true); await ...; } finally { setExporting(false); }` pattern already used for Excel. Trainings has no PDF export today and no shared "detail row" shape with Matches (absences vs. per-match cells) — inventing a shared abstraction now would guess at requirements Trainings hasn't asked for.

3. **No re-sorting inside the export module — it trusts `rows` order.**
   Per the user's requirement, both PDFs must list players in the same order the cards appear on screen. `AttendanceSummaryContent.tsx` already computes that order (dorsal ascending, associated player first) before passing `rows` down. The export functions simply `for (const row of rows)` — duplicating or second-guessing that order here would risk drifting from the on-screen order if either sort evolves independently.

4. **"Resumen" PDF caps the form strip at the same `FORM_STRIP_MAX_MATCHES = 5` used by the collapsed card; "Completo" PDF shows every column.**
   The proposal is explicit that "Exportar resumen" mirrors "los datos visibles en la tarjeta colapsada", and the on-screen card itself only shows the last 5 matches in its form strip (a deliberate scoping decision from the prior change, "with a full season of jornadas the strip would otherwise grow unbounded"). Showing more in the PDF than the card shows on screen would make "resumen" inconsistent with its own name; a coach wanting the full history already has "Exportar completo".

5. **Dorsal badge in the PDF reuses the same blue/red position-color rule as the on-screen jersey badge (`isGoalkeeperPosition`), duplicated locally rather than imported from the component.**
   Consistent with the repo's already-established precedent of duplicating this exact helper per file (`AttendanceMatchesTab.tsx`, `AttendanceTrainingsTab.tsx` both already have their own copy — see `redesign-attendance-matches-tab-cards` design.md decision on `playerInitials`). No shared `shared/` module exists for it yet and this change doesn't introduce one.

## Risks / Trade-offs

- [No real photo in the PDF] → Mitigated by the colored dorsal badge carrying the same at-a-glance identity/position signal the card gives; documented as a conscious non-goal (decision 1's alternative note, and the "Embedding..." non-goal above).
- [Two large `jsPDF`-drawing functions can be hard to keep readable] → Mitigated by following `squadPdfExport.ts`'s existing pattern of small single-purpose drawing helpers (`drawPlayerHeaderRow`, `drawMatchDetailRow`, etc.) with page-break checks (`BOTTOM_LIMIT`) factored the same way.
- ["Completo" PDF could grow to many pages for a full-season squad] → Accepted; this mirrors `exportAllPlayersPdf`'s existing multi-page behavior for squad ratings, which is already the accepted UX for this kind of full-detail export in the app.

## Open Questions

None — scope was fully specified by the user before this design was written (see proposal.md "What Changes").
