# Implement: mobile-player-stats-group-by-position (Mobile only)

Self-contained technical script for the `openspec-implementer` agent. You have no memory of how
this change was discussed — everything you need is in this file, plus `proposal.md`,
`design.md`, and `tasks.md` in this same change directory (read them if you need more rationale;
this script gives you the exact steps and content to execute). This file is meant to be run
**from scratch**, so it includes the already-completed work (Steps 1–2) as context/summary and
the new work (Step 3) in full executable detail — do not assume anything about prior
conversation history.

**Scope**: `Mobile/` only. No backend changes (`Back/ExtractionApi/` is untouched — the position
catalog and `activeDemarcation` field already exist and are already returned by `GET
/api/mobile/teams/{teamId}/season-player-cards`). No `Front/` changes.

**Do not commit.** Report the diff and test results back for explicit user go-ahead per
`.claude/rules/git.md §7.3`.

## Hard rules (do not violate)

- **Strict TDD.** For every step marked **RED** below, write the test file/block and run it to
  confirm it fails for the stated reason before writing any production code. Do not write
  production code first and backfill tests.
- **Every existing `testID` in `Mobile/src/screens/PlayerSeasonCardsScreen.tsx` must be
  preserved exactly**: `loading-indicator`, `error-message`, `retry-button`, `empty-message`,
  `player-season-card-{teamPlayerId}`, `player-photo-{teamPlayerId}`,
  `player-photo-placeholder-{teamPlayerId}`, `player-dorsal-{teamPlayerId}`,
  `player-alias-{teamPlayerId}`, `player-demarcation-{teamPlayerId}`,
  `player-possible-demarcation-{teamPlayerId}-{demarcationId}`, `stat-{key}-{teamPlayerId}`,
  `position-section-header-{groupKey}` (added in Step 2, kept in Step 3).
- **No existing assertion in `Mobile/src/screens/__tests__/PlayerSeasonCardsScreen.test.tsx` may
  have its expected *value* changed or be removed.** Step 3 below is the **one documented
  exception to "don't touch existing tests" that is explicitly authorized**: a fixed, named list
  of pre-existing tests each get exactly one `fireEvent.press(...)` line **added** before their
  existing card-testID assertions, because collapsing sections by default is a genuine, deliberate
  behavior change (see Step 3.1). No other edit to any existing test is permitted. If any test
  outside that named list fails after Step 3, that is a regression in your implementation, not a
  test to "fix".
- No `it.skip`/`test.skip`/`xit`/`xdescribe` anywhere in this change.
- All new user-facing strings are Spanish, matching the exact copy specified — do not paraphrase:
  `Porteros`, `Defensas`, `Medio centros`, `Bandas`, `Delanteros`, `Sin posición`.
- Colors: reuse `coachColors` from `Mobile/src/theme/colors.ts`. No new hardcoded hex values —
  Step 3 specifically reuses `coachColors.surfaceAlt`, `coachColors.border`, and
  `coachColors.primaryLight` (all already defined in that file).
- Matching for grouping uses `activeDemarcation.code`, **never** `activeDemarcation.name`.
- Icon names must be real, installed Ionicons glyphs, not assumed from memory — Step 3 uses
  `chevron-down-outline` / `chevron-forward-outline`, both confirmed present in
  `Mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json`.

Run all commands from the repo root unless noted; `cd Mobile` first for `npm`/`npx` commands.

---

## Steps 1–2 (already implemented and verified green — summary only, do not redo)

These are complete and passing as of this writing. They are summarized here so this file is a
faithful, self-contained record of the screen's current state before Step 3. **Do not re-write
or re-run these as if they were pending** — only re-run their test suites as a smoke check if you
want confirmation of the starting state.

### Step 1 summary — `Mobile/src/screens/hooks/groupPlayersByPosition.ts`

