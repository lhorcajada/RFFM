# Implement — `mobile-shared-screen-header`

Technical script for `openspec-implementer`. Follow the tasks in order. This is a Mobile-only
change (`Mobile/`) — do not touch `Front/` or `Back/ExtractionApi/`. Do not add new npm
dependencies. Do not create a git commit or push — that is the user's call, not yours.

Read before starting, in full: `openspec/changes/mobile-shared-screen-header/proposal.md` and
`openspec/changes/mobile-shared-screen-header/design.md`. This script summarizes the decisions
already made there; if anything here seems to contradict `design.md`, `design.md` wins.

## Hard constraints (apply to every task below)

- **TDD, no exceptions**: for every task that touches `ScreenHeader.tsx` or a screen file, write
  the test assertions first (or update existing ones to the new expected behavior), run
  `npm test -- <pattern>` and **confirm the failure** (Red) before writing/editing the
  corresponding production code (Green). Do not write production code first and backfill tests.
- **No new dependencies.** Everything needed (`@expo/vector-icons`, `@react-navigation/native`,
  `react-native`, `@testing-library/react-native`) is already installed.
- **Out of scope, do not touch**: `Mobile/src/screens/EventDetailScreen.tsx`,
  `Mobile/src/screens/TeamSwitcherScreen.tsx`, `Mobile/src/screens/LoginScreen.tsx`, and
  `Mobile/src/navigation/RootNavigator.tsx`. These keep their native `Stack.Navigator` header.
- **Colors**: only `coachColors` tokens from `Mobile/src/theme/colors.ts`. Do not introduce a new
  hex value. If a color used by `ScreenSectionHeader` today (`coachColors.primary`,
  `coachColors.secondary`) is not enough for the back button / action row, check
  `Mobile/src/theme/colors.ts` for an existing token (e.g. `textPrimary`, `border`) before asking
  the user — never invent a new hex.
- **Icons**: `Ionicons` from `@expo/vector-icons`, always the `-outline` variant, matching the
  existing icon usage elsewhere in `Mobile/src/screens/` and `Mobile/src/navigation/`.
- **Route/screen `name`s**: never change any `Tab.Screen`/`Stack.Screen` `name` prop. This change
  only touches in-content markup, never navigation config.
- **No commit, no push.** Leave the working tree as modified files only.

---

## 1. `ScreenHeader` component (TDD)

- [x] 1.1 **Red.** Create `Mobile/src/shared/components/__tests__/ScreenHeader.test.tsx`. Follow
      the mocking pattern already used in `Mobile/src/screens/__tests__/NewsScreen.test.tsx` and
      `Mobile/src/screens/CalendarScreen.tsx`'s own test file for mocking
      `@react-navigation/native` — i.e.
      `jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }))`
      where `mockNavigation = { goBack: jest.fn() }` (declare it so each test can inspect calls;
      reset with `jest.clearAllMocks()` in `beforeEach` if you use a shared mock object across
      tests). Write these test cases:
      - Renders `title` prop as text inside `testID="screen-header-title"`.
      - Always renders `testID="screen-header-back-button"` even when `actions` is omitted.
      - Pressing the back button with no `onBack` prop calls the mocked `navigation.goBack()`
        exactly once.
      - Pressing the back button when an `onBack` prop is supplied calls `onBack` and does
        **not** call `navigation.goBack()`.
      - Renders zero elements with `testID` starting `screen-header-action-` when `actions` is
        omitted or an empty array.
      - Given `actions={[{ key: 'filter', icon: 'options-outline', label: 'Filtrar', onPress: fn }]}`
        (no `testID`), renders one action button at
        `testID="screen-header-action-filter"` showing text `"Filtrar"`.
      - Given an action with an explicit `testID: 'open-filters-button'`, the button is found at
        `testID="open-filters-button"` (not the derived one) — i.e. `testID` overrides when
        provided.
      - Pressing an action button calls that action's own `onPress` (not any other action's).
      Run `cd Mobile && npm test -- ScreenHeader` and confirm it fails (component does not exist
      yet) before moving to 1.2.
