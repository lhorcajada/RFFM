## Context

`Mobile/src/navigation/RootNavigator.tsx` currently defines `CalendarTabs`, a single
`Tab.Navigator` (from `@react-navigation/bottom-tabs`) with 7 flat `Tab.Screen`s, exported as a
named component for isolated testing (per `.claude/rules/react-native.md`). No code outside
`RootNavigator.tsx` and its test file references the route names `PlayersTab`, `LeagueTab`,
`FriendliesTab`, `InjuriesTab`, `SanctionsTab`, `CalendarTab`, `NewsTab` (verified via
project-wide grep) — so restructuring how these routes are reached (still under the same route
names) does not risk breaking programmatic navigation elsewhere in the app.

This change does not touch any Expo SDK API (SecureStore, Constants, notifications, camera, etc.)
— it only nests one more `@react-navigation` navigator inside another, which is a stable, well
documented React Navigation (not Expo-SDK-versioned) pattern already used once in this app
(`Stack.Navigator` > `Stack.Group` > `Tab.Navigator` for `CalendarTabs` itself). Per
`Mobile/AGENTS.md`, the versioned Expo docs check is required before using an **Expo** API;
nested `Tab.Navigator`/`Stack.Navigator` composition is a React Navigation library concern, not an
Expo SDK version concern, so no Expo docs lookup is required for this change specifically.

## Goals / Non-Goals

**Goals:**
- Reduce the bottom tab bar to 4 tabs: Noticias, Eventos, Equipo, Competición.
- "Equipo" and "Competición" open an intermediate list/card menu (most common "grouped menu" mobile
  pattern), not an action sheet or sub-tabs — per the user's explicit, already-confirmed choice.
- Keep every existing leaf screen and its route `name` unchanged; only the path to reach it changes.
- Preserve `initialParams` (`teamId`, `teamPlayerId`) propagation to every leaf screen.
- Native back (Android hardware back / iOS back gesture) from a leaf screen returns to the
  intermediate menu, not to the tab bar directly.

**Non-Goals:**
- No visual redesign of the 5 existing leaf screens themselves.
- No new backend calls or contract changes.
- No renaming of any existing route/screen `name`.
- No generic/reusable "menu navigator factory" abstraction — two concrete menu screens are enough
  for 2 groups; over-abstracting for a hypothetical third group is not justified now.

## Decisions

### 1. Nested `Stack.Navigator` per group tab, mounted as the `Tab.Screen` component

Each of the two new group tabs (`TeamTab`, `CompetitionTab`) renders its own small
`createNativeStackNavigator()` instance whose **initial route** is a new intermediate menu screen,
and whose other routes are the existing leaf screens (unchanged `name`s):

```
Tab.Navigator (CalendarTabs)
├─ NewsTab            → NewsScreen                          (unchanged)
├─ CalendarTab        → CalendarScreen                      (unchanged)
├─ TeamTab            → TeamTabStack (nested Stack.Navigator)
│                         ├─ TeamMenu   → TeamMenuScreen      (new, initial route)
│                         ├─ PlayersTab → PlayerSeasonCardsScreen (unchanged name/component)
│                         ├─ InjuriesTab → InjuriesScreen       (unchanged name/component)
│                         └─ SanctionsTab → SanctionsScreen     (unchanged name/component)
└─ CompetitionTab     → CompetitionTabStack (nested Stack.Navigator)
                          ├─ CompetitionMenu → CompetitionMenuScreen (new, initial route)
                          ├─ LeagueTab       → LeagueScreen         (unchanged name/component)
                          └─ FriendliesTab   → FriendliesScreen     (unchanged name/component)
```

This is React Navigation's standard "nested navigator" composition (a `Stack.Navigator` mounted as
a tab's screen component) — it gets native back gesture/hardware-back-to-parent-route behavior for
free, satisfying the acceptance criterion about back navigation, with no custom back handling code.

**Alternative considered — a single generic `TabMenuScreen` navigator factory parameterized by a
route/items list**: rejected as premature abstraction for exactly 2 call sites; two concrete,
readable screens are easier to test and modify independently, consistent with
`.claude/rules/react-native.md`'s "one screen per file" convention.

**Alternative considered — action sheet / bottom sheet on tab press instead of a screen**: rejected
per the user's explicit instruction (list/card intermediate screen, not an action sheet).

**Alternative considered — sub-tabs (nested `Tab.Navigator` instead of `Stack.Navigator`) inside
each group**: rejected per the user's explicit instruction; also a nested tab bar would compete
visually with the outer tab bar.

### 2. `TeamTabStack` / `CompetitionTabStack` live inline in `RootNavigator.tsx`, exported like `CalendarTabs`

`CalendarTabs` is already defined and exported directly from `RootNavigator.tsx` (not a separate
file) specifically so it can be rendered and asserted on in isolation
(`navigation/__tests__/CalendarTabs.test.tsx`). The two new nested-stack components follow the same
precedent: `export const TeamTabStack = ({ route }) => (...)` and
`export const CompetitionTabStack = ({ route }) => (...)`, defined in `RootNavigator.tsx` next to
`CalendarTabs`, each reading `teamId`/`teamPlayerId` off `route.params` and threading them into
their own `initialParams` per screen — mirroring exactly how `CalendarTabs` already reads
`route.params` today.

