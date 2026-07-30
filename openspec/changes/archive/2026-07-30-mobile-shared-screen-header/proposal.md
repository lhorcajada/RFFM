## Why

`Mobile/src/shared/components/ScreenSectionHeader.tsx` only renders a title (plus optional
free-form trailing children). It provides no back navigation and no consistent place for
per-screen action buttons, so every screen that needs a "volver" affordance or an action (e.g.
`CalendarScreen`'s "Filtrar" button) improvises its own markup, and several screens
(`NewsScreen`) have no header at all. The user wants one shared header — title + always-present
back button + a row of icon+text action buttons, all in a single row — used consistently across
every screen under `Mobile/src/screens/` that currently renders its own in-content header (i.e.
the tab/nested-stack "content" screens with `headerShown: false`), replacing
`ScreenSectionHeader` outright.

## What Changes

- **BREAKING** (internal, no external consumers): remove `ScreenSectionHeader` and replace it
  with a new shared component, `Mobile/src/shared/components/ScreenHeader.tsx`, that renders
  title + back button + action-button row in one row.
- Back button defaults to `navigation.goBack()` (from `useNavigation()`), overridable per screen
  via an `onBack` prop for the rare case a screen needs custom back behavior (e.g. a confirm
  dialog). Always rendered — no screen hides it.
- Action buttons are icon (`Ionicons`, `-outline` suffix) + text, passed as a typed `actions`
  array prop; each screen declares its own 0..n actions.
- Migrate all 9 current `ScreenSectionHeader` consumers (`CalendarScreen`, `FriendliesScreen`,
  `TournamentsScreen`, `PlayerSeasonCardsScreen`, `LeagueScreen`, `InjuriesScreen`,
  `SanctionsScreen`, `TeamMenuScreen`, `CompetitionMenuScreen`) to `ScreenHeader`, plus
  `NewsScreen` (currently has no header at all).
- `CalendarScreen`'s existing "Filtrar" trailing button becomes its first `ScreenHeader` action
  (icon + "Filtrar" text) instead of ad-hoc `Pressable` children.
- `EventDetailScreen`, `TeamSwitcherScreen`, `LoginScreen` are explicitly **out of scope** for
  this migration — they already render a native React Navigation `Stack` header (back button +
  title + `UserAvatarMenu`) at `headerShown: true`. `design.md` documents this boundary and the
  rationale in detail.
- Delete `ScreenSectionHeader.tsx` and its test file once every consumer is migrated.

## Capabilities

### New Capabilities
- `mobile-screen-header`: shared header (title + always-present back button + per-screen
  icon+text action row) used by every Mobile content screen under a `headerShown: false`
  navigator.

### Modified Capabilities
(none — no existing `openspec/specs/` capability documents this header's behavior today)

## Impact

- New: `Mobile/src/shared/components/ScreenHeader.tsx` + `__tests__/ScreenHeader.test.tsx`.
- Removed: `Mobile/src/shared/components/ScreenSectionHeader.tsx` +
  `__tests__/ScreenSectionHeader.test.tsx`.
- Modified: `CalendarScreen`, `FriendliesScreen`, `TournamentsScreen`,
  `PlayerSeasonCardsScreen`, `LeagueScreen`, `InjuriesScreen`, `SanctionsScreen`,
  `TeamMenuScreen`, `CompetitionMenuScreen`, `NewsScreen`, and their `__tests__/`.
- No changes to `Mobile/src/navigation/RootNavigator.tsx` route names, to `EventDetailScreen`,
  `TeamSwitcherScreen`, `LoginScreen`, or to `Front/`/`Back/ExtractionApi/`.
