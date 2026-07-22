## Context

`Front/src/apps/coach/pages/game-model/` renders a 6-level hierarchy: `GameMoment → Zone → Scenario →
SubPrinciple → SubSubPrinciple → EssentialSkill`. `GameMoment`/`Zone` already use MUI `Tabs`
(`GameModel.tsx` lines ~324-371, `GameModelCreate.tsx` lines ~203-255) — these are unchanged by this
design. Below that, both the read view (`ScenarioAccordion.tsx`) and the editor
(`ScenarioFormAccordion.tsx`) nest 3 MUI `Accordion` components (Scenario → SubPrinciple →
SubSubPrinciple), each shrinking font size/padding via CSS Modules with no media queries. Reordering
`SubPrinciple`/`SubSubPrinciple` uses native HTML5 `draggable` (`ScenarioFormAccordion.tsx` lines
293-328, 465-500) dispatching `MOVE_SP`/`MOVE_SSP` on `GameModelDraftContext`
(`Front/src/apps/coach/context/GameModelDraftContext.tsx`), which has no touch fallback.

Constraints:
- `GameModelDraftContext`'s reducer (`SET_NAME`, `ADD_*`/`UPD_*`/`DEL_*`/`MOVE_*` actions) must not
  change shape — it's the single source of truth for the draft and other tests/consumers depend on it.
- `GameModelPrintView.tsx` is explicitly out of scope (print-only, separate rendering path).
- No backend involvement; `gameModelService`/types (`../../types/gameModel`) are unchanged.
- Coach app theme (`muiCoachTheme.ts`) does not override MUI's default breakpoints, so `md = 900px`.

## Goals / Non-Goals

**Goals:**
- Replace the 3-level nested-Accordion chain with a reusable drill-down navigation shell usable at
  every nesting depth, without changing `GameModelDraftContext`'s action shapes.
- Master-detail (list + detail side by side) at `>= md` (900px); single-pane drill-down with a back
  button below `md`.
- Keep the Moment/Zone `Tabs` untouched (files touched only to swap what renders below them).
- Add "move up"/"move down" icon-button reordering (always available, all breakpoints) alongside
  existing drag-and-drop, reusing `MOVE_SP`/`MOVE_SSP` unchanged.