- [x] 1.2 **Green.** Create `Mobile/src/shared/components/ScreenHeader.tsx`. Mirror the doc-comment
      style and `StyleSheet.create` structure of
      `Mobile/src/shared/components/ScreenSectionHeader.tsx` (read it first — it is the direct
      predecessor of this component and its accent-bar markup/styles are reused, not
      reinvented). Exact shape, per `design.md` Decision 1:
      ```ts
      import { Ionicons } from '@expo/vector-icons';
      import { useNavigation } from '@react-navigation/native';

      export interface ScreenHeaderAction {
        key: string;
        icon: string; // Ionicons name, '-outline' suffix
        label: string;
        onPress: () => void;
        testID?: string;
      }

      interface ScreenHeaderProps {
        title: string;
        actions?: ScreenHeaderAction[];
        onBack?: () => void;
      }
      ```
      Structure, single row (`flexDirection: 'row'`, `alignItems: 'center'`):
      1. Back button: `Pressable` with `testID="screen-header-back-button"`, containing
         `<Ionicons name="chevron-back-outline" .../>`, fixed (non-flex) width, `onPress` calls
         `onBack` if provided, else `navigation.goBack()` (`useNavigation()` resolved at the top
         of the component, same pattern as `Mobile/src/screens/CalendarScreen.tsx` /
         `Mobile/src/screens/TeamMenuScreen.tsx` — read one of them for the exact import/usage
         idiom).
      2. Title: `Text` with `testID="screen-header-title"`, `numberOfLines={1}`, `flex: 1`, and
         the same `fontSize: 20, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2,
         color: coachColors.primary` styling `ScreenSectionHeader` uses for `screen-section-title`.
      3. Action row: only rendered when `actions && actions.length > 0`. Each action is a
         `Pressable` with `testID={action.testID ?? \`screen-header-action-${action.key}\`}`,
         containing `<Ionicons name={action.icon} .../>` plus `<Text>{action.label}</Text>`,
         `onPress={action.onPress}`.
      Keep the accent gradient bar (`accent`/`accentPrimary`/`accentSecondary` Views, identical
      styles) below the row, unchanged from `ScreenSectionHeader`.
      Colors: `coachColors.primary` (title, accentPrimary, back icon), `coachColors.secondary`
      (accentSecondary) — check `Mobile/src/theme/colors.ts` for any other token you need (e.g.
      action label text color) rather than hardcoding.
      Export `ScreenHeader` as default, and export the `ScreenHeaderAction` type (named export)
      since screens will need it to type their `actions` arrays.
- [x] 1.3 Run `cd Mobile && npm test -- ScreenHeader` — confirm green before moving on.

## 2. Migrate `CalendarScreen` (has an existing action)

- [x] 2.1 **Red.** Open `Mobile/src/screens/__tests__/CalendarScreen.test.tsx`. Find and update
      any assertion tied to `screen-section-title`, `filterButton`/`filterButtonText` styling, or
      `ScreenSectionHeader`-specific markup so it instead expects: a `testID="screen-header-title"`
      with text `"Eventos"`, and an action button at `testID="open-filters-button"` with label
      text `"Filtrar"`. **Keep** the existing assertion(s) that tapping `open-filters-button`
      opens the filters modal — that `testID` does not change, so those assertions should not
      need to change beyond whatever selector they use to find the button. Run
      `cd Mobile && npm test -- CalendarScreen` and confirm it now fails against the still-unmigrated
      `CalendarScreen.tsx`.
- [x] 2.2 **Green.** In `Mobile/src/screens/CalendarScreen.tsx`:
      - Replace `import ScreenSectionHeader from '../shared/components/ScreenSectionHeader';`
        with `import ScreenHeader from '../shared/components/ScreenHeader';`.
      - Replace the `renderHeader` function's body (currently
        `<ScreenSectionHeader title="Eventos"><Pressable testID="open-filters-button" .../></ScreenSectionHeader>`
        around line 106-112) with:
        ```tsx
        const renderHeader = () => (
          <ScreenHeader
            title="Eventos"
            actions={[
              {
                key: 'filter',
                icon: 'options-outline',
                label: 'Filtrar',
                onPress: () => setFiltersModalVisible(true),
                testID: 'open-filters-button',
              },
            ]}
          />
        );
        ```
      - Remove the now-unused `filterButton`/`filterButtonText` entries from the `StyleSheet.create`
        block and the now-unused `Pressable` import if nothing else in the file uses it (check
        first — `Pressable` may still be used elsewhere in `CalendarScreen.tsx`, e.g. event list
        items; only remove the import if grep confirms zero remaining usages in the file).
