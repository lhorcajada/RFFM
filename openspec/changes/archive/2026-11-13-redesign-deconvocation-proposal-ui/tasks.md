## Step 1: Restructure the proposal block markup under test

- [x] Step 1: Restructure the proposal block markup under test

**Routing**: category=frontend-ui · context=medium · difficulty=medium

**Files Affected**:
- A Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.proposalLayout.test.tsx
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css

**What Will Be Done**: First run the three existing `ConvocationTab.*` suites to fix the green baseline (design Risk, verify-first). Then write `ConvocationTab.proposalLayout.test.tsx` (RED), copying the local `proposalPlayer` / `alreadyOut` / `proposal` / `renderTab` helper pattern of `ConvocationTab.alreadyDeconvoked.test.tsx` and importing the fixture types from `utils/deconvokeProposal.ts`. Then restructure `ConvocationTab.tsx` per design D3 and D5: render the proposed cards in a `.proposalList` container, move the already-deconvoked cards into a following `div.proposalDeconvokedGroup` (`role="group"`, `aria-label`) rendered only when `alreadyDeconvoked` is non-empty, give them `.proposalCardDeconvoked` instead of `.proposalCardDim`, and replace the warning `Alert` `sx` and the no-selection paragraph inline `style` with `proposalWarningAlert` / `proposalNotice` class names. In `ConvocationTab.module.css` rename `.proposalCards` to `.proposalList` and add the new classes with the minimal rules that keep the current look (full restyle is Step 2). Behavior and copy stay as specified in `openspec/changes/redesign-deconvocation-proposal-ui/specs/deconvocation-proposal-ui/spec.md`.

**Testing Strategy**: New RED tests cover the structure requirements (order, mark only on already-deconvoked rows, row data kept, no `table`, labelled group only when needed); GREEN is the markup change. Reviewed consumers: `ConvocationMatchDetail.tsx` imports `ConvocationTab` by default export with unchanged props and needs no change; no test or other file references `proposalCards`, `proposalCardDim`, or `factorItem` (verified by search), so the rename is safe; `ConvocationTab.alreadyDeconvoked.test.tsx`, `ConvocationTab.positionWarnings.test.tsx`, and `ConvocationTab.rules.test.tsx` assert visible texts, `title` attributes, and button names that this step leaves untouched, so they remain compatible. Run the four `ConvocationTab.*` suites in the area; the typecheck through `npm run build` is left to the final run.

**Existing Tests Broken**: None

## Step 2: Restyle the proposal block with flex lists and tokens, bump the version

- [x] Step 2: Restyle the proposal block with flex lists and tokens, bump the version

**Routing**: category=frontend-ui · context=medium · difficulty=medium

**Files Affected**:
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css
- M Front/package.json

**What Will Be Done**: Precondition (design D6): the user has produced the visual design with `/design` under `.design/deconvocation-proposal/` (`project/canvas.json` and its `.dc.html`); if it is absent, stop and report the missing precondition instead of restyling. Consult it for the appearance of rows, cards, and the already-deconvoked group (`.design/convocatoria` and `.design/desconvocatorias-historial` are visual references); where it differs in appearance only it wins, and where it would change content, order, behavior, or the no-table, no-fixed-column-grid, and no-new-design-values rules, the spec wins. Apply design D2 and D4 to the proposal and factor rules of `ConvocationTab.module.css`. Make `.proposalList` a flex column that wraps with `flex: 1 1 320px; min-width: 0` per card, turn `.factorItem` into a wrapping flex row, and remove the grid declarations of the block so it contains no `display: grid`. Add the muted dashed look of `.proposalCardDeconvoked` and the divider of `.proposalDeconvokedGroup`, and shrink the 600px media query to header stacking and sub-item indentation. Replace each literal that has a matching `--rffm-*` token in `muiGameTheme.ts` by `var(--rffm-<token>, <current literal>)` only when the token value equals that literal; introduce no new color, radius, or spacing value. Delete `.proposalActions` after confirming no tsx uses it. Bump the minor version in `Front/package.json` from `1.120.0` to `1.121.0` (`feat`, `.claude/rules/git.md` section 2.4). Layout requirements: `openspec/changes/redesign-deconvocation-proposal-ui/specs/deconvocation-proposal-ui/spec.md`.

