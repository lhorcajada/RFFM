## ADDED Requirements

### Requirement: Shared screen header layout
Every Mobile screen mounted under a `headerShown: false` navigator (the root `Tab.Navigator` and its nested `TeamStack`/`CompetitionStack`) SHALL render its title, its back button, and its action buttons via the shared `ScreenHeader` component (`Mobile/src/shared/components/ScreenHeader.tsx`), in a single row: back button, then title, then action buttons, in that order.

#### Scenario: Screen renders title and back button in the same row
- **WHEN** a screen renders `<ScreenHeader title="Amistosos" />`
- **THEN** the header shows a back button (`testID="screen-header-back-button"`) and the title
  text "Amistosos" (`testID="screen-header-title"`) in the same row, with no action buttons
  rendered

#### Scenario: Screen renders action buttons alongside title and back button
- **WHEN** a screen renders `<ScreenHeader title="Eventos" actions={[{ key: 'filter', icon: 'options-outline', label: 'Filtrar', onPress, testID: 'open-filters-button' }]} />`
- **THEN** the header shows the back button, the title "Eventos", and one action button with the
  `options-outline` icon and the text "Filtrar", in the same row

### Requirement: Back button is always present and defaults to goBack
The back button SHALL be rendered on every screen using `ScreenHeader` — no screen may hide it — and SHALL call `navigation.goBack()` (resolved via `useNavigation()`) by default; a screen MAY override the press behavior via an `onBack` prop, but the button itself remains visible either way.

#### Scenario: Default back button calls navigation.goBack()
- **WHEN** a screen renders `<ScreenHeader title="Liga" />` with no `onBack` prop, and the user
  presses the back button
- **THEN** `navigation.goBack()` is called

#### Scenario: Screen overrides back button behavior
- **WHEN** a screen renders `<ScreenHeader title="Liga" onBack={customHandler} />`, and the user
  presses the back button
- **THEN** `customHandler` is called instead of `navigation.goBack()`

### Requirement: Action buttons are icon + text
Each action button in the `actions` array SHALL render both an `Ionicons` icon (using the `-outline` suffix convention) and a text label — never icon-only or text-only — and SHALL call its own `onPress` handler when tapped.

#### Scenario: Tapping an action button calls its handler
- **WHEN** a screen renders `<ScreenHeader title="Eventos" actions={[{ key: 'filter', icon: 'options-outline', label: 'Filtrar', onPress: handleOpenFilters }]} />`, and the user taps the
  "Filtrar" action button
- **THEN** `handleOpenFilters` is called
