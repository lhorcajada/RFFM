## 1. Upcoming matches

- [x] 1.1 Tests then `upcomingMatchesAfter` in `rivalDifficulty.ts`: own matches after the current one with round, date, rival and difficulty
- [x] 1.2 `useRivalOutlook` exposes the upcoming matches; match context exposes estimated recovery dates of injured players

## 2. Chained estimate

- [x] 2.1 Tests then `simulateUpcomingProposals`: chaining, injured players, assumptions
- [x] 2.2 Wire the estimate in `ConvocationMatchDetail` and `ConvocationTab`

## 3. UI

- [x] 3.1 Tests then tabs in `DeconvocationProposalView`: current + one per estimated match, read only, «Estimación» notice, cards (no tables), usable from 360px

## 4. Verification

- [x] 4.1 Area tests, full suite and `npm run build` once at the end; minor version bump
