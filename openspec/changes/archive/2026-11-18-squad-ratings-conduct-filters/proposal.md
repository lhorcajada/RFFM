## Why

The «Valoraciones» tab of the squad only lets the coach sort players by the four technical ratings; the match-conduct ratings (behavior traits) live in a separate screen and cannot be used to find players. The coach needs to quickly spot, per position, which players are weak or improving in a given trait.

## What Changes

- Add a «Conducta» filter bar to the «Valoraciones» tab, visible only to coaches and administrators (not to players or family):
  - Filter by **trait and level**: pick one of the team's visible traits and a level range (e.g. level ≤ 2), keeping only players whose latest conduct rating matches.
  - Filter by **trend**: up / same / down according to the player's latest conduct rating.
- The position grouping (Portero, Defensa, Centrocampista, Delantero…) is kept while filtering: each group lists only the players that match, and groups left empty are hidden.
- Show an empty state with a «Quitar filtros» action when no player matches.
- Load the latest conduct ratings and the team's trait catalog once for the tab, using the existing endpoints; no backend change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `squad-ratings-tab`: the tab gains conduct filters (trait + level, trend) that apply within the position groups, restricted to coach and administrator roles.

## Impact

- `Front/src/apps/coach/pages/squad/components/SquadRatings.tsx` (filter state, filtered grouping) and a new conduct filter component with its CSS Module.
- `SquadRatings` already receives `teamId` and `readOnly`, so `Squad.tsx` and the other tabs are not touched.
- Reuses `getTeamLatestTraitRatings` (`traitRatingService.ts`) and `useRatingConfig` (visible traits of the team). Both endpoints are already restricted to Coach/Administrator.
- Front version bump (minor) on implementation. No API, database or Mobile impact.

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/squad/Squad.tsx
- Front/src/apps/coach/pages/squad/components/SquadRatings.tsx
- Front/src/apps/coach/pages/squad/components/SquadRanking.tsx
- Front/src/apps/coach/pages/squad/rating/TraitRatingPage.tsx
- Front/src/apps/coach/pages/squad/rating/useRatingConfig.ts
- Front/src/apps/coach/pages/squad/rating/useTraitRating.ts
- Front/src/apps/coach/services/traitRatingService.ts
- Front/src/apps/coach/types/traitRating.ts
- Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/TeamTraitRatingAccess.cs
- openspec/specs/squad-ratings-tab/spec.md
- openspec/specs/player-behavior-traits-rating/spec.md

**External URLs**:
<!-- none -->

## Additional Notes

- The tab already groups by position and sorts within each group by rating; the position grouping is retained as the "order by position" requested, and filters narrow the players inside the groups.
- Trait ratings are staff-only: the backend answers 403 to players and family, so the conduct filters must not be rendered nor requested when the tab is read-only.
- Players without any conduct rating do not match a trait-level filter (there is no level to compare).
