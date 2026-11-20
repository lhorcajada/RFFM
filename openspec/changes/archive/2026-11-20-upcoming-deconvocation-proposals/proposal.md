## Why

The deconvocation proposal only answers who rests in the match being prepared. The coach cannot see how rest will rotate over the next weeks, whether a player never rests, or whether a hard match will find the strong players tired.

## What Changes

- The proposal screen gets **tabs**: the current proposal (the real one) and one estimated proposal for each of the **next 5 league matches**.
- Each estimated proposal is computed **chained**: the proposal of the previous match is assumed applied (proposed players deconvoked by technical decision, the rest called), and rest windows, streaks, call surplus, minimum of calls and protection windows are recomputed before the next one.
- Assumptions of the estimate: every player trains (training attendance does not tell players apart), players injured today stay out until their estimated recovery date (or the whole window when there is none), the low-minutes rule is off, only league matches count, no new injuries or sanctions.
- Estimated tabs are read only (no apply action), carry an «Estimación» notice, and show match, date, rival and difficulty.

## Capabilities

### New Capabilities
- `deconvocation-upcoming-proposals`: chained estimate of the deconvocation proposal for the next 5 league matches, shown in tabs inside the proposal.

### Modified Capabilities
- None.

## Impact

- Frontend only: `Front/src/apps/coach/pages/convocations/utils/simulateUpcomingProposals.ts` (new), `utils/rivalDifficulty.ts`, `hooks/useRivalDifficulty.ts`, `hooks/useConvocationMatchContext.ts` (estimated recovery dates), `ConvocationMatchDetail.tsx`, `components/ConvocationTab.tsx`, `components/DeconvocationProposalView.tsx`.
- No backend or data-model change.
- Version: `Front/package.json` minor bump.
