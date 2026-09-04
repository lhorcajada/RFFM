## Context

`AttendanceSummaryContent.tsx` builds a `SummaryByType` (`{total, training, match, other}`, each a `{events, attend, absent}`) and passes it to `AttendanceDashboardTab.tsx`, which renders 4 static stat cards. Per-event data already flows through the component while building this aggregate but is discarded:

- **Match/Other**: the first pass (`eventsWithConvocations.filter(isEventFinished).forEach(...)`) computes one `eventSummary: Summary` per finished event (gated by `acceptedSet`, i.e. only literally-"Accepted"-status convocations count), then folds it into `nextSummary.training/match/other` via `addSummary` and discards the per-event object.
- **Training**: `nextSummary.training` is *recalculated and overwritten* afterwards from `teamConvocations` grouped **by player** (`nextRows`), using a richer per-convocation classifier (`isAttendById`/`isAbsentById`, with a fallback to a justified-absence `statusId` when `assistanceTypeId` is null) — this is what a recent fix (`fix(front): make dashboard "Resumen global" always match its tiles`) made `nextSummary.total` derive from, instead of the discarded first-pass training numbers.

This means training and match/other currently use **two different per-convocation classifiers** for what counts as "attended"/"absent". That's an existing, already-accepted asymmetry (training's classifier is richer and is the one that's now authoritative for the aggregate) — the per-event breakdown for training must reuse training's own (richer) classifier, not match/other's simpler one, or the per-event bars and the card's own aggregate % would disagree again, reintroducing the exact class of bug that was just fixed for the global total.

## Goals / Non-Goals

**Goals:**
- Replace the accumulated `Eventos/Asisten/No asisten` block on the Entrenamientos/Partidos/Otros cards with a bar chart: one bar per finished event of that category, height = that event's attendance %.
- Card header keeps a single aggregate % (already computed today) as a reference figure next to the title — not removed, just no longer the only figure.
- Windowed view (last 5 events) with ◀▶ navigation across the full season, mirroring `AttendanceMatchesTab`'s `FORM_STRIP_MAX_MATCHES` pattern.
- Hover/tap tooltip per bar (event title, date, attend/absent, %) and a "Ver como tabla" fallback view — both required by the `dataviz` skill's accessibility pass (table view always available; identity never color-alone).
- Training's per-event numbers must be computed with training's own richer classifier (see Context), so `sum(per-event attend/absent) === card's aggregate attend/absent` always holds, by construction — same discipline as the recent total-vs-tiles fix.
- Resumen global stays exactly as-is (single aggregate stat tile) — it's a cross-category total, "evento a evento" doesn't apply to it.

**Non-Goals:**
- No change to how `SummaryByType`/aggregate % are computed (already correct after the recent fix) — this change only adds a parallel per-event breakdown alongside it, it doesn't touch the aggregation math itself except where explicitly noted (see Decision 2).
- No backend changes — all data needed (convocations per event, event dates/titles) is already fetched by `AttendanceSummaryContent.tsx`.
- No changes to the Partidos/Entrenamientos tabs' own per-match/per-training-session displays (those already show individual sessions in their own way; this change is scoped to the Dashboard tab only).
- No dark/light theme toggle — the app has a single dark theme (`--rffm-*` tokens, no light variant anywhere in the codebase); the chart uses hard-coded dark-mode colors consistent with the rest of `AttendanceSummary.module.css`, not a themed token system.

## Decisions

1. **New type `EventAttendancePoint`** in `types.ts`:
   ```ts
   export type EventAttendancePoint = {
     eventId: string;
     label: string;        // short axis label, e.g. "J3", "E12", "R1" — reuse Partidos' J/A-numbering convention for matches; training/other get a simple sequential "E{n}"/"R{n}"
     date: string | null;
     title: string;        // full name shown in tooltip/table, e.g. "J3 · vs Parla", "Entrenamiento 12"
     total: number;        // convocations counted for this event
     attend: number;
     absent: number;
   };
   export type CategoryAttendance = {
     summary: Summary;               // unchanged aggregate, still used for the card's headline %
     events: EventAttendancePoint[]; // chronological order, oldest first (windowing takes the last N)
   };
   export type DashboardData = {
     total: Summary;
     training: CategoryAttendance;
     match: CategoryAttendance;
     other: CategoryAttendance;
   };
   ```
   `AttendanceSummaryContent` builds and stores `DashboardData` (replacing the `SummaryByType` state) and passes it to `AttendanceDashboardTab`.

2. **Match/Other per-event points**: collect the existing first-pass `eventSummary` (already computed per event, per category, in the `eventsWithConvocations...forEach` loop) into `training`/`match`/`other` arrays instead of only folding it into the running aggregate — same numbers, just also kept individually. No calculation changes.

