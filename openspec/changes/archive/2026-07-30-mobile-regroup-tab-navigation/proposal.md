## Why

The Mobile bottom tab bar has grown to 7 flat tabs (Noticias, Eventos, Liga, Amistosos, Plantilla,
Lesiones, Sanciones), which crowds the tab bar and mixes unrelated concerns (team-roster info vs.
competition info) at the same navigation level. The user has agreed on a regrouped 4-tab
information architecture: keep Noticias and Eventos as direct tabs, and group the remaining 5
screens under two new tabs ("Equipo" and "Competición") that open an intermediate list/card menu.

## What Changes

- Reduce the bottom tab bar in `CalendarTabs` (`Mobile/src/navigation/RootNavigator.tsx`) from 7 to
  4 tabs: `NewsTab`, `CalendarTab` (both unchanged), `TeamTab` (new), `CompetitionTab` (new).
- `TeamTab` opens a nested stack whose initial route is a new intermediate menu screen listing
  Plantilla, Lesiones, Sanciones (reusing their existing icons `shirt-outline`, `medkit-outline`,
  `warning-outline`); tapping an item navigates to the existing `PlayersTab`, `InjuriesTab`,
  `SanctionsTab` screens (unchanged route names, unchanged screens).
- `CompetitionTab` opens a nested stack whose initial route is a new intermediate menu screen
  listing Liga, Amistosos (reusing `trophy-outline`, `football-outline`); tapping an item navigates
  to the existing `LeagueTab`, `FriendliesTab` screens (unchanged route names, unchanged screens).
- Add two new screens: `Mobile/src/screens/TeamMenuScreen.tsx`, `Mobile/src/screens/CompetitionMenuScreen.tsx`.
- Add a small shared presentational component `Mobile/src/screens/components/TabMenuCard.tsx`
  (icon + label + chevron row) reused by both new menu screens.
- Pick literal `Ionicons` for the two new group tabs (`people-outline` for "Equipo",
  `podium-outline` for "Competición") — agent's choice per the user's explicit delegation.
- `initialParams` (`teamId`, `teamPlayerId`) continue to reach every leaf screen unchanged.
- Update/add Jest + Testing Library for RN tests (TDD, Red→Green→Refactor) for the new menu screens,
  the new shared card component, and the restructured navigation (tab list + nested stack routes).

No backend or `Front/` changes — this is a Mobile-only navigation/UI restructuring.

## Capabilities

### New Capabilities
- `mobile-tab-menu-navigation`: intermediate list/card menu screens that group related Mobile tabs
  ("Equipo": Plantilla/Lesiones/Sanciones; "Competición": Liga/Amistosos) behind a single tab each.

### Modified Capabilities
(none — no existing `openspec/specs/` capability has documented requirements that change; this is
purely a Mobile navigation restructuring with no backend contract or cross-cutting spec impact)

## Impact

- Modified: `Mobile/src/navigation/RootNavigator.tsx` (`CalendarTabs` reduced to 4 tabs, two new
  nested-stack tab-group components), `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx`.
- New: `Mobile/src/screens/TeamMenuScreen.tsx`, `Mobile/src/screens/CompetitionMenuScreen.tsx`,
  `Mobile/src/screens/components/TabMenuCard.tsx`, and their `__tests__/`.
- New: `Mobile/src/navigation/__tests__/TeamTabStack.test.tsx`,
  `Mobile/src/navigation/__tests__/CompetitionTabStack.test.tsx`.
- No changes to `PlayersTab`, `InjuriesTab`, `SanctionsTab`, `LeagueTab`, `FriendliesTab` screen
  components themselves or their route `name`s — only how the user reaches them.
- No changes to `Front/` or `Back/ExtractionApi/`.
