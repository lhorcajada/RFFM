## 1. Shared `TabMenuCard` component

- [ ] 1.1 Write failing tests for `Mobile/src/screens/components/TabMenuCard.tsx` in
      `Mobile/src/screens/components/__tests__/TabMenuCard.test.tsx`: renders `label`, renders the
      given `icon` name plus the `chevron-forward-outline` trailing icon, calls `onPress` on tap,
      exposes the given `testID`.
- [ ] 1.2 Implement `Mobile/src/screens/components/TabMenuCard.tsx` (`Pressable` row: icon + label +
      chevron, `coachColors` styling) to make the tests pass.

## 2. TeamMenuScreen

- [ ] 2.1 Write failing tests for `Mobile/src/screens/TeamMenuScreen.tsx` in
      `Mobile/src/screens/__tests__/TeamMenuScreen.test.tsx`: renders a "Equipo" section title,
      renders 3 `TabMenuCard`s (Plantilla/`shirt-outline`, Lesiones/`medkit-outline`,
      Sanciones/`warning-outline`), tapping each calls `navigation.navigate` with the correct route
      name (`PlayersTab`/`InjuriesTab`/`SanctionsTab`) and `{ teamId }`.
- [ ] 2.2 Implement `Mobile/src/screens/TeamMenuScreen.tsx` (static list, `useRoute`/`useNavigation`,
      `ScreenSectionHeader` title "Equipo") to make the tests pass.

## 3. CompetitionMenuScreen

- [ ] 3.1 Write failing tests for `Mobile/src/screens/CompetitionMenuScreen.tsx` in
      `Mobile/src/screens/__tests__/CompetitionMenuScreen.test.tsx`: renders a "Competición" section
      title, renders 2 `TabMenuCard`s (Liga/`trophy-outline`, Amistosos/`football-outline`), tapping
      Liga calls `navigation.navigate('LeagueTab', { teamId })`, tapping Amistosos calls
      `navigation.navigate('FriendliesTab', { teamId, teamPlayerId })`.
- [ ] 3.2 Implement `Mobile/src/screens/CompetitionMenuScreen.tsx` (static list, `useRoute`/
      `useNavigation`, `ScreenSectionHeader` title "Competición") to make the tests pass.

## 4. Nested stack navigators (`TeamTabStack`, `CompetitionTabStack`)

- [ ] 4.1 Write failing tests in `Mobile/src/navigation/__tests__/TeamTabStack.test.tsx` (mocking
      `@react-navigation/native-stack` the way `CalendarTabs.test.tsx` mocks
      `@react-navigation/bottom-tabs`): asserts the stack registers routes in order `TeamMenu`,
      `PlayersTab`, `InjuriesTab`, `SanctionsTab`, with `TeamMenu` as the initial route and
      `teamId` forwarded via `initialParams` to every screen.
- [ ] 4.2 Implement `TeamTabStack` in `Mobile/src/navigation/RootNavigator.tsx` (nested
      `createNativeStackNavigator()`, `screenOptions={{ headerShown: false }}`,
      `TeamMenu` → `TeamMenuScreen`, `PlayersTab` → `PlayerSeasonCardsScreen`, `InjuriesTab` →
      `InjuriesScreen`, `SanctionsTab` → `SanctionsScreen`) to make the tests pass.
- [ ] 4.3 Write failing tests in `Mobile/src/navigation/__tests__/CompetitionTabStack.test.tsx`
      (same mocking approach): asserts the stack registers routes in order `CompetitionMenu`,
      `LeagueTab`, `FriendliesTab`, with `CompetitionMenu` as the initial route and
      `teamId`/`teamPlayerId` forwarded via `initialParams`.
- [ ] 4.4 Implement `CompetitionTabStack` in `Mobile/src/navigation/RootNavigator.tsx` (nested
      `createNativeStackNavigator()`, `screenOptions={{ headerShown: false }}`,
      `CompetitionMenu` → `CompetitionMenuScreen`, `LeagueTab` → `LeagueScreen`, `FriendliesTab` →
      `FriendliesScreen`) to make the tests pass.

## 5. Regroup the bottom tab bar (`CalendarTabs`)

- [ ] 5.1 Update `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx` (Red): remove the
      per-leaf-tab assertions that no longer apply at this level (icons/labels for
      `PlayersTab`/`LeagueTab`/`FriendliesTab`/`InjuriesTab`/`SanctionsTab`, now covered by
      `TeamTabStack.test.tsx`/`CompetitionTabStack.test.tsx`), update the tab-order assertion to
      `['NewsTab', 'CalendarTab', 'TeamTab', 'CompetitionTab']`, add assertions for `TeamTab`
      (label "Equipo", icon `people-outline`) and `CompetitionTab` (label "Competición", icon
      `podium-outline`), mock `TeamTabStack`/`CompetitionTabStack` as leaf strings via `jest.mock`.
- [ ] 5.2 Update `CalendarTabs` in `Mobile/src/navigation/RootNavigator.tsx` (Green): replace the 5
      trailing `Tab.Screen`s (`LeagueTab`, `FriendliesTab`, `PlayersTab`, `InjuriesTab`,
      `SanctionsTab`) with 2 `Tab.Screen`s (`TeamTab` → `TeamTabStack`, `CompetitionTab` →
      `CompetitionTabStack`), each with the appropriate `initialParams` and new icon, keeping
      `NewsTab`/`CalendarTab` untouched.

## 6. Verification

- [ ] 6.1 Run `cd Mobile && npm test` — full suite green, zero skipped tests.
- [ ] 6.2 Run `openspec validate mobile-regroup-tab-navigation --strict` from the repo root — no
      errors.
- [ ] 6.3 Confirm via `git status`/`git diff --stat` that only files under `Mobile/` and
      `openspec/changes/mobile-regroup-tab-navigation/` changed — nothing under `Front/` or `Back/`.
