## Why

Issue 15 asks for a new design of the "Propuestos para desconvocar" list, now that the already-deconvoked players are part of it. The design has to be made on the final content of the list, so it follows the logic slice `show-already-deconvoked-in-proposal`.

## What Changes

- The deconvocation proposal block, the one that holds the players proposed for deconvocation followed by the already-deconvoked players marked «Ya desconvocado», gets a new visual design, including the design of each player row.
- The new design is responsive: it stays usable from 360px wide up to desktop, built from cards or a list layout, never from a table or fixed-column grid, and styled with CSS Modules and the theme tokens of the Coach app.
- The block keeps showing the same content as today, in the same order: new proposals first by score, then the already-deconvoked players with the mark «Ya desconvocado».
- The behavior and data of the proposal do not change: selection, scores, target count, position warnings, empty-list notices, and applying the proposal work as they do now.
- The visual design itself is produced with the `/design` flow under `.design/<name>/`, in a later phase of this change; this phase only fixes what the design must preserve.

## Capabilities

### New Capabilities
- `deconvocation-proposal-ui`: the visual design of the deconvocation proposal block and its player rows, including the «Ya desconvocado» entries, with the content and behavior it must preserve and the responsive, no-table constraint it must meet.

### Modified Capabilities
<!-- None -->

## Impact

- `Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx`: the proposal panel and the local row renderers `renderCard` and `renderAlreadyDeconvokedCard`.
- `Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css`: the proposal styles.
- Tests: the existing `ConvocationTab.*` tests keep passing; new tests cover the preserved content and order.
- `Front/package.json`: minor version bump (`feat`).
- No backend, API, data-model or proposal-logic change.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx
- Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css
- Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.alreadyDeconvoked.test.tsx
- openspec/changes/show-already-deconvoked-in-proposal/proposal.md
- openspec/changes/show-already-deconvoked-in-proposal/specs/deconvoke-proposal-positions/spec.md
- openspec/specs/deconvoke-proposal-positions/spec.md
- openspec/config.yaml
- GLOSSARY.md
- .claude/rules/design.md

**External URLs**:
<!-- None -->

## Additional Notes

- The proposal panel already lists the already-deconvoked players with the mark «Ya desconvocado» (commit `584d3aa3`), so this change builds on code that exists. The panel header now sits at lines 605-626 and the block at lines 684-709 of `ConvocationTab.tsx`; the line numbers cited in the request are stale.
- The component that renders each proposal row is `ConvocationTab.tsx`'s local `renderCard(item, highlighted)` (line 321) for proposed and remaining players, and `renderAlreadyDeconvokedCard(item)` (line 303) for the already-deconvoked ones. There is no separate row component.
- The text and sections the existing tests rely on: «Propuestos para desconvocar», «Resto de convocados», «Ya desconvocado», «OBLIGATORIO», «No hace falta desconvocar jugadores con las reglas actuales.» and «No hay convocados para evaluar.».
- The position-warning alert (header) and the factor list of each proposed card already show per-card data; the design restyles them and removes none.
- `ConvocatoriaPrint.tsx` prints the proposal on its own template and is not part of this change.
- No `.design/` folder exists yet, and no `/design` command file exists in `.claude/commands/`; the design flow is described only by `.claude/rules/design.md`.