- [x] 2.3 Run `cd Mobile && npm test -- CalendarScreen` — confirm green.

## 3. Migrate the 7 remaining `ScreenSectionHeader` consumers with zero actions

For each screen below: **Red** — update its test file's header-related assertions (title
`testID` from `screen-section-title` to `screen-header-title`, same title text as today) and run
`npm test -- <ScreenName>` to confirm it fails; **Green** — in the screen file, swap the
`ScreenSectionHeader` import for `ScreenHeader` and replace
`<ScreenSectionHeader title="...">...</ScreenSectionHeader>` (or
`<ScreenSectionHeader title="..." />` if it has no children) with `<ScreenHeader title="..." />`
(no `actions` prop — these screens have zero header actions today per `design.md` Decision 4).

- [x] 3.1 `Mobile/src/screens/__tests__/FriendliesScreen.test.tsx` +
      `Mobile/src/screens/FriendliesScreen.tsx` → `<ScreenHeader title="Amistosos" />`.
- [x] 3.2 `Mobile/src/screens/__tests__/TournamentsScreen.test.tsx` +
      `Mobile/src/screens/TournamentsScreen.tsx` → `<ScreenHeader title="Torneos" />`.
- [x] 3.3 `Mobile/src/screens/__tests__/PlayerSeasonCardsScreen.test.tsx` +
      `Mobile/src/screens/PlayerSeasonCardsScreen.tsx` → `<ScreenHeader title="Plantilla" />`.
- [x] 3.4 `Mobile/src/screens/__tests__/LeagueScreen.test.tsx` +
      `Mobile/src/screens/LeagueScreen.tsx` → `<ScreenHeader title="Liga" />`.
- [x] 3.5 `Mobile/src/screens/__tests__/InjuriesScreen.test.tsx` +
      `Mobile/src/screens/InjuriesScreen.tsx` → `<ScreenHeader title="Lesiones" />`.
- [x] 3.6 `Mobile/src/screens/__tests__/SanctionsScreen.test.tsx` +
      `Mobile/src/screens/SanctionsScreen.tsx` → `<ScreenHeader title="Sanciones" />`.
      Note: confirm the exact current title string passed to `ScreenSectionHeader` in each screen
      file before writing the test assertion — use the literal already in the file (the titles
      listed here match `tasks.md`/`design.md`, but read each screen file first in case of a typo
      or accent difference, e.g. verify it is exactly `"Sanciones"` not `"Sanción"` etc.).
- [x] 3.7 Run
      `cd Mobile && npm test -- FriendliesScreen TournamentsScreen PlayerSeasonCardsScreen LeagueScreen InjuriesScreen SanctionsScreen`
      — confirm green.

## 4. Migrate the two menu screens (tab roots)

- [x] 4.1 **Red→Green.** `Mobile/src/screens/__tests__/TeamMenuScreen.test.tsx` +
      `Mobile/src/screens/TeamMenuScreen.tsx` → `<ScreenHeader title="Equipo" />` (verify the
      exact current title string in the file first, same caveat as task 3.6).
- [x] 4.2 **Red→Green.** `Mobile/src/screens/__tests__/CompetitionMenuScreen.test.tsx` +
      `Mobile/src/screens/CompetitionMenuScreen.tsx` → `<ScreenHeader title="Competición" />`
      (verify exact current title string first).
- [x] 4.3 Run `cd Mobile && npm test -- TeamMenuScreen CompetitionMenuScreen` — confirm green.

## 5. Add a header to `NewsScreen` (currently has none)

