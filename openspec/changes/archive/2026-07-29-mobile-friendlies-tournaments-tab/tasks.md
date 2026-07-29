## 1. Extract `sportEventTypeMatchers.ts` and refactor `EventCard.tsx` to consume it

- [ ] 1.1 **Red** — Write `Mobile/src/utils/__tests__/sportEventTypeMatchers.test.ts` against the not-yet-created module. Cover, per exported predicate (`isTrainingEventType`, `isMatchEventType`, `isTournamentEventType`, `isFriendlyEventType`, `isFriendlyOrTournamentEventType`):
  - Exact current backend names: `'Partido'`, `'Entrenamiento'`, `'Reunión'`, `'Amistoso'`, `'Pruebas de acceso'` — assert only the intended predicate returns `true` for each (e.g. `isFriendlyEventType('Amistoso')` → `true`, all four others → `false`).
  - Case-insensitivity: `'AMISTOSO'`, `'entrenamiento'` (mixed case).
  - Speculative/forward-compatible names that don't exist in the backend today but must still match per the design: `'Torneo Provincial'`, `'Fase de Competición'` → `isTournamentEventType` and `isFriendlyOrTournamentEventType` both `true`.
  - `undefined`, `null`, `''` → every predicate returns `false` (no throw).
  - Run `npm test -- sportEventTypeMatchers` and confirm it fails (module doesn't exist yet).
- [ ] 1.2 **Green** — Create `Mobile/src/utils/sportEventTypeMatchers.ts` implementing exactly the five predicates from `design.md` §Decisions 1. Run `npm test -- sportEventTypeMatchers` and confirm all pass.
- [ ] 1.3 **Refactor (still green)** — In `Mobile/src/screens/components/EventCard.tsx`, replace the inline `getHeaderStyle` substring checks (`'entrenamiento'`, `'torneo'`/`'competici'`) and the inline `isMatch` check (`'partido'`) with calls to `isTrainingEventType`, `isTournamentEventType`, `isMatchEventType` imported from `../../utils/sportEventTypeMatchers`. Do not change any rendering logic or output — this is a pure extraction.
  - **Done when**: `npm test -- EventCard` passes with zero changes to `Mobile/src/screens/components/__tests__/EventCard.test.tsx`. If any existing assertion fails, the extraction introduced a behavior change — fix the extraction, never edit the pre-existing test to match.
- [ ] 1.4 **Verification** — Run `npm test -- sportEventTypeMatchers EventCard` together; both suites green, no skipped tests (`.skip`/`xit`) introduced.

## 2. `FriendliesScreen.tsx`

- [ ] 2.1 **Red** — Write `Mobile/src/screens/__tests__/FriendliesScreen.test.tsx` (new file) against the not-yet-created screen. Mock `../../api/client` (`api.get`) and `../../api/sportEventTypes` (`fetchSportEventTypeMap`) per `frontend-testing.md` §3.3 conventions (jest module mocks, no real network). Cover all four states:
  - **Loading**: `api.get` unresolved yet → `getByTestId('loading-indicator')` present.
  - **Data (happy path + filtering + sorting)**: mock `api.get` to return a mixed list of events (some `eventTypeId` resolving to `'Amistoso'`, some to `'Torneo Regional'`, some to `'Entrenamiento'`/`'Partido'`/`'Reunión'`) out of date order; mock `fetchSportEventTypeMap` accordingly. Assert only the friendly/tournament events render (via `EventCard`'s `event-item-<id>` testID or similar), and assert they appear in ascending `eveDateTime` order (training/match/meeting events must be absent).
  - **Error**: `api.get` rejects with `{ response: { data: { detail: 'X' } } }` → `getByTestId('error-message')` shows `'X'`; also test the fallback path where `response.data.detail` is absent → shows the Spanish fallback `'Error al cargar los amistosos y torneos'`. Assert `retry-button` re-triggers the fetch (mock resolves on second call, e.g. via `mockResolvedValueOnce`/`mockRejectedValueOnce` sequencing).
  - **Empty**: `api.get` resolves with events but none classify as friendly/tournament (or resolves with an empty array) → `getByTestId('empty-message')` shows `'No hay amistosos ni torneos próximos'`.
  - Assert tapping an event card navigates: mock `useNavigation` (and `useRoute` returning `{ params: { teamId: 'team1', teamPlayerId: 'tp1' } }`), tap the card, assert `navigate` called with `('EventDetail', { eventId, teamId: 'team1', teamPlayerId: 'tp1' })`.
  - Assert the request includes a `startDate` param (any ISO-ish string) alongside `pageNumber`, `pageSize`, `descending: false`, by inspecting the mock's call args.
  - Run `npm test -- FriendliesScreen` and confirm it fails (screen doesn't exist).
- [ ] 2.2 **Green** — Create `Mobile/src/screens/FriendliesScreen.tsx` per `design.md` §Decisions 2: `useState`/`useEffect` data-loading pattern, `Promise.all([api.get(...), fetchSportEventTypeMap()])`, filter with `isFriendlyOrTournamentEventType` (from task 1's module) against the resolved type name, sort ascending by `eveDateTime`, render `EventCard` in a `FlatList` with `RefreshControl`, four states with the `testID`s asserted in 2.1. Run `npm test -- FriendliesScreen` until all cases pass.
- [ ] 2.3 **Refactor (still green)** — Clean up: confirm no duplicated logic against `CalendarScreen.tsx` beyond what's structurally necessary (e.g., reuse `coachColors`, no new hex values); confirm the section title/empty-state copy matches `design.md` exactly (`'Amistosos y torneos'`, `'No hay amistosos ni torneos próximos'`).
- [ ] 2.4 **Verification** — Run `npm test -- FriendliesScreen` standalone once more after refactor; all four states + navigation + request-params assertions green, no skipped tests.

## 3. `FriendliesTab` in `RootNavigator.tsx` / `CalendarTabs`

- [ ] 3.1 **Red** — Extend `Mobile/src/navigation/__tests__/CalendarTabs.test.tsx` (existing file, following its existing `@react-navigation/bottom-tabs` mock pattern) with new assertions, added to the existing `describe('CalendarTabs', ...)` block:
  - `jest.mock('../../screens/FriendliesScreen', () => 'FriendliesScreen')` added alongside the existing screen mocks.
  - New test: `tab-screen-FriendliesTab` exists, `tab-label-FriendliesTab` renders `'Amistosos'`.
  - New test: `tab-icon-FriendliesTab` renders `'football-outline'`.
  - New test: `FriendliesTab` is registered before `NewsTab` and after `CalendarTab` — assert ordering via the rendered children order (e.g. querying `getAllByTestId(/^tab-screen-/)` and checking index positions), matching `design.md`'s placement decision.
  - Run `npm test -- CalendarTabs` and confirm the new assertions fail (tab doesn't exist yet).
- [ ] 3.2 **Green** — In `Mobile/src/navigation/RootNavigator.tsx`: import `FriendliesScreen` from `../screens/FriendliesScreen`; add the `Tab.Screen name="FriendliesTab"` block from `design.md` §Decisions 3 (`initialParams={{ teamId, teamPlayerId }}`, `tabBarLabel: 'Amistosos'`, `tabBarIcon` using `Ionicons name="football-outline"`) positioned between `CalendarTab` and `NewsTab`. Run `npm test -- CalendarTabs` until green.
- [ ] 3.3 **Verification** — Run `npm test -- CalendarTabs` alone once more; confirm the three pre-existing tests (`Estadísticas`/`Liga`/tab registration) still pass unmodified — a passing suite with only additive assertions confirms no regression to existing tab wiring.

## 4. Final verification

- [ ] 4.1 Run the full Mobile suite: `cd Mobile && npm test`. All suites pass, zero failures.
- [ ] 4.2 Grep the diff for skipped tests: confirm no `.skip(`, `xit(`, or `xdescribe(` was introduced in any file touched by this change (`sportEventTypeMatchers.test.ts`, `EventCard.test.tsx`, `FriendliesScreen.test.tsx`, `CalendarTabs.test.tsx`).
- [ ] 4.3 Coverage check on new/changed code per `frontend-testing.md` §4.6 target (≥75%): confirm `sportEventTypeMatchers.ts` (all 5 predicates), `FriendliesScreen.tsx` (all 4 states + navigation + request params), and the `EventCard.tsx`/`RootNavigator.tsx` diffs are exercised by the tests written in groups 1–3 — no untested branch introduced by this change.
- [ ] 4.4 Manual sanity pass on `EventCard.tsx`'s refactor: confirm the diff only replaces inline conditionals with the imported predicates, with no accidental reordering of the training/tournament/generic precedence documented in `design.md`.
