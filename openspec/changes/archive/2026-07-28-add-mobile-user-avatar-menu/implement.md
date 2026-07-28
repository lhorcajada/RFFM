# implement.md — add-mobile-user-avatar-menu

Technical script for the `openspec-implementer` agent. Scope: `Mobile/` only. Do not touch `Front/` or `Back/`.

## Context

`Mobile/src/navigation/RootNavigator.tsx` wraps every authenticated screen (`TeamSwitcher`, the `Calendar` tab group, `EventDetail`) in a single `Stack.Navigator` with `screenOptions={{ headerShown: true }}`. `Login` overrides `headerShown: false`. There is currently no `headerRight` configured anywhere, and `AuthContext.logout()` (`Mobile/src/auth/AuthContext.tsx`) is fully implemented and tested but unreachable from the UI.

This change adds a header avatar (`headerRight`) that opens an animated dropdown with a single "Cerrar sesión" item calling `useAuth().logout()`. Full rationale in `design.md` (this same change folder) — follow its 6 decisions exactly, do not re-derive them:
1. Wire via `Stack.Navigator`'s `screenOptions.headerRight` in `RootNavigator.tsx` (not inside `AppHeaderTitle.tsx`, not per-screen).
2. New self-contained component `Mobile/src/navigation/UserAvatarMenu.tsx` + co-located test, no props, reads `useAuth()` internally.
3. Animation via RN core `Animated` (`Animated.Value` + `Animated.timing`, `useNativeDriver: true`), opacity 0→1 and scale 0.95→1, ~150ms.
4. Outside-tap-to-close via RN core `Modal` (`transparent visible={open}`) with a full-screen `Pressable` backdrop behind the menu panel.
5. Icon: `Ionicons` (`@expo/vector-icons`), glyph `"person-circle-outline"`. Promote `@expo/vector-icons` from transitive (via `expo`) to direct dependency in `Mobile/package.json`.
6. `testID`s: `user-avatar-button`, `user-avatar-menu`, `user-avatar-menu-backdrop`, `logout-menu-item`.

Styling: `StyleSheet.create` + `coachColors` from `Mobile/src/theme/colors.ts`, matching `AppHeaderTitle.tsx`/`EventCard.tsx` conventions. No new libraries beyond promoting `@expo/vector-icons` to direct (already installed transitively — confirmed present at `Mobile/node_modules/expo/node_modules/@expo/vector-icons`, not yet hoisted to top-level `Mobile/node_modules/@expo/vector-icons`).

## Step 1 — Dependency: promote `@expo/vector-icons` to direct

In `Mobile/package.json`, add to `"dependencies"` (alphabetical position, matching the existing sorted list), using the version currently pulled in by `expo` (`^15.0.3` — verify against `Mobile/node_modules/expo/package.json`'s own `"@expo/vector-icons"` entry before writing it, in case it has drifted):

```json
"@expo/vector-icons": "^15.0.3",
```

Insert it after `"@react-navigation/native-stack": "^7.18.6",` — wait, check alphabetical order: `@expo/vector-icons` sorts before `@react-navigation/*`. Insert it as the first entry under `"dependencies"`, immediately before `"@react-navigation/bottom-tabs"`.

Run `cd Mobile && npm install`. This must NOT introduce new packages beyond hoisting `@expo/vector-icons` to top-level `Mobile/node_modules/@expo/vector-icons` (it already exists nested under `Mobile/node_modules/expo/node_modules/@expo/vector-icons`) — confirm via `git diff Mobile/package-lock.json` (or whichever lockfile exists; check `Mobile/` root for `package-lock.json` vs `yarn.lock` vs none before running install) that the diff is additive/hoisting only, not a version bump elsewhere.

Verify: `cd Mobile && npx tsc --noEmit` still clean (0 errors, same as baseline before this change).

## Step 2 — RED: write `Mobile/src/navigation/__tests__/UserAvatarMenu.test.tsx`

Create this file. It MUST fail because `Mobile/src/navigation/UserAvatarMenu.tsx` does not exist yet.

```tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import UserAvatarMenu from '../UserAvatarMenu';
import { useAuth } from '../../auth/AuthContext';

jest.mock('../../auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockLogout = jest.fn();

describe('UserAvatarMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ logout: mockLogout });
  });

  it('renders the avatar button with the menu closed by default', () => {
    const { getByTestId, queryByTestId } = render(<UserAvatarMenu />);

    expect(getByTestId('user-avatar-button')).toBeTruthy();
    expect(queryByTestId('user-avatar-menu')).toBeNull();
  });

  it('opens the menu when the avatar is pressed', async () => {
    const { getByTestId, queryByTestId } = render(<UserAvatarMenu />);

    fireEvent.press(getByTestId('user-avatar-button'));

    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeTruthy());
    expect(getByTestId('logout-menu-item')).toBeTruthy();
  });

  it('closes the menu when the avatar is pressed again while open', async () => {
    const { getByTestId, queryByTestId } = render(<UserAvatarMenu />);

    fireEvent.press(getByTestId('user-avatar-button'));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeTruthy());

    fireEvent.press(getByTestId('user-avatar-button'));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeNull());
  });

  it('closes the menu when tapping outside (backdrop press)', async () => {
    const { getByTestId, queryByTestId } = render(<UserAvatarMenu />);

    fireEvent.press(getByTestId('user-avatar-button'));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeTruthy());

    fireEvent.press(getByTestId('user-avatar-menu-backdrop'));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeNull());

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('calls logout exactly once and closes the menu when "Cerrar sesión" is pressed', async () => {
    const { getByTestId, queryByTestId } = render(<UserAvatarMenu />);

    fireEvent.press(getByTestId('user-avatar-button'));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeTruthy());

    fireEvent.press(getByTestId('logout-menu-item'));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queryByTestId('user-avatar-menu')).toBeNull());
  });
});
```

Run: `cd Mobile && npx jest src/navigation/__tests__/UserAvatarMenu.test.tsx` — MUST fail (module not found: `../UserAvatarMenu`).

## Step 3 — GREEN: create `Mobile/src/navigation/UserAvatarMenu.tsx`

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coachColors } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';

