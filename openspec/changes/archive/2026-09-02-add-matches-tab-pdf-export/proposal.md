## Why

The "Partidos" tab of the Coach attendance summary (`/coach/attendance/summary?teamId`) was recently redesigned from a matrix table to a per-player card list (`AttendanceMatchesTab.tsx`, change `redesign-attendance-matches-tab-cards`, archived). The sibling "Entrenamientos" tab already lets a coach export its per-player data to Excel (`.trainingToolbar` button). Coaches now ask for the same offline-sharing capability on "Partidos", but as PDF rather than Excel — one PDF matching what the collapsed cards show (a quick season overview to hand a coordinator), and a second PDF that also includes the match-by-match detail currently only visible by expanding each card (for a full written record).

## What Changes

- Add an **"Exportar resumen"** button to `AttendanceMatchesTab.tsx`'s `.matchToolbar` (next to the "N jornadas"/"N amistosos" chips) that generates a PDF with, per player, the same data shown in the collapsed card: photo-derived identity (name + dorsal, colored jersey badge blue/red by position), and the aggregate chips (partidos, titularidades, no convocados, minutos de temporada) plus the season form strip.
- Add an **"Exportar completo"** button next to it that generates a PDF with everything from "resumen" plus, per player, one row per match: jornada label, rival, date, "Amistoso" tag when applicable, state (Titular/Convocado/Desconvocado/No convocado), and minutes played.
- Both PDFs list players in exactly the order `rows` arrives in the component (dorsal ascending, associated player first — same order already on screen) — no re-sorting inside the export.
- Both buttons are hidden for Player/FamilyPlayer/FamilyMember roles, mirroring `AttendanceTrainingsTab`'s `canExportExcel` check.
- New frontend-only module `matchAttendancePdfExport.ts` (jsPDF direct-drawing, no `html2canvas`) exporting `exportMatchesSummaryPdf()` and `exportMatchesFullPdf()`.

## Capabilities

### Modified Capabilities
- `coach-attendance-matches-tab`: adds PDF export requirements to the existing "Partidos" tab capability.

## Impact

- `Front/src/apps/coach/pages/attendance/components/summary/AttendanceMatchesTab.tsx` (export buttons + role check)
- `Front/src/apps/coach/pages/attendance/components/summary/matchAttendancePdfExport.ts` (new)
- `Front/src/apps/coach/pages/attendance/AttendanceSummary.module.css` (toolbar layout for the new buttons)
- No backend changes. No changes to `PlayerMatchSummary`/`MatchAttendanceColumn` types — all data already reaches the tab as-is.
