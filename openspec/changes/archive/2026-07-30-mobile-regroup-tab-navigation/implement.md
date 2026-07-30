# Implement: mobile-regroup-tab-navigation

Scope: **Mobile/ only** — no changes to `Front/` or `Back/ExtractionApi/`. Strict TDD
(Red → Green → Refactor) for every file. No commits, no pushes, no archive — leave the working
tree as-is for the user to review.

## Ground truth (verified against source, do not re-derive)

- Current `Mobile/src/navigation/RootNavigator.tsx` defines `CalendarTabs` inline with 7 flat
  `Tab.Screen`s: `NewsTab`, `CalendarTab`, `LeagueTab`, `FriendliesTab`, `PlayersTab`,
  `InjuriesTab`, `SanctionsTab`. Only `RootNavigator.tsx` and
  `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx` reference these route names anywhere in
  the repo (verified via grep) — no other programmatic `navigation.navigate('PlayersTab', ...)`
  etc. exists, so restructuring how they're reached is safe.
- `screenOptions={{ headerShown: false }}` is set at the `Tab.Navigator` level today; every screen
  renders its own in-content title via `Mobile/src/shared/components/ScreenSectionHeader.tsx`
  (title + two-tone accent bar). Keep this pattern — do not introduce native headers.
- `coachColors` (`Mobile/src/theme/colors.ts`) is the only color source — no new hex values.
- `TeamSwitcherScreen.tsx`'s `teamCard`/`teamNameText` styles are the closest existing precedent
  for a tappable list-row card; mirror that visual weight for `TabMenuCard`.

## Conventions to follow exactly (see `.claude/rules/react-native.md` for full detail)

- One screen per file, `PascalCase` + `Screen` suffix, under `Mobile/src/screens/`.
- Components used only by screens go in `Mobile/src/screens/components/` (see `EventCard.tsx` for
  precedent).
- Never change the internal route `name` of an existing screen — `PlayersTab`, `InjuriesTab`,
  `SanctionsTab`, `LeagueTab`, `FriendliesTab`, `CalendarTab`, `NewsTab` must all keep their exact
  current string values, just move to a different place in the navigator tree.
- Icons: `@expo/vector-icons` `Ionicons`, most literal name for the concept, `-outline` suffix.
- Tests co-located in `__tests__/` next to the file under test, Jest + `@testing-library/react-native`.
- Single Axios instance — not touched by this change (no new API calls).

## Task execution notes

### 1. `TabMenuCard` (tasks 1.1–1.2)

`Mobile/src/screens/components/TabMenuCard.tsx`:
```tsx
interface Props {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID: string;
}
```
Renders a `Pressable` row: `Ionicons name={icon}` + `Text` label + trailing
`Ionicons name="chevron-forward-outline"`, `coachColors.surface`/`textPrimary`/`border` styling
matching `TeamSwitcherScreen`'s `teamCard` row (padding, bottom border). Test asserts label text,
that both icon names render (leading `icon` prop value and `chevron-forward-outline`), and that
`onPress` fires on `fireEvent.press`.

### 2. `TeamMenuScreen` (tasks 2.1–2.2)

`Mobile/src/screens/TeamMenuScreen.tsx`: `useRoute<...>()` for `{ teamId }`,
`useNavigation<NativeStackNavigationProp<any>>()`. Renders `ScreenSectionHeader title="Equipo"`
then 3 `TabMenuCard`s in a `View`/`FlatList`:
- `{ label: 'Plantilla', icon: 'shirt-outline', target: 'PlayersTab' }`
- `{ label: 'Lesiones', icon: 'medkit-outline', target: 'InjuriesTab' }`
- `{ label: 'Sanciones', icon: 'warning-outline', target: 'SanctionsTab' }`

Each `onPress` → `navigation.navigate(target, { teamId })`. Test: mock `useNavigation` (and
`useRoute` if not passed via props) from `@react-navigation/native`, render with
`{ params: { teamId: 'team1' } }`, assert the 3 labels/icons appear and that pressing each calls
`navigate` with the right route name + `{ teamId: 'team1' }`.

### 3. `CompetitionMenuScreen` (tasks 3.1–3.2)

`Mobile/src/screens/CompetitionMenuScreen.tsx`: same shape, `{ teamId, teamPlayerId }` from
`route.params`, `ScreenSectionHeader title="Competición"`, 2 `TabMenuCard`s:
- `{ label: 'Liga', icon: 'trophy-outline', target: 'LeagueTab', params: { teamId } }`
- `{ label: 'Amistosos', icon: 'football-outline', target: 'FriendliesTab', params: { teamId, teamPlayerId } }`

Test mirrors `TeamMenuScreen`'s, asserting `FriendliesTab` navigation includes `teamPlayerId`.

### 4. `TeamTabStack` / `CompetitionTabStack` (tasks 4.1–4.4)

