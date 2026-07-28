## ADDED Requirements

### Requirement: Header avatar for authenticated users
The Mobile app SHALL render a generic person-silhouette avatar in the top-right corner of the header (`headerRight`) on every screen shown while the user is authenticated.

#### Scenario: Avatar visible when authenticated
- **WHEN** a user is authenticated and viewing any screen in the authenticated stack (e.g. `TeamSwitcher`, `Calendar`, `EventDetail`)
- **THEN** the header shows a person-silhouette icon in the top-right corner

#### Scenario: Avatar not shown on Login
- **WHEN** a user is on the `Login` screen (unauthenticated)
- **THEN** no header, and therefore no avatar, is rendered

### Requirement: Animated menu opens on avatar tap
Tapping the avatar SHALL open a dropdown menu with an opening animation, and tapping it again while open SHALL close the menu.

#### Scenario: Open on tap
- **WHEN** the user taps the avatar while the menu is closed
- **THEN** the menu becomes visible with an opening animation and shows the "Cerrar sesión" option

#### Scenario: Toggle closed on repeated tap
- **WHEN** the user taps the avatar again while the menu is open
- **THEN** the menu closes with a closing animation

### Requirement: Tap outside closes the menu
Tapping anywhere outside the open menu SHALL close it without triggering any menu action.

#### Scenario: Outside tap closes menu
- **WHEN** the menu is open and the user taps outside the menu panel
- **THEN** the menu closes and no menu item's action is invoked

### Requirement: Logout menu item invokes existing logout
The menu SHALL contain exactly one item, "Cerrar sesión", which invokes the existing `AuthContext.logout()` flow.

#### Scenario: Logout invoked
- **WHEN** the menu is open and the user taps "Cerrar sesión"
- **THEN** `logout()` from `AuthContext` is called exactly once and the menu closes

#### Scenario: No new logout logic
- **WHEN** "Cerrar sesión" is pressed
- **THEN** no new authentication/token logic is introduced — the same `SecureStore.deleteToken()` + context state reset already implemented in `AuthContext.tsx` is reused unchanged