**Alternative considered**: extracting each into its own file under `navigation/` (like
`AppHeaderTitle.tsx`/`UserAvatarMenu.tsx`). Rejected because those are leaf UI components, not tab
groups; the existing precedent for a "tab group" (`CalendarTabs`) is to live inline in
`RootNavigator.tsx`, and consistency with that precedent outweighs file-length concerns for two
~15-line additions.

### 3. Two new menu screens + one shared presentational card component

- `Mobile/src/screens/TeamMenuScreen.tsx`: reads `teamId` from `route.params`, renders 3
  `TabMenuCard`s (Plantilla/`shirt-outline`, Lesiones/`medkit-outline`, Sanciones/`warning-outline`),
  `onPress` calls `navigation.navigate('PlayersTab' | 'InjuriesTab' | 'SanctionsTab', { teamId })`.
- `Mobile/src/screens/CompetitionMenuScreen.tsx`: reads `teamId`/`teamPlayerId` from
  `route.params`, renders 2 `TabMenuCard`s (Liga/`trophy-outline` with `{ teamId }`,
  Amistosos/`football-outline` with `{ teamId, teamPlayerId }`), `onPress` calls
  `navigation.navigate('LeagueTab' | 'FriendliesTab', { ...params })`.
- `Mobile/src/screens/components/TabMenuCard.tsx`: presentational `Pressable` row (icon + label +
  `chevron-forward-outline`), `coachColors` styling matching `TeamSwitcherScreen`'s existing card
  row style (`teamCard`/`teamNameText` pattern) — props: `label: string`, `icon: string`,
  `onPress: () => void`, `testID: string`. Lives in `screens/components/` because it is used only by
  screens (per `.claude/rules/react-native.md` §2), analogous to `EventCard.tsx`.
- Both menu screens use `ScreenSectionHeader` (`Mobile/src/shared/components/ScreenSectionHeader.tsx`)
  for their title ("Equipo" / "Competición"), matching every other listing screen in the app
  (Eventos, Amistosos, Liga, Plantilla, Lesiones, Sanciones already use it per its own doc comment).
- No data fetching in either menu screen — the list is static, so no `loading`/`error` state is
  needed (no network call happens until a leaf screen is reached).

### 4. Icons for the two new group tabs

- "Equipo" → `people-outline` (a literal group-of-people icon, distinct from `shirt-outline` used
  by the "Plantilla" leaf item it contains).
- "Competición" → `podium-outline` (a literal ranking/competition icon, distinct from
  `trophy-outline`/`football-outline` used by the "Liga"/"Amistosos" leaf items it contains).

Both keep the `-outline` suffix consistent with every other tab icon in the app.

### 5. `headerShown: false` preserved throughout (no native header added)

The existing `CalendarTabs` sets `screenOptions={{ headerShown: false }}` at the `Tab.Navigator`
level because every screen renders its own in-content title via `ScreenSectionHeader`, and the
outer `Stack.Screen name="Calendar"` already supplies the app-level header
(`AppHeaderTitle` + `UserAvatarMenu`). The two new nested `Stack.Navigator`s also set
`screenOptions={{ headerShown: false }}` to stay visually consistent — no double header appears
when drilling into a leaf screen. Back navigation still works via the platform-default stack
gesture/hardware back button, which React Navigation's native-stack provides independently of
`headerShown`.

**Alternative considered**: `headerShown: true` on the nested stacks to get a native back button.
Rejected because it would show a second, empty-title header bar above each leaf screen's own
`ScreenSectionHeader`, duplicating the "Plantilla"/"Lesiones"/etc. title and breaking the app's
established "one in-content header per screen" visual language.

## Risks / Trade-offs

- **[Risk] Losing the native back button as a visible tap target on iOS** since `headerShown` stays
  `false` → **Mitigation**: iOS's native-stack swipe-back gesture is enabled by default regardless
  of `headerShown`; Android's hardware back button is always available. This matches the existing
  behavior of every other screen in the app today (also `headerShown: false`), so no regression is
  introduced.
- **[Risk] Test suite churn**: `CalendarTabs.test.tsx`'s existing "tab order" assertion
  (`['NewsTab', 'CalendarTab', 'LeagueTab', 'FriendliesTab', 'PlayersTab', 'InjuriesTab',
  'SanctionsTab']`) must change to `['NewsTab', 'CalendarTab', 'TeamTab', 'CompetitionTab']`, and
  the per-leaf-tab icon/label assertions for `LeagueTab`/`FriendliesTab`/`PlayersTab`/
  `InjuriesTab`/`SanctionsTab` move out of `CalendarTabs.test.tsx` into the two new
  `TeamTabStack.test.tsx` / `CompetitionTabStack.test.tsx` files → **Mitigation**: this is expected,
  intentional TDD churn (Red step), not incidental breakage; tasks.md sequences it explicitly.

## Open Questions

None — scope, grouping, and icon delegation already confirmed by the user before starting.
