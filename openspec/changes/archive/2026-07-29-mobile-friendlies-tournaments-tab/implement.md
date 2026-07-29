# Implement: mobile-friendlies-tournaments-tab (Mobile only)

Self-contained technical script for the `openspec-implementer` agent. You have no memory of
how this change was discussed — everything you need is in this file, plus
`proposal.md`, `design.md`, and `tasks.md` in this same change directory (read them if you
need more rationale; this script gives you the exact steps and content).

**Scope**: `Mobile/` only. No backend changes (`Back/ExtractionApi/` is untouched — the
backend's `SportEventTypes` lookup table already has everything needed: see `design.md`
"Resolved decision"). No `Front/` changes.

**Do not commit.** Report the diff and test results back for explicit user go-ahead per
`.claude/rules/git.md §7.3`.

## Hard rules (do not violate)

- **Strict TDD.** For every numbered step below marked **RED**, write the test file/block and
  run it to confirm it fails for the stated reason (module/component/tab doesn't exist yet)
  before writing any production code. Do not write production code first and backfill tests.
- **`Mobile/src/screens/components/__tests__/EventCard.test.tsx` must pass with ZERO edits to
  the test file.** Step 2 refactors `EventCard.tsx` to consume the new matcher module — this is
  a pure extraction with no behavior change. If any existing assertion in that file fails after
  the refactor, the extraction is wrong (fix `EventCard.tsx`'s use of the matchers, or the
  matcher module itself) — do not edit the test to make it pass.
- **The 3 pre-existing tests in `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx`
  (`registers an "Estadísticas" PlayersTab...`, `uses a statistics icon for the PlayersTab`,
  `uses a trophy icon for the LeagueTab`) must pass with ZERO edits to those three tests.** Step
  4 only adds new mocks/assertions to this file — it must not touch the existing ones.
- No `it.skip`/`test.skip`/`xit`/`xdescribe` anywhere in this change.
- All user-facing strings are Spanish, matching the exact copy specified below (from
  `design.md`) — do not paraphrase.
- Colors: reuse `coachColors` from `Mobile/src/theme/colors.ts`. No new hardcoded hex values.

Run all commands from the repo root unless noted; `cd Mobile` first for `npm`/`npx` commands.

---

## Step 1 — `sportEventTypeMatchers.ts` (tasks.md §1.1–1.2)

### 1.1 RED — write the test file first

Create `Mobile/src/utils/__tests__/sportEventTypeMatchers.test.ts` importing from
`../sportEventTypeMatchers` (module does not exist yet — this must fail on import/resolution).

Test every exported function against these cases:

- `isTrainingEventType`: `'Entrenamiento'` → `true`; `'entrenamiento'` (lowercase) → `true`;
  `'Partido'`, `'Reunión'`, `'Amistoso'`, `'Pruebas de acceso'`, `undefined`, `null`, `''` →
  `false`.
- `isMatchEventType`: `'Partido'` → `true`; `'PARTIDO'` → `true`; all other names/`undefined`/
  `null`/`''` → `false`.
- `isTournamentEventType`: `'Torneo Provincial'` → `true`; `'Fase de Competición'` → `true`
  (covers the `'competici'` substring); `'torneo regional'` (lowercase) → `true`; `'Amistoso'`,
  `'Partido'`, `'Entrenamiento'`, `'Reunión'`, `'Pruebas de acceso'`, `undefined`, `null`, `''`
  → `false`.
- `isFriendlyEventType`: `'Amistoso'` → `true`; `'AMISTOSO'` → `true`; all other
  names/`undefined`/`null`/`''` → `false`.
- `isFriendlyOrTournamentEventType`: `'Amistoso'` → `true`; `'Torneo Provincial'` → `true`;
  `'Fase de Competición'` → `true`; `'Partido'`, `'Entrenamiento'`, `'Reunión'`,
  `'Pruebas de acceso'`, `undefined`, `null`, `''` → `false`.

Run:
```
cd Mobile
npm test -- sportEventTypeMatchers
```
Confirm it fails because `../sportEventTypeMatchers` cannot be resolved.

### 1.2 GREEN — create the module

Create `Mobile/src/utils/sportEventTypeMatchers.ts`:

```ts
const normalize = (name?: string | null): string => (name ?? '').toLowerCase();

export const isTrainingEventType = (name?: string | null): boolean =>
  normalize(name).includes('entrenamiento');

export const isMatchEventType = (name?: string | null): boolean =>
  normalize(name).includes('partido');

export const isTournamentEventType = (name?: string | null): boolean => {
  const n = normalize(name);
  return n.includes('torneo') || n.includes('competici');
};

export const isFriendlyEventType = (name?: string | null): boolean =>
  normalize(name).includes('amistos');

export const isFriendlyOrTournamentEventType = (name?: string | null): boolean =>
  isFriendlyEventType(name) || isTournamentEventType(name);
```

Run `npm test -- sportEventTypeMatchers` until every case from 1.1 passes.

---

## Step 2 — Refactor `EventCard.tsx` to consume the matchers (tasks.md §1.3–1.4)

Do **not** touch `Mobile/src/screens/components/__tests__/EventCard.test.tsx`.

In `Mobile/src/screens/components/EventCard.tsx`:

1. Add the import:
   ```ts
   import { isTrainingEventType, isTournamentEventType, isMatchEventType } from '../../utils/sportEventTypeMatchers';
   ```
2. Replace the body of `getHeaderStyle`:
   ```ts
   function getHeaderStyle(eventTypeName?: string | null) {
     if (isTrainingEventType(eventTypeName)) {
       return { emoji: '⚽', backgroundColor: '#2e7d32' };
     }
     if (isTournamentEventType(eventTypeName)) {
       return { emoji: '🏆', backgroundColor: '#c62828' };
     }
     return { emoji: '📅', backgroundColor: '#455a64' };
   }
   ```
   Keep precedence identical to the current implementation: training checked first, then
   tournament, else the generic fallback. Do not swap the order.
3. Replace the `isMatch` line inside the component body:
   ```ts
   const isMatch = isMatchEventType(eventTypeName);
   ```
   (was: `const isMatch = (eventTypeName ?? '').toLowerCase().includes('partido');`)
4. Remove the now-unused inline `.toLowerCase().includes(...)` logic — nothing else in the file
   should still do this matching inline.

Run:
```
npm test -- EventCard
```
All existing assertions in `EventCard.test.tsx` must pass unmodified. If something fails,
fix `EventCard.tsx`/`sportEventTypeMatchers.ts` — do not edit the test.

Then run both together:
```
npm test -- sportEventTypeMatchers EventCard
```
Confirm both suites are green, no skipped tests.

---

## Step 3 — `FriendliesScreen.tsx` (tasks.md §2.1–2.4)

### 3.1 RED — write the test file first

Create `Mobile/src/screens/__tests__/FriendliesScreen.test.tsx`. Mirror the mocking style used
in `Mobile/src/screens/__tests__/CalendarScreen.test.tsx` (read it for the exact mock shape of
`../../api/client` and navigation hooks before writing this file, since it is the closest
sibling pattern). Mock:

- `../../api/client` (`api.get` as a `jest.fn()`).
- `../../api/sportEventTypes` (`fetchSportEventTypeMap` as a `jest.fn()`).
- `@react-navigation/native`'s `useRoute` → `{ params: { teamId: 'team1', teamPlayerId: 'tp1' } }`
  and `useNavigation` → an object with a `navigate: jest.fn()`.

Write these cases against the not-yet-created `FriendliesScreen` (default export from
`../FriendliesScreen`):

1. **Loading**: `api.get` returns a pending (never-resolving in this assertion window) promise
   → `getByTestId('loading-indicator')` is present.
2. **Data — filters and sorts correctly**: `fetchSportEventTypeMap` resolves to
   `{ 1: 'Partido', 2: 'Entrenamiento', 3: 'Reunión', 4: 'Amistoso', 6: 'Torneo Regional' }`
   (id 6 is a made-up id for this test only — it does not need to exist in the real backend).
   `api.get` resolves with a `data` array containing, out of date order: a `Partido` event, an
   `Entrenamiento` event, a `Reunión` event, an `Amistoso` event dated later, and a
   `Torneo Regional` event dated earlier. Assert: only the `Amistoso` and `Torneo Regional`
   events render (e.g. via their `event-item-<id>` testID from `EventCard`), and the `Torneo
   Regional` one (earlier date) appears before the `Amistoso` one (later date) in the rendered
   order.
3. **Error — with `detail`**: `api.get` rejects with
   `{ response: { data: { detail: 'Fallo de red' } } }` → `getByTestId('error-message')` text is
   `'Fallo de red'`. Tapping `getByTestId('retry-button')` calls `api.get` again (assert call
   count increases, or that a second, resolved mock value now renders data).
4. **Error — without `detail` (fallback)**: `api.get` rejects with an error object lacking
   `response.data.detail` (e.g. a plain `new Error('network')`) →
   `getByTestId('error-message')` text is `'Error al cargar los amistosos y torneos'`.
5. **Empty — no friendly/tournament events among results**: `api.get` resolves with only
   `Partido`/`Entrenamiento`/`Reunión` events (or an empty array) →
   `getByTestId('empty-message')` text is `'No hay amistosos ni torneos próximos'`.
6. **Navigation on tap**: from the data case (case 2), tap one rendered `EventCard` → asserts
   `navigate` was called with `('EventDetail', { eventId: <that event's id>, teamId: 'team1',
   teamPlayerId: 'tp1' })`.
7. **Request params**: assert `api.get` was called with `/api/sport-events/team1` and a params
   object containing `{ pageNumber: 1, pageSize: 50, descending: false }` plus a `startDate`
   key present with a string value (do not assert the exact ISO string — assert
   `typeof params.startDate === 'string'` or similar, since it's `new Date().toISOString()` at
   call time).

Run:
```
npm test -- FriendliesScreen
```
Confirm it fails (module doesn't exist).

### 3.2 GREEN — create the screen

Create `Mobile/src/screens/FriendliesScreen.tsx`. Use `Mobile/src/screens/CalendarScreen.tsx`
as the structural template (same imports style, same `StyleSheet.create` co-location, same
`testID`s for `loading-indicator`/`error-message`/`retry-button`/`empty-message`), but:

- No `EventFiltersModal`/`useEventFilters` — this screen has no user-facing filter UI.
- Section title text: `'Amistosos y torneos'` (no filter button next to it, unlike
  `CalendarScreen`'s header row).
- State: `events: SportEvent[]`, `eventTypeMap: SportEventTypeMap`, `loading`, `error`,
  `refreshing`. (Reuse the `SportEvent` type from `./components/EventCard` and the
  `SportEventTypeMap` type from `../api/sportEventTypes`, same imports `CalendarScreen` uses.)
- `useRoute()` → `{ teamId, teamPlayerId }` from `route.params` (same shape as `CalendarScreen`).
- `useEffect` on `[teamId]` → calls `fetchFriendlies`.
- `fetchFriendlies` (async):
  ```ts
  const fetchFriendlies = async () => {
    try {
      if (!teamId) {
        setError('Team ID not provided');
        setLoading(false);
        return;
      }
      setLoading(true);
      const [eventsResponse, typeMap] = await Promise.all([
        api.get(`/api/sport-events/${teamId}`, {
          params: {
            pageNumber: 1,
            pageSize: 50,
            descending: false,
            startDate: new Date().toISOString(),
          },
        }),
        fetchSportEventTypeMap(),
      ]);
      setEvents(eventsResponse.data || []);
      setEventTypeMap(typeMap);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al cargar los amistosos y torneos');
    } finally {
      setLoading(false);
    }
  };
  ```
- `onRefresh` mirrors `CalendarScreen`'s (`setRefreshing(true); await fetchFriendlies(); setRefreshing(false);`).
- Derived, render-time list (not stored in state):
  ```ts
  const friendlyOrTournamentEvents = events
    .filter((e) => isFriendlyOrTournamentEventType(eventTypeMap[e.eventTypeId ?? -1]))
    .sort((a, b) => new Date(a.eveDateTime).getTime() - new Date(b.eveDateTime).getTime());
  ```
  Import `isFriendlyOrTournamentEventType` from `../utils/sportEventTypeMatchers` (the module
  from Step 1).
- Render, in order: loading state (`ActivityIndicator` testID `loading-indicator`) → error state
  (`error-message` text + `retry-button` calling `fetchFriendlies`) → empty state (`empty-message`
  text exactly `'No hay amistosos ni torneos próximos'`, shown when
  `friendlyOrTournamentEvents.length === 0`) → `FlatList` of `EventCard` (same props as
  `CalendarScreen`: `event={item}`, `eventTypeName={eventTypeMap[item.eventTypeId ?? -1]}`,
  `onPress={(eventId) => navigation.navigate('EventDetail', { eventId, teamId, teamPlayerId })}`)
  wrapped with `RefreshControl` bound to `onRefresh`.
- `StyleSheet` reusing `coachColors` (`../theme/colors`) the same way `CalendarScreen` does — no
  new hex values.

Run `npm test -- FriendliesScreen` until every case from 3.1 passes.

### 3.3 Refactor pass (still green)

Re-read the finished file against `design.md` §Decisions 2: confirm the exact copy
(`'Amistosos y torneos'` section title, `'No hay amistosos ni torneos próximos'` empty state,
`'Error al cargar los amistosos y torneos'` fallback error) and that no logic duplicates
`CalendarScreen.tsx` beyond what's structurally required. Re-run `npm test -- FriendliesScreen`
once more to confirm still green after any cleanup.

---

## Step 4 — `FriendliesTab` in `RootNavigator.tsx` (tasks.md §3.1–3.3)

### 4.1 RED — extend the existing navigation test file

Edit `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx`. **Add to it, do not remove or
alter any existing line.**

1. Add a new mock alongside the existing screen mocks (same line style):
   ```ts
   jest.mock('../../screens/FriendliesScreen', () => 'FriendliesScreen');
   ```
2. Add new tests inside the existing `describe('CalendarTabs', ...)` block (after the existing
   ones, do not reorder or edit them):
   - A test asserting `getByTestId('tab-screen-FriendliesTab')` exists and
     `getByTestId('tab-label-FriendliesTab').props.children` is `'Amistosos'`.
   - A test asserting `getByTestId('tab-icon-FriendliesTab').props.children` is
     `'football-outline'`.
   - A test asserting tab order: `CalendarTab` is registered before `FriendliesTab`, which is
     registered before `NewsTab`. Use `getAllByTestId(/^tab-screen-/)` (or equivalent querying
     available in the installed Testing Library version — check
     `@testing-library/react-native`'s docs for the exact regex-matcher API before writing this
     if unfamiliar) and assert the index of `tab-screen-CalendarTab` < index of
     `tab-screen-FriendliesTab` < index of `tab-screen-NewsTab`.

Run:
```
npm test -- CalendarTabs
```
Confirm only the 3 new assertions fail (module/tab doesn't exist yet) and the 3 pre-existing
tests (`Estadísticas`/statistics icon/trophy icon) still pass untouched.

### 4.2 GREEN — wire the tab

Edit `Mobile/src/navigation/RootNavigator.tsx`:

1. Add the import: `import FriendliesScreen from '../screens/FriendliesScreen';` (place it
   next to the other screen imports, after `CalendarScreen`).
2. Inside `CalendarTabs`, add a new `Tab.Screen` **between** the existing `CalendarTab` and
   `NewsTab` `Tab.Screen` blocks:
   ```tsx
   <Tab.Screen
     name="FriendliesTab"
     component={FriendliesScreen}
     initialParams={{ teamId, teamPlayerId }}
     options={{
       tabBarLabel: 'Amistosos',
       tabBarIcon: ({ color, size }) => <Ionicons name="football-outline" size={size} color={color} />,
     }}
   />
   ```
   Note `initialParams` includes both `teamId` and `teamPlayerId` (same as `CalendarTab`, unlike
   `PlayersTab`/`LeagueTab` which only get `teamId`) — `FriendliesTab` navigates onward to
   `EventDetail`, which needs `teamPlayerId`.
3. Do not change the `name`, `initialParams`, or `options` of any other existing `Tab.Screen`.

Run `npm test -- CalendarTabs` until all tests (the 3 pre-existing + the 3 new ones) pass.

### 4.3 Verification

Run `npm test -- CalendarTabs` alone once more and confirm the 3 pre-existing tests still pass
with their original assertions, byte-for-byte unmodified in the diff.

---

## Step 5 — Final verification (tasks.md §4)

From `Mobile/`:

```
npm test
```
Must be 100% pass, zero failures, across the whole suite (not just the files touched by this
change).

Grep for any skipped tests introduced by this change:
```
grep -rnE "\.skip\(|xit\(|xdescribe\(" \
  src/utils/__tests__/sportEventTypeMatchers.test.ts \
  src/screens/components/__tests__/EventCard.test.tsx \
  src/screens/__tests__/FriendliesScreen.test.tsx \
  src/navigation/__tests__/CalendarTabs.test.tsx
```
Expect no output. If any match is found, it must not be present — remove it, don't silence it.

Confirm every branch touched by this change has a corresponding test (per `frontend-testing.md`
§4.6, ≥75% target on modified code):
- `sportEventTypeMatchers.ts`: all 5 exported predicates exercised (Step 1.1's cases).
- `EventCard.tsx`'s refactored `getHeaderStyle`/`isMatch`: already covered by the untouched
  `EventCard.test.tsx` (Step 2) — no new branch was introduced, only relocated.
- `FriendliesScreen.tsx`: all 4 UI states + navigation + request params (Step 3.1's cases).
- `RootNavigator.tsx`'s new `Tab.Screen`: label/icon/order (Step 4.1's cases).

Manually re-read the `EventCard.tsx` diff one more time: confirm it only replaces inline
conditionals with calls into `sportEventTypeMatchers.ts`, with the training → tournament →
generic precedence preserved exactly as it was before the refactor.

## Done

Report back: full list of files created/modified, `npm test` output summary (pass count, 0
failures, 0 skipped), and the grep result (empty). Do not run `git add`/`git commit` — wait for
the user's explicit go-ahead per `.claude/rules/git.md §7.3`.
