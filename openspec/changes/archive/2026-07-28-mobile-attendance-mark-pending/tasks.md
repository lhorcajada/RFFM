## 1. Mobile: add "Pendiente" button to roster cards

- [x] 1.1 (RED) Extend `Mobile/src/screens/__tests__/EventDetailScreen.test.tsx`: Added 3 new test cases for pending button behavior (render when editable, absent when not, POST to API, row moves to Pending group). Tests initially failed as expected (RED phase).
- [x] 1.2 (GREEN) `Mobile/src/screens/EventDetailScreen.tsx`: Added third Pressable with testID=`pending-button-{teamPlayerId}`, buttonSecondary style, t('attendance.pending') label, calling handleConfirmAttendance with 'Pending' status. All 19 EventDetailScreen tests now pass.
- [x] 1.3 (REFACTOR) Confirmed three Pressable buttons have minimal duplication (each with distinct testID/label/status); no component extraction needed — pattern consistent with existing two buttons.

## 2. Verification

- [x] 2.1 `cd Mobile && npx jest` — 99 tests pass (up from 70 baseline), no skipped tests, 0 failures.
- [x] 2.2 `cd Mobile && npx tsc --noEmit` — no new errors in non-test code; pre-existing @types/jest gaps in __tests__ only.
- [x] 2.3 `git status` — only Mobile/src/screens/EventDetailScreen.tsx, Mobile/src/screens/__tests__/EventDetailScreen.test.tsx, and openspec/changes/mobile-attendance-mark-pending/ modified; no Back/ or Front/ files touched.

## 3. Follow-up: uniform button styling with a selected/pressed state

- User feedback: the three buttons looked visually inconsistent (Going was always filled/primary regardless of status) and there was no visual indicator of which status was currently active.
- [x] 3.1 (RED) `EventDetailScreen.test.tsx`: added two tests — one asserting NotGoing/Pending render identically and differently from Going when status is `Going` (using `StyleSheet.flatten` on `.props.style`), one asserting the Pending button is the one styled as selected (not Going) when status is `Pending`. First test passed by coincidence (Going was hardcoded filled); second test failed as expected, proving the selection wasn't actually dynamic.
- [x] 3.2 (GREEN) `EventDetailScreen.tsx`: replaced the static `buttonPrimary`/`buttonSecondary` split with a single `buttonSecondary` (unselected, outline) base applied to all three buttons, plus a new `buttonSelected` (filled, `coachColors.secondary`) applied only to whichever button's status matches `row.status`. Same pattern for text color (`buttonTextSecondary` vs new `buttonTextSelected`). Removed now-unused `buttonPrimary`/`buttonText` styles.
- [x] 3.3 (REFACTOR) No extraction needed — three conditional expressions inline, consistent with the file's existing style.
- [x] 3.4 Verification: `npx jest` → 101/101 pass (Mobile full suite); `npx tsc --noEmit` → no new errors outside `__tests__`; `git status` → only `Mobile/src/screens/EventDetailScreen.tsx` and its test file changed.
