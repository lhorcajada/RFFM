## Context

`Mobile/src/navigation/RootNavigator.tsx` defines a single `Stack.Navigator` with `screenOptions={{ headerShown: true }}` wrapping every authenticated screen (`TeamSwitcher`, the `Calendar` group with `EventDetail`); only `Login` opts out via its own `headerShown: false`. The `Calendar` screen additionally sets `headerTitle: () => <AppHeaderTitle teamId={...} />` to render the brand + club/team shield (added in commit `77cb481`). There is currently **no `headerRight`** configured anywhere, and no UI entry point calls `AuthContext.logout()` — it exists and is fully tested (`Mobile/src/auth/__tests__/AuthContext.test.tsx`) but is unreachable from the app.

Mobile has no icon library or animation precedent yet:
- `@expo/vector-icons@^15.0.3` is present in `Mobile/node_modules` only as a **transitive** dependency of the `expo` package (checked `Mobile/node_modules/expo/package.json`), not a direct one in `Mobile/package.json`, and nothing under `Mobile/src` imports from it today.
- No file under `Mobile/src` imports `Animated` from `react-native` (checked via grep). `EventCard.tsx` uses plain emoji (`⚽`, `🏆`, `📅`) as visual markers, not vector icons, so there's no existing icon convention to diverge from — this change establishes the first one.
- No file uses RN's `Modal` component either.

Testing stack (confirmed via `Mobile/package.json` and existing tests like `Mobile/src/navigation/__tests__/AppHeaderTitle.test.tsx`, `Mobile/src/auth/__tests__/AuthContext.test.tsx`): Jest 29 + `jest-expo` preset + `@testing-library/react-native@^14.0.1`. Tests live co-located under `__tests__/` next to the component, `describe`/`it`, `render`/`fireEvent`/`waitFor` from `@testing-library/react-native`, `jest.mock(...)` for API/context dependencies.

## Goals / Non-Goals