- 44px minimum touch target for interactive elements at `sm`/`md` breakpoints.
- Sticky bottom save/cancel bar on mobile in the editor, without modifying the shared
  `ContentLayout`/`ActionBar` components (they're used by both Federation and Coach; changing them is
  out of scope and would need cross-app verification we're not doing here).
- No visual overflow/illegible text at 320px viewport width.

**Non-Goals:**
- Redesigning `GameModelPrintView.tsx`, `CreateSessionFromSubPrinciple.tsx`,
  `SessionsFromSubPrinciple.tsx`, or the Moment/Zone `Tabs`.
- Changing `GameModelDraftContext` reducer action shapes or `gameModelService` contracts.
- Persisting the user's navigation position (selected scenario/subprinciple) across reloads — it's
  transient UI state, reset on data reload like today's `momentTab`/`zoneTab`.
- Building a fully generic "any-depth" recursive drill-down abstraction — 3 concrete levels
  (Scenario/SubPrinciple/SubSubPrinciple) is the actual need; the shared shell is reusable but each
  page wires it explicitly per level (no dynamic recursion), keeping types simple and strict-mode
  friendly.

## Decisions

### 1. One shared presentational shell: `DrillDownPanel`

New component `Front/src/apps/coach/pages/game-model/components/DrillDownPanel.tsx` (+
`DrillDownPanel.module.css`, + `DrillDownPanel.test.tsx`). It is generic over an item type `T` and is
purely a navigation/layout shell — it knows nothing about scenarios, subprinciples, drafts, or
dispatch:

```tsx
interface DrillDownPanelProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string | number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onBack: () => void;
  renderListItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
  renderDetail: (item: T, index: number) => React.ReactNode;
  renderListFooter?: React.ReactNode; // e.g. "Add scenario" button
  listAriaLabel: string;
  emptyMessage: string;
}
```

Behavior (internal `useMediaQuery(theme.breakpoints.down('md'))`):
- **Mobile** (`< md`): if `selectedIndex === null`, render the list full-width; else render only the
  detail panel full-width with a header containing a "Volver" `IconButton` (`ArrowBackIcon`) calling
  `onBack`.
- **Tablet/Desktop** (`>= md`): render list (fixed-width column, ~320px, internally scrollable) and
  detail (flex-grow column, internally scrollable) side by side in a CSS Grid/Flex row. Selecting an
  item highlights it in the list; if `selectedIndex === null` the detail pane shows `emptyMessage`
  (does not auto-select, to avoid surprising jumps when list length changes from add/delete).

Why a shared shell instead of duplicating layout logic in each of `ScenarioAccordion`,
`SubPrincipleAccordion`, `ScenarioFormAccordion`, `SubPrincipleForm`: the master-detail/drill-down
switch, back-button wiring, and responsive breakpoint logic are identical at every level — duplicating
it 4+ times is exactly the kind of density/maintenance problem that caused the original bug (decreasing
nested CSS with `!important`). Keeping it presentation-only (no knowledge of `dispatch` or draft shape)
means it's testable in isolation and reusable for both the read view and the editor.

Alternative considered: a fully generic recursive `<HierarchyDrillDown items={...} getChildren={...}>`
that walks the whole 3-level tree itself. Rejected — the read view and editor need materially
different `renderListItem`/`renderDetail` content (inline `TextField`s + drag/reorder buttons in the
editor vs. read-only `Typography`/`Chip` in the view), so a data-driven recursive walker would need as
much per-level configuration as just calling `DrillDownPanel` explicitly 2-3 times per page — same
complexity, less type safety (strict mode struggles to type a generic recursive shape here without
`any`).

### 2. Levels wired per page (explicit composition, not recursion)

- **Editor** (`ScenarioFormAccordion.tsx`, rewritten internally, same file/exports):
  `ScenarioFormAccordion` → `DrillDownPanel<Scenario>` (list = scenario cards with name/context
  fields... no — list items are compact summary rows; full name/context/principles editing happens in
  the detail pane) → detail renders `ScenarioDetailForm` which itself renders a second
  `DrillDownPanel<SubPrinciple>` for subprinciples → detail renders `SubPrincipleDetailForm` which
  renders a third `DrillDownPanel<SubSubPrinciple>` for sub-subprinciples → detail renders
  `SubSubPrincipleDetailForm` (name/action fields + flat editable `EssentialSkill` list, no further
  drill-down — matches proposal's "no over-engineering" guidance since skills are a flat list already).
- **Read view** (`ScenarioAccordion.tsx`, rewritten internally, same file/exports):
  `ScenarioAccordion` → `DrillDownPanel<Scenario>` → detail renders `ScenarioDetailView` which renders
  a second `DrillDownPanel<SubPrinciple>` for subprinciples → detail renders `SubPrincipleDetailView`
  which renders the existing `SubSubPrincipleCard` list *unchanged in structure* (already a flat,
  touch-friendly `Collapse` card list, not an `Accordion` — only responsive CSS touch-ups needed, no
  drill-down, per the proposal's explicit "read view can stay simpler" guidance).
- Filenames `ScenarioAccordion.tsx` and `ScenarioFormAccordion.tsx` are kept (internals rewritten) to
  avoid rippling import-path changes into `GameModel.tsx`/`GameModelCreate.tsx` beyond what's already
  planned, per the "keep diffs minimal" convention. `SubSubPrincipleCard.tsx` is untouched structurally
  (only CSS touch-target/responsive fixes).

### 3. Navigation state lives in local component state, not `GameModelDraftContext`

Each level's `selectedIndex` (`si`, `pi`, `qi`) is `useState` in the component that owns that
`DrillDownPanel` instance (mirrors the existing pattern where `momentTab`/`zoneTab` already live in
local state in `GameModel.tsx`/`GameModelCreate.tsx`, not in a shared context). This is pure UI
navigation, not draft data — no reason to add reducer actions or context fields for it. When a
`Scenario`/`SubPrinciple`/`SubSubPrinciple` is deleted at an index at or below the current selection,
the owning component resets `selectedIndex` to `null` (mobile: goes back to the list; desktop: detail
pane shows the empty state) to avoid pointing at a stale/shifted index.

### 4. Reorder: keep drag-and-drop, add move-up/move-down buttons

`renderListItem` for `SubPrinciple`/`SubSubPrinciple` rows in the editor keeps the existing
`draggable` handle (desktop mouse users) and adds two `IconButton`s (`ArrowUpwardIcon`/
`ArrowDownwardIcon`, `aria-label="Mover arriba"`/`"Mover abajo"`) that dispatch the *same*
`MOVE_SP`/`MOVE_SSP` actions with `from`/`to` computed as `index - 1`/`index + 1`, disabled at the
first/last position. No reducer changes. This is the accessible/touch fallback required by acceptance
criterion 4 and works identically on desktop (keyboard/mouse) and touch.

### 5. Touch targets and responsive field stacking

- CSS Modules for `DrillDownPanel`, the new `*DetailForm`/`*DetailView` components, and fixes to
  `ScenarioFormAccordion.module.css`/`SkillRow`'s `.skillNameField`/`.skillDescField` add
  `@media (max-width: 899.95px)` (MUI `md` breakpoint boundary) rules: fields go `flex-direction:
  column`, `min-height: 44px` on `TextField`/`IconButton`/`Button` root, `flex-basis: auto` instead of
  the current fixed `200px`.
- No new colors/fonts introduced; reuse existing CSS custom properties already defined for the Coach
  dark/orange theme (`--rffm-card-bg`, etc. — exact token names taken from the existing `.module.css`
  files at implementation time).

### 6. Sticky save/cancel bar scoped to `GameModelCreate.tsx` only

Rather than modifying the shared `ContentLayout`/`ActionBar` (used by every Coach and Federation page),
`GameModelCreate.tsx` renders a second, page-local bar: a `Box` with `className={styles.mobileActionBar}`
that is `display: none` by default and, under a `@media (max-width: 899.95px)` query, becomes
`position: sticky; bottom: 0` containing the same Save/Cancel `Button`s (reusing `handleTriggerSave`/
`handleCancel`, no new logic). The existing `ContentLayout` `actionBar` prop keeps working unchanged for
desktop and for every other page — zero cross-app risk.

## Risks / Trade-offs

- [Risk] Splitting one large `Accordion` file into `DrillDownPanel` + 3 `*DetailForm`/`*DetailView`
  components per page increases file count and could fragment logic. → Mitigation: keep
  `ScenarioFormAccordion.tsx`/`ScenarioAccordion.tsx` as the composition root that imports and wires the
  sub-components; co-locate new sub-components either inline in the same file (if small) or as
  siblings in `components/` following the existing flat-file convention in this folder — decided at
  task-execution time per component size, not pre-split arbitrarily.
- [Risk] `DrillDownPanel`'s master-detail mode changes visual density expectations for
  desktop/tablet users used to expand-all accordions. → Mitigation: default to no selection (list
  visible, detail empty-state) rather than auto-expanding everything, matching the existing pattern
  where accordions defaulted to collapsed except when there was exactly one item
  (`defaultExpanded={... .length === 1}` in the current code) — replicate that as "auto-select index 0
  when there is exactly one item."
- [Risk] Removing `Accordion`/`AccordionSummary`/`AccordionDetails` changes keyboard navigation and
  screen-reader semantics. → Mitigation: `DrillDownPanel` list items use `role="button"`/real
  `<button>` semantics with `aria-current="true"` on the selected item, and the detail panel headers
  use a real heading + back `IconButton` with `aria-label`; verified in `DrillDownPanel.test.tsx` via
  Testing Library role/name queries (not snapshot tests).
- [Trade-off] Local `useState` for `selectedIndex` per level means navigation position resets on
  season/model reload, same as today's `momentTab`/`zoneTab` reset in `GameModel.tsx` (`setMomentTab(0)`,
  `setZoneTab(0)` in the `loadModel` effect) — accepted as consistent existing behavior, not a
  regression.

## Migration Plan

No data migration — this is a pure UI/component refactor with no API or draft-shape changes. Rollout is
a single frontend deploy. Rollback is a plain revert of the Front/ diff (no backend coordination, no
feature flag needed given `Front/` is deployed as one static bundle).

## Open Questions

- Exact CSS custom property names for spacing/border tokens to reuse in new components — resolve by
  reading the current `ScenarioFormAccordion.module.css`/`ScenarioAccordion.module.css` at
  implementation time rather than guessing here.
- Whether `DrillDownPanel`'s list column width on `md`/`lg` should be a fixed px or a responsive
  fraction (`minmax(280px, 25%)`) — resolve empirically during implementation by checking against
  320px/768px/1024px/1440px viewports per the acceptance criteria.