Add to `Mobile/src/navigation/RootNavigator.tsx`, next to `CalendarTabs`:
```tsx
const TeamStack = createNativeStackNavigator();
export const TeamTabStack = ({ route }: { route: { params?: { teamId?: string } } }) => {
  const teamId = route.params?.teamId;
  return (
    <TeamStack.Navigator screenOptions={{ headerShown: false }}>
      <TeamStack.Screen name="TeamMenu" component={TeamMenuScreen} initialParams={{ teamId }} />
      <TeamStack.Screen name="PlayersTab" component={PlayerSeasonCardsScreen} initialParams={{ teamId }} />
      <TeamStack.Screen name="InjuriesTab" component={InjuriesScreen} initialParams={{ teamId }} />
      <TeamStack.Screen name="SanctionsTab" component={SanctionsScreen} initialParams={{ teamId }} />
    </TeamStack.Navigator>
  );
};

const CompetitionStack = createNativeStackNavigator();
export const CompetitionTabStack = ({ route }: { route: { params?: { teamId?: string; teamPlayerId?: string } } }) => {
  const teamId = route.params?.teamId;
  const teamPlayerId = route.params?.teamPlayerId;
  return (
    <CompetitionStack.Navigator screenOptions={{ headerShown: false }}>
      <CompetitionStack.Screen name="CompetitionMenu" component={CompetitionMenuScreen} initialParams={{ teamId, teamPlayerId }} />
      <CompetitionStack.Screen name="LeagueTab" component={LeagueScreen} initialParams={{ teamId }} />
      <CompetitionStack.Screen name="FriendliesTab" component={FriendliesScreen} initialParams={{ teamId, teamPlayerId }} />
    </CompetitionStack.Navigator>
  );
};
```
Note: `createNativeStackNavigator` is already imported at the top of `RootNavigator.tsx` for the
outer `Stack`; reuse the import, just call it twice more for these two new local navigators
(exact same pattern the file already uses for `Stack`/`Tab` at module scope — one `createXNavigator()`
call per distinct navigator instance).

Tests (`TeamTabStack.test.tsx`, `CompetitionTabStack.test.tsx`): mock
`@react-navigation/native-stack`'s `createNativeStackNavigator` the same way
`CalendarTabs.test.tsx` mocks `createBottomTabNavigator` — return an object with `Navigator`/
`Screen` that render `View`/`Text` with predictable `testID`s (`stack-screen-<name>`,
`stack-label-<name>` or similar; adapt the existing mock shape). Assert route order and that
`initialParams` reach each screen (e.g. assert a rendered `testID` prop or a mock capturing
`initialParams`). Also mock the leaf screens
(`jest.mock('../../screens/TeamMenuScreen', () => 'TeamMenuScreen')`, etc.) like
`CalendarTabs.test.tsx` does.

### 5. Regroup `CalendarTabs` (tasks 5.1–5.2)

In `CalendarTabs.test.tsx`: remove assertions for `LeagueTab`/`FriendliesTab`/`PlayersTab`/
`InjuriesTab`/`SanctionsTab` icons/labels (now covered in the two new stack test files), update the
tab-order test to `['NewsTab', 'CalendarTab', 'TeamTab', 'CompetitionTab']`, add `TeamTab`
(label "Equipo", icon `people-outline`) and `CompetitionTab` (label "Competición", icon
`podium-outline`) assertions, replace the 5 `jest.mock('../../screens/...')` lines for the moved
leaf screens with `jest.mock('../TeamTabStack', ...)`-equivalent — since `TeamTabStack`/
`CompetitionTabStack` are exported from the same `RootNavigator.tsx` file as `CalendarTabs` (not a
separate importable module), mock them via `jest.mock` on the screen components they render is not
applicable; instead keep this test focused purely on tab-level label/icon and let `TeamTabStack`
render for real (its own leaf screens are cheap `View`/`Text` mocks or, if that causes noise, mock
`@react-navigation/native-stack` in this file too, same as in `TeamTabStack.test.tsx`) — pick
whichever keeps `CalendarTabs.test.tsx` deterministic and fast; write the test first and let it
guide the choice.

In `RootNavigator.tsx`: replace the 5 trailing `<Tab.Screen>` entries (`LeagueTab` through
`SanctionsTab`) inside `CalendarTabs` with:
```tsx
<Tab.Screen
  name="TeamTab"
  component={TeamTabStack}
  initialParams={{ teamId }}
  options={{
    tabBarLabel: 'Equipo',
    tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
  }}
/>
<Tab.Screen
  name="CompetitionTab"
  component={CompetitionTabStack}
  initialParams={{ teamId, teamPlayerId }}
  options={{
    tabBarLabel: 'Competición',
    tabBarIcon: ({ color, size }) => <Ionicons name="podium-outline" size={size} color={color} />,
  }}
/>
```
Remove the now-unused direct imports of `LeagueScreen`/`FriendliesScreen`/`PlayerSeasonCardsScreen`/
`InjuriesScreen`/`SanctionsScreen` from the `CalendarTabs`-adjacent top-level imports only if they
become unused there — they are still needed by `TeamTabStack`/`CompetitionTabStack` in the same
file, so the imports stay, just used by the new components instead.

### 6. Verification (tasks 6.1–6.3)

- Run `cd Mobile && npm test`. Full suite must pass, zero skipped tests.
- Run `openspec validate mobile-regroup-tab-navigation --strict` from the repo root — must report
  valid (already confirmed valid at proposal time; re-check after any spec edits).
- Run `git status` (repo root) and confirm only files under `Mobile/` and
  `openspec/changes/mobile-regroup-tab-navigation/` changed — nothing under `Front/` or `Back/`.
- Do **not** commit, push, or archive. Leave the change directory as-is for the user to review.

## Report back

When done, report: every file created/modified (absolute paths), the exact `npm test` result
summary (pass/fail counts), and confirmation that `openspec validate --strict` passed and no
`Front/`/`Back/` files were touched.
