## Why

With two hard matches close together, the proposal deconvoked the weakest players in the first one. The technical protection then kept them called in the second, harder match, where a better player had to be deconvoked instead. The rule about the forward cover was meant for every position, and keeping strong players in a medium match with a hard one ahead was not wanted.

## What Changes

- **Weakest players are reserved for the hardest match**: when a harder match is among the next 5 league matches, the proposal does not deconvoke now the N lowest-rated players (N = players deconvoked per match) unless the target cannot be reached otherwise, and orders this match by fairness. In the hardest match the weakest go first.
- **Strong players stay called only against a hard rival**; against an easy or medium rival there is no special protection and only a cap of half the target.
- **Position cover applies to every position**, not only forwards.
- The proposal says which players are reserved and for which match.

## Capabilities

### Modified Capabilities
- `deconvocation-tiered-selection`: reservation of the weakest, strong players only against a hard rival, position cover.

## Impact

- Frontend only: `deconvokeProposal.ts`, `deconvocationFunnel.ts`, `rivalDifficulty.ts`, `simulateUpcomingProposals.ts`, `DeconvocationProposalView.tsx`, hooks (win probability of each match).
- Version: `Front/package.json` patch bump.
