## 1. Persistence: `useEventFilters` hook (~1.5h)

- [ ] 1.1 (RED) Create `Mobile/src/screens/hooks/__tests__/useEventFilters.test.ts` (new `hooks/` folder alongside `CalendarScreen.tsx`, following the co-located-under-`__tests__` convention). Mock `expo-secure-store` (as `CalendarScreen.test.tsx` already does). Cases:
  - returns `{ eventTypeId: null, startDate: null, endDate: null }` and `isLoaded: true` when no value is stored.
  - loads and parses a previously stored JSON value on mount.
  - `saveFilters(partial)` merges into current filters and persists the merged JSON under the `event_filters` key via `SecureStore.setItemAsync`.
  - `clearFilters()` resets to the default (`null`/`null`/`null`) and calls `SecureStore.deleteItemAsync` (or writes the default back — pick one and assert it).
  - a failure reading from secure store (rejected promise) does not throw and resolves to the default filters with `isLoaded: true` (matches `secureStore.ts`'s existing defensive try/catch pattern).
- [ ] 1.2 (GREEN) Implement `Mobile/src/screens/hooks/useEventFilters.ts` per design.md Decision 2: wraps `expo-secure-store` under key `event_filters`, JSON-stringified `{ eventTypeId, startDate, endDate }`, exposes `{ filters, isLoaded, saveFilters, clearFilters }`.
- [ ] 1.3 (REFACTOR) Confirm the hook has no dependency on `CalendarScreen` or navigation (pure, reusable), matching the "one concern per file" convention.
- Verify: `cd Mobile && npx jest src/screens/hooks/__tests__/useEventFilters.test.ts` — all new tests pass.

## 2. UI: `EventFiltersModal` component (~2h)

- [ ] 2.1 Add dependency: `cd Mobile && npx expo install @react-native-community/datetimepicker`. Confirm `Mobile/package.json` gets the entry and lockfile updates; confirm no prebuild/config-plugin step is required (per design.md, confirmed Expo-Go-compatible in Expo v57 docs).
- [ ] 2.2 (RED) Create `Mobile/src/screens/components/__tests__/EventFiltersModal.test.tsx`. Mock `@react-native-community/datetimepicker` (native module — needs a jest mock rendering a simple stand-in, check if `jest-expo` preset already provides one; if not, add a manual mock under `Mobile/__mocks__/` or inline `jest.mock`). Cases:
  - not visible → `queryByTestId('event-filters-modal')` is `null`.
  - visible with `eventTypeOptions` → renders `filter-type-option-all` plus one `filter-type-option-{id}` per option, matching design.md's chip approach mirroring `EventCard.tsx`'s `typeChip` style.
  - tapping a type option marks it selected (visual state) without calling `onApply` yet (draft state, not applied until "Aplicar").
  - tapping `apply-filters-button` calls `onApply` with the currently-selected draft values (type + start + end dates).
  - tapping `clear-filters-button` calls `onClear` (and does not call `onApply`).
  - tapping the backdrop or `onRequestClose` calls `onClose` without calling `onApply` (mirrors `UserAvatarMenu`'s outside-tap-to-close, but here it discards draft edits — assert `onApply` was NOT called).
  - when `value` prop has non-null fields, the modal opens pre-populated with those as the draft (so re-opening after a previous Apply shows the current filters, not blank).
- [ ] 2.3 (GREEN) Implement `Mobile/src/screens/components/EventFiltersModal.tsx` per design.md Decision 1 (controlled component: `visible`, `value`, `eventTypeOptions`, `onApply`, `onClear`, `onClose` props) and Decision 4 (chip row for type) and Decision 3 (`@react-native-community/datetimepicker` for start/end date fields, testIDs `filter-start-date-input`/`filter-end-date-input`). Use RN core `Modal` + backdrop `Pressable`, `coachColors` theme tokens, `StyleSheet.create` — same conventions as `UserAvatarMenu.tsx`.
- [ ] 2.4 (REFACTOR) Confirm the component has no direct dependency on `expo-secure-store`/`useEventFilters` (pure presentational + draft state only), matching design.md's "container owns applied state, modal owns only draft" split.
- Verify: `cd Mobile && npx jest src/screens/components/__tests__/EventFiltersModal.test.tsx` — all new tests pass. `npx tsc --noEmit` — no new type errors.

## 3. Wire filters into `CalendarScreen` (~2h)

- [ ] 3.1 (RED) Extend `Mobile/src/screens/__tests__/CalendarScreen.test.tsx` (mock `useEventFilters` — either via `jest.mock('../hooks/useEventFilters')` or by keeping the real hook and mocking `expo-secure-store` as already done). Cases:
  - on mount, waits for `isLoaded` before calling `api.get('/api/sport-events/...')`, and the very first call already includes the persisted `startDate`/`endDate` (i.e. exactly one call to the events endpoint on initial mount — assert call count to guard against the double-fetch risk flagged in design.md).
  - when persisted filters include an `eventTypeId`, only matching events render as cards (client-side filter over the fetched `events`), even though the mocked API response includes events of other types too.
  - `open-filters-button` is present and opens `EventFiltersModal` (`event-filters-modal` becomes visible).
  - applying a new date range in the modal triggers a new `api.get` call with the new `startDate`/`endDate` params, and persists them (assert the mocked persistence write, e.g. `SecureStore.setItemAsync`, was called with the new values).
  - applying a new event type filter (no date change) does NOT trigger a new `api.get` call (type filtering is client-side only — assert call count unchanged) but does change which cards render.
  - `clear-filters-button` resets both the visible list (all events reappear) and re-fetches without `startDate`/`endDate` params.
  - zero events match the applied filters → `empty-message` renders with the same existing text (no error state).
  - switching `teamId` (route param change) keeps the currently applied filters (fetch call for the new team still includes the same `startDate`/`endDate`) — does not reset to unfiltered.
- [ ] 3.2 (GREEN) Update `Mobile/src/screens/CalendarScreen.tsx` per design.md Decision 5: consume `useEventFilters`, gate the fetch effect on `isLoaded`, add `startDate`/`endDate` to the `api.get` params, derive `visibleEvents` via client-side `eventTypeId` filter, swap the empty-state check to `visibleEvents.length === 0`, add the `open-filters-button` header control wiring to `EventFiltersModal`'s `onApply`/`onClear`/`onClose`.
- [ ] 3.3 (REFACTOR) Re-check the effect dependency array for correctness (`[teamId, isLoaded, filters.startDate, filters.endDate]` — NOT `filters.eventTypeId`, since that filter must not trigger a re-fetch). Extract any duplicated params-building logic if it grew unwieldy.
- Verify: `cd Mobile && npx jest src/screens/__tests__/CalendarScreen.test.tsx` — all tests (existing + new) pass.

## 4. Full verification (~0.5h)

- [ ] 4.1 `cd Mobile && npx jest` — full suite passes, no skipped tests, count increased from baseline (currently 101 per the last archived change's verification note — confirm current baseline before comparing).
- [ ] 4.2 `cd Mobile && npx tsc --noEmit` — no new errors outside `__tests__` (matches existing project tolerance for pre-existing `@types/jest` gaps in tests).
- [ ] 4.3 `git status` / `git diff --stat` — confirm only `Mobile/` files changed (`CalendarScreen.tsx` + test, new `EventFiltersModal.tsx` + test, new `useEventFilters.ts` + test, `Mobile/package.json`/lockfile for the new dependency) plus `openspec/changes/mobile-calendar-event-filters/`; no `Back/` or `Front/` files touched.
- [ ] 4.4 Manual sanity check (if a device/emulator is available): open Calendar, set a date range + type filter, background/reopen the app (or force-reload), confirm the filter is still applied; switch teams and confirm the filter persists but the list re-queries for the new team; clear filters and confirm the full list returns.

## 5. Post-implementation: date validation + non-blocking error handling (~1.5h) — DONE

- [x] 5.1 (RED→GREEN) `EventFiltersModal`: add `getDateRangeError(draft)`, inline `date-range-error` message, disable `apply-filters-button` while `endDate < startDate`. Tests cover: error shown/hidden as dates change, Apply disabled/blocked while invalid.
- [x] 5.2 (RED→GREEN) `useEventFilters`: `saveFilters`/`clearFilters` return `Promise<boolean>` reflecting persistence success/failure (previously swallowed silently). Tests cover both outcomes.
- [x] 5.3 New reusable toast infra: `Mobile/src/shared/components/Toast.tsx` + `Mobile/src/shared/context/ToastContext.tsx`, mounted in `Mobile/App.tsx`. `CalendarScreen`'s `handleApplyFilters`/`handleClearFilters` show a toast only when persistence fails (filter still applies in-memory). Events-endpoint failures keep the existing full-screen error + retry, unchanged.
- Verify: `cd Mobile && npx jest` — 21 suites / 135 tests, 100% pass (up from 19/121 after section 1-4). `npx tsc --noEmit` clean outside pre-existing `__tests__` gaps.
- Note: toast could not be visually verified on-device in this session (deferred by user); functional coverage is via Jest only.