3. **Training per-event points use training's own richer classifier**, applied per event instead of per player:
   ```ts
   const trainingEvents: EventAttendancePoint[] = allEvents
     .filter((event) => activeTrainingEventIds.has(event.id))
     .map((event) => {
       const eventConvocations = teamConvocations.filter((row) => row.eventId === event.id);
       const attend = eventConvocations.filter((row) => isAttendById(row.assistanceTypeId)).length;
       const absent = eventConvocations.filter(
         (row) =>
           isAbsentById(row.assistanceTypeId) ||
           (row.assistanceTypeId == null && row.statusId != null && absenceStatusSet.has(row.statusId))
       ).length;
       return {
         eventId: event.id,
         label: `E${...}`, // sequential index within activeTrainingEventIds, chronological
         date: getEventDate(event),
         title: event.title ?? event.name ?? "Entrenamiento",
         total: attend + absent,
         attend,
         absent,
       };
     })
     .sort(by date ascending);
   ```
   This is the exact same classifier `nextRows` already uses per player — applied per event instead. Because both derive from the same `teamConvocations` rows and the same predicate, `trainingEvents.reduce(sum attend) === nextSummary.training.attend` holds structurally, not by coincidence.
   *Alternative considered*: reuse the simpler first-pass `eventSummary` for training too (like match/other), for a single code path. Rejected — that's the exact calculation the recent fix moved *away* from for the aggregate; using it for the per-event bars while the card header keeps the richer aggregate would silently reintroduce a mismatch between the bars and the % shown next to them.

4. **New shared component `AttendanceEventChart.tsx`**, props `{ title, icon, color, aggregate: Summary, events: EventAttendancePoint[] }`, owns:
   - Windowing state (`useState` start index, default = `Math.max(0, events.length - 5)`), ◀▶ handlers clamped to `[0, events.length - 5]`.
   - SVG bar chart (viewBox-scaled, `width:100%` for mobile), one `<rect>` per event in the current window, height proportional to `attend/total`, rounded top corners (per `dataviz` mark specs), gridlines at 25/50/75%, baseline axis.
   - A single shared tooltip (positioned via mouse/touch coordinates) showing title/date/attend/absent/%.
   - A `<table>` (native, `hidden` by default) listing all events (not just the window) with a "Ver como tabla" / "Ocultar tabla" toggle button — the `dataviz` skill's required non-color-dependent fallback.
   - Reused by `AttendanceDashboardTab` three times (training/match/other), each with its own validated color (Decision 5) and icon (reusing the icons already used today: `FitnessCenterIcon`/`SportsSoccerIcon`/`HelpOutlineIcon`).
   *Alternative considered*: one component per category (`TrainingChart`, `MatchChart`, `OtherChart`). Rejected — the three only differ in color/icon/title, a single parametrized component avoids duplicating the windowing/tooltip/table logic three times, following the repo's general "no duplicate logic across near-identical components" convention.

5. **Colors**, validated with the `dataviz` skill's `scripts/validate_palette.js` against the app's real dark card surface (`--rffm-card-bg: #1c1c30`) — all checks pass (lightness band, chroma floor, CVD separation, normal-vision floor, contrast ≥3:1):
   - Entrenamientos: `#3987e5` (blue)
   - Partidos: `#199e70` (aqua/green — deliberately not orange, since orange is already heavily used elsewhere in this screen for the friendly-match/goalkeeper-jersey badges; reusing it here would blur that existing meaning)
   - Otros eventos: `#9085e9` (violet)
   Declared as new CSS custom properties in `AttendanceSummary.module.css` (e.g. `--chart-training`, `--chart-match`, `--chart-other`) rather than hard-coded per-component hex, so a future re-theme only touches one place.

6. **Windowing default and empty state**: if a category has 0 finished events, `AttendanceEventChart` shows the existing `EmptyState` pattern already used elsewhere on this screen (e.g. "Sin datos de partidos" in `AttendanceMatchesTab`) instead of an empty chart — an empty SVG with no bars and a "0–0 de 0" pager reads as broken, not "no data yet".

## Risks / Trade-offs

- [Training's per-event classifier duplicates predicate logic already inlined in `nextRows`' construction] → Accepted for this change (matches the existing per-file duplication convention seen elsewhere in this codebase, e.g. `isGoalkeeperPosition` duplicated across `AttendanceMatchesTab.tsx`/`AttendanceTrainingsTab.tsx`/`matchAttendancePdfExport.ts`); a shared extraction is a reasonable follow-up but out of scope here since `isAttendById`/`isAbsentById`/`absenceStatusSet` are closures over data resolved earlier in the same function, not easily hoisted without a larger refactor.
- [Removing the accumulated `Eventos/Asisten/No asisten` numbers from the category cards loses an at-a-glance total] → Mitigated: the aggregate % stays in the card header, and "Ver como tabla" exposes the same attend/absent numbers per event (summable by the user if needed); the season-total attend/absent count was identified by the user as low-value ("mezcla la primera jornada con la última").
- [SVG bar chart must stay legible on narrow mobile widths with only 5 bars] → `viewBox`-scaled SVG at `width:100%` with the existing `.grid` breakpoint (`@media max-width:920px { grid-template-columns:1fr }`) already collapsing cards to full width before the chart itself needs to shrink further; verified in the spike at a 400px viewport.

## Open Questions

None — direction and colors confirmed by the user from the HTML spike before writing this design; the "no explanatory copy in the real app" note from the spike review is already reflected in the proposal (no lede text, no "Spike" framing in the shipped component).
