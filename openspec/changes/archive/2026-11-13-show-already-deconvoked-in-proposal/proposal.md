## Why

The coach's deconvocation proposal silently drops the players already deconvoked before it is generated, so the coach cannot see the whole picture of who is out (issue 15). They must appear in the list as informational entries without changing how new proposals are computed.

## What Changes

- The proposal result additionally returns the already-deconvoked players as a separate, flagged list, taken from `convocation.mgmtNotCalled` with no new data source.
- The proposal panel shows them at the top of the proposal block, marked «Ya desconvocado»: new proposals first (by score), then the already-deconvoked.
- They are never proposed again, never counted as available, never change the target number of deconvocations, and applying the proposal does not deconvoke them again; they keep being subtracted from their position when position minimums are evaluated.
- With no already-deconvoked players the list looks and works as today; when every deconvokable player is already deconvoked and there are no new proposals, the block shows only the already-deconvoked and no empty-list notice.
- Out of this change: the selection algorithm and its results for new proposals, and the new visual design of the list.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `deconvoke-proposal-positions`: adds a requirement that the deconvocation proposal returns and shows the already-deconvoked players as flagged informational entries next to the new proposals, while the existing requirement that they are out of the proposal logic stays unchanged.

## Impact

- `Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts`: `buildDeconvokeProposal` returns the flagged already-deconvoked list.
- `Front/src/apps/coach/pages/convocations/hooks/useConvocationProposal.ts`: exposes that list; its documentation of `alreadyOutIds` stops saying they are simply excluded.
- `Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx`: proposal panel renders them at the top of the proposal block with the «Ya desconvocado» mark.
- Tests: `useConvocationProposal.alreadyOut.test.tsx` and new tests for the behaviors above.
- `Front/package.json`: minor version bump (`feat`).
- No backend, API or data-model change.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts
- Front/src/apps/coach/pages/convocations/hooks/useConvocationProposal.ts
- Front/src/apps/coach/pages/convocations/hooks/__tests__/useConvocationProposal.alreadyOut.test.tsx
- Front/src/apps/coach/pages/convocations/ConvocationMatchDetail.tsx
- Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx
- openspec/specs/deconvoke-proposal-positions/spec.md
- openspec/specs/deconvoke-proposal-rules-config/spec.md
- GLOSSARY.md

**External URLs**:
<!-- None -->

## Additional Notes

- `ConvocationTab.tsx` renders each proposal row through its local `renderCard(item, highlighted)` (line 303); there is no separate row component.
- The panel shows the empty state «No hay convocados para evaluar.» when `proposal.players.length === 0` (line 663) and the notice «No hace falta desconvocar jugadores con las reglas actuales.» when no player is selected (line 669); both must not appear when only already-deconvoked players exist.
- `ConvocatoriaPrint.tsx` (line 630) prints from `proposal.players`.
- `handleApplyProposal` in `ConvocationMatchDetail.tsx` (line 288) already skips players that are in `mgmtNotCalled`.
