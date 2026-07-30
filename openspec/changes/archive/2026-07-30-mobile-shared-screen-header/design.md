## Context

`Mobile/src/navigation/RootNavigator.tsx` has two distinct header mechanisms today:

1. **Native `Stack.Navigator` header** (`headerShown: true`, `headerRight: () => <UserAvatarMenu />`)
   at the outer `Stack.Navigator` level, used by `TeamSwitcher`, `Calendar` (with
   `headerTitle={() => <AppHeaderTitle .../>}`), and `EventDetail`. These routes already get a
   native back button for free whenever there is a previous route on that stack (React
   Navigation's native-stack shows it automatically), plus the app-level chrome
   (logo/club/team + `UserAvatarMenu`).
2. **In-content `ScreenSectionHeader`**, used by the 9 screens that live inside navigators with
   `headerShown: false` (the root `Tab.Navigator` — `CalendarTabs` — and its two nested
   `TeamStack`/`CompetitionStack`). These screens have no native header at all, so
   `ScreenSectionHeader` is a hand-rolled title row, with zero back-navigation support today (see
   `Mobile/src/shared/components/ScreenSectionHeader.tsx`).

`NewsScreen` sits inside the same `headerShown: false` `Tab.Navigator` as the 9
`ScreenSectionHeader` consumers but currently renders no header of any kind — an inconsistency
this change also fixes.

`Mobile/AGENTS.md` requires checking exact versioned Expo docs before using an Expo SDK API.
`Mobile/package.json` pins `expo: ^54.0.0` (not v57 — always re-check the installed version
before assuming a doc URL). This change touches no Expo SDK API: `Ionicons` is already used
throughout the app with the same import, and `navigation.goBack()` / `useNavigation()` are
React Navigation library concerns, not Expo-SDK-versioned ones (same reasoning already recorded
in `openspec/changes/archive/2026-07-30-mobile-regroup-tab-navigation/design.md`). No Expo docs
lookup is required.

## Goals / Non-Goals

**Goals:**
- One shared component, `ScreenHeader`, rendering title + back button + action-button row in a
  single row, used by every screen currently under a `headerShown: false` navigator.
- Back button always rendered on every migrated screen (no screen hides it), defaulting to
  `navigation.goBack()`, overridable per screen for the rare custom-confirm case.
- Action buttons are icon (`Ionicons`, `-outline`) + text, declared per screen as a typed array.
- Replace `ScreenSectionHeader` entirely — delete it once every consumer migrates.
- `NewsScreen` gains a header, closing the one inconsistency found in `Mobile/src/screens/`.

**Non-Goals:**
- No change to the outer `Stack.Navigator`'s native header (`TeamSwitcher`, `Calendar`,
  `EventDetail`, `Login`) — see Decision 3 for why these 3 screens are excluded.
- No change to any route `name`, to `initialParams` propagation, or to the tab bar structure
  from `openspec/changes/archive/2026-07-30-mobile-regroup-tab-navigation`.