`NewsScreen` today (`Mobile/src/screens/NewsScreen.tsx`) renders its own ad-hoc
`testID="news-title"` `Text` with `"Noticias"` — no `ScreenSectionHeader`, no back button. Its
existing test file `Mobile/src/screens/__tests__/NewsScreen.test.tsx` asserts on
`news-title` and `news-placeholder`.

- [x] 5.1 **Red.** Update `Mobile/src/screens/__tests__/NewsScreen.test.tsx`:
      - Add the same `@react-navigation/native` `useNavigation` mock used in
        `ScreenHeader.test.tsx` / `CalendarScreen.test.tsx` (required now that `NewsScreen` will
        render `ScreenHeader`, which calls `useNavigation()` internally) — the file already mocks
        `useNavigation` (see current content, `() => ({ navigate: jest.fn() })`); extend the
        mocked object to include `goBack: jest.fn()` since `ScreenHeader`'s default back handler
        calls it.
      - Replace the assertion on `getByTestId('news-title').props.children` with an assertion on
        `getByTestId('screen-header-title').props.children` equal to `'Noticias'`.
      - Keep the `news-placeholder` assertion (`'Próximamente...'`) unchanged — that content
        stays as-is, just below the new header.
      Run `cd Mobile && npm test -- NewsScreen` and confirm it fails against the still-unmigrated
      `NewsScreen.tsx`.
- [x] 5.2 **Green.** In `Mobile/src/screens/NewsScreen.tsx`:
      - Add `import ScreenHeader from '../shared/components/ScreenHeader';`.
      - Replace the `testID="news-title"` `Text` element with `<ScreenHeader title="Noticias" />`
        placed above the existing `news-placeholder` `Text`, inside the same container `View`.
      - Remove the now-unused `title` entry from `StyleSheet.create` if nothing else in the file
        references it.
- [x] 5.3 Run `cd Mobile && npm test -- NewsScreen` — confirm green.

## 6. Delete `ScreenSectionHeader`

- [x] 6.1 Grep the whole `Mobile/` tree for the literal string `ScreenSectionHeader` (e.g.
      `grep -r ScreenSectionHeader Mobile/src`). Confirm zero remaining references — every match
      should now be `ScreenHeader`, not `ScreenSectionHeader`. If any screen still references it,
      go back and finish migrating that screen before proceeding.
- [x] 6.2 Delete `Mobile/src/shared/components/ScreenSectionHeader.tsx` and
      `Mobile/src/shared/components/__tests__/ScreenSectionHeader.test.tsx`.

## 7. Verification

Run these commands from the repo root / `Mobile/` as indicated and confirm every one succeeds
before reporting the change implemented:

```bash
cd Mobile && npm test                       # full Jest suite green, zero skipped tests
```

```bash
openspec validate mobile-shared-screen-header --strict   # from repo root, no errors
```

```bash
git status
git diff --stat
```
Confirm from the `git status`/`git diff --stat` output that only files under `Mobile/` and
`openspec/changes/mobile-shared-screen-header/` changed — nothing under `Front/` or `Back/`.

- [x] 7.1 `cd Mobile && npm test` — full suite green, zero skipped/pending tests
      (`it.skip`/`test.skip`/`xit` are not acceptable — if you find yourself wanting to skip a
      test to get to green, stop and report the failure instead of skipping it).
- [x] 7.2 `openspec validate mobile-shared-screen-header --strict` from the repo root — no errors.
- [x] 7.3 Confirm via `git status` / `git diff --stat` that only files under `Mobile/` and
      `openspec/changes/mobile-shared-screen-header/` changed.
- [x] 7.4 **Do not attempt** the manual QA step from `tasks.md` §7.4 (tapping "volver" from each
      tab-root screen in a running Expo app) — it requires a human with the app running and is
      out of scope for this automated implementation pass. Note in your final report that this
      manual QA step remains outstanding for the user to perform.

**Do not run `git commit`, `git add`, or `git push` at any point in this script** — leave the
working tree with modified/new/deleted files for the user to review and commit themselves.
