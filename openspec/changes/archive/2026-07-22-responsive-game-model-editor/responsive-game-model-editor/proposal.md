## Why

The "Modelo de Juego" page (Coach app) resolves its 6-level data hierarchy (GameMoment → Zone →
Scenario → SubPrinciple → SubSubPrinciple → EssentialSkill) with MUI `Tabs` for the top 2 levels
(responsive by nature) but with 3 `Accordion` components nested inside one another (Scenario >
SubPrinciple > SubSubPrinciple) for the bottom 4 levels. This nesting is visually dense, has no
`useMediaQuery`/`theme.breakpoints` usage anywhere in `game-model/`, and several concrete defects
break usability below tablet width: `GameModelCreate.module.css` and `ScenarioFormAccordion.module.css`
have zero media queries, `SkillRow` uses a fixed `flex: 0 0 200px` field that doesn't collapse, and
reordering `SubPrinciple`/`SubSubPrinciple` relies solely on native HTML5 `draggable` drag-and-drop,
which has no reliable touch fallback. We need this page usable at 320px width and with touch input,
without regressing desktop behavior or existing data flows.

## What Changes

- Replace the 3 nested `Accordion` chain (Scenario → SubPrinciple → SubSubPrinciple) with a shared
  drill-down navigation component: mobile navigates one level at a time (list → detail, with a "back"
  button); tablet/desktop (`>= md` breakpoint, 900px) show master-detail (list left, detail right) via
  `useMediaQuery(theme.breakpoints.up('md'))`.
- Applies to both the read-only view (`GameModel.tsx` → `ScenarioAccordion.tsx` →
  `SubSubPrincipleCard.tsx`) and the editor (`GameModelCreate.tsx` → `ScenarioFormAccordion.tsx`),
  reusing one navigation shell parameterized per level, with a simpler (non-editable) variant for
  read-only.
- Fields inside each node (name, context/action, tacticalPrinciples, skills) stack in a column on
  mobile and a row on tablet/desktop.
- Reordering `SubPrinciple`/`SubSubPrinciple` keeps HTML5 drag-and-drop on desktop and adds
  "move up"/"move down" icon buttons as an always-available accessible alternative (works on all
  breakpoints, not just touch, reusing the existing `MOVE_SP`/`MOVE_SSP` reducer actions unchanged).
- Interactive elements (inputs, buttons, icon buttons) get a minimum 44px touch target on mobile/tablet
  breakpoints via CSS Modules.
- The editor's save/cancel action bar becomes sticky to the viewport bottom on mobile.
- **BREAKING** (UX only, not data): on mobile, users navigate the Scenario/SubPrinciple/SubSubPrinciple
  hierarchy via drill-down screens instead of expanding accordions in place.

## Capabilities

### New Capabilities
- `game-model-responsive-navigation`: Responsive drill-down/master-detail navigation for the
  Scenario → SubPrinciple → SubSubPrinciple → EssentialSkill hierarchy in both the Coach game-model
  viewer and editor, replacing nested accordions below the Zone tab level.

### Modified Capabilities
(none — no existing `openspec/specs/` capability currently governs game-model UI structure)

## Impact

- `Front/src/apps/coach/pages/game-model/GameModel.tsx` — zone content rendering
- `Front/src/apps/coach/pages/game-model/GameModelCreate.tsx` — zone form content rendering, sticky
  action bar
- `Front/src/apps/coach/pages/game-model/components/ScenarioAccordion.tsx` — replaced by drill-down
  read view components
- `Front/src/apps/coach/pages/game-model/components/ScenarioFormAccordion.tsx` — replaced by
  drill-down editor view components; `SkillRow` field layout fixed
- `Front/src/apps/coach/pages/game-model/components/SubSubPrincipleCard.tsx` — reused as the
  deepest-level read-only detail panel, adapted to the new navigation shell
- New: a shared drill-down/master-detail navigation component (exact name/location defined in
  `design.md`) plus co-located `.module.css` and tests
- `Front/src/apps/coach/context/GameModelDraftContext.tsx` — touched only if a "selected node" UI
  state needs to be exposed beyond local component state (to be confirmed in `design.md`); no reducer
  action shape changes are anticipated
- Out of scope: `Front/src/apps/coach/pages/game-model/components/GameModelPrintView.tsx` (print-only,
  untouched), any `Back/ExtractionApi/` change, `CreateSessionFromSubPrinciple.tsx` /
  `SessionsFromSubPrinciple.tsx` (separate pages, not part of this hierarchy's accordion chain)
