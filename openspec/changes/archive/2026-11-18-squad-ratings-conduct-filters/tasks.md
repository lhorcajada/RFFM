## Planning Status

Planned from `proposal.md`, `specs/squad-ratings-tab/spec.md` and `design.md`. Nothing is implemented yet. Each step follows Red → Green → Refactor; run only the affected tests during development and the full suite plus build once at the end.

## Step 1: Pure conduct filter

- [x] 1.1 Write tests for `filterPlayersByConduct` in `squad/utils/__tests__/conductFilter.test.ts`: level range, no conduct rating, missing trait, trend, combined filters, no active filter (spec: Conduct filters).
- [x] 1.2 Implement `squad/utils/conductFilter.ts` with the filter model and function (D1, D3).

## Step 2: Conduct data hook

- [x] 2.1 Write tests for `useConductData(teamId, enabled)`: loads latest ratings indexed by player, does not request when disabled, tolerates a failed request (spec: Hidden for players and family).
- [x] 2.2 Implement `useConductData` reusing `getTeamLatestTraitRatings` and `useRatingConfig` (D2).

## Step 3: Filter bar component

- [x] 3.1 Write tests for `ConductFilters`: trait select lists only visible traits, level selects enabled after choosing a trait, trend chips toggle with `aria-pressed`, «Quitar filtros» clears everything.
- [x] 3.2 Implement `ConductFilters.tsx` and `ConductFilters.module.css`, mobile-first with wrapping chips (D4).

## Step 4: Integrate into the Valoraciones tab

- [x] 4.1 Write `SquadRatings` tests: filtering keeps position order and hides empty groups, empty state with «Quitar filtros», sort chips apply inside filtered groups, read-only shows no filter bar and requests no conduct data, tab still renders if the conduct request fails (spec: Filtered position groups).
- [x] 4.2 Wire the hook, filter state and `filterPlayersByConduct` into `SquadRatings` before `groupPlayersByPosition`; render `ConductFilters` for non-read-only users.
- [x] 4.3 Update existing `SquadRatings` tests that mock services so they keep passing with the new requests.

## Step 5: Verify and release

- [x] 5.1 Run the squad test directory, then the full `npm run test` and `npm run build` once.
- [x] 5.2 Check visually in a narrow viewport (~360 px) and desktop.
- [x] 5.3 Bump the Front minor version (`feat`) in `Front/package.json`.
