## Step 1: Proposal result returns the already-deconvoked players

- [x] Step 1: Proposal result returns the already-deconvoked players

**Routing**: category=frontend-code · context=medium · difficulty=medium

**Files Affected**:
- M Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts
- M Front/src/apps/coach/pages/convocations/hooks/useConvocationProposal.ts
- M Front/src/apps/coach/pages/convocations/utils/__tests__/deconvokeProposal.positions.test.ts
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useConvocationProposal.alreadyOut.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.rules.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.positionWarnings.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.availability.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.emptyZones.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.formStatus.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.groups.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.readiness.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.summary.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.touchActions.test.tsx

**What Will Be Done**: Add the exported `AlreadyDeconvokedPlayer` type and the required `alreadyDeconvoked` field to `DeconvokeProposal` in `deconvokeProposal.ts`, following design decisions D1 to D4 and the first requirement of `openspec/changes/show-already-deconvoked-in-proposal/specs/deconvoke-proposal-positions/spec.md`. In `buildDeconvokeProposal`, derive the list from the same squad collection that is filtered by `alreadyOutIds` before scoring, in squad order, and add it to the returned object. Extract the existing display-name rule into one small shared helper used by both the scored path and the new list, and reuse the `positionRole` derivation from `toPositionPlayer`. Leave scoring, target, counts and position minimums untouched. In `useConvocationProposal.ts`, rewrite only the `alreadyOutIds` documentation to say these players stay out of the proposal logic and are returned in `alreadyDeconvoked`. Add `alreadyDeconvoked: []` to the strictly typed `DeconvokeProposal` fixtures of the ConvocationTab tests.

**Testing Strategy**: RED first in `deconvokeProposal.positions.test.ts` (existing «con jugadores ya desconvocados» block) and `useConvocationProposal.alreadyOut.test.tsx`: every squad player in `alreadyOutIds` is returned whatever the reason, pending players are not returned, the list is empty when no player is out, and `targetCount`, `calledCount`, `selectedIds` and `positionWarnings` are identical with and without those players (centre-back minimum still reports «Centrales: quedan 2 de 3»). Reviewed consumers and fixtures: the nine ConvocationTab tests listed below build a strictly typed `DeconvokeProposal` and need the new required field (`ConvocationTab.rules.test.tsx` and `ConvocationTab.positionWarnings.test.tsx` also open the panel); `ConvocationTab.bulkCall.test.tsx`, `ConvocationTab.calledAvg.test.tsx` and `ConvocationTab.markAvailable.test.tsx` use `as unknown as` casts and do not open the panel, so they remain compatible; `deconvokeProposal.goalkeepers.test.ts` and `deconvokeProposal.matchUnavailable.test.ts` call the builder without a proposal literal and remain compatible; `ConvocationMatchDetail.tabsAndProposal.test.tsx` mocks the hook and does not open the panel, so it remains compatible. Run `cd Front && npx vitest run src/apps/coach/pages/convocations` for the affected area.

**Existing Tests Broken**:
- `Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.positionWarnings.test.tsx` — compile
- `Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.rules.test.tsx` — compile
- `Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.availability.test.tsx` — compile
- `Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.emptyZones.test.tsx` — compile
- `Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.formStatus.test.tsx` — compile
- `Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.groups.test.tsx` — compile
- `Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.readiness.test.tsx` — compile
- `Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.summary.test.tsx` — compile
- `Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.touchActions.test.tsx` — compile

## Step 2: Proposal panel shows the already-deconvoked players

- [ ] Step 2: Proposal panel shows the already-deconvoked players

**Routing**: category=frontend-ui · context=medium · difficulty=medium

**Files Affected**:
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css
- A Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.alreadyDeconvoked.test.tsx
- M Front/package.json
- M Front/package-lock.json

**What Will Be Done**: In `ConvocationTab.tsx`, add a local `renderAlreadyDeconvokedCard` and render the `proposal.alreadyDeconvoked` entries after the selected players inside the existing proposal section, as set out in design decisions D5 and D6 and the third requirement of `openspec/changes/show-already-deconvoked-in-proposal/specs/deconvoke-proposal-positions/spec.md`. The card is a stacked card with name, position and a «Ya desconvocado» chip; add its class to `ConvocationTab.module.css` next to `proposalForcedBadge`, using theme tokens and CSS custom properties, no inline style and no table. Change the empty-state and no-selection conditions so both notices stay hidden when `players` is empty and `alreadyDeconvoked` is not, and render the section when there is a selected player or an already-deconvoked one. Leave `renderCard`, the «Resto» section and `handleApplyProposal` unchanged. Bump the web version one minor step with `npm version 1.120.0 --no-git-tag-version` in `Front/`, which updates both package files.

