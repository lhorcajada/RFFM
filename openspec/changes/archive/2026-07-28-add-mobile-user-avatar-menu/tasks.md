All implementation follows strict TDD (Red → Green → Refactor) per `CLAUDE.md` — write the failing test first, implement the minimal code to pass, then refactor while keeping the suite green. Test framework: **Jest 29 + `jest-expo` + `@testing-library/react-native@^14.0.1`** (confirmed via `Mobile/package.json` and existing tests such as `Mobile/src/navigation/__tests__/AppHeaderTitle.test.tsx` and `Mobile/src/auth/__tests__/AuthContext.test.tsx`). Run with `cd Mobile && npx jest`.

## 1. Dependency

- [x] 1.1 Add `@expo/vector-icons` as an explicit dependency in `Mobile/package.json` (currently only transitive via `expo`, per design.md Decision 5). Reinstall (`npm install` in `Mobile/`) and confirm the lockfile updates without pulling new packages (already present under `Mobile/node_modules/expo/node_modules` or hoisted).
- Verify: `cd Mobile && npx tsc --noEmit` still clean; `import { Ionicons } from '@expo/vector-icons'` resolves.

## 2. `UserAvatarMenu` component — render + open/close state

- [x] 2.1 (RED) Write `Mobile/src/navigation/__tests__/UserAvatarMenu.test.tsx`:
  - `jest.mock('../../auth/AuthContext', () => ({ useAuth: jest.fn() }))`, mock `logout: jest.fn()`.
  - "renders the avatar button with the generic silhouette icon" — `getByTestId('user-avatar-button')` present; menu (`queryByTestId('user-avatar-menu')`) absent/closed by default.
  - "opens the menu when the avatar is pressed" — `fireEvent.press(getByTestId('user-avatar-button'))`, then `getByTestId('user-avatar-menu')` and `getByTestId('logout-menu-item')` become present (use `waitFor` if animation timing requires it).
  - "closes the menu when tapping outside" — open it, then `fireEvent.press(getByTestId('user-avatar-menu-backdrop'))`, assert `queryByTestId('user-avatar-menu')` becomes `null`.
  - "closes the menu when the avatar is pressed again while open" (toggle behavior) — optional but recommended for a natural UX; assert same as above.
- [x] 2.2 (GREEN) Implement `Mobile/src/navigation/UserAvatarMenu.tsx`: local `open` state, `Ionicons name="person-circle-outline"` button with `testID="user-avatar-button"`, RN `Modal transparent visible={open}` containing a full-screen `Pressable testID="user-avatar-menu-backdrop"` (closes on press) and the menu panel `testID="user-avatar-menu"`. `StyleSheet.create` styling using `coachColors` (per `Mobile/src/theme/colors.ts`), matching the visual conventions in `AppHeaderTitle.tsx`/`EventCard.tsx`.
- [x] 2.3 (REFACTOR) Extract the open/close boolean + toggle handler into a small internal hook or plain functions if the component grows noisy; keep `UserAvatarMenu.tsx` focused on one export.

## 3. Open/close animation

- [x] 3.1 (RED) Extend `UserAvatarMenu.test.tsx`: assert the menu panel's animated style reaches its "open" end-state (e.g. resolved `opacity`/`transform` via the rendered style prop, or simply that the panel is present/interactive) after opening, without asserting brittle intermediate frame values. If using fake timers, add a case advancing timers (`jest.useFakeTimers()` + `act(() => jest.advanceTimersByTime(...))`) to confirm the animation completes rather than leaving the panel stuck mid-transition.
- [x] 3.2 (GREEN) Wire `Animated.Value` (`useRef(new Animated.Value(0))`) + `Animated.timing` (`useNativeDriver: true`) driving opacity/scale on the menu panel, triggered by the `open` state via a `useEffect`, per design.md Decision 3.
- [x] 3.3 (REFACTOR) Name the animation duration as a constant (e.g. `MENU_ANIMATION_MS`); ensure closing reverses the same animation rather than duplicating timing logic.

## 4. Logout wiring

- [x] 4.1 (RED) Extend `UserAvatarMenu.test.tsx`: "calls logout and closes the menu when 'Cerrar sesión' is pressed" — open the menu, `fireEvent.press(getByTestId('logout-menu-item'))`, assert the mocked `logout` from `useAuth()` was called exactly once, and that the menu closes afterward (`queryByTestId('user-avatar-menu')` → `null`).
- [x] 4.2 (GREEN) Implement the "Cerrar sesión" row calling `useAuth().logout()` (the real function from `Mobile/src/auth/AuthContext.tsx` — not reimplemented) and closing the menu.
- [x] 4.3 (REFACTOR) Confirm no duplicate logout logic exists outside `AuthContext.tsx`; `UserAvatarMenu.tsx` only calls the hook.

## 5. Header integration

- [x] 5.1 (RED) Update/add a test for `Mobile/src/navigation/RootNavigator.tsx` header wiring if a reasonable seam exists for testing `screenOptions.headerRight` without a full navigation render (e.g. asserting the options object passed to `Stack.Navigator` includes a `headerRight` that renders `UserAvatarMenu`). If React Navigation's `screenOptions` isn't practically unit-testable in isolation given the current test setup, document that explicitly here instead of forcing a brittle test, and rely on `UserAvatarMenu.test.tsx` (section 2-4) plus manual verification (task 6.2) for coverage — do not skip silently.
- [x] 5.2 (GREEN) In `Mobile/src/navigation/RootNavigator.tsx`, add `headerRight: () => <UserAvatarMenu />` to the authenticated `Stack.Navigator`'s `screenOptions` (alongside the existing `headerShown: true`), per design.md Decision 1. No changes to `AppHeaderTitle.tsx`.
- [x] 5.3 (REFACTOR) Double-check `Login`'s `headerShown: false` override still fully hides the header (and therefore the avatar) on the unauthenticated screen.

## 6. Verification

- [x] 6.1 Run `cd Mobile && npx jest` — 100% pass, no skipped tests, across the whole Mobile suite (baseline was 42/42 before this change per `mobile-events-cards` tasks.md; confirm new total).
- [x] 6.2 `cd Mobile && npx tsc --noEmit` — no new errors (pre-existing `@types/jest` gap in `__tests__` files is a known, unrelated repo gap — do not attempt to fix it in this change).
- [ ] 6.3 Manual smoke check (if a dev build/Expo Go session is available): log in, confirm the avatar appears top-right, tap opens the menu with a visible animation, tap outside closes it, tapping "Cerrar sesión" logs out and returns to `Login`.
- [x] 6.4 Confirm via `git status`/diff — only `Mobile/` and `openspec/` changed; no `Back/ExtractionApi` or `Front/` files touched.