A pure function (no React/React Native/API imports) with signature:
```ts
export interface PlayerPositionSection<T extends PlayerLike = PlayerLike> {
  key: string;
  title: string;
  data: T[];
}
export function groupPlayersByPosition<T extends PlayerLike>(cards: T[]): PlayerPositionSection<T>[];
```
It buckets cards into 5 fixed named groups plus a `Sin posición` catch-all, using a
module-level `GROUPS` constant:
```ts
const GROUPS = [
  { key: 'porteros', title: 'Porteros', codes: ['POR'] },
  { key: 'defensas', title: 'Defensas', codes: ['DFC', 'LIB', 'LI', 'LD'] },
  { key: 'medio-centros', title: 'Medio centros', codes: ['MCD', 'MC', 'MCO'] },
  { key: 'bandas', title: 'Bandas', codes: ['MI', 'MD', 'EI', 'ED'] },
  { key: 'delanteros', title: 'Delanteros', codes: ['SD', 'DC'] },
];
```
Matching is on `activeDemarcation?.code` (never `name`); `null` or an unrecognized code both fall
into `Sin posición`. Within a group, cards sort by sub-position index in the group's `codes`
array, then by `dorsal` ascending (`null` dorsal sorts last within its sub-position). **Groups
with zero matching cards are omitted from the returned array entirely** — `Sin posición` is
appended last only if non-empty. Its test file,
`Mobile/src/screens/hooks/__tests__/groupPlayersByPosition.test.ts`, covers: all-groups-populated
order, empty-interior-group omission, `Sin posición` omission when no nulls, nulls always last,
sub-position ordering, dorsal ascending, null-dorsal-last, and code-not-name matching. Full green.

### Step 2 summary — `Mobile/src/screens/PlayerSeasonCardsScreen.tsx` uses `SectionList`

The screen now imports `SectionList` from `react-native` and `groupPlayersByPosition` from
`./hooks/groupPlayersByPosition`. The former `.map()` card body was extracted verbatim into a
`renderPlayerCard(card: PlayerSeasonCard)` function (identical JSX/testIDs). `const sections =
useMemo(() => groupPlayersByPosition(cards), [cards]);` feeds a `<SectionList sections={sections}
keyExtractor={...} renderSectionHeader={...} renderItem={({ item }) => renderPlayerCard(item)}
/>` in place of the old `<ScrollView>{cards.map(...)}</ScrollView>`. At this point,
`renderSectionHeader` is a plain, non-pressable `<Text testID={`position-section-header-${section.key}`}>{section.title}</Text>`
styled with a `sectionHeader` entry in the existing `StyleSheet.create` using
`coachColors.textSecondary`. Loading/error/empty-list early returns are untouched.
`PlayerSeasonCardsScreen.test.tsx` gained 3 new tests on top of the pre-existing ones — **their
exact current names, verbatim, are** (you will need these exact strings in Step 3.1 below):

1. `'Section headers render in the fixed order, only for groups that have players'`
2. `'Sin posición header absent when no player lacks a demarcation'`
3. `'Existing per-card fields still resolve after grouping'`

All tests in the file are green at this point, with **zero collapse/expand behavior yet** — every
section's cards render immediately on data load.

---

## Step 3 — Collapsible section headers, accent styling, player count, exclusive accordion (NEW — tasks.md §3)

This is the new, not-yet-implemented work. It builds directly on the `SectionList` from Step 2
(no changes to `groupPlayersByPosition.ts`, which stays collapse-agnostic by design — see
`design.md` decision 6).

### 3.1 RED (part A) — add the justified `fireEvent.press` line to specific pre-existing tests