**Testing Strategy**: RED first in the new `ConvocationTab.alreadyDeconvoked.test.tsx`, built on the typed fixture style of `ConvocationTab.positionWarnings.test.tsx` and opening the panel with the «Proponer desconvocados» button: each already-deconvoked player shows the mark «Ya desconvocado»; proposed and already-deconvoked players share the block with proposed first; no mark when the list is empty; with only already-deconvoked players neither «No hay convocados para evaluar.» nor «No hace falta desconvocar jugadores con las reglas actuales.» is shown; with proposals and no already-deconvoked players the notices behave as before. Reviewed consumers: no existing test asserts the two notice strings (verified by search of the tests folder), and the existing apply test in `ConvocationMatchDetail.tabsAndProposal.test.tsx` already pins that applying keeps the reason of already-deconvoked players, so it remains compatible. Run `cd Front && npx vitest run src/apps/coach/pages/convocations/components` for the affected area. The full suite and `npm run build` run once after all steps.

**Existing Tests Broken**: None

## Required Documentation

### Spec files
- openspec/changes/show-already-deconvoked-in-proposal/specs/deconvoke-proposal-positions/spec.md
- openspec/specs/deconvoke-proposal-positions/spec.md
- openspec/specs/deconvoke-proposal-rules-config/spec.md

### Local files
- Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts — builder and types to extend; alreadyOutIds is filtered from the squad before scoring.
- Front/src/apps/coach/pages/convocations/utils/positionRequirements.ts — toPositionPlayer derives positionRole for the new list.
- Front/src/apps/coach/pages/convocations/hooks/useConvocationProposal.ts — only non-test caller of the builder; its alreadyOutIds documentation changes.
- Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx — builds alreadyOutIds from mgmtNotCalled; handleApplyProposal already skips them.
- Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx — proposal panel, renderCard and the two empty notices to adapt.
- Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css — proposalForcedBadge class is the pattern for the new mark.
- Front/src/apps/coach/pages/convocations/components/ConvocatoriaPrint.tsx — prints proposal.players only; context only, unchanged.
- Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.positionWarnings.test.tsx — typed fixture factory and panel-opening pattern to imitate.
- Front/src/apps/coach/pages/convocations/utils/__tests__/deconvokeProposal.positions.test.ts — existing already-deconvoked block where builder tests are added.
- Front/src/apps/coach/pages/convocations/hooks/__tests__/useConvocationProposal.alreadyOut.test.tsx — hook test to extend with the returned list.
- Front/src/apps/coach/pages/convocations/__tests__/ConvocationMatchDetail.tabsAndProposal.test.tsx — existing apply test that keeps reasons of already-deconvoked players.
- Front/src/apps/coach/services/teamplayerService.ts — PlayerResponse type with name, last name, alias and position.
- Front/package.json — version to bump one minor step.
- GLOSSARY.md — project terms, context only.

### External URLs
None

## Implementation Context

**Stack**: React 19, TypeScript 5.5 strict, Vite 7, MUI v5 with CSS Modules, Vitest 4 with Testing Library (`vmThreads` pool in `Front/vitest.config.ts`).

**Conventions**:
- Components keep a co-located `ComponentName.module.css`; reusable styles go there, never `styled()` or inline `style={{}}`.
- Tests live in `__tests__/` beside the code, named per facet (for example `ConvocationTab.positionWarnings.test.tsx`), with Spanish sentence names and `vi.mock` declared before the component import.
- Typed `DeconvokeProposal` fixtures are local to each ConvocationTab test; a new required field must be added to each strict literal.
- Lists are cards, never tables, and must work from about 360 px width.
- Imports go to the direct file; there are no barrel files.

**Avoid**:
- Using `any`, inline styles or MUI `Table` for the new list.
- Adding the already-deconvoked players to `players`, `selectedIds`, targets or counts.
- Running the full suite or `npm run build` per step.

**Test Command**: `cd Front && npx vitest run --maxWorkers=4`; scoped form `cd Front && npx vitest run <test-path-or-directory>`