const MENU_ANIMATION_MS = 150;

const UserAvatarMenu = () => {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animation, {
      toValue: open ? 1 : 0,
      duration: MENU_ANIMATION_MS,
      useNativeDriver: true,
    }).start();
  }, [open, animation]);

  const toggleMenu = () => setOpen((prev) => !prev);
  const closeMenu = () => setOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
  };

  return (
    <View>
      <Pressable testID="user-avatar-button" onPress={toggleMenu} hitSlop={8} style={styles.avatarButton}>
        <Ionicons name="person-circle-outline" size={28} color={coachColors.textPrimary} />
      </Pressable>

      <Modal transparent visible={open} animationType="none" onRequestClose={closeMenu}>
        <Pressable testID="user-avatar-menu-backdrop" style={styles.backdrop} onPress={closeMenu}>
          <Animated.View
            testID="user-avatar-menu"
            style={[
              styles.menu,
              {
                opacity: animation,
                transform: [
                  {
                    scale: animation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable testID="logout-menu-item" onPress={handleLogout} style={styles.menuItem}>
              <Text style={styles.menuItemText}>Cerrar sesión</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  avatarButton: {
    marginRight: 12,
  },
  backdrop: {
    flex: 1,
    alignItems: 'flex-end',
  },
  menu: {
    marginTop: 56,
    marginRight: 12,
    backgroundColor: coachColors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coachColors.border,
    minWidth: 160,
    paddingVertical: 4,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: coachColors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
});

export default UserAvatarMenu;
```

Notes for the implementer:
- `Pressable`'s `onPress` on `user-avatar-menu-backdrop` and on the panel (`Animated.View` with `testID="user-avatar-menu"`) do not conflict: the panel itself is not a `Pressable`, and RNTL/RN's event system does not bubble a press on `logout-menu-item` up to the backdrop's `onPress` in this tree shape (the item is a sibling `Pressable` nested inside the `Animated.View`, itself nested inside the backdrop `Pressable`; a `Pressable` press event is consumed by the innermost `Pressable` it lands on and does not also fire the outer one in `@testing-library/react-native`'s `fireEvent.press`, which dispatches directly to the target's handler). If actual test runs show the backdrop's `onPress` firing when `logout-menu-item` is pressed (i.e. `closeMenu` running twice, which is harmless but indicates propagation), that is acceptable — do not restructure the component to fight it; both paths already close the menu correctly. Do NOT add `stopPropagation` workarounds unless a test actually fails.
- `animationType="none"` is set on `Modal` because the transition is driven manually via `Animated`, not RN's built-in modal slide/fade — this avoids double-animating.

Run: `cd Mobile && npx jest src/navigation/__tests__/UserAvatarMenu.test.tsx` — MUST pass now, all 5 cases green.

If any case is flaky around the animation (e.g. `queryByTestId('user-avatar-menu')` not settling before the `waitFor` timeout), do NOT weaken the assertion — instead confirm the `Modal`'s `visible={open}` prop (not the `Animated.Value`) gates the panel's presence in the tree, since `@testing-library/react-native` renders `Modal` children directly and `visible` is a plain boolean tied to synchronous `open` state, not to the animation completing. The animation affects opacity/scale styling only, not tree presence, so `queryByTestId` transitions should be synchronous with `fireEvent.press` + a microtask flush (`waitFor` is defensive here, not strictly required, but keep it for robustness against React's batching).

## Step 4 — REFACTOR (component)

With tests green, check `UserAvatarMenu.tsx` for:
- No duplicate logout logic — `handleLogout` only calls `closeMenu()` then `logout()` from `useAuth()`, nothing else.
- `MENU_ANIMATION_MS` is the single named constant driving both open and close (already the case above — `Animated.timing` uses it for both directions via the shared `open` boolean toggling `toValue`).
- Keep the file to one default export (`UserAvatarMenu`); do not split into multiple files for this size of component.

No structural changes expected if Step 3 was implemented as written — this step is a checklist, not necessarily a diff.

## Step 5 — Header integration in `Mobile/src/navigation/RootNavigator.tsx`

Add the import:

```tsx
import UserAvatarMenu from './UserAvatarMenu';
```

In the authenticated `Stack.Navigator`'s `screenOptions` (the block currently reading `screenOptions={{ headerShown: true }}`), add `headerRight`:

```tsx
<Stack.Navigator
  screenOptions={{
    headerShown: true,
    headerRight: () => <UserAvatarMenu />,
  }}
>
```

Do not add `headerRight` to the `Login` screen's own `options` (it already sets `headerShown: false`, which hides the entire header including any `headerRight`) and do not touch `AppHeaderTitle.tsx`.

There is no practical unit-testable seam for asserting `screenOptions.headerRight` renders `UserAvatarMenu` without a full `NavigationContainer` render in the current test setup (no existing precedent for testing `RootNavigator.tsx` itself — confirm via `find Mobile/src/navigation/__tests__ -iname "RootNavigator*"` returning nothing). Per tasks.md §5.1, do not force a brittle test for this — rely on `UserAvatarMenu.test.tsx` (Steps 2-3 above) for component coverage and on manual/Expo verification (Step 7 below) for the integration itself. State this explicitly in the final report; do not silently skip it.

## Step 6 — REFACTOR (integration)

Confirm `Login`'s `headerShown: false` override still fully hides the header (and therefore the avatar) — read the current `Stack.Screen name="Login"` block in `RootNavigator.tsx` and verify it is unchanged by Step 5 (it should be, since `headerRight` was added only to the parent `Stack.Navigator`'s `screenOptions`, and per-screen `options` override parent `screenOptions`).

## Step 7 — Verify

Run in order, fix any failure introduced by this change before proceeding (pre-existing unrelated failures/gaps are out of scope — see tasks.md §6.2 note on `@types/jest`):

1. `cd Mobile && npx jest src/navigation/__tests__/UserAvatarMenu.test.tsx` — all 5 new tests green.
2. `cd Mobile && npx jest` — full suite, 100% pass, 0 skipped. Confirm the new total test count vs. the pre-change baseline (42/42 per `mobile-events-cards` tasks.md, though re-check the actual current baseline by running the suite once before this change if unsure — do not assume 42 is still accurate after later archived changes).
3. `cd Mobile && npx tsc --noEmit` — no new type errors versus baseline (the pre-existing `@types/jest` gap in `__tests__` files is known and out of scope — do not attempt to fix it here).
4. `git diff --stat` — confirm only `Mobile/package.json`, `Mobile/package-lock.json` (or equivalent lockfile), `Mobile/src/navigation/UserAvatarMenu.tsx`, `Mobile/src/navigation/__tests__/UserAvatarMenu.test.tsx`, and `Mobile/src/navigation/RootNavigator.tsx` changed under `Mobile/`, plus `openspec/changes/add-mobile-user-avatar-menu/tasks.md` and this `implement.md` (checkbox updates) under `openspec/`. Nothing under `Back/ExtractionApi/` or `Front/`.
5. Manual smoke check (only if a dev build/Expo Go session is actually available in this environment — do not fabricate this step if it cannot be run): log in, confirm the avatar appears top-right on `TeamSwitcher`/`Calendar`/`EventDetail`, tap opens the menu with a visible animation, tap outside closes it, tapping "Cerrar sesión" logs out and returns to `Login`. If unavailable, say so explicitly in the final report and leave the corresponding tasks.md checkbox (§6.3) unchecked.

## Step 8 — tasks.md

Mark all checkboxes in `openspec/changes/add-mobile-user-avatar-menu/tasks.md` as done (`[x]`) for items actually completed and verified. Leave §6.3 (manual smoke check) unchecked if it could not be run, and say so in the final report — do not check off something not actually performed.

## Final report requirements

List every file created/modified (absolute paths), full test results (pass count, before/after totals), and explicitly call out:
- Whether `@expo/vector-icons` was successfully hoisted to `Mobile/node_modules/@expo/vector-icons` after `npm install`, and whether the lockfile diff was additive-only as expected.
- Whether the RootNavigator `headerRight` integration test seam was skipped as anticipated in Step 5, per tasks.md §5.1's explicit allowance.
- Whether the manual Expo/simulator visual check (Step 7.5) was performed or skipped, and why.
- Any deviation from this script, however small, with justification.
