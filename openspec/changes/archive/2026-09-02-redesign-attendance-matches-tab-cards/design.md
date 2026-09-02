## Context

`AttendanceMatchesTab.tsx` currently renders a `Table` (`TableContainer` with `max-height: calc(100vh - ... - 290px)` and its own vertical scroll, `stickyHeader`, sticky first column) where each row is a player and each extra column is a match (`MatchAttendanceColumn`). Friendly matches are flagged only via a small `Chip` inside the column header (`.matchFriendlyChip`). This is the only tab in `AttendanceSummaryContent.tsx` using a table; the sibling "Entrenamientos" tab (`AttendanceTrainingsTab.tsx`) already solves the "one row per player, variable amount of nested detail" problem with a per-player `Accordion` card grid (`.trainingCardsGrid`, `.trainingCard`), which is the pattern this change ports over.

The prop contract into the tab is unchanged: `rows: PlayerMatchSummary[]`, `columns: MatchAttendanceColumn[]`, `onRefresh?`, `loading?` (from `AttendanceSummaryContent.tsx`). `columns` is already ordered chronologically (index-based `J{n}` labeling happens in the parent); the new component keeps that order when listing matches inside a card.

## Goals / Non-Goals

**Goals:**
- No nested/double scrolling: the tab uses only the page's own scroll (like "Entrenamientos"), regardless of how many matches (`columns.length`) exist.
- The "Amistoso" tag is always visible next to the match it belongs to (inside the card row), never dependent on a sticky/scrolled table header staying in view.
- Reuse the existing `Accordion` card pattern (`AttendanceTrainingsTab.tsx` + its CSS classes) rather than inventing a new one, per the repo convention of following the nearest sibling pattern.
- Preserve every metric currently shown in the table: per-match state (Titular/Convocado/Desconvocado/No convocado) + minutes, and per-player totals (`totalMatches`, `startedMatches`, `notCalledMatches`, `seasonMinutesPlayed`).
- Keep a fast "scan the whole season" view without opening every card — a compact per-match "form strip" of state badges in the card summary.

**Non-Goals:**
- Changing `AttendanceSummaryContent.tsx`'s data-fetching/aggregation logic, or the `PlayerMatchSummary`/`MatchAttendanceColumn` types.
- Adding an Excel export for matches (the trainings tab has one; not requested here — out of scope).
- Sorting/filtering controls beyond what exists today (refresh button only). Sorting by titularidad/minutos was shown as a future note in the spike but is not part of this change.
- Touching `AttendanceDashboardTab.tsx` or `AttendanceTrainingsTab.tsx` themselves.

## Decisions

