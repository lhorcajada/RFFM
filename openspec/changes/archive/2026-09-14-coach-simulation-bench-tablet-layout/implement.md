# Implement script — coach-simulation-bench-tablet-layout

Self-contained execution script for `tasks.md`. Frontend-only (`Front/`). Follow strict TDD
(Red → Green → Refactor) per block: write/adjust tests, confirm they fail for the right reason,
implement the minimal change, confirm green, refactor if needed while staying green.

Do not run `git commit`/`git push` — the user handles that separately.

## Files involved

- `Front/src/apps/coach/pages/convocations/components/simulation/SimulationPlayerSlot.tsx` (+ `.module.css`)
- NEW `Front/src/apps/coach/pages/convocations/components/simulation/BenchPlayerCard.tsx`
- NEW test files co-located under `__tests__/` next to each touched/new component
- `Front/src/apps/coach/pages/convocations/components/SimulacionTab.tsx`
- `Front/src/apps/coach/pages/convocations/components/PartidoEnDirectoTab.tsx`
- `Front/src/apps/coach/pages/convocations/components/SimulacionTab.module.css`

## Block 1 — Trim the on-field player card (global, all viewport sizes)

1. Add/extend `Front/src/apps/coach/pages/convocations/components/simulation/__tests__/SimulationPlayerSlot.test.tsx`.
   Cover the 3 render paths (`prepareMode=true`, `freeRepositionEnabled=true`,
   neither/static) with a player that has `competitiveness` and `readiness`/`fatigue` set.
   Assert: no element with the competitiveness badge text/role is rendered, and
   `PlayerFormBars` is not rendered (mock it or assert on the DOM it would produce, e.g. no
   `title`/testid it emits — inspect `PlayerFormBars` implementation to pick a reliable
   assertion, such as `queryByText` for the rounded competitiveness number, or mocking the
   module with `vi.mock` and asserting it was never called). Keep existing assertions for
   `dorsalBadge`, `playerName`, `enteringBadge`, `leavingBadge`, `goalBadge`, `usedBadgeSlot`.
   Run tests, confirm Red.
2. In `SimulationPlayerSlot.tsx`, remove the `compBadge` JSX block and the
   `<PlayerFormBars variant="compact" ... className={styles.formBarsField} />` element from all
   three functions (`DraggablePrepareCard`, `DraggableStaticCard`, `StaticCard`). Remove the now
   unused `PlayerFormBars` import if nothing else in the file uses it.
3. In `SimulationPlayerSlot.module.css`, delete `.compBadge`, `.compTagHigh`, `.compTagMid`,
   `.compTagLow`, `.formBarsField` if grep confirms no other file references them.
4. Run the test file, confirm Green. Run `npm run build` mentally is not enough — actual build
   happens in the final verification block.

## Block 2 — Extract the rich bench card to a shared module

