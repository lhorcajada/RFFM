## Context

Verified facts:
- `SquadRatings` (`Front/src/apps/coach/pages/squad/components/SquadRatings.tsx`) groups players by position (`groupPlayersByPosition`) and sorts inside each group by the chosen rating chip. It receives `teamId`, `players`, `latestRatings` and `readOnly`.
- Conduct ratings are served by `GET /api/catalog/team/{teamId}/trait-ratings/latest` (`getTeamLatestTraitRatings`) and the team's trait catalog by `GET .../rating-config` (`useRatingConfig`, `visibleTraits`). Both are restricted to Coach/Administrator by `TeamTraitRatingAccess`; players and family get 403.
- A conduct rating is `{ teamPlayerId, trend: "up"|"same"|"down", levels: [{ traitKey, level 1–5 }] }`.

## Goals / Non-Goals

Goals:
- Filter the «Valoraciones» tab by trait level range and by trend, for coaches and administrators.
- Keep the position grouping, sort chips and PDF actions working on the filtered players.

Non-goals:
- Backend changes, new endpoints or server-side filtering.
- Showing conduct values on the rating cards.
- Filters on the other tabs or on `TraitRatingPage`.
- Persisting the filter state between visits.

## Decisions

### D1. Pure filter function, applied before grouping
A pure function `filterPlayersByConduct(players, conductByPlayer, filters)` in `squad/utils/conductFilter.ts` returns the matching players; `SquadRatings` calls it and feeds the result to the existing `groupPlayersByPosition`. Grouping and sorting stay untouched, so empty groups disappear naturally (spec: Filtered position groups). Alternative of filtering inside `groupPlayersByPosition` was rejected: it mixes two concerns and complicates its tests.

### D2. Data loading inside `SquadRatings`, skipped when read-only
A hook `useConductData(teamId, enabled)` loads the latest conduct ratings and reuses `useRatingConfig` for the visible traits. It runs only when `readOnly` is false, so players and family never trigger the 403 requests (spec: Hidden for players and family). Alternative of loading in `Squad.tsx` was rejected: it would fetch for every tab.

### D3. Filter model
Filters: `{ traitKey: string | null; minLevel: number; maxLevel: number; trend: TraitTrend | null }`. With no trait selected the level range is ignored; with a trait selected, a player matches when their latest rating has a level for it within `[minLevel, maxLevel]`. A player without conduct rating or without that trait never matches a trait filter. The trend filter matches on the latest rating's trend. Both filters are ANDed (spec: Conduct filters).

### D4. UI
A `ConductFilters` component with its CSS Module, placed under the existing toolbar: a trait `Select`, two level selects (mín./máx., 1–5) enabled once a trait is chosen, and trend chips (Subiendo / Igual / Bajando) as toggle buttons with `aria-pressed`, wrapping instead of scrolling. It is mobile-first and uses the Coach theme tokens, like the existing sort chips. A «Quitar filtros» button clears all filters and also appears in the empty state.

## Target State

Coach/Administrator opens «Valoraciones», sees the conduct filter bar below the sort chips and, after filtering, the position groups with only the matching players. Players and family see the tab exactly as today.

## Risks / Trade-offs

- Conduct ratings can reference hidden or deleted traits: the trait select lists only visible traits, so such levels are simply not filterable.
- If the conduct request fails, the tab must still render: the filter bar is hidden (or disabled) and the tab behaves as today; no error blocks the ratings.
- Extra requests on tab open for staff (two small GETs): acceptable, both are cached by the browser session only and loaded once per mount.

## Migration Plan

Not applicable: frontend-only change, no data or API change.

## Validation Strategy

- Unit tests of `filterPlayersByConduct`: level range, no rating, missing trait, trend, combined filters.
- Component tests of `SquadRatings` with mocked `traitRatingService` and `ratingConfigService`: filtering keeps position groups and hides empty ones, empty state with «Quitar filtros», sort chips still apply, read-only renders no filter bar and makes no conduct request, load failure leaves the tab usable.
- Final run of the squad test directory, then `npm run test` and `npm run build` once at the end.

## ADR / DDR Evaluation

Neither: a local UI filter using existing endpoints, with no architectural or domain decision beyond the existing patterns.

## Open Questions

None.