1. **Port the `Accordion`-per-player pattern from `AttendanceTrainingsTab.tsx` verbatim, not a new abstraction.**
   Same `Box.trainingCardsGrid`-equivalent wrapper (`.matchCardsGrid`, single column — unlike trainings' `auto-fit minmax(320px,1fr)` grid, since match rows need full width to lay out label/badge/minutes/date without wrapping awkwardly), `Accordion`/`AccordionSummary`/`AccordionDetails` structure, `ExpandMoreIcon`. This keeps the two tabs visually/behaviorally consistent (same disclosure affordance) and avoids a third pattern in the same screen.
   *Alternative considered*: a `Card` + custom expand/collapse via local state (matching the old table's `selected` row toggle behavior). Rejected — `Accordion` is already the established sibling pattern one tab over; reinventing it here for no functional gain violates "sigue el patrón del archivo hermano más cercano".

2. **Card summary (collapsed state) shows aggregate chips + a compact form-strip, not just a name.**
   Reuses `.matchMetricChip`/`.matchMetricChipSuccess`/`.matchMetricChipMuted`/`.matchMetricChipInfo` (already defined, currently used in the table's sticky/totals cells) for: `{totalMatches} partidos`, `{startedMatches} tit.`, `{notCalledMatches} no conv.`, `{seasonMinutesPlayed} min temporada`. Additionally, a new small inline "form strip" — one small circular state badge per column, in chronological order, reusing `.matchCell`/`.matchCellStarter`/`.matchCellCalled`/`.matchCellNotCalled`/`.matchCellAbsent` (already defined for the table cells) — sits in the summary row so a coach can scan a player's whole-season pattern without expanding the card, replacing the "read across a table row" glance the matrix gave for free.
   *Alternative considered*: no form strip, rely only on aggregate chips. Rejected — the aggregate numbers alone lose the "shape" of the season (e.g., "titular hasta la lesión, luego suplente") that the matrix made visible at a glance; the strip is what preserves that at low cost (it's the same small badge already styled, just reused outside a table cell).

3. **Expanded detail: one row per match, in chronological column order, each showing name+rival+date, the "Amistoso" tag inline, a state badge, and minutes.**
   New CSS class `.matchDetailRow` (grid: `label/rival/date` column, state badge, minutes — analogous to the spike's `.match-row`), reusing `MatchAttendanceColumn.label`/`.rival`/`.date`/`.isFriendly` and per-cell `MatchAttendanceCell.state`/`.minutesPlayed` exactly as the table did (`cellLabel`/`cellTitle` logic moves over unchanged, only the state now renders as a full-width badge with text label instead of a single-letter table cell, since there's no column-width pressure anymore).
   *Alternative considered*: keep the T/C/D/— single-letter badge (as in the table) inside the detail row too, for minimal visual change. Rejected — once each match has its own full-width row, there's no space constraint forcing an abbreviation, and a readable label ("Titular", "Convocado"...) is strictly better for a detail view meant to be read top-to-bottom; the abbreviated single-letter form is kept only in the collapsed form-strip where space is genuinely tight.

4. **Drop the table-only CSS (`.matchTable*`, `.matchStickyCell`, `.matchHeaderCell`, `.matchTableContainer`, `.matchCellWrap`, `.matchCellMinutes`, `.matchRowClickable`, `.matchTotalsChips`) and the `selected`/`toggleRow` local click-to-highlight state.**
   These only existed to support the table's sticky-column/sticky-header/row-selection mechanics, which no longer apply once the layout is a list of independently-expandable cards (the `Accordion`'s own open/close state replaces "select a row to inspect it").
   *Alternative considered*: leave the unused CSS in place in case another consumer needs it later. Rejected per repo convention ("si estás seguro de que algo no se usa, elimínalo por completo" / no dead code) — grep confirms these classes are only referenced from `AttendanceMatchesTab.tsx`.

5. **Reuse, don't duplicate, the metric-chip and match-state-badge styling already defined for training cards / the old table.**
   `.matchMetricChip*` (from the old table's totals cell) and `.matchCell*` (from the old table's per-match cell) are kept and reused as-is for the new card summary; only new CSS is added for what didn't exist before: the detail row layout (`.matchDetailRow`, `.matchDetailMain`, `.matchDetailMeta`, `.matchStateBadge*`, `.matchFriendlyTag`) and the card grid wrapper (`.matchCardsGrid`). This mirrors how `AttendanceTrainingsTab.tsx` reuses `.absenceItem`/`.playerName`-style classes rather than defining a parallel set.

## Risks / Trade-offs

- [Losing the "whole matrix at a glance" comparison across players in one screen] → Mitigated by the collapsed-state form-strip (decision 2), which gives each card its own at-a-glance season shape; a true cross-player matrix view is explicitly out of scope (non-goal) and can be revisited later if requested.
- [Existing test `AttendanceMatchesTab.minutesAndFriendly.test.tsx` asserts on table-specific text/structure] → Addressed as part of this change: the test file is rewritten (Red→Green) to assert the same behaviors (minutes shown for called players, none for not-called, season-minutes chip, "Amistoso" tag present/absent) against the new card DOM structure, not left broken.
- [`AttendanceSummary.module.css` is shared by all three tabs; removing `.matchTable*` classes could theoretically affect another file] → Verified via `grep` before removal that these classes are only referenced from `AttendanceMatchesTab.tsx` (task 3.5 below); if a false positive is found the class is kept and just left unused-but-safe rather than blocking the change.

## Open Questions

None — direction confirmed by the user from the HTML spike before writing this design.