**Testing Strategy**: No RED block: styles in CSS Modules are not asserted (frontend-testing.md section 2.4). Verification is the `ConvocationTab.*` suites staying green, a search showing no `display: grid` and no `grid-template` left in the proposal and factor rules, the presence of `.design/deconvocation-proposal/project/canvas.json` before the step starts, and the visual checks listed in `design.md` Manual Verification, which compare the restyled block with that design. The full suite and `npm run build` run once at the end of the change.

**Existing Tests Broken**: None

## Required Documentation

### Spec files
- openspec/changes/redesign-deconvocation-proposal-ui/specs/deconvocation-proposal-ui/spec.md

### Local files
- Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx — proposal panel, `renderCard`, and `renderAlreadyDeconvokedCard` that Step 1 restructures.
- Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css — proposal and factor styles restructured in Step 1 and restyled in Step 2.
- Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.alreadyDeconvoked.test.tsx — fixture and render pattern to copy; asserts texts that must keep passing.
- Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.positionWarnings.test.tsx — asserts warning text, chip titles, and the open-proposal button; must keep passing.
- Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.rules.test.tsx — opens the proposal via the button; regression guard only.
- Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts — types of the proposal fixtures (`PlayerProposal`, `AlreadyDeconvokedPlayer`, `DeconvokeProposal`).
- Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx — only importer of `ConvocationTab`; context only.
- Front/src/apps/coach/pages/convocations/components/ConvocatoriaPrint.module.css — separate print styles; context only, not changed.
- Front/src/apps/federation/muiGameTheme.ts — defines the `--rffm-*` tokens in `:root`; source for the token mapping.
- Front/src/shared/components/ui/BaseLayout/BaseLayout.module.css — defines `--rffm-page-h-padding`; context only.
- Front/src/apps/coach/pages/convocations/Convocations.module.css — example of `var(--rffm-*, literal)` fallback pattern to imitate.
- Front/package.json — version field bumped in Step 2.
- openspec/changes/show-already-deconvoked-in-proposal/proposal.md — slice that introduced the already-deconvoked rows; context only.
- GLOSSARY.md — defines «Ya desconvocado»; no new term added.
- .claude/rules/design.md — location rule for the `.design/<name>/` files.
- .claude/rules/react.md — CSS Modules, no inline style, no table rules for `Front/`.
- .claude/rules/frontend-testing.md — Vitest and Testing Library rules; area-only runs during the work.
- .claude/rules/git.md — version bump rule for `feat`.

### External URLs
None

## Implementation Context

**Stack**: React 19.2, TypeScript 5.5 strict, Vite 7, MUI v5.14 (Emotion), CSS Modules, Vitest 4 with Testing Library React 16; `Front/package.json` version `1.120.0`.

**Conventions**:
- Proposal row renderers are local functions inside `ConvocationTab.tsx`; there is no separate row component, so restyle in place.
- Coach CSS Modules read tokens as `var(--rffm-*, <literal>)` (see `Convocations.module.css`); the `--rffm-*` tokens are defined in `muiGameTheme.ts` because `muiCoachTheme` is not mounted.
- Component tests pass all data by props with local helper builders (`proposalPlayer`, `proposal`, `renderTab`) copied per file, open the proposal with `getByRole("button", { name: /proponer desconvocados/i })`, and use Spanish sentence names with «» quotes.
- UI copy is Spanish and exact-text assertions exist, so no visible text may be added or reworded in the block.

**Avoid**:
- Adding a `<table>`, MUI `Table`, or any `display: grid` / fixed-column template to the proposal block.
- Adding inline `style`, `sx`, or Emotion `styled()` to the block, or hardcoding a new color or spacing value.
- Adding a visible label near the already-deconvoked rows (it would collide with the exact-text assertions on «Ya desconvocado»).

**Test Command**: `cd Front && npx vitest run --config vitest.config.ts` (scoped: `cd Front && npx vitest run --config vitest.config.ts <test-file-path-relative-to-Front>`)
