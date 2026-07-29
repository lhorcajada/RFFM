# Implement: mobile-calendar-event-filters

Self-contained technical script for implementing this change under `Mobile/` only. Follows strict TDD (Red -> Green -> Refactor). Do not touch `Back/` or `Front/`.

## Approved decisions (already confirmed by user — do not re-ask)

1. Persistence reuses `expo-secure-store` (no `AsyncStorage`), new dedicated key `event_filters`, same defensive try/catch pattern as `Mobile/src/auth/secureStore.ts`.
2. New dependency `@react-native-community/datetimepicker`, installed via `npx expo install @react-native-community/datetimepicker` (not plain `npm install`), for the start/end date pickers.

## Baseline (verified before implementation)

- `Mobile/src/screens/CalendarScreen.tsx`: fetch effect keyed on `[teamId]`; calls `api.get('/api/sport-events/{teamId}', { params: { pageNumber: 1, pageSize: 50, descending: false } })` and `fetchSportEventTypeMap()` in parallel; renders loading / error / empty (`empty-message`, text `'No hay eventos programados'`) / list states; each branch repeats a `<Text style={styles.sectionTitle}>Eventos</Text>` header.
- `Mobile/src/auth/secureStore.ts`: `TOKEN_KEY` pattern — `getItemAsync` wrapped in try/catch returning a safe default, `setItemAsync`/`deleteItemAsync` unwrapped.
- `Mobile/src/navigation/UserAvatarMenu.tsx`: only existing overlay pattern — RN core `Modal` (`transparent`, `onRequestClose`) + full-screen backdrop `Pressable` for outside-tap-to-close, `Animated` for transitions, `coachColors` theme tokens, `StyleSheet.create`.
- `Mobile/src/screens/components/EventCard.tsx`: has a `typeChip` style to mirror visually for the type-filter chips.
- `Mobile/src/api/sportEventTypes.ts`: `fetchSportEventTypeMap()` returns `Record<number, string>`.
- Jest baseline: 17 suites / 101 tests passing (`cd Mobile && npx jest`). `jest.setup.js` mocks `@expo/vector-icons`. `jest.config.js` uses `jest-expo` preset, `testMatch` covers `src/**/__tests__/**/*.test.{ts,tsx}`.
- Existing `Mobile/src/screens/__tests__/CalendarScreen.test.tsx` already has `jest.mock('expo-secure-store')` (auto-mock, all functions become `jest.fn()` returning `undefined`) — harmless today, becomes load-bearing once `useEventFilters` is wired in. `await SecureStore.getItemAsync(...)` on an automocked `undefined` return resolves fine (`await undefined` is valid).
- Existing test `'requests events and event types for the teamId coming from route params'` asserts `api.get` called with `params: { pageNumber: 1, pageSize: 50, descending: false }` exactly — Jest's `toHaveBeenCalledWith`/`toEqual` ignore object keys whose value is `undefined`, so adding `startDate: undefined, endDate: undefined` to the params object when no filter is set does NOT break this test. No need to touch this assertion.

## Step 1 — Persistence: `useEventFilters` hook

### 1.1 RED — `Mobile/src/screens/hooks/__tests__/useEventFilters.test.ts` (new `hooks/` folder)

Mock `expo-secure-store` exactly like `CalendarScreen.test.tsx` does (`jest.mock('expo-secure-store')`), then override per-test with `(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(...)` etc. Cases:

- No stored value (`getItemAsync` resolves `null`/`undefined`) -> after awaiting effects, `filters` is `{ eventTypeId: null, startDate: null, endDate: null }` and `isLoaded` is `true`.
- Stored JSON value (`getItemAsync` resolves a JSON string) -> `filters` reflects the parsed value once loaded.
- `saveFilters(partial)` merges `partial` into current `filters` and calls `SecureStore.setItemAsync('event_filters', JSON.stringify(merged))` with the merged object.
- `clearFilters()` resets `filters` to the default object and calls `SecureStore.deleteItemAsync('event_filters')`.
- `getItemAsync` rejecting does not throw out of the hook; `filters` stays at the default and `isLoaded` becomes `true`.