**Goals:**
- Add a person-silhouette avatar to the top-right of the header on every authenticated screen (via `Stack.Navigator`'s shared `screenOptions.headerRight`), not just the `Calendar` screen, so logout is reachable from anywhere in the app.
- Tapping the avatar opens a small dropdown menu anchored below/near it, with an opening animation; tapping the avatar again or anywhere outside the menu closes it with a matching closing animation.
- The menu offers exactly one item today: "Cerrar sesión", wired to the real `logout()` from `useAuth()` (`Mobile/src/auth/AuthContext.tsx`) — no new logout logic, no new API calls.
- Use only what's already installed: `@expo/vector-icons` (promote to a direct `Mobile/package.json` dependency — see Decision 4) for the icon, RN core `Animated` for the transition, RN core `Modal` (or an equivalent overlay) for outside-tap detection.
- TypeScript strict, `StyleSheet.create` styling, `coachColors` theme tokens — same conventions as `AppHeaderTitle.tsx` and `EventCard.tsx`.
- Full TDD coverage per tasks.md: render, open-on-tap, close-on-outside-tap, logout-on-menu-item-tap.

**Non-Goals:**
- No user photo, initials, or profile data — the icon is a static generic silhouette regardless of who is logged in.
- No additional menu items beyond "Cerrar sesión" (no "Perfil", "Ajustes", etc.) — explicitly out of scope per the request; the component should be structured so adding items later is a small diff, but nothing extra ships now.
- No confirmation dialog before logout — mirrors the current behavior where `logout()` is a direct, undoable-by-relogin action; Coach web's own logout (if any) is not being audited or matched here since this change is Mobile-only.
- No changes to `Mobile/src/auth/AuthContext.tsx` — `logout()` is consumed as-is.
- No visual redesign of `AppHeaderTitle.tsx` itself beyond making room for `headerRight` (React Navigation lays out `headerTitle` and `headerRight` independently, so no change to `AppHeaderTitle.tsx` is expected — see Decision 1).

## Decisions

1. **Wire the avatar via `Stack.Navigator`'s top-level `screenOptions.headerRight` in `RootNavigator.tsx`**, not per-screen and not inside `AppHeaderTitle.tsx`. `headerRight` and `headerTitle` are independent React Navigation header slots — adding `headerRight: () => <UserAvatarMenu />` next to the existing `headerShown: true` in the authenticated `Stack.Navigator`'s `screenOptions` makes the avatar appear on `TeamSwitcher`, `Calendar`, and `EventDetail` alike, with zero changes to `AppHeaderTitle.tsx`. `Login` already overrides `headerShown: false`, so the avatar never renders on the unauthenticated screen without needing a conditional.
   - *Alternative considered*: render `UserAvatarMenu` from inside `AppHeaderTitle.tsx` and pass it through `headerTitle`. Rejected — `headerTitle` is meant for the centered/left title area; cramming a right-aligned interactive element into it fights React Navigation's layout instead of using the slot designed for it, and it would only appear on `Calendar` (which sets `headerTitle`), not on `TeamSwitcher`/`EventDetail` where logout should also be reachable.

2. **New component `Mobile/src/navigation/UserAvatarMenu.tsx`** (+ co-located `Mobile/src/navigation/__tests__/UserAvatarMenu.test.tsx`), self-contained: reads `logout` from `useAuth()` internally, owns its own open/closed state and animation — no props required. Mirrors the "one header concern, one file" shape already established by `AppHeaderTitle.tsx` sitting next to `RootNavigator.tsx`.

3. **Open/close animation via RN core `Animated`** (`Animated.Value` + `Animated.timing`, `useRef` to persist the value across renders, `useNativeDriver: true` for opacity/scale since no layout properties are animated). No new dependency — `Animated` ships with `react-native` itself, already installed. Concretely: the menu panel animates `opacity` 0→1 and `scale` 0.95→1 on open (~150ms), reversed on close, matching the lightweight feel of a native dropdown without a heavier animation library.
   - *Alternative considered*: `react-native-reanimated`. Rejected — not installed, and `Animated` is sufficient for a two-state opacity/scale transition; adding a new native module for this is out of proportion, same reasoning `mobile-events-cards` used to reject `expo-linear-gradient`.

4. **Outside-tap-to-close via RN core `Modal` (`transparent visible={open}`) wrapping a full-screen `Pressable` backdrop + the menu panel.** `Modal` renders above the navigation header reliably regardless of the avatar's on-screen position (no manual absolute-position math relative to header height/safe-area), and a full-screen transparent `Pressable` behind the menu panel gives "tap outside closes" for free: any tap not on the menu panel bubbles to the backdrop's `onPress`, which closes it; taps on the panel itself are caught by the panel's own (non-propagating) `Pressable`/`View` boundary. `@testing-library/react-native` renders `Modal` children directly (no native portal in the Jest/`jest-expo` environment), so this is fully testable with `render`/`fireEvent` like any other component.
   - *Alternative considered*: a manually absolute-positioned `View` sibling to the avatar, no `Modal`. Rejected — would need to compute the avatar's screen coordinates (`onLayout`/`measure`) to position a full-screen backdrop correctly under React Navigation's header, adding complexity `Modal` provides for free.

5. **Icon: `@expo/vector-icons`'s `Ionicons`, glyph `"person-circle-outline"`** (a generic person-in-circle silhouette, matches "genérico, no foto, no iniciales" from the request). Since it's currently only a *transitive* dependency (pulled in by `expo`, not declared by the app), it is added as an explicit dependency in `Mobile/package.json` — pinning what the app directly imports is correct dependency hygiene and avoids relying on `expo`'s internal dependency tree, which could change across Expo SDK upgrades (see `Mobile/AGENTS.md`: "Expo HAS CHANGED", versions move fast).
   - *Alternative considered*: an emoji glyph (`👤`) in a `Text`, consistent with `EventCard.tsx`'s emoji markers. Rejected for this specific case — emoji rendering/appearance varies more across Android/iOS/OS versions for a persistent, always-visible chrome element like a header avatar than it does for content-area decoration in an event card; a vector icon renders identically everywhere and is the more standard pattern for this exact UI role (person/profile/account icon) across native apps.

6. **`testID`s**: `user-avatar-button` (the tappable avatar in the header), `user-avatar-menu` (the dropdown panel, only present in the tree while open — RNTL `queryByTestId` returns `null` when closed), `user-avatar-menu-backdrop` (the full-screen `Pressable`), `logout-menu-item` (the "Cerrar sesión" row). Follows the existing `kebab-case` `testID` convention seen in `AppHeaderTitle.tsx` (`app-header-logo`, `club-shield`, `team-shield`) and `CalendarScreen.tsx` (`loading-indicator`, `error-message`, `retry-button`, `empty-message`).

## Risks / Trade-offs

- **[Risk] `Modal` + `Animated` interplay in tests**: `Animated.timing` callbacks can leave pending timers if a test unmounts mid-animation. Mitigated by using `jest.useFakeTimers()`/`waitFor` around animation-dependent assertions where needed, and by keeping the animation duration a named constant so tests can reason about it without magic numbers.
- **[Risk] `headerRight` applying globally via `Stack.Navigator.screenOptions`** means any future screen added to the authenticated stack automatically gets the avatar without an explicit per-screen decision. Treated as a feature, not a bug, for this change (logout should be reachable everywhere) — but flagged here so a future screen that legitimately needs a custom `headerRight` (e.g. a save button) knows to override `screenOptions.headerRight` locally rather than being surprised by inheritance.
- **[Trade-off] Promoting `@expo/vector-icons` from transitive to direct dependency** touches `Mobile/package.json`/lockfile even though no new files are downloaded (already in `node_modules` via `expo`). Considered worth it for dependency-hygiene reasons in Decision 5; flagged as a reviewable diff, not a silent side effect.

## Open Questions

(none — resolved above)
