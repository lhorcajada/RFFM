## 1. Shared `DrillDownPanel` shell (TDD)

- [x] 1.1 Write `Front/src/apps/coach/pages/game-model/components/DrillDownPanel.test.tsx` (Red):
      Testing Library tests asserting (a) below `md` with `selectedIndex=null` the list renders and
      detail does not, (b) selecting an item shows detail + "Volver" button and hides the list, (c)
      clicking "Volver" calls `onBack` and returns to the list, (d) at/above `md` both list and detail
      render simultaneously regardless of selection, (e) selected list item exposes
      `aria-current="true"`, (f) empty `items` renders `emptyMessage` in the detail area. Mock
      `useMediaQuery` (e.g. via `vi.mock('@mui/material/useMediaQuery')` or by wrapping in a
      `ThemeProvider` + `window.matchMedia` mock, matching the existing pattern used by other
      responsive tests in the repo if any, otherwise establish one here) to control breakpoint in each
      test. Confirm tests fail (component doesn't exist yet).
- [x] 1.2 Implement `DrillDownPanel.tsx` (Green): generic `<T>` presentational component per
      `design.md` Decision 1 (props: `items`, `getKey`, `selectedIndex`, `onSelect`, `onBack`,
      `renderListItem`, `renderDetail`, `renderListFooter?`, `listAriaLabel`, `emptyMessage`), using
      `useMediaQuery(theme.breakpoints.down('md'))` to switch between drill-down and master-detail
      layout. Real `<button>`/`role="button"` semantics for list items, real heading + `IconButton`
      (`ArrowBackIcon`, `aria-label="Volver"`) in the mobile detail header.
- [x] 1.3 Create `DrillDownPanel.module.css`: CSS Grid/Flex master-detail layout (list column
      ~320px fixed on `md+`, detail column flex-grow, both independently scrollable), no fixed pixel
      widths that could overflow at 320px, reuse existing Coach CSS custom properties (inspect
      `ScenarioAccordion.module.css`/`ScenarioFormAccordion.module.css` for exact token names before
      introducing any new value).
      Verify: `npm run test -- DrillDownPanel` passes (Green), then Refactor if needed while staying
      green.

## 2. Editor: SubSubPrinciple detail form + skills touch-target fix (TDD)

- [x] 2.1 Write tests for the new `SubSubPrincipleDetailForm` (name/action fields + flat editable
      `EssentialSkill` list) asserting: fields render with current values, editing dispatches
      `UPD_SSP`/`UPD_SKILL` with the right mi/zi/si/pi/qi/ki indices (mock `dispatch` via
      `GameModelDraftContext`'s existing test-friendly provider pattern — check how other
      `game-model` tests, if any, wrap `useGameModelDraft` consumers), and skill rows stack vertically
      with `min-height: 44px` computed style below `md`. Confirm failing (Red).
- [x] 2.2 Implement `SubSubPrincipleDetailForm` (extracted from the current
      `SubSubPrincipleForm` in `ScenarioFormAccordion.tsx`, adapted to be a detail-pane component
      instead of an `Accordion`) and fix `SkillRow`'s `.skillNameField`/`.skillDescField` CSS in
      `ScenarioFormAccordion.module.css` to stack in a column with `min-height: 44px` under
      `@media (max-width: 899.95px)`, replacing the fixed `flex: 0 0 200px`. Verify: `npm run test --
      SubSubPrincipleDetailForm` (or equivalent test file name) passes (Green).

## 3. Editor: SubPrinciple detail form using DrillDownPanel for SubSubPrinciples (TDD)

- [x] 3.1 Write tests for `SubPrincipleDetailForm` asserting: context/tacticalPrinciples fields
      dispatch `UPD_SP` correctly, "Añadir sub-subprincipio" dispatches `ADD_SSP`, the
      subsubprinciple list renders via `DrillDownPanel`, each list row exposes working "Mover arriba"/
      "Mover abajo" buttons that dispatch `MOVE_SSP` with correct `from`/`to`, and the first/last row's
      corresponding button is `disabled`. Confirm failing (Red).
- [ ] 3.2 Implement `SubPrincipleDetailForm` (extracted/adapted from the current `SubPrincipleForm`)
      wiring a `DrillDownPanel<SubSubPrinciple>` instance, list rows keeping the existing `draggable`
      handle plus the new move-up/move-down `IconButton`s (per `design.md` Decision 4), detail renders
      `SubSubPrincipleDetailForm` from Task 2. Verify: relevant test file passes (Green).

## 4. Editor: Scenario detail form using DrillDownPanel for SubPrinciples, and rewrite `ScenarioFormAccordion` composition root (TDD)

- [x] 4.1 Write/extend tests (new or extend existing `ScenarioFormAccordion` tests if present) asserting:
      the scenario-level `DrillDownPanel<SubPrinciple>` renders subprinciple rows with move-up/down
      buttons wired to `MOVE_SP`, "Añadir subprincipio" dispatches `ADD_SP`, and selecting/back
      navigates correctly at both breakpoints (reuse the `useMediaQuery` mocking approach from Task 1).
      Confirm failing where behavior changed (Red).
- [x] 4.2 Rewrite `ScenarioFormAccordion.tsx` internals (same file, same default export/props) to:
      remove the 3 nested `Accordion`s, wrap the top-level scenario list of `ZoneFormContent` in a
      `DrillDownPanel<Scenario>` (or keep the outer `Box`/list mapping in `GameModelCreate.tsx`'s
      `ZoneFormContent` and only replace the nested tiers — decide based on where the scenario-level
      list currently maps in `GameModelCreate.tsx` and keep that responsibility there per `design.md`
      Decision 2), and compose `SubPrincipleDetailForm` from Task 3 as the scenario detail's
      subprinciple section. Verify: `npm run test -- ScenarioFormAccordion` passes (Green).
- [x] 4.3 Update `ScenarioFormAccordion.module.css`: remove now-unused nested-accordion rules,
      add `@media (max-width: 899.95px)` stacking for the scenario/context/tacticalPrinciples fields
      and 44px minimum touch target for all `Button`/`IconButton`/`TextField` roots per `design.md`
      Decision 5.

## 5. Editor: sticky mobile Save/Cancel bar

- [ ] 5.1 Write a test on `GameModelCreate.tsx` (or a small extracted component if the bar is
      factored out) asserting a mobile-only action bar renders with Save/Cancel buttons that call
      `handleTriggerSave`/`handleCancel` (mock/inspect the same callbacks already used by the existing
      `ContentLayout` `actionBar`). Confirm failing (Red).
- [ ] 5.2 Implement the page-local sticky bar per `design.md` Decision 6: a `Box` with
      `className={styles.mobileActionBar}` in `GameModelCreate.tsx`, hidden by default and
      `position: sticky; bottom: 0` under `@media (max-width: 899.95px)` in
      `GameModelCreate.module.css`, without touching `ContentLayout`/`ActionBar`. Verify: test passes
      (Green).

## 6. Read view: SubSubPrinciple/SubPrinciple responsive touch-ups (no drill-down needed here)

- [ ] 6.1 Write/extend tests on `SubSubPrincipleCard.test.tsx` (create if none exists) asserting the
      card's header/expand button and exercise action buttons meet the 44px touch target below `md`,
      and no horizontal overflow occurs (e.g. assert a wrapping/ellipsis class is applied to long
      names — check computed `overflow-wrap`/`text-overflow` styles). Confirm failing where CSS is
      missing (Red).
- [ ] 6.2 Update `SubSubPrincipleCard.module.css` with the necessary `@media (max-width: 899.95px)`
      touch-target and overflow rules (structure of the component stays a flat `Collapse` card list per
      `design.md` — no `DrillDownPanel` needed at this level). Verify: Green.

## 7. Read view: SubPrinciple detail view and Scenario `DrillDownPanel` composition (TDD)

- [ ] 7.1 Write tests for `SubPrincipleDetailView` (read-only: label, name, context, tactical
      principle chips, "Nueva sesión"/"Ver sesiones" buttons unchanged in behavior, renders
      `SubSubPrincipleCard` list from Task 6) confirming navigation actions (`navigate(...)` calls with
      the same state payloads as today's `SubPrincipleAccordion`) are preserved. Confirm failing (Red).
- [ ] 7.2 Write tests for the rewritten `ScenarioAccordion.tsx` composition root asserting it renders a
      `DrillDownPanel<Scenario>`, with detail composing a `DrillDownPanel<SubPrinciple>` whose detail is
      `SubPrincipleDetailView`. Confirm failing (Red).
- [ ] 7.3 Implement `SubPrincipleDetailView` (extracted/adapted from `SubPrincipleAccordion`) and
      rewrite `ScenarioAccordion.tsx` internals (same file, same default export/props consumed by
      `GameModel.tsx`'s `ZoneContent`) removing the nested `Accordion`s in favor of the two
      `DrillDownPanel` levels. Verify: both test files pass (Green).
- [ ] 7.4 Update `ScenarioAccordion.module.css`: remove now-unused nested-accordion rules, add
      responsive stacking/44px touch targets for `Button`s (`Nueva sesión`, `Ver sesiones`) and chip
      rows below `md`, verify no horizontal overflow at 320px.

## 8. Cross-cutting verification

- [ ] 8.1 Manually verify (via `npm run dev` + browser devtools responsive mode, or Playwright if a
      relevant spec already targets `game-model`) at 320px, 768px, 1024px, and 1440px widths: no
      horizontal scroll, Moment/Zone `Tabs` unaffected, drill-down works below 900px, master-detail
      works at/above 900px, move-up/move-down buttons functional and correctly disabled at boundaries,
      sticky Save bar visible while scrolled in the mobile editor.
- [ ] 8.2 Run `npm run build` in `Front/` — must pass with zero TypeScript errors (`any` not
      introduced).
- [ ] 8.3 Run `npm run test` in `Front/` — full suite passes, 100% pass rate, no skipped tests, new
      tests from Tasks 1-7 included.
- [ ] 8.4 Re-read `GameModelPrintView.tsx` usage in `GameModel.tsx` to confirm it was not touched and
      still receives the same `gameModel`/`teamName`/`season` props.