Use `renderHook` from `@testing-library/react-native` (already a devDependency) and `act`/`waitFor` to flush the initial load effect.

### 1.2 GREEN — `Mobile/src/screens/hooks/useEventFilters.ts`

```ts
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const FILTERS_KEY = 'event_filters';

export interface EventFilters {
  eventTypeId: number | null;
  startDate: string | null;
  endDate: string | null;
}

const DEFAULT_FILTERS: EventFilters = { eventTypeId: null, startDate: null, endDate: null };

export const useEventFilters = () => {
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(FILTERS_KEY);
        if (mounted && stored) {
          setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(stored) });
        }
      } catch (error) {
        console.error('Error retrieving event filters from secure store:', error);
      } finally {
        if (mounted) setIsLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const saveFilters = async (partial: Partial<EventFilters>) => {
    const merged = { ...filters, ...partial };
    setFilters(merged);
    try {
      await SecureStore.setItemAsync(FILTERS_KEY, JSON.stringify(merged));
    } catch (error) {
      console.error('Error saving event filters to secure store:', error);
    }
  };

  const clearFilters = async () => {
    setFilters(DEFAULT_FILTERS);
    try {
      await SecureStore.deleteItemAsync(FILTERS_KEY);
    } catch (error) {
      console.error('Error clearing event filters from secure store:', error);
    }
  };

  return { filters, isLoaded, saveFilters, clearFilters };
};
```

Note: `saveFilters`/`clearFilters` close over `filters` from the latest render (not wrapped in `useCallback`) — acceptable since this hook has a single consumer (`CalendarScreen`) and is re-created each render like any other inline handler in this codebase.

### 1.3 REFACTOR

Confirm the hook imports nothing from `CalendarScreen`/navigation — pure and reusable. No further extraction needed at this size.

**Verify**: `cd Mobile && npx jest src/screens/hooks/__tests__/useEventFilters.test.ts`

## Step 2 — UI: `EventFiltersModal` component

### 2.1 Add dependency

```
cd Mobile && npx expo install @react-native-community/datetimepicker
```

Confirm `Mobile/package.json` gained the entry (Expo resolves the SDK54/v57-compatible version) and the lockfile updated. No config-plugin/prebuild step needed (Expo Go compatible).

### 2.2 RED — `Mobile/src/screens/components/__tests__/EventFiltersModal.test.tsx`

At the top of the test file, mock the native date picker so it renders as an inert stand-in under test:

```ts
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, { testID: 'mock-date-time-picker', ...props }),
  };
});
```

Cases (props: `visible`, `value: { eventTypeId, startDate, endDate }`, `eventTypeOptions: { id: number; name: string }[]`, `onApply`, `onClear`, `onClose`):

- `visible={false}` -> `queryByTestId('event-filters-modal')` is `null`.
- `visible={true}` with `eventTypeOptions=[{id:1,name:'Entrenamiento'},{id:2,name:'Partido'}]` -> renders `filter-type-option-all` plus `filter-type-option-1` and `filter-type-option-2`.
- Tapping `filter-type-option-2` marks it selected (e.g. assert a visual/selected prop or just that a subsequent Apply reflects it — do not assert `onApply` was called on tap alone).
- Tapping `apply-filters-button` after selecting a type calls `onApply` with `{ eventTypeId: 2, startDate: <draft>, endDate: <draft> }` reflecting the current draft.
- Tapping `clear-filters-button` calls `onClear` and does not call `onApply`.
- Tapping the backdrop (or firing `onRequestClose`) calls `onClose` and does NOT call `onApply` (discards draft edits).
- When `value` has non-null fields (e.g. `{ eventTypeId: 2, startDate: '2026-08-01T00:00:00.000Z', endDate: null }`), the modal opens with `filter-type-option-2` already selected as the draft (re-opening after a previous Apply shows current filters, not blank).

