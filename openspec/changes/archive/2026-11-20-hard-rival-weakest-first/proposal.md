## Why

Against a hard rival the proposal still ordered by fairness first, so strong players could be deconvoked just because they had played many matches in a row. A strong player was also rested against a medium rival when a hard match was coming. The coach wants the weakest players out against the hard rival (unless protected) and the strong players kept for it. The balance rules added with the next-matches lookahead (spread over lines, cap on strong players, forward cover) were never written in the specs.

## What Changes

- **Hard rival**: the weighted rating becomes the first criterion of the fairness order, compared in steps of half a point; consecutive matchdays, call surplus, fit, technical deconvocations and attendance only break ties.
- **Hard match ahead** (among the next 5 league matches) while the current rival is not hard: strong players (top third by rating) are kept called whenever there is an alternative, and non-strong players go first after consecutive matchdays and call surplus.
- Specify the balance rules: at most one deconvocation per line while other lines have candidates, a cap on strong players, and at least two players able to play forward when a forward is deconvoked.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `deconvocation-tiered-selection`: rival difficulty ordering and the balance rules.

## Impact

- Frontend only: `deconvocationFunnel.ts`, `deconvokeProposal.ts`, `DeconvocationProposalView.tsx` (already implemented).
- Version: `Front/package.json` patch bump.
