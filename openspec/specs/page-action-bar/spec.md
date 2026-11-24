# page-action-bar Specification

## Purpose
TBD - created by archiving change sticky-action-bar. Update Purpose after archive.
## Requirements
### Requirement: Page action bar stays pinned below the app header

The `ActionBar` rendered by `ContentLayout` SHALL stay pinned at the top of the existing `BaseLayout` scroll area (`position: sticky; top: 0`), directly below the app header, while the page content scrolls underneath it. Its stacking order SHALL stay below the app header (z-index 5, below the header's 1600), and `BaseLayout` SHALL NOT change for this behavior.

#### Scenario: Content scrolls underneath the pinned bar

- **WHEN** a user scrolls down a screen that renders `ContentLayout` with an `actionBar`
- **THEN** the action bar stays visible directly below the app header and the content scrolls underneath it

#### Scenario: Wrapped bar on a narrow screen stays pinned

- **WHEN** the action bar wraps onto several lines on a narrow screen (about 360px)
- **THEN** the whole bar stays pinned and complete, and all content remains reachable by scrolling underneath it

### Requirement: Pinned action bar has an opaque theme background

The pinned action bar SHALL use an opaque background taken from the `--rffm-card-bg` CSS custom property instead of a translucent blurred background, so content passing underneath is never visible through its buttons.

#### Scenario: Content passes underneath the bar

- **WHEN** page content scrolls underneath the pinned action bar
- **THEN** the content is hidden behind the bar's opaque `--rffm-card-bg` background

### Requirement: No action bar without actions

`ContentLayout` SHALL render no action bar, and reserve no space for one, when it receives no `actionBar`.

#### Scenario: ContentLayout without actionBar

- **WHEN** `ContentLayout` is rendered without an `actionBar` prop
- **THEN** no action bar element is rendered

#### Scenario: ContentLayout with actionBar

- **WHEN** `ContentLayout` is rendered with an `actionBar` prop
- **THEN** the action bar element is rendered

### Requirement: Portal content inside the action bar keeps working

Content that a page mounts into the action bar through a React portal SHALL stay mounted and visible inside the pinned bar.

#### Scenario: Button portaled into the bar

- **WHEN** a page renders a slot inside its `actionBar` and portals a button into that slot
- **THEN** the button is rendered inside the action bar slot

### Requirement: Action bar publishes its real height

The `ActionBar` SHALL measure its rendered height and publish it as the `--rffm-action-bar-h` CSS custom property on its nearest vertically scrolling ancestor, SHALL update the value whenever the bar is resized (via `ResizeObserver`), and SHALL remove the property and stop observing when it unmounts.

#### Scenario: Height published on mount

- **WHEN** the action bar mounts inside a scroll area with a rendered height of 52px
- **THEN** the scroll area carries `--rffm-action-bar-h: 52px`

#### Scenario: Height updated on resize

- **WHEN** the action bar's height changes to 96px and the resize observer fires
- **THEN** the scroll area's `--rffm-action-bar-h` becomes `96px`

#### Scenario: Height removed on unmount

- **WHEN** the action bar unmounts
- **THEN** `--rffm-action-bar-h` is removed from the scroll area and the resize observer is disconnected

### Requirement: Own page-top bars share the pinned behavior

The top bars of `NewSessionPage`, `NewExercisePage` and `ContentBoardPage` SHALL pin below the app header with the same rule as the page action bar, reusing the shared `sticky` class from `ActionBar.module.css` through CSS Modules `composes` rather than copying it. The `ContentBoardPage` top bar SHALL use the `--rffm-coach-bg` CSS custom property as its background so content does not show through it.

#### Scenario: Session, exercise and content-board top bars stay pinned

- **WHEN** a user scrolls `NewSessionPage`, `NewExercisePage` or `ContentBoardPage`
- **THEN** that page's top bar stays pinned directly below the app header while the content scrolls underneath

### Requirement: Pinned panels stay visible below the action bar

The pinned panels of `GameModelReadingView` and `Classification` SHALL offset their sticky `top` by the published `--rffm-action-bar-h` height (`calc(16px + var(--rffm-action-bar-h, 0px))`), and the `GameModelReadingView` panel SHALL reduce its maximum height by the same amount, so neither panel is covered by the pinned action bar.

#### Scenario: Panel pinned below the action bar

- **WHEN** a user scrolls `GameModelReadingView` or `Classification` while the action bar is pinned
- **THEN** the pinned panel stays fully visible below the action bar instead of underneath it

#### Scenario: No action bar height published

- **WHEN** no action bar has published `--rffm-action-bar-h`
- **THEN** the pinned panel keeps its previous 16px top offset

