## 1. `ScreenHeader` component (TDD)

- [x] 1.1 Write failing tests in
      `Mobile/src/shared/components/__tests__/ScreenHeader.test.tsx` (mock
      `@react-navigation/native`'s `useNavigation`): renders `title`
      (`testID="screen-header-title"`); always renders the back button
      (`testID="screen-header-back-button"`) even with no `actions`; pressing the back button
      with no `onBack` prop calls the mocked `navigation.goBack()`; pressing the back button with
      an `onBack` prop calls `onBack` instead of `goBack()`; renders zero action buttons when
      `actions` is omitted/empty; renders one action button per `actions` entry with its icon
      name, its `label` text, and its `testID` (falling back to
      `screen-header-action-<key>` when `testID` is not provided); pressing an action button
      calls that action's `onPress`.
- [x] 1.2 Implement `Mobile/src/shared/components/ScreenHeader.tsx` (single row: back button →
      title → action row; `coachColors` styling reusing the existing accent-bar motif from
      `ScreenSectionHeader`) to make the tests pass.
- [x] 1.3 Run `cd Mobile && npm test -- ScreenHeader` — green.

## 2. Migrate `CalendarScreen` (has an existing action)

- [x] 2.1 Update `Mobile/src/screens/__tests__/CalendarScreen.test.tsx` (Red): replace any
      assertions tied to `ScreenSectionHeader`/ad-hoc `filterButton` markup with assertions
      against `ScreenHeader` (title "Eventos", one action with `testID="open-filters-button"`,
      icon `options-outline`, label "Filtrar"); keep the existing assertion that tapping it opens
      the filters modal.
- [x] 2.2 Update `Mobile/src/screens/CalendarScreen.tsx` (Green): replace
      `<ScreenSectionHeader title="Eventos"><Pressable .../></ScreenSectionHeader>` with
      `<ScreenHeader title="Eventos" actions={[{ key: 'filter', icon: 'options-outline', label: 'Filtrar', onPress: () => setFiltersModalVisible(true), testID: 'open-filters-button' }]} />`;
      remove the now-unused `filterButton`/`filterButtonText` styles.
- [x] 2.3 Run `npm test -- CalendarScreen` — green.

## 3. Migrate the 7 remaining `ScreenSectionHeader` consumers with zero actions

- [x] 3.1 Update `Mobile/src/screens/__tests__/FriendliesScreen.test.tsx` and
      `Mobile/src/screens/FriendliesScreen.tsx` (Red→Green): swap `ScreenSectionHeader` for
      `<ScreenHeader title="Amistosos" />`.
- [x] 3.2 Update `Mobile/src/screens/__tests__/TournamentsScreen.test.tsx` and
      `Mobile/src/screens/TournamentsScreen.tsx` (Red→Green): swap for
      `<ScreenHeader title="Torneos" />`.
- [x] 3.3 Update `Mobile/src/screens/__tests__/PlayerSeasonCardsScreen.test.tsx` and
      `Mobile/src/screens/PlayerSeasonCardsScreen.tsx` (Red→Green): swap for
      `<ScreenHeader title="Plantilla" />`.
- [x] 3.4 Update `Mobile/src/screens/__tests__/LeagueScreen.test.tsx` and
      `Mobile/src/screens/LeagueScreen.tsx` (Red→Green): swap for `<ScreenHeader title="Liga" />`.
- [x] 3.5 Update `Mobile/src/screens/__tests__/InjuriesScreen.test.tsx` and
      `Mobile/src/screens/InjuriesScreen.tsx` (Red→Green): swap for
      `<ScreenHeader title="Lesiones" />`.
- [x] 3.6 Update `Mobile/src/screens/__tests__/SanctionsScreen.test.tsx` and
      `Mobile/src/screens/SanctionsScreen.tsx` (Red→Green): swap for
      `<ScreenHeader title="Sanciones" />`.
- [x] 3.7 Run `npm test -- FriendliesScreen TournamentsScreen PlayerSeasonCardsScreen LeagueScreen InjuriesScreen SanctionsScreen` — green.

## 4. Migrate the two menu screens (tab roots)

- [x] 4.1 Update `Mobile/src/screens/__tests__/TeamMenuScreen.test.tsx` and
      `Mobile/src/screens/TeamMenuScreen.tsx` (Red→Green): swap for
      `<ScreenHeader title="Equipo" />`.
- [x] 4.2 Update `Mobile/src/screens/__tests__/CompetitionMenuScreen.test.tsx` and
      `Mobile/src/screens/CompetitionMenuScreen.tsx` (Red→Green): swap for
      `<ScreenHeader title="Competición" />`.
- [x] 4.3 Run `npm test -- TeamMenuScreen CompetitionMenuScreen` — green.

## 5. Add a header to `NewsScreen` (currently has none)

- [x] 5.1 Write/update failing tests in `Mobile/src/screens/__tests__/NewsScreen.test.tsx` (new
      file if none exists): asserts `ScreenHeader` renders with `title="Noticias"` and the
      existing placeholder content (`news-placeholder`) still renders below it.
- [x] 5.2 Update `Mobile/src/screens/NewsScreen.tsx` (Green): wrap content with
      `<ScreenHeader title="Noticias" />` above the existing placeholder `View`.
- [x] 5.3 Run `npm test -- NewsScreen` — green.

## 6. Delete `ScreenSectionHeader`

- [x] 6.1 Grep the whole `Mobile/` tree for `ScreenSectionHeader` to confirm zero remaining
      references (only `ScreenHeader` should match after tasks 2-5).
- [x] 6.2 Delete `Mobile/src/shared/components/ScreenSectionHeader.tsx` and
      `Mobile/src/shared/components/__tests__/ScreenSectionHeader.test.tsx`.

## 7. Verification

- [x] 7.1 Run `cd Mobile && npm test` — full suite green, zero skipped tests.
- [x] 7.2 Run `openspec validate mobile-shared-screen-header --strict` from the repo root — no
      errors.
- [x] 7.3 Confirm via `git status`/`git diff --stat` that only files under `Mobile/` and
      `openspec/changes/mobile-shared-screen-header/` changed — nothing under `Front/` or
      `Back/`.
- [x] 7.4 Manual QA (not automatable in Jest, per `design.md` Decision 2/Risk): with the Expo app
      running, from each of the 4 tab-root screens (Noticias, Eventos, Equipo, Competición), tap
      "volver" and confirm it lands on `TeamSwitcherScreen` ("Seleccionar equipo"); from a leaf
      screen (e.g. Plantilla), confirm "volver" returns to the "Equipo" menu, not to
      `TeamSwitcherScreen`.

## 8. Post-implementation scope correction: migrate `EventDetailScreen` (manual QA bug fix)

- [x] 8.1 Manual QA (2026-07-30) found that the native back button on `EventDetailScreen` broke
      the app-level chrome (name+avatar header) when returning to `Calendar`. Confirmed with the
      user: bring `EventDetailScreen` into the unified `ScreenHeader` layout — see `design.md`
      Decision 3 post-implementation note.
- [x] 8.2 Write failing tests in `Mobile/src/screens/__tests__/EventDetailScreen.test.tsx` (Red):
      assert `<ScreenHeader title="Detalles del evento" />` (with default `showBack={true}`)
      renders in all 4 render branches (loading, error, empty, success).
- [x] 8.3 Update `Mobile/src/screens/EventDetailScreen.tsx` (Green): add `renderHeader()` (same
      pattern as `FriendliesScreen.tsx`) to all 4 branches; keep the root container from centering
      its whole tree (avoid the `NewsScreen` centering bug) — only the loading/error/empty inner
      content is centered, via a dedicated `centeredContent` style, not the root `container`.
- [x] 8.4 Update `Mobile/src/navigation/RootNavigator.tsx`: set `headerShown: false` on the
      `EventDetail` `Stack.Screen` only (not the `Stack.Group`, not `Calendar`) so the native
      header no longer renders for this screen.
- [x] 8.5 Run `cd Mobile && npm test` — full suite green (39 suites / 328 tests). Verified
      `Calendar` and `TeamSwitcher` still show the native header (`UserAvatarMenu` +
      title/`AppHeaderTitle`) by inspecting `RootNavigator.tsx`'s `screenOptions` inheritance —
      only `EventDetail`'s own `options` was changed.