Collapsing all sections by default (this step's requirement) means **no player card renders
until its section header is tapped**. Every existing test in
`Mobile/src/screens/__tests__/PlayerSeasonCardsScreen.test.tsx` that asserts on a
`player-season-card-*` / `player-photo*` / `player-dorsal-*` / `player-alias-*` /
`player-demarcation-*` / `player-possible-demarcation-*` / `stat-*-*` testID will fail once Step
3.3 ships, unless it first expands the relevant section.

**This is the one explicitly authorized, documented exception to "never touch existing tests"
in this file.** Add exactly one `fireEvent.press(await findByTestId('position-section-header-<key>'))`
line immediately before the first card-testID assertion in each of the following tests — **do
not change any expected value, only insert this one line per test**:

| Test name (verbatim, do not rename) | Section header to press before its card assertion |
|---|---|
| `'shows an error and lets the user retry when loading fails'` | `position-section-header-porteros` (before the trailing `await findByTestId('player-season-card-player1')`) |
| `'renders one card per player with alias and dorsal'` | `position-section-header-porteros` (both `player1`/`player2` come from `cardOne`/`cardTwo`; `cardOne` is `POR` → `porteros`. `cardTwo` has `activeDemarcation: null` → its card is under `sin-posicion`. Press **both** `position-section-header-porteros` and `position-section-header-sin-posicion` before asserting on `card1`/`card2` respectively) |
| `'shows the player photo when urlPhoto is an absolute URL'` | `position-section-header-sin-posicion` (uses `cardTwo`, which has `activeDemarcation: null`) |
| `'resolves a relative urlPhoto through the public storage proxy'` | `position-section-header-porteros` (uses a `cardOne`-derived fixture, `POR`) |
| `'shows a placeholder when the player has no photo'` | `position-section-header-porteros` (uses `cardOne`) |
| `'renders all 10 season stat fields for a player'` | `position-section-header-porteros` (uses `cardOne`) |
| `'shows the active demarcation name/code when the player has one'` | `position-section-header-porteros` (uses `cardOne`) |
| `'renders a chip per possible demarcation when present'` | `position-section-header-porteros` (uses `cardOne`) |
| `'shows a discreet placeholder and no possible-demarcation chips for a player without a demarcation'` | `position-section-header-sin-posicion` (uses `cardTwo`) |
| `'renders no edit controls for any role, read-only screen'` | `position-section-header-porteros` (uses `cardOne`; the test asserts absence of edit-control testIDs/text globally, so expanding is only needed if you want the card actually mounted — expand it for consistency and to keep the "read-only" assertion meaningful against real rendered card content, not just headers) |
| `'Existing per-card fields still resolve after grouping'` (added in Step 2) | data is `[cardOne, cardTwo]` → press **both** `position-section-header-porteros` and `position-section-header-sin-posicion` before the 3 assertions |

Tests that do **not** need any change (they never assert on a card-level testID, or they
already assert card-level testIDs are absent, which stays true either way):
`'shows a loading indicator before the season cards request resolves'`,
`'fetches the season cards for the team from route params on mount'`,
`'falls back to a statistics-worded error when the server sends no detail'`,
`'shows an empty-state message when there are no players'`,
`'Section headers render in the fixed order, only for groups that have players'` (only asserts
header testIDs, never card testIDs), `'Sin posición header absent when no player lacks a
demarcation'` (only asserts header absence).

Make these additions now (still against the Step-2 implementation, before Step 3.3 exists) and
run:
```
cd Mobile
npm test -- PlayerSeasonCardsScreen
```
At this point, with only the `fireEvent.press` lines added and no production change yet, these
tests **still pass** (pressing a `Text` with no `onPress` handler is a no-op, and cards are still
always rendered since collapse doesn't exist yet in the code). This is expected — it is not the
red signal for this step. The red signal comes from 3.2 (new tests) and is *confirmed* in 3.3's
"before" run below.

### 3.1 RED (part B) — confirm the true regression signal before writing code

Before touching production code, temporarily verify these arrangement changes are meaningful:
this is optional but recommended — you may skip a literal "confirm red" run for 3.1 alone since
by construction pressing a non-interactive `Text` cannot fail; the real RED confirmation for this
whole step happens via 3.2's new tests below, which cannot pass without Step 3.3's implementation.

### 3.2 RED — add the 6 new collapse/expand/accordion tests

Add these new tests to the same `describe('PlayerSeasonCardsScreen', ...)` block, after the
existing ones (including after the 3 added in Step 2 and the edits from 3.1). They must fail
against the current (Step 2) implementation, since it has no `Pressable` header, no expand state,
and always renders every card:

1. **`'all sections start collapsed on mount'`**:
   ```ts
   it('all sections start collapsed on mount', async () => {
     const cards = [
       { ...cardOne, activeDemarcation: { id: 1, name: 'Portero', code: 'POR' } },
       { ...cardTwo, teamPlayerId: 'player5', activeDemarcation: null },
     ];
     (mockApi.get as jest.Mock).mockResolvedValue({ data: cards });

     const { findByTestId, queryByTestId } = await render(<PlayerSeasonCardsScreen />);

     await findByTestId('position-section-header-porteros');
     expect(queryByTestId('player-season-card-player1')).toBeNull();
     expect(queryByTestId('player-season-card-player5')).toBeNull();
   });
   ```
2. **`'expands a section on tap, revealing only its own cards'`**:
   ```ts
   it('expands a section on tap, revealing only its own cards', async () => {
     const cards = [
       { ...cardOne, activeDemarcation: { id: 1, name: 'Portero', code: 'POR' } },
       { ...cardTwo, teamPlayerId: 'player5', activeDemarcation: null },
     ];
     (mockApi.get as jest.Mock).mockResolvedValue({ data: cards });

     const { findByTestId, queryByTestId } = await render(<PlayerSeasonCardsScreen />);

     fireEvent.press(await findByTestId('position-section-header-porteros'));

     await findByTestId('player-season-card-player1');
     expect(queryByTestId('player-season-card-player5')).toBeNull();
   });
   ```
3. **`'collapses an expanded section on a second tap'`**:
   ```ts
   it('collapses an expanded section on a second tap', async () => {
     (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

     const { findByTestId, queryByTestId } = await render(<PlayerSeasonCardsScreen />);

     const header = await findByTestId('position-section-header-porteros');
     fireEvent.press(header);
     await findByTestId('player-season-card-player1');

     fireEvent.press(header);
     expect(queryByTestId('player-season-card-player1')).toBeNull();
   });
   ```
4. **`'exclusive accordion: expanding one section collapses the previously expanded one'`**:
   ```ts
   it('exclusive accordion: expanding one section collapses the previously expanded one', async () => {
     const cards = [
       { ...cardOne, activeDemarcation: { id: 1, name: 'Portero', code: 'POR' } },
       { ...cardOne, teamPlayerId: 'player3', activeDemarcation: { id: 4, name: 'Defensa Central', code: 'DFC' } },
     ];
     (mockApi.get as jest.Mock).mockResolvedValue({ data: cards });

     const { findByTestId, queryByTestId } = await render(<PlayerSeasonCardsScreen />);

     fireEvent.press(await findByTestId('position-section-header-porteros'));
     await findByTestId('player-season-card-player1');

     fireEvent.press(await findByTestId('position-section-header-defensas'));
     await findByTestId('player-season-card-player3');
     expect(queryByTestId('player-season-card-player1')).toBeNull();
   });
   ```
5. **`'chevron icon reflects the collapsed/expanded state'`**:
   ```ts
   it('chevron icon reflects the collapsed/expanded state', async () => {
     (mockApi.get as jest.Mock).mockResolvedValue({ data: [cardOne] });

     const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

     const chevronCollapsed = await findByTestId('position-section-chevron-porteros');
     expect(chevronCollapsed.props.name).toBe('chevron-forward-outline');

     fireEvent.press(await findByTestId('position-section-header-porteros'));

     const chevronExpanded = await findByTestId('position-section-chevron-porteros');
     expect(chevronExpanded.props.name).toBe('chevron-down-outline');
   });
   ```
   (If the installed `Ionicons` mock/test renderer does not expose `name` directly on
   `.props`, inspect the actual rendered props for the icon node in this codebase's existing
   icon tests, if any exist elsewhere in `Mobile/`, e.g. under `navigation/__tests__/`, and match
   that convention instead — do not guess a different querying approach without checking.)
6. **`'shows the player count in the header in both collapsed and expanded states'`**:
   ```ts
   it('shows the player count in the header in both collapsed and expanded states', async () => {
     const cards = [
       { ...cardOne, activeDemarcation: { id: 4, name: 'Defensa Central', code: 'DFC' } },
       { ...cardOne, teamPlayerId: 'player3', activeDemarcation: { id: 3, name: 'Lateral Derecho', code: 'LD' } },
     ];
     (mockApi.get as jest.Mock).mockResolvedValue({ data: cards });

     const { findByTestId } = await render(<PlayerSeasonCardsScreen />);

     const headerCollapsed = await findByTestId('position-section-header-defensas');
     expect(headerCollapsed).toHaveTextContent('Defensas (2)');

     fireEvent.press(headerCollapsed);

     const headerExpanded = await findByTestId('position-section-header-defensas');
     expect(headerExpanded).toHaveTextContent('Defensas (2)');
   });
   ```
   (Use whichever text-content assertion helper this project's installed
   `@testing-library/react-native` version supports — e.g. `toHaveTextContent` from
   `@testing-library/jest-native` if it's set up in `Mobile/`, or fall back to finding the inner
   `Text` node via `within(header).getByText(/Defensas \(2\)/)` if `toHaveTextContent` is not
   available. Check `Mobile/package.json`/existing test files for which matcher is already in
   use before picking one.)

Run:
```
npm test -- PlayerSeasonCardsScreen
```
Confirm all 6 new tests fail (no `Pressable` header, no `expandedSectionKey` state, no chevron,
no count text yet) before writing any production code.

### 3.3 GREEN — implement in `PlayerSeasonCardsScreen.tsx`

1. Add imports (extend existing import lines, do not add duplicate `react-native` or `react`
   import statements):
   ```ts
   import { Pressable } from 'react-native'; // add to the existing react-native import list
   import { Ionicons } from '@expo/vector-icons'; // new import, same package used in RootNavigator.tsx
   ```
2. Add the expansion state, right after the existing `cards`/`loading`/`error` state
   declarations:
   ```ts
   const [expandedSectionKey, setExpandedSectionKey] = useState<string | null>(null);
   ```
3. Add the toggle handler (component body, alongside `fetchCards`):
   ```ts
   const toggleSection = (key: string) => {
     setExpandedSectionKey((current) => (current === key ? null : key));
   };
   ```
4. Add the derived, collapse-applied sections, right after the existing `sections` `useMemo`
   from Step 2 (do not remove or rename that one — `sections` remains the full, uncollapsed
   source of truth used for the player count):
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
5. Change the `<SectionList>` to consume `visibleSections` instead of `sections`, and rewrite
   `renderSectionHeader` to a pressable, styled, counted, chevron-bearing header:
   ```tsx
   <SectionList
     style={styles.container}
     contentContainerStyle={styles.contentContainer}
     sections={visibleSections}
     keyExtractor={(card) => card.teamPlayerId}
     renderSectionHeader={({ section }) => {
       const isExpanded = section.key === expandedSectionKey;
       const fullSection = sections.find((s) => s.key === section.key);
       const count = fullSection ? fullSection.data.length : 0;
       return (
         <Pressable
           testID={`position-section-header-${section.key}`}
           onPress={() => toggleSection(section.key)}
           style={styles.sectionHeader}
         >
           <Text style={styles.sectionHeaderTitle}>
             {section.title} ({count})
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
     renderItem={({ item }) => renderPlayerCard(item)}
   />
   ```
   The count **must** come from `sections` (the full, pre-collapse array), via the
   `fullSection` lookup above — **not** from `section.data.length` on the argument, which is the
   `visibleSections` copy and will be `0` for every non-expanded section. This is exactly the
   bug called out in `design.md`'s Risks section — do not reintroduce it.
6. Update the `sectionHeader` style and add `sectionHeaderTitle` in the existing
   `StyleSheet.create({...})` object, replacing the old plain `sectionHeader` entry from Step 2:
   ```ts
   sectionHeader: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'space-between',
     paddingHorizontal: 12,
     paddingVertical: 10,
     marginTop: 12,
     borderRadius: 10,
     backgroundColor: coachColors.surfaceAlt,
     borderWidth: 1,
     borderColor: coachColors.border,
   },
   sectionHeaderTitle: {
     fontSize: 14,
     fontWeight: '800',
     color: coachColors.primaryLight,
     textTransform: 'uppercase',
     letterSpacing: 0.5,
   },
   ```
   Remove the old `sectionHeader` properties from Step 2 (`fontSize: 13`, `fontWeight: '700'`,
   `color: coachColors.textSecondary`, `textTransform`, `letterSpacing`, `paddingTop: 16`,
   `paddingBottom: 8`) — they are superseded by the two entries above. No new hex values are
   introduced anywhere in this change; `coachColors.surfaceAlt`, `coachColors.border`, and
   `coachColors.primaryLight` are all pre-existing tokens in `Mobile/src/theme/colors.ts`.
7. Do not touch the `loading`/`error`/`empty` early returns.

Run:
```
npm test -- PlayerSeasonCardsScreen
```
Iterate until **every** test in the file passes: all pre-existing ones (with the Step-3.1
`fireEvent.press` additions from the table above, and no other change to their expected values),
the 3 tests from Step 2, and the 6 new ones from Step 3.2. If a test outside the Step-3.1 table
fails, that's a regression — fix the component.

### 3.4 REFACTOR (still green)

- Confirm `toggleSection`/`visibleSections` do not duplicate any bucketing/sorting logic —
  `groupPlayersByPosition` remains completely unaware that collapsing exists.
- Confirm no leftover references to the old plain-`Text`, non-pressable header style from Step 2.
- Confirm the chevron/header `testID`s and icon names match this file exactly:
  `position-section-header-{key}`, `position-section-chevron-{key}`,
  `chevron-down-outline`/`chevron-forward-outline`.
- Re-run `npm test -- PlayerSeasonCardsScreen` once more and confirm 100% green.

---

## Step 4 — Final verification (tasks.md §4)

From `Mobile/`:

```
npm test
```
Must be 100% pass, zero failures, across the **whole** Mobile test suite (not just the files
touched by this change).

Grep for any skipped tests introduced by this change:
```
grep -rnE "\.skip\(|xit\(|xdescribe\(" \
  src/screens/hooks/__tests__/groupPlayersByPosition.test.ts \
  src/screens/__tests__/PlayerSeasonCardsScreen.test.tsx
```
Expect no output. If any match is found, remove it — do not silence it with `.skip`.

**Diff-review `PlayerSeasonCardsScreen.test.tsx` with this exact framing**: the only permitted
change to any test that existed before Step 3 is the single added `fireEvent.press(...)` line
listed in the Step 3.1 table above, on exactly those named tests, with no change to any expected
value. Every other pre-existing test (from before this whole change, and the 3 added in Step 2)
must be otherwise byte-for-byte identical. Document this explicitly in your final report as an
intentional, justified behavior-change accommodation — not a silently "fixed" test.

Run coverage for the touched code and confirm ≥75% (per `.claude/rules/frontend-testing.md`
§4.6), specifically checking these branches are exercised:
- `groupPlayersByPosition.ts`: empty-group-omitted, null-dorsal-sorts-last (from Step 1).
- `PlayerSeasonCardsScreen.tsx`: initial-collapsed, toggle-expand, toggle-collapse,
  exclusive-accordion (only one section open at a time), chevron-name-per-state,
  count-visible-in-both-states (all from Step 3.2).
```
npm test -- --coverage groupPlayersByPosition PlayerSeasonCardsScreen
```

Confirm no new hardcoded hex color was introduced anywhere in
`Mobile/src/screens/PlayerSeasonCardsScreen.tsx` — every color reference in the file's
`StyleSheet.create` must resolve to a `coachColors.*` token (grep the file for `#` outside of
comments/testIDs as a quick check):
```
grep -n "'#" src/screens/PlayerSeasonCardsScreen.tsx
```
Expect no output (or only pre-existing matches unrelated to this change, e.g. inside
`dorsalBadge`/`dorsalBadgeText` styles that predate this whole change and were never touched).

If the project has a TypeScript check script (verify by checking `Mobile/package.json`'s
`scripts` block — do not assume a name), run it to confirm no type errors were introduced by
`SectionList`, the new helper's generics, or the `Ionicons`/`Pressable` props added in Step 3. If
no such script exists, skip this check and note it in your final report.

## Done

Report back: full list of files created/modified across the entire change
(`Mobile/src/screens/hooks/groupPlayersByPosition.ts`,
`Mobile/src/screens/hooks/__tests__/groupPlayersByPosition.test.ts`,
`Mobile/src/screens/PlayerSeasonCardsScreen.tsx`,
`Mobile/src/screens/__tests__/PlayerSeasonCardsScreen.test.tsx`), the `npm test` output summary
(pass count, 0 failures, 0 skipped), the grep results (both empty, or the hex grep's pre-existing
exceptions listed explicitly), the coverage summary for the two touched files, and the explicit
list of which pre-existing tests received the one-line `fireEvent.press` addition (per the Step
3.1 table) with the justification restated. Do not run `git add`/`git commit` — wait for the
user's explicit go-ahead per `.claude/rules/git.md §7.3`.
