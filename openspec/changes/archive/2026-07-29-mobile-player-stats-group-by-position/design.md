## Context

`Mobile/src/screens/PlayerSeasonCardsScreen.tsx` currently renders `cards.map(...)` inside a
plain `ScrollView`. The proposal for `mobile-player-stats-group-by-position` requires grouping
those same cards into 6 fixed, ordered position sections with visible headers, using data
(`activeDemarcation.code`) already returned by `GET
/api/mobile/teams/{teamId}/season-player-cards`.

### Version check (resolves the open question left in the proposal)

`Mobile/AGENTS.md` points at `https://docs.expo.dev/versions/v57.0.0/`, but that is stale: the
installed versions per `Mobile/package.json` are **Expo `^54.0.0`** and **React Native
`0.81.5`**. This design was written against:

- `https://docs.expo.dev/versions/v54.0.0/` — confirms Expo SDK 54.0.0 pins **React Native
  0.81**. The SDK reference page has no list-component guidance (`SectionList` is a React
  Native core API, not an Expo package, so it isn't covered there).
- `https://reactnative.dev/docs/0.81/sectionlist` — the React Native docs for the exact
  installed core version (0.81). `SectionList` is present, fully documented, and **not marked
  deprecated** on this version's docs. Required props are `sections` (array of `{ title, data,
  ...}`-shaped objects) and `renderItem`; `renderSectionHeader` is the supported way to render a
  header per section. The page explicitly frames `FlatList` as the simpler alternative "if you
  don't need section support" — i.e. `SectionList` is the recommended core component precisely
  for this use case, not a deprecated/legacy one.

Conclusion: `SectionList` is confirmed as a real, current, supported API in the app's actual
installed RN version (0.81.5), independent of the outdated `v57.0.0` pointer in `AGENTS.md`.

## Goals / Non-Goals

**Goals:**
- Render the existing player season cards grouped into 6 fixed sections with a visible header
  per non-empty section, in the fixed order: Porteros, Defensas, Medio centros, Bandas,
  Delanteros, Sin posición.
- Keep grouping/sorting logic out of the screen component, in a pure, unit-testable helper.
- Preserve every existing `testID` used by `PlayerSeasonCardsScreen.test.tsx`
  (`player-season-card-{id}`, `player-alias-{id}`, `player-dorsal-{id}`,
  `player-photo(-placeholder)-{id}`, `player-demarcation-{id}`,
  `player-possible-demarcation-{id}-{demarcationId}`, `stat-{key}-{id}`, plus
  `loading-indicator` / `error-message` / `retry-button` / `empty-message`).
- **(Added requirement)** Each section header is visually more prominent than a plain label,
  always shows the group's player count, and is tappable to expand/collapse its rows; all
  sections start collapsed on mount; only one section can be expanded at a time (exclusive
  accordion); collapse/expand state is not persisted across screen visits.

**Non-Goals:**
- No backend/API changes.
- No change to the card's internal layout/content (photo, dorsal badge, demarcation chips, stat
  grid) — only how cards are grouped/ordered and shown/hidden on screen.
- No changes to other tabs/screens.
- No virtualization/performance tuning beyond what `SectionList` gives for free — squads are a
  few dozen players at most, not thousands.
- No persistence (storage, navigation params, context) of which section is expanded — always
  resets to "all collapsed" on mount, by design.

## Decisions

### 1. `SectionList` vs. grouped `ScrollView` with manual headers

**Decision: use React Native's core `SectionList`.**

Rationale:
- **Confirmed supported in the installed version** (see version check above) — not a legacy or
  soon-to-be-removed API.
- **Correctness for free**: `SectionList` accepts pre-grouped `sections` data and a
  `renderSectionHeader`, which maps directly onto "6 fixed groups, each with a header,
  empty groups omitted" — the grouping helper just needs to omit empty groups from the array it
  returns; `SectionList` renders exactly what's given, no conditional-empty-section logic needed
  inside JSX.
- **Testability**: `@testing-library/react-native` renders `SectionList` output (headers +
  items) into the same host-component tree as any other RN list; existing tests already use
  `findByTestId`/`queryByTestId`, which keep working unchanged since `SectionList` is just
  another way to produce the same `View`/`Text` tree that a `.map()` would.
- **Squad size makes virtualization performance irrelevant either way** (a few dozen players,
  not thousands) — this decision is about correctness/idiom fit, not performance.
- A manually grouped `ScrollView` (rendering a header `<Text>` + `.map()` per group, all inside
  one `ScrollView`) was considered and rejected: it duplicates exactly what `SectionList` gives
  natively (grouping + headers), adds more custom JSX to hand-maintain, and is not a pattern used
  anywhere else in `Mobile/` — introducing `SectionList` instead establishes a clean, idiomatic
  precedent for any future grouped list in the app (also not currently used anywhere in
  `Mobile/`, per repo-wide search, so there is no existing local convention being broken either
  way).

### 2. Grouping/sorting logic lives in a pure helper, not the screen

New file: `Mobile/src/screens/hooks/groupPlayersByPosition.ts` (co-located with other
screen-only helpers per `screens/hooks/` convention — it's a plain function, not a React hook,
but lives alongside `useEventFilters`-style screen-scoped logic rather than in `shared/` since
nothing outside this screen needs it yet).

Signature:

```ts
export interface PlayerPositionSection {
  key: string;             // stable key, e.g. 'porteros', 'defensas', ...
  title: string;           // exact section header text, e.g. 'Porteros'
  data: PlayerSeasonCard[]; // players in this section, already sorted
}