### 2.3 GREEN — `Mobile/src/screens/components/EventFiltersModal.tsx`

Controlled component per design.md Decision 1 (screen owns applied state, modal owns only draft state before Apply):

```ts
export interface EventFiltersValue {
  eventTypeId: number | null;
  startDate: string | null;
  endDate: string | null;
}

interface Props {
  visible: boolean;
  value: EventFiltersValue;
  eventTypeOptions: { id: number; name: string }[];
  onApply: (value: EventFiltersValue) => void;
  onClear: () => void;
  onClose: () => void;
}
```

- Local draft state (`useState<EventFiltersValue>(value)`), reset from `value` via `useEffect` keyed on `visible` transitioning to `true` (so re-opening shows current applied filters, not stale draft).
- Type chips: `Object.values`-style row built from `eventTypeOptions` plus a leading "Todos" chip (`filter-type-option-all`, sets draft `eventTypeId: null`). Each option chip `testID={\`filter-type-option-${id}\`}`, tapping sets draft `eventTypeId`. Style mirrors `EventCard.tsx`'s `typeChip` (rounded pill), using `coachColors` tokens, with a selected/unselected visual state (e.g. background color swap) via `StyleSheet.create`.
- Date fields: two `Pressable`s (`filter-start-date-input`, `filter-end-date-input`) showing the current draft date (formatted `es-ES` or a placeholder "Seleccionar fecha"); tapping toggles a local `showStartPicker`/`showEndPicker` boolean that conditionally renders `<DateTimePicker mode="date" value={...} onChange={...} />` from `@react-native-community/datetimepicker`, updating the draft's `startDate`/`endDate` as an ISO string (`date.toISOString()`) in the `onChange` handler and closing the picker.
- `apply-filters-button` `Pressable` calls `onApply(draft)`.
- `clear-filters-button` `Pressable` calls `onClear()` (does not call `onApply`).
- Root: RN core `Modal` (`transparent`, `visible={visible}`, `onRequestClose={onClose}`) wrapping a full-screen backdrop `Pressable` (`onPress={onClose}`) containing a `Pressable` (or `View` with `onStartShouldSetResponder` stub, or simplest: wrap content in a `Pressable` with `onPress={(e) => e.stopPropagation()}` — match whatever `UserAvatarMenu.tsx` needs; that file relies on the backdrop covering the full screen and the menu sitting inside it without its own stopPropagation, since the menu doesn't fill the screen) holding the content, `testID="event-filters-modal"` on the content container so it only exists in the tree while `visible`.
- `StyleSheet.create`, `coachColors` tokens — no inline styles beyond one-off `sx`-equivalents (this is RN, not MUI, so plain `style` props are fine per `Mobile/` conventions already seen in `EventCard.tsx`/`UserAvatarMenu.tsx`).

### 2.4 REFACTOR

Confirm the component never imports `expo-secure-store` or `useEventFilters` directly — pure presentational + draft state only.

**Verify**: `cd Mobile && npx jest src/screens/components/__tests__/EventFiltersModal.test.tsx && npx tsc --noEmit`

## Step 3 — Wire filters into `CalendarScreen`

### 3.1 RED — extend `Mobile/src/screens/__tests__/CalendarScreen.test.tsx`

Keep the existing `jest.mock('expo-secure-store')` (auto-mock) — do NOT replace it with a `jest.mock('../hooks/useEventFilters')` unless a specific test needs to force a particular persisted value, in which case override the relevant `SecureStore.getItemAsync` mock return for that one test via `(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(...)` (import `* as SecureStore from 'expo-secure-store'` at the top of the test file). Add cases:

- On mount with no persisted filters, exactly one call to `/api/sport-events/team1` happens (guards the double-fetch risk from design.md) and it matches the existing assertion (params without `startDate`/`endDate` — verified they're `undefined`, ignored by `toEqual`).
- With `SecureStore.getItemAsync` resolving a JSON string containing `eventTypeId: 1`, and the mocked events response containing events of type 1 and type 2, only the type-1 event renders as a card (client-side filter), and the api call still doesn't need `eventTypeId` as a query param.
- `open-filters-button` exists in the header row and pressing it makes `event-filters-modal` visible.
- Pressing `apply-filters-button` inside the opened modal after picking a new date range triggers a **new** `api.get('/api/sport-events/team1', ...)` call including the new `startDate`/`endDate`, and calls `SecureStore.setItemAsync` with the new persisted values.
- Applying only a new event-type selection (no date change) does NOT add a new `api.get` call to the events endpoint (assert call count for that URL unchanged) but does change which cards render.
- Pressing `clear-filters-button` resets the visible list to all events and re-fetches without `startDate`/`endDate`.
- Zero events match applied filters -> `empty-message` renders with unchanged text (no error path).
- Changing `teamId` (re-render with new route params) keeps currently applied filters (the new team's fetch call still includes the same `startDate`/`endDate`).

### 3.2 GREEN — update `Mobile/src/screens/CalendarScreen.tsx`

- Import `useEventFilters` from `./hooks/useEventFilters` and `EventFiltersModal`, `EventFiltersValue` from `./components/EventFiltersModal`.
- `const { filters, isLoaded, saveFilters, clearFilters } = useEventFilters();`
- `const [filtersModalVisible, setFiltersModalVisible] = useState(false);`
- Fetch effect: `useEffect(() => { if (!isLoaded) return; fetchEvents(); }, [teamId, isLoaded, filters.startDate, filters.endDate]);` — deliberately excludes `filters.eventTypeId`.
- `fetchEvents` params: `{ pageNumber: 1, pageSize: 50, descending: false, startDate: filters.startDate ?? undefined, endDate: filters.endDate ?? undefined }`.
- `const eventTypeOptions = Object.entries(eventTypeMap).map(([id, name]) => ({ id: Number(id), name }));` (build once eventTypeMap is loaded; fine if empty on first render).
- `const visibleEvents = filters.eventTypeId == null ? events : events.filter((e) => e.eventTypeId === filters.eventTypeId);`
- Replace the `events.length === 0` empty-state check with `visibleEvents.length === 0`, and `data={events}` in the `FlatList` with `data={visibleEvents}`.
- Extract the repeated `<Text style={styles.sectionTitle}>Eventos</Text>` header into a shared header row (e.g. a small local `renderHeader()` function or a `<View style={styles.headerRow}>` used in all four branches) that also renders the `open-filters-button` `Pressable` (icon or text, e.g. reuse `Ionicons` "filter" or a simple text button consistent with the rest of the screen's plain-`Pressable` style — check `jest.setup.js`'s `Ionicons` mock already covers this import if used) calling `setFiltersModalVisible(true)`.
- Render `<EventFiltersModal visible={filtersModalVisible} value={filters} eventTypeOptions={eventTypeOptions} onApply={handleApplyFilters} onClear={handleClearFilters} onClose={() => setFiltersModalVisible(false)} />` once, outside the conditional branches (or inside each, but simplest is once at the top level alongside whichever branch renders, since `Modal` portals its content regardless of parent layout).
- `handleApplyFilters = async (value: EventFiltersValue) => { await saveFilters(value); setFiltersModalVisible(false); };`
- `handleClearFilters = async () => { await clearFilters(); setFiltersModalVisible(false); };`

### 3.3 REFACTOR

Re-check the fetch effect's dependency array is exactly `[teamId, isLoaded, filters.startDate, filters.endDate]` (no `filters.eventTypeId`, no missing deps lint surprises — this file doesn't appear to run `eslint-plugin-react-hooks` as a hard gate today, so an intentional omission is fine, but leave a one-line comment explaining the exclusion is deliberate, matching the "one thing per file, explicit intent" convention). Extract the params-building line only if it grows unwieldy (unlikely at this size).

**Verify**: `cd Mobile && npx jest src/screens/__tests__/CalendarScreen.test.tsx`

## Step 4 — Full verification

1. `cd Mobile && npx jest` — full suite passes, 0 skipped, count > 101 (new baseline).
2. `cd Mobile && npx tsc --noEmit` — no new type errors.
3. `git status` / `git diff --stat` — confirm only `Mobile/` files + `openspec/changes/mobile-calendar-event-filters/` changed; nothing under `Back/` or `Front/`.
4. Report: files created/modified, final test count, and any deviation from `design.md`/`tasks.md` with rationale (e.g. if `renderHook` isn't available in this RTL version, or if `Modal` backdrop tap-target needed a different structure than `UserAvatarMenu.tsx`'s).

## Step 5 — Post-implementation: date validation + non-blocking error handling (done)

Added after the Step 1-4 pass at the user's explicit request:

- `EventFiltersModal.tsx`: `getDateRangeError(draft)` returns an error string when both dates are set and `endDate < startDate`; rendered inline (`testID="date-range-error"`) next to the date fields, recomputed on every draft change; `apply-filters-button` gets `disabled={!!getDateRangeError(draft)}` plus a guard at the top of `handleApply` (belt-and-suspenders against any way the disabled prop could be bypassed) and a reduced-opacity style while disabled.
- `useEventFilters.ts`: `saveFilters`/`clearFilters` changed from `Promise<void>` to `Promise<boolean>` — `true` on successful `SecureStore` write/delete, `false` if the try/catch caught an error (previously only `console.error`-logged and swallowed).
- New `Mobile/src/shared/components/Toast.tsx` (presentational: `message`, `variant: 'error' | 'success' | 'info'`, `coachColors` tokens) and `Mobile/src/shared/context/ToastContext.tsx` (`ToastProvider`, `useToast()` returning `showToast(message, variant)`, auto-dismiss after 3s via `setTimeout`).
- `Mobile/App.tsx`: mount `<ToastProvider>` once at the root, inside `SafeAreaProvider`, wrapping `AuthProvider` — available to every screen via `useToast()`.
- `CalendarScreen.tsx`: `handleApplyFilters`/`handleClearFilters` now `await saveFilters(...)`/`await clearFilters()` and call `showToast('No se pudieron guardar los filtros. Se aplicarán solo en esta sesión.', 'error')` when the result is `false`. The filter is applied to the in-memory `filters` state regardless (already the case, since `useEventFilters` updates local state before attempting persistence) — only the "survives app restart" guarantee is lost, hence a toast (transient, non-blocking) rather than blocking the UI.
- Deliberately did not touch the events-fetch error path (`error-message` + `retry-button`) — that's a different failure mode (the whole list failed to load) already handled correctly; adding a toast there would double-notify.
- Deliberately did not wire `ToastProvider`/`useToast()` into other screens (`LoginScreen`, `TeamSwitcherScreen`) in this pass — scoped to this feature plus the reusable infra. Flagged to the user as a possible follow-up for a consistent house style.

**Verify**: `cd Mobile && npx jest` → 21 suites / 135 tests, 100% pass. `npx tsc --noEmit` clean outside pre-existing `__tests__` gaps.

## Constraints (non-negotiable)

- No changes under `Back/` or `Front/`.
- No i18n keys — hardcoded Spanish strings, matching `CalendarScreen.tsx`'s existing convention.
- No new backend query param — `eventTypeId` never goes over the network.
- CSS/styling: RN `StyleSheet.create`, no CSS Modules (that's a `Front/`-only convention).
- TDD strictly: a failing test must exist before its implementation is written, for every unit above.