1. Add `Front/src/apps/coach/pages/convocations/components/simulation/__tests__/BenchPlayerCard.test.tsx`.
   This file does not exist yet, so start by writing it against the *intended* new module path
   (`../BenchPlayerCard`) — it will fail to even resolve the import (Red, for the right reason:
   module doesn't exist yet). Cover:
   - `BenchPlayerCard` renders photo/initials, dorsal, name, competitiveness tag, streak badge,
     minutes tag (or SALE when `isLeaving`), and the form bars.
   - `groupBenchPlayers` groups a mixed list of `SquadPlayer` by `BENCH_POSITION_GROUPS` and
     puts unmatched positions in an "others" group only when non-empty.
   - `DraggableBenchCard` renders `BenchPlayerCard` inside a draggable wrapper (assert the
     wrapping element exists; dnd-kit's `useDraggable` needs a `DndContext` ancestor in the
     test — wrap the render in a minimal `<DndContext>`).
   - `DroppableBench` renders its children inside a droppable wrapper (same `DndContext` need).
2. Create `BenchPlayerCard.tsx` in `components/simulation/`, moving `BenchPlayerCard`,
   `DraggableBenchCard`, `DroppableBench`, `BENCH_POSITION_GROUPS`, `groupBenchPlayers` verbatim
   from `SimulacionTab.tsx` (content unchanged — same JSX, same CSS class names). Import styles
   from `../SimulacionTab.module.css` (relative to `components/simulation/`, i.e.
   `../../SimulacionTab.module.css` — verify the actual relative path once the file exists,
   since `SimulacionTab.module.css` lives in `components/`, one level above
   `components/simulation/`). Export `SquadPlayer`-typed props exactly as today.
3. Run the new test file, confirm Green.
4. Do NOT yet remove the originals from `SimulacionTab.tsx`/`PartidoEnDirectoTab.tsx` — that
   happens in Blocks 3/4 so each tab's own test suite stays green throughout.

## Block 3 — Integrate in `SimulacionTab.tsx`

1. Replace the local `BenchPlayerCard`/`DraggableBenchCard`/`DroppableBench`/
   `BENCH_POSITION_GROUPS`/`groupBenchPlayers` definitions with an import from
   `./simulation/BenchPlayerCard`. Delete `flattenBenchPlayers` (dead code, confirmed unused).
   Remove the now-unused `useDraggable`/`useDroppable`/`CSS` imports from dnd-kit **only if**
   nothing else in the file still uses them directly (the file's own `DndContext`/sensors setup
   uses different imports — check before deleting).
2. Compute `onFieldPlayers`: mirror the existing `benchPlayers` memo but inverted — players
   whose id IS in `Object.values(activeSlots)` (where `activeSlots = sim.prepareMode ?
   sim.prepareSlotsPreview : sim.slots`). Reuse the same `sim.playerMinutes`/`sim.playerStates`
   lookups the current bench panel uses for `minutesPlayed`/`hasPlayed`.
3. Add markup: wrap the existing `.sidePanel` block and a new `.onFieldPanel` block inside a new
   `.benchListsRow` div, both inside `.rightColumn`, `SubstitutionHistoryPanel` staying as the
   next sibling after `.benchListsRow`. The `.onFieldPanel` block renders `onFieldPlayers`
   grouped via `groupBenchPlayers`, using bare `BenchPlayerCard` (no `DraggableBenchCard`, no
   `DroppableBench`) — read-only. Give it a header (e.g. "En el campo") and count badge
   mirroring `.panelHeader`/`.panelBadge` structure.
4. Write/extend a `SimulacionTab` test (Vitest + Testing Library, `MemoryRouter` if routing is
   involved) asserting: (a) dragging a bench card onto a field slot still calls through to
   `movePreparePlayer` behavior (test via the existing DnD test pattern already in the repo, or
   assert the resulting DOM state after simulating a `DragEndEvent` if that's how existing tests
   for this file work — inspect any existing `SimulacionTab` test file first for the established
   pattern before inventing a new one); (b) the "En el campo" list renders read-only cards for
   players currently on field and none of its cards has drag listeners/attributes.
5. Run the file's test suite, confirm Green.

## Block 4 — Integrate in `PartidoEnDirectoTab.tsx`

1. Repeat step 3.1–3.3 for this file (its local hook is `live` instead of `sim` — same shape for
   `slots`/`prepareSlotsPreview`/`prepareMode`/`playerMinutes`/`playerStates`).
2. Add/extend tests equivalent to 3.4, plus one confirming `freeRepositionEnabled` dragging
   still works by dragging directly on field cards (not through bench/on-field lists) — this
   behavior must be unchanged.
3. Run the file's test suite, confirm Green.

## Block 5 — Three-tier responsive CSS in `SimulacionTab.module.css`

1. Add `.benchListsRow` (default: no special layout effect — let `.sidePanel` keep behaving as
   it does today when `.onFieldPanel` is hidden) and `.onFieldPanel` (same visual treatment as
   `.sidePanel` — background, border, radius, header — `display: none` by default).
2. Add a new media query `@media (min-width: 781px) and (max-width: 1200px)`:
   - `.main { flex-direction: column; }`
   - `.benchListsRow { flex-direction: row; flex-wrap: wrap; gap: 12px; }`
   - `.sidePanel, .onFieldPanel { flex: 1 1 320px; max-height: min(42vh, 420px); overflow-y: auto; }`
   - `.onFieldPanel { display: flex; flex-direction: column; }`
3. Leave the existing `@media (max-width: 780px)` block as-is unless a conflict with the new
   classes appears (e.g. `.onFieldPanel` must stay hidden there — it already defaults to
   `display: none`, so no override needed unless the tablet media query's `display: flex` isn't
   scoped correctly — double check media query ordering/specificity in CSS, since a
   `min-width:781px` block declared after `max-width:780px` in the stylesheet won't leak into
   the mobile range because ranges don't overlap, but verify by reading final file).
4. No JS changes needed for this block — verify visually with browser devtools at 1180×820,
   820×1180 (tablet), ~1280px width (desktop) and ~375px (mobile) after Block 6's build.

## Block 6 — Final verification

1. `cd Front && npm run test` — full suite green, no skipped tests.
2. `cd Front && npm run build` — must succeed with strict TypeScript.
3. Manually reason about (or visually check via dev server if available) iPad 10" landscape/
   portrait scrolling behavior for a long bench list.
4. Confirm desktop/mobile layouts are visually unchanged aside from the field-card trim.
5. `openspec validate coach-simulation-bench-tablet-layout --strict` from repo root.
6. Report: files touched, test results, build result, and any on-the-fly design decisions.
