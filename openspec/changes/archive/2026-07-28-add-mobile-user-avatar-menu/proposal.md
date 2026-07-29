## Why

Mobile's header (`Mobile/src/navigation/AppHeaderTitle.tsx`, rendered via `headerTitle` in `Mobile/src/navigation/RootNavigator.tsx`) shows the FutbolBase brand and the current club/team shield, but there is no way for a Coach/Familia user to log out from inside the app once authenticated — the only exit today is clearing the token via `AuthContext.logout()`, which nothing in the UI currently calls. Users need a discoverable, standard place to end their session.

## What Changes

- Add a generic person-silhouette avatar icon to the top-right corner of the Mobile header (React Navigation's `headerRight`), visible whenever the user is authenticated (i.e. on the same screens where `AppHeaderTitle` already renders).
- Tapping the avatar opens an animated dropdown/submenu anchored under it, closing with a matching animation.
- The submenu contains a single option for now: "Cerrar sesión", which calls the existing `logout()` from `Mobile/src/auth/AuthContext.tsx`.
- Tapping anywhere outside the open submenu closes it without side effects.
- No new icon or animation dependency is introduced: `@expo/vector-icons` (already a transitive dependency of the installed `expo` package, currently unused directly in `Mobile/src`) supplies the silhouette glyph, and React Native's built-in `Animated` API (not used anywhere in `Mobile/src` yet — this is the first consumer) drives the open/close transition.

## Capabilities

### New Capabilities
- `mobile-user-avatar-menu`: authenticated Mobile users see a header avatar that opens an animated menu offering "Cerrar sesión", which invokes the existing `AuthContext.logout()` flow.

### Modified Capabilities
(none — no existing spec covers the Mobile header; this only adds to it)

## Impact

- **Mobile only**: `Mobile/src/navigation/AppHeaderTitle.tsx` and/or `Mobile/src/navigation/RootNavigator.tsx` (`headerRight` wiring), new `Mobile/src/navigation/UserAvatarMenu.tsx` component + co-located test, `Mobile/package.json` (no dependency changes expected — see design.md).
- **Backend**: none — logout is purely client-side (`SecureStore.deleteToken()` + context state reset), no new/changed endpoints.
- **Front (web SPA)**: none — this change is scoped exclusively to `Mobile/`.