- No visual redesign beyond adding the back button and restyling the action row; existing titles,
  copy, and icons for existing actions (`CalendarScreen`'s "Filtrar") are preserved.
- No generic "action bar overflow menu" for >2-3 actions — today's max is 1 action
  (`CalendarScreen`); over-engineering for a hypothetical future case is not justified now.

## Decisions

### 1. New component: `Mobile/src/shared/components/ScreenHeader.tsx`

Replaces `ScreenSectionHeader` in the same location (shared, not screen-local, since it is used
by 10 screens — consistent with `.claude/rules/react-native.md` §2: "componentes realmente
transversales... van en `shared/components/`").

```ts
interface ScreenHeaderAction {
  key: string;
  icon: string; // Ionicons name, '-outline' suffix
  label: string;
  onPress: () => void;
  testID?: string;
}

interface ScreenHeaderProps {
  title: string;
  actions?: ScreenHeaderAction[];
  onBack?: () => void; // override; defaults to navigation.goBack()
}
```

- Single row (`flexDirection: 'row'`, `alignItems: 'center'`): back button (fixed width,
  `Ionicons name="chevron-back-outline"`, `testID="screen-header-back-button"`) → title
  (`flex: 1`, `numberOfLines={1}`, `testID="screen-header-title"`, same uppercase/letter-spaced
  style as today's `screen-section-title`) → action row (only rendered when `actions.length > 0`,
  each action a `Pressable` with icon + text, `testID={action.testID ?? `screen-header-action-${action.key}`}`).
  The accent gradient bar from `ScreenSectionHeader` (`accent`/`accentPrimary`/`accentSecondary`)
  is kept below the row, unchanged, since it is the app's established "FC26-style" section-title
  motif (per `Mobile/src/shared/components/ScreenSectionHeader.tsx`'s own doc comment) and no
  reason to drop it was given.
- Back button always renders — no `hideBackButton`/`showBackButton` prop. Decision 2 explains why
  every migrated screen genuinely has a working back target, so a hide escape hatch is
  unnecessary complexity for this batch of 10 screens. If a future screen needs to hide it, that
  is a follow-up change, not a speculative prop today.
- `onBack` override only replaces *what happens on press* (e.g. show a confirm dialog before
  calling `goBack()` itself) — it does not hide the button. No current screen needs this override;
  it exists because the user explicitly asked for a per-screen escape hatch.
- Uses `useNavigation()` internally (same pattern already used in `CalendarScreen.tsx`,
  `TeamMenuScreen.tsx`) to resolve the default back handler — no navigation prop drilling needed
  from parent screens.
- Colors from `coachColors` only (`primary`, `secondary`, `textPrimary`, `border`) — no new hex
  values.

**Alternative considered — keep `children: ReactNode` like `ScreenSectionHeader`** (let each
screen render its own `Pressable`s freely): rejected because it is exactly the inconsistency this
change fixes (ad-hoc markup per screen, e.g. `CalendarScreen`'s bespoke `filterButton` style) and
gives no way to guarantee "icon + text, `-outline` Ionicons" consistency across screens.

### 2. Back button target per screen category — CORRECTED after manual QA (see below)

> **Post-implementation correction (manual QA, 2026-07-30):** the bubbling analysis originally
> written here was wrong. It assumed `Tab.Navigator` has no back history of its own and that an
> unhandled `GO_BACK` from a tab-root screen bubbles up to the outer `Stack.Navigator`, landing on
> `TeamSwitcherScreen`. In reality, React Navigation's `Tab.Navigator` defaults to
> `backBehavior: 'history'`: it tracks the order in which tabs were visited, and `GO_BACK` pops
> that tab-visit history *before* ever bubbling to a parent navigator. The user reproduced this in
> the running app: from `CalendarTab` ("Eventos"), pressing "volver" did not reach
> `TeamSwitcherScreen` — it switched to whichever tab was visited previously (typically `NewsTab`,
the `Tab.Navigator`'s initial route). None of the 4 tab-root screens has a real "previous
> screen" to return to; a visible back button on them is misleading. The table and reasoning below
> are kept for historical context but are **superseded** by Decision 2-bis.

| Screen | Mounted as | `goBack()` target (as originally assumed — since disproven) |
|---|---|---|
| `PlayersTab`/`InjuriesTab`/`SanctionsTab` (leaf of `TeamStack`) | pushed screen | pops to `TeamMenu` (`TeamMenuScreen`) — native stack pop, standard (this part is still correct) |
| `LeagueTab`/`FriendliesTab`/`TournamentsTab` (leaf of `CompetitionStack`) | pushed screen | pops to `CompetitionMenu` (`CompetitionMenuScreen`) — native stack pop, standard (this part is still correct) |
| `TeamMenuScreen` (initial route of `TeamStack`, mounted as `TeamTab`) | `Tab.Screen` w/ nested stack, no back history in that stack | *(assumed)* bubbles to `Tab.Navigator`, then to outer `Stack.Navigator`, landing on `TeamSwitcher` — **wrong**, see correction above |
| `CompetitionMenuScreen` (initial route of `CompetitionStack`, mounted as `CompetitionTab`) | same as above | *(assumed, wrong)* same as above |
| `NewsScreen` (`NewsTab`) | `Tab.Screen`, no nested stack | *(assumed, wrong)* bubbles to outer `Stack.Navigator`, landing on `TeamSwitcher` |
| `CalendarScreen` (`CalendarTab`) | `Tab.Screen`, no nested stack | *(assumed, wrong)* same |

### 2-bis. Actual behavior and resulting decision: hide the back button on the 4 tab-root screens

`CalendarTabs`'s `Tab.Navigator` (`Mobile/src/navigation/RootNavigator.tsx`) does not set
`backBehavior` explicitly, so it uses React Navigation's default, `'history'`: `GO_BACK` inside
the tab navigator switches to the last-visited tab instead of bubbling to the parent
`Stack.Navigator`. This means none of `NewsScreen`, `CalendarScreen`, `TeamMenuScreen`,
`CompetitionMenuScreen` — the 4 screens mounted directly as `Tab.Screen`s with no push history of
their own — has a real "back" destination; what looked like a back button would actually jump
between tabs, which is not what a back affordance should do and would confuse the coach navigating
the app.

Decision: add `showBack?: boolean` (default `true`) to `ScreenHeaderProps`, and pass
`showBack={false}` from exactly these 4 screens. When `false`, `ScreenHeader` does not render the
`Pressable`/`testID="screen-header-back-button"` at all (not just visually hidden), keeping the
rest of the row (title, accent bar, actions) unchanged. All other 6 migrated screens
(`PlayersTab`/`InjuriesTab`/`SanctionsTab`/`LeagueTab`/`FriendliesTab`/`TournamentsTab`, pushed
inside `TeamStack`/`CompetitionStack`) keep the default `showBack={true}` — their native-stack pop
target (`TeamMenuScreen`/`CompetitionMenuScreen`) is real and was verified correct.

This supersedes Decision 1's original "no hide escape hatch is needed" reasoning: that reasoning
was itself premised on the now-disproven bubbling analysis above. The `hideBackButton` need was
discovered in QA, not anticipated in the original design — recorded here rather than silently
rewriting Decision 1, so the history of *why* the prop exists is traceable.

**Verification note**: this is exactly the kind of behavior a Jest unit test (which mocks
`useNavigation`) cannot catch — the original design's own "Verification caveat" flagged this
category of risk correctly, even though the specific predicted destination was wrong. The
corrected behavior is now covered by a Jest assertion on `showBack={false}` (component-level, in
`ScreenHeader.test.tsx`) plus per-screen assertions that `screen-header-back-button` is absent —
sufficient to prevent regression, even though the cross-navigator bubbling behavior itself remains
something only manual QA in the running app catches.

### 3. `EventDetailScreen`, `TeamSwitcherScreen`, `LoginScreen` stay out of scope

These 3 screens currently have **no** in-content header component (not `ScreenSectionHeader`,
not anything else) — but they are not "missing a unified header": they already get one, supplied
by the outer `Stack.Navigator`'s `headerShown: true` + per-`Stack.Screen` `title`/`headerTitle`
options, with a native back button that React Navigation renders automatically once there is a
previous route, plus `UserAvatarMenu` as `headerRight`. Migrating them to `ScreenHeader` would
require either:
- (a) keeping both headers → a visibly broken double-header screen, or
- (b) setting `headerShown: false` for these routes and losing `UserAvatarMenu` (the app-level
  chrome) and the app-level `AppHeaderTitle`/title wiring done centrally in
  `RootNavigator.tsx`, replacing it with per-screen duplicated logic.

Neither is a net improvement for 3 screens whose header already does its job, so this change
scopes `ScreenHeader` to exactly the screens that lack any header today or already fake one by
hand (`ScreenSectionHeader`'s 9 consumers + `NewsScreen`). `Login` additionally has
`headerShown: false` set deliberately (full-bleed login UI, no chrome) and stays that way — it
was never a `ScreenSectionHeader` consumer and has no title/back concept while unauthenticated.

**Alternative considered — migrate all 13 screens uniformly, including these 3**: rejected per
the trade-off above; flagged as an explicit Open Question below in case the user wants this
broader scope in a follow-up change.

> **Post-implementation scope correction (manual QA, 2026-07-30): `EventDetailScreen` gets BOTH
> headers.** The user tested the app after this change shipped and reported a bug: on
> `EventDetailScreen`, pressing the native back button broke the app-level chrome (the
> name+avatar header disappeared/glitched on the way back to `Calendar`). First fix attempt set
> `headerShown: false` on the `EventDetail` `Stack.Screen` (native header off, `ScreenHeader`
> only) — the user then explicitly asked to **not** disable the native header, while keeping the
> `ScreenHeader` addition ("déjalo igual que en las otras pantallas"). Final state:
> `EventDetailScreen` renders `<ScreenHeader title="Detalles del evento" />` (default
> `showBack={true}`, same as the other 10 migrated screens) **inside** its content, AND
> `RootNavigator.tsx`'s `EventDetail` `Stack.Screen` keeps the native Stack header on
> (inherited `headerShown: true` + `UserAvatarMenu` from the parent `Stack.Navigator`). Per a
> further user request, that native header no longer shows a plain `title: 'Detalles del evento'`
> string — it now uses `headerTitle: () => <AppHeaderTitle teamId={...} />`, the same component
> `Calendar` uses, so it shows app name + club + team (not just the avatar) exactly like the rest
> of the app's native-header screens. This means EventDetail intentionally shows two header rows:
> the native one (app/club/team + avatar) and the in-content `ScreenHeader` (screen title + back).
> The underlying native-back-button bug that originally motivated disabling the native header was
> not otherwise root-caused or fixed; if it resurfaces, treat it as a separate, still-open bug
> against the native Stack header rather than assuming this scope correction resolved it.
> `TeamSwitcherScreen` and `LoginScreen` are unaffected and remain the only two screens with no
> `ScreenHeader` at all — Decision 3's reasoning still applies to both unchanged.

### 4. `CalendarScreen`'s "Filtrar" button becomes a `ScreenHeader` action

`CalendarScreen`'s existing `open-filters-button` (`Pressable` with just text, no icon) maps to:

```ts
{ key: 'filter', icon: 'options-outline', label: 'Filtrar', onPress: () => setFiltersModalVisible(true), testID: 'open-filters-button' }
```

`options-outline` chosen over `filter-outline` as the more literal "adjust filter criteria" icon
already available in `@expo/vector-icons`'s `Ionicons` set, consistent with the "most literal
icon for the concept" rule in `.claude/rules/react-native.md` §3. `testID` is preserved
(`open-filters-button`) so the existing filter-modal-visibility test assertions in
`CalendarScreen`'s test file do not need to change.

All other 9 migrated screens (`FriendliesScreen`, `TournamentsScreen`, `PlayerSeasonCardsScreen`,
`LeagueScreen`, `InjuriesScreen`, `SanctionsScreen`, `TeamMenuScreen`, `CompetitionMenuScreen`,
`NewsScreen`) have **zero** header-level actions today (verified: no other screen renders
children inside its `ScreenSectionHeader`, and `NewsScreen` has no header at all) — they render
`<ScreenHeader title="..." />` with no `actions` prop.

### 5. Deletion, not deprecation

`ScreenSectionHeader.tsx` and its test are deleted in the same change once all 10 consumers
migrate — no dual-maintenance period, since there is exactly one internal package (`Mobile/`) and
grep confirms no other consumer exists today.

## Risks / Trade-offs

- **[Risk]** The `GO_BACK`-bubbles-to-parent-navigator behavior described in Decision 2 is
  correct per React Navigation's documented action-bubbling model, but has not been exercised in
  this app for the 4 tab-root screens before (today they have no back button at all) →
  **Mitigation**: `tasks.md` includes an explicit manual QA task before declaring this change
  verified; if it does not behave as expected, the fallback is adding a `disabled` (visually
  greyed but still-rendered, per "SIEMPRE presente") state or documenting a different target — a
  follow-up decision, not blocking the initial component/test work.
- **[Risk]** Deleting `ScreenSectionHeader` in the same change touches 10 screen files at once →
  **Mitigation**: `tasks.md` sequences one screen (or tight batch) per task with its own
  Red→Green step, so a regression in one screen is isolated and bisectable.
- **[Trade-off]** Excluding `EventDetailScreen`/`TeamSwitcherScreen`/`LoginScreen` (Decision 3)
  means the app still has two header mechanisms after this change (native Stack header vs.
  `ScreenHeader`), not full uniformity → accepted trade-off; see Open Questions.

## Open Questions

- **Scope of Decision 3 — PARTIALLY RESOLVED for `EventDetailScreen` (2026-07-30)**: `ScreenHeader`
  added alongside (not replacing) the native Stack header, per explicit user instruction — see the
  post-implementation note under Decision 3. The native-back-button bug that prompted this is
  still open/unfixed at the native-header level. `TeamSwitcherScreen`/`LoginScreen` remain fully
  out of scope — no bug or request has been raised for either, and the original Decision 3
  trade-off (losing `UserAvatarMenu`/`AppHeaderTitle` wiring for a per-screen duplicate) still
  applies to both. Revisit only if a similar issue surfaces for one of them.
- **Manual QA of back-button bubbling** (Decision 2) needs a human tester with the Expo app
  running; `tasks.md` calls this out as a non-automatable verification step.
- **Manual QA of back-button bubbling** (Decision 2) needs a human tester with the Expo app
  running; `tasks.md` calls this out as a non-automatable verification step.