export function groupPlayersByPosition(
  cards: PlayerSeasonCard[],
): PlayerPositionSection[];
```

Behavior:
- Iterates the fixed group definitions (see below), bucketing each card by
  `card.activeDemarcation?.code`.
- Cards with `activeDemarcation === null` go to the `Sin posición` bucket.
- Within a bucket, sorts by the sub-position's index in its group's code list (ties broken by
  the code list order — e.g. within Defensas: `DFC` before `LIB` before `LI` before `LD`), then
  by `dorsal` ascending; cards with `dorsal === null` sort after every card with a numeric
  dorsal, within their own sub-position.
- **Groups with zero matching cards are omitted from the returned array entirely** — this is the
  explicit, confirmed behavior from the proposal: no empty section header is ever rendered.
  `Sin posición` follows the same rule — if every card has an `activeDemarcation`, no
  "Sin posición" section appears.
- Pure function: no I/O, no React state — takes the already-fetched `cards` array, returns
  sections. Fully unit-testable in isolation from the screen/network/navigation.

Fixed group definitions (module-level constant in the same file, order matters):

```ts
const GROUPS: { key: string; title: string; codes: string[] }[] = [
  { key: 'porteros',     title: 'Porteros',      codes: ['POR'] },
  { key: 'defensas',     title: 'Defensas',      codes: ['DFC', 'LIB', 'LI', 'LD'] },
  { key: 'medio-centros', title: 'Medio centros', codes: ['MCD', 'MC', 'MCO'] },
  { key: 'bandas',       title: 'Bandas',        codes: ['MI', 'MD', 'EI', 'ED'] },
  { key: 'delanteros',   title: 'Delanteros',    codes: ['SD', 'DC'] },
];
// 'Sin posición' handled separately for activeDemarcation === null, always appended last.
```

The `codes` array order within each group is exactly the sub-position sort order documented in
the proposal (matches the `DemarcationMaster.cs` catalog order for each group's codes).

### 3. Screen refactor: `ScrollView`/`.map()` → `SectionList`

- `PlayerSeasonCardsScreen.tsx` computes `const sections = groupPlayersByPosition(cards);` after
  `cards` state is loaded (or via `useMemo(() => groupPlayersByPosition(cards), [cards])` to
  avoid recomputing on unrelated re-renders).
- Replace the returned `<ScrollView>...{cards.map(...)}...</ScrollView>` block with:
  ```tsx
  <SectionList
    style={styles.container}
    contentContainerStyle={styles.contentContainer}
    sections={sections}
    keyExtractor={(card) => card.teamPlayerId}
    renderSectionHeader={({ section }) => (
      <Text testID={`position-section-header-${section.key}`} style={styles.sectionHeader}>
        {section.title}
      </Text>
    )}
    renderItem={({ item: card }) => renderPlayerCard(card)}
  />
  ```
  where `renderPlayerCard(card)` is the existing per-card JSX (photo, dorsal badge, name,
  demarcation, chips, stats grid) extracted verbatim from the current `.map()` callback into a
  local function/sub-component — **no change to its internal markup or `testID`s**, since the
  existing test file asserts against those directly (`player-season-card-{id}`,
  `player-alias-{id}`, etc.).
- Loading / error / empty-list early returns (`if (loading) ...`, `if (error) ...`, `if
  (cards.length === 0) ...`) are unchanged — they still short-circuit before the `SectionList` is
  reached, exactly as today, so their existing tests (`loading-indicator`, `error-message`,
  `retry-button`, `empty-message`) need no changes.
- `stickySectionHeadersEnabled` is left at its RN default (`true` on iOS, platform default on
  Android) — no explicit override; not a requirement from the proposal, and changing it is out
  of scope unless the user asks for sticky/non-sticky behavior explicitly.

### 4. Section header structure and styling — collapsible, accented, with player count and chevron

**Addendum (this section supersedes the original plain-header styling below it with the
collapsible/accented behavior requested after initial implementation).**

- New `testID` per header: `position-section-header-{groupKey}` (e.g.
  `position-section-header-porteros`), so tests can assert header presence/order/text
  independently of card content. The header is now a `Pressable` (not a bare `Text`), so it can
  be tapped to toggle expand/collapse.
- **Accented style** — more visually prominent than a plain label, still built entirely from
  existing `coachColors` tokens (no new hex):
  ```ts
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: coachColors.surfaceAlt,   // was: no background (plain Text)
    borderWidth: 1,
    borderColor: coachColors.border,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',                          // was 700 — bumped for more visual weight
    color: coachColors.primaryLight,            // was coachColors.textSecondary — accent color
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ```
  `coachColors.surfaceAlt` and `coachColors.primaryLight` are both already-defined tokens in
  `Mobile/src/theme/colors.ts` (`surfaceAlt` is the app's own `MuiAppBar` background;
  `primaryLight` is `palette.primary.light`) — using them here gives the header a filled,
  accent-colored pill/bar look distinct from the plain-text label originally specified, entirely
  within the existing token set.
- **Player count, always visible in both states**: the header text becomes
  `` `${section.title} (${section.data.length})` ``, e.g. `"Defensas (5)"`. Since `section.data`
  always holds every player in the group regardless of collapsed/expanded state (see decision
  below — collapsing hides rendered rows, not the underlying data), the count is always accurate
  and needs no separate computation.
- **Chevron icon**: `Ionicons` (already used app-wide, see `Mobile/src/navigation/RootNavigator.tsx`).
  Confirmed against the installed `@expo/vector-icons` Ionicons glyph map (not assumed from
  memory) that `chevron-down-outline` and `chevron-forward-outline` both exist. Chosen mapping,
  consistent with the app's existing `-outline` icon convention (`react-native.md` §3):
  - Expanded → `chevron-down-outline`
  - Collapsed → `chevron-forward-outline`
  Rendered at the right edge of the header row, `size={18}`, `color={coachColors.primaryLight}`
  (matching the header title's accent color), with its own `testID`:
  `position-section-chevron-{groupKey}`.
- The first section's header sits directly under the screen's existing `contentContainer`
  padding; no extra top margin needed beyond the `sectionHeader.marginTop` above, since
  `SectionList`'s `contentContainerStyle` already supplies `paddingVertical: 20`.

### 5. Sub-position order and dorsal tie-break (confirmed, unchanged from proposal)

Within a group, order is: sub-position index per the `codes` array above (which mirrors the
`DemarcationMaster.cs` catalog order), then `dorsal` ascending, with `dorsal === null` sorted
after every numeric dorsal within the same sub-position bucket. This is implemented as a single
`Array.prototype.sort` comparator inside `groupPlayersByPosition` operating on
`(subPositionIndex, dorsal ?? Infinity)` tuples — no separate pass needed.

### 6. Exclusive-accordion collapse state (new requirement, added after initial implementation)

**State shape**: a single `useState<string | null>` in `PlayerSeasonCardsScreen.tsx`, holding the
`key` (not `title`) of the currently-expanded section, e.g.:

```ts
const [expandedSectionKey, setExpandedSectionKey] = useState<string | null>(null);
```

- `null` means "everything collapsed" — this is the initial value, satisfying "all groups start
  collapsed on mount" with no extra effect needed (no `useEffect` required to force a collapsed
  default; it's simply the initial state).
- Only ever holds **one** key at a time (a single `string | null`, not a `Set`/array) — this is
  what makes the accordion exclusive by construction: setting a new expanded key automatically
  "collapses" whichever key was previously stored, because there is only one slot to hold it.
- State is component-local (`useState`, not context/`AsyncStorage`/`SecureStore`) — confirmed
  requirement is "no persistence between visits", so on every mount of the screen the state
  re-initializes to `null`. No storage read/write of any kind is introduced.
- Toggle handler:
  ```ts
  const toggleSection = (key: string) => {
    setExpandedSectionKey((current) => (current === key ? null : key));
  };
  ```
  Tapping the already-expanded section's header collapses it (back to `null`, nothing expanded);
  tapping a different section's header expands that one and implicitly collapses whatever was
  expanded before (single-slot state, see above).

**How `SectionList` renders collapsed vs. expanded content**: the header always renders (title +
count + chevron, per decision 4) regardless of collapse state — only the **rows** are hidden when
collapsed. Rather than making `renderItem` conditionally return `null` (which would still incur a
render pass and complicate `keyExtractor`/layout measurement per row), the collapse is applied
**at the `sections` data level**, immediately before passing to `SectionList`:

```ts
const visibleSections = useMemo(
  () =>
    sections.map((section) => ({
      ...section,
      data: section.key === expandedSectionKey ? section.data : [],
    })),
  [sections, expandedSectionKey],
);
```

`sections` (from `groupPlayersByPosition`, decision 2) stays the full, ungrouped-by-visibility
source of truth — including for the always-accurate player count in decision 4, which reads
`section.data.length` from the *pre-collapse* `sections`, not `visibleSections`. `visibleSections`
is a second, derived `useMemo` that only empties out `data` for every section except the expanded
one, and is what's actually passed to `<SectionList sections={visibleSections} .../>`. This keeps
`groupPlayersByPosition` itself free of any UI-state concern (it has no idea collapsing exists),
matching the "pure helper" goal from decision 2 — collapse/expand is purely a screen-level
presentation concern layered on top.

`renderSectionHeader` gains the `onToggle`/`isExpanded` wiring:
```tsx
renderSectionHeader={({ section }) => {
  const isExpanded = section.key === expandedSectionKey;
  return (
    <Pressable
      testID={`position-section-header-${section.key}`}
      onPress={() => toggleSection(section.key)}
      style={styles.sectionHeader}
    >
      <Text style={styles.sectionHeaderTitle}>
        {section.title} ({sections.find((s) => s.key === section.key)?.data.length ?? 0})
      </Text>
      <Ionicons
        testID={`position-section-chevron-${section.key}`}
        name={isExpanded ? 'chevron-down-outline' : 'chevron-forward-outline'}
        size={18}
        color={coachColors.primaryLight}
      />
    </Pressable>
  );
}}
```
(Looking the count up from the outer `sections`, not the `section` argument `renderSectionHeader`
receives, is required precisely because `section.data` on the argument is the *possibly-emptied*
`visibleSections` version — see above.)

## Testing Strategy

### `groupPlayersByPosition.test.ts` (new, co-located under `Mobile/src/screens/hooks/__tests__/`)

Pure unit tests, no rendering, no mocked API — plain input/output on fixture arrays of
`PlayerSeasonCard`-shaped objects:

- Returns one section per group that has at least one matching card, titles exactly `Porteros`,
  `Defensas`, `Medio centros`, `Bandas`, `Delanteros`, `Sin posición`, in that fixed order.
- A group with no matching cards is **absent** from the result (not present with `data: []`) —
  covers both an "interior" group (e.g. no `Delanteros`) and the `Sin posición` group when every
  card has an `activeDemarcation`.
- Cards with `activeDemarcation === null` land in `Sin posición`, and that section is always
  last even when it's the only non-empty section besides others.
- Within `Defensas`, given cards with codes `LD`, `DFC`, `LI`, `LIB` in that input order, the
  output order is `DFC`, `LIB`, `LI`, `LD` (sub-position order, not input order).
- Within one sub-position (e.g. two `DFC` cards), cards with dorsal `9` and `3` come back as
  `3`, `9` (ascending).
- A card with `dorsal: null` in a sub-position that also has cards with numeric dorsals sorts
  after all of them, within that same sub-position.
- Matching is asserted to use `code`, not `name` (a fixture with an unexpected/renamed `name` but
  known `code` still groups correctly) — guards against a future regression back to
  name-matching.

### `PlayerSeasonCardsScreen.test.tsx` (existing file, extended — not rewritten)

- All current tests (loading, error + retry, no-detail fallback, empty state, one-card-per-player
  rendering, photo resolution/placeholder, stat fields, demarcation text/chips, no edit controls)
  keep passing unchanged, since their target `testID`s are preserved verbatim on the extracted
  per-card renderer.
- New tests added (from the initial grouping/`SectionList` work, already implemented):
  - Given cards spanning multiple groups (e.g. one `POR`, one `DFC`, one `DC`, one with
    `activeDemarcation: null`), all four expected section headers are found via
    `findByTestId('position-section-header-<key>')` and appear in the DOM in the fixed group
    order (asserted via each header's position relative to the others, e.g. comparing
    `UNSAFE_getAllByType`/render-order index, or simply asserting each header renders and that
    `Sin posición`'s underlying card renders after the others' cards in the tree).
  - Given cards where every card has an `activeDemarcation` (no nulls), the `Sin posición`
    header (`position-section-header-sin-posicion`) is **not** rendered
    (`queryByTestId` returns `null`).
  - Given two cards in the same group with different dorsals, both `player-season-card-{id}`
    testIDs still resolve, and the existing per-field assertions (`player-alias-{id}`,
    `stat-{key}-{id}`, etc.) still pass unchanged — confirming the extraction of the per-card
    renderer didn't regress any existing field.

### Required update to the tests above once collapse/expand ships (important — read before editing)

Adding "all sections start collapsed" is a genuine **behavior change** on top of the tests just
described: those tests were written and passed against a version of the screen where every
section rendered its rows immediately (no collapse existed yet). Once collapse ships, **no
player card renders anywhere until its section's header is tapped**. This means:

- The 3 tests listed above that assert on `player-season-card-*` / `player-alias-*` /
  `stat-*-*` testIDs (and every pre-existing test from before this whole change, e.g.
  "renders one card per player", "shows the player photo...", "renders all 10 season stat
  fields...") **must now `fireEvent.press` the relevant section's header testID
  (`position-section-header-<key>`) before asserting on any card-level testID**, because those
  cards start hidden (collapsed) on mount.
- This is **not** a silent, unjustified edit to a pre-existing assertion's *expected value* — the
  assertions themselves (what a card testID's content should equal) do not change. Only the
  *arrangement* of each test gains one extra step: tap the header to expand the section first.
  This must be called out explicitly in the diff/PR description as "pre-existing tests updated
  to expand their section before asserting card content, because collapse is now the default
  state" — an intentional, documented consequence of the new requirement, not a regression being
  papered over.
- Concretely: every existing test fixture uses `cardOne` (Portero, group `porteros`) and/or
  `cardTwo` (no demarcation, group `sin-posicion`). Each such test needs one added line before
  its card assertions, e.g.:
  ```ts
  fireEvent.press(await findByTestId('position-section-header-porteros'));
  ```
  (or `position-section-header-sin-posicion` for tests using `cardTwo`) before the existing
  `findByTestId('player-...')` calls.

New tests added for the collapse/expand/accordion behavior itself:

- **Initial state — everything collapsed on mount**: given cards spanning 2+ groups, immediately
  after the data resolves (`await waitFor(...)` on the fetch), assert every
  `player-season-card-*` testID is **absent** (`queryByTestId` → `null`) even though the section
  headers themselves (`position-section-header-*`) are present. This directly covers "todos los
  grupos empiezan plegados".
- **Tap to expand**: `fireEvent.press` on one section's header (e.g. `porteros`) → the cards that
  belong to that section become present (`findByTestId('player-season-card-player1')` for a
  `cardOne`-shaped fixture in that group), while cards belonging to *other* sections remain
  absent.
- **Tap again to collapse**: pressing the same, now-expanded header a second time hides its cards
  again (`queryByTestId` → `null` for that section's cards) — covers the toggle-off path of
  `toggleSection`.
- **Exclusive accordion**: with 2 fixtures in 2 different groups (e.g. `cardOne` in `porteros`,
  a second fixture in `defensas`), expand `porteros` first (its card appears), then press the
  `defensas` header → assert the `defensas` card is now present **and** the `porteros` card has
  gone back to absent, in the same test — this is the behavior test that actually proves
  exclusivity (single-slot state), not just "expand works".
- **Chevron reflects state**: assert
  `(await findByTestId('position-section-chevron-porteros')).props.name` is
  `'chevron-forward-outline'` before tapping, and `'chevron-down-outline'` after tapping (or
  assert on the rendered icon's `name` prop directly, since the mocked/rendered `Ionicons`
  component exposes its `name` prop on the test node either way).
- **Count always visible, in both states**: given a group with a known number of cards (e.g. 2
  cards in `defensas`), assert the header's text content includes `Defensas (2)` both
  immediately after mount (collapsed) and after tapping to expand it (still `Defensas (2)`,
  unchanged) — covers "el contador se muestra siempre, plegada o desplegada".

## Risks / Trade-offs

- **[Risk]** `SectionList`'s `renderItem`/`renderSectionHeader` signatures differ slightly from
  a plain `.map()` callback (item comes wrapped as `{ item, index, section }` /
  `{ section }`), so the extraction of the per-card renderer must be done carefully to avoid
  subtly changing which value is passed to existing per-field logic.
  → Mitigation: extract the current `.map()` body into a `renderPlayerCard(card:
  PlayerSeasonCard)` function with no signature change, then call it as
  `renderItem={({ item }) => renderPlayerCard(item)}` — a pure wiring change, not a rewrite of
  the card markup.
- **[Risk]** New group definitions (`codes` arrays) are duplicated from the proposal/spec table;
  a future backend addition of a new `DemarcationMaster` code would silently fall into no group
  matching any of the 5 named groups.
  → Mitigation: any card whose `activeDemarcation` code doesn't match any of the 5 named groups'
  `codes` falls through to `Sin posición` by construction (the grouping only special-cases
  `null`; anything else unmatched — including a hypothetical future code — is bucketed the same
  way as null, in `Sin posición`), so the screen never silently drops a player. This is called
  out as intentional and safe for now; if the catalog changes materially, this mapping should be
  revisited as its own change.
- **[Trade-off]** Sticky section headers behavior is left at RN's platform default rather than
  explicitly forced — acceptable since neither the proposal nor the user specified sticky
  behavior; can be revisited as a small follow-up if desired.
- **[Risk]** Making all sections collapsed by default is a genuine behavior change relative to
  the grouping/`SectionList` work already implemented and green: every test written against that
  version (including several pre-existing tests from *before this whole change*, e.g. "renders
  one card per player") asserted on card testIDs without expanding anything, because nothing was
  collapsible yet. Those tests will fail once collapse ships unless updated.
  → Mitigation: documented explicitly above (`Testing Strategy` → "Required update to the tests
  above...") — every such test gains one `fireEvent.press` on the relevant section header before
  its existing card assertions. This is a deliberate, called-out arrangement change, not a
  silent/unjustified edit to what a test expects.
- **[Risk]** Looking up the section's player count from the outer `sections` (not the
  `renderSectionHeader` callback's own `section` argument, which reflects the collapsed
  `visibleSections` copy with `data: []`) is easy to get backwards and would silently show
  `(0)` for every collapsed section.
  → Mitigation: called out explicitly in decision 6's code sketch with an inline comment; the
  screen test "count always visible in both states" (Testing Strategy) exists specifically to
  catch a regression here.

## Migration Plan

Not applicable — pure UI refactor of one screen, no data migration, no API versioning, no
feature flag. Ships as a single Mobile-only change; rollback is a plain revert of the diff to
`PlayerSeasonCardsScreen.tsx`, its test file, and the new helper file.

## Open Questions

None outstanding. Both decisions flagged as open in the original proposal (`SectionList` vs.
grouped `ScrollView`, and empty-group-omission behavior) were resolved above, and the collapse/
expand addendum's own open items (state shape, collapsed-rendering strategy, header styling,
chevron icon name, testing approach) are resolved in decisions 4 and 6 and the updated `Testing
Strategy` section.
