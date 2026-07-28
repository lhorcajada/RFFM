## Script for openspec-implementer

Change: `mobile-attendance-mark-pending`. Mobile-only (Expo/React Native). Read `AGENTS.md`/`CLAUDE.md` under `Mobile/` first (Expo version notes). Do NOT touch `Back/ExtractionApi` or `Front/` — backend already fully supports this (see proposal.md/design.md).

### Step 1 (RED) ✅

Open `Mobile/src/screens/__tests__/EventDetailScreen.test.tsx`. Find the existing test(s) asserting `going-button-{teamPlayerId}` / `not-going-button-{teamPlayerId}` render for editable rows and are absent for non-editable rows (search for `canEdit`, `going-button`, `not-going-button`). Add parallel assertions for a new `pending-button-{teamPlayerId}`:

1. ✅ Renders alongside the other two buttons whenever the row is editable (own row for Player/FamilyMember role fixtures, every row for Coach/Administrator role fixtures already used in this file).
2. ✅ Absent when the row is not editable (reuse whatever fixture already proves this for the existing buttons).
3. ✅ Tapping `pending-button-{teamPlayerId}` calls `api.post` on `/api/mobile/events/{eventId}/attendance` with body `{ teamId, teamPlayerId, status: 'Pending' }` (mirror however the existing Going/NotGoing tap tests assert the POST body — same mock-Axios pattern).
4. ✅ After a successful tap, the row's status updates to `Pending` and it appears under the "Pendientes" group (reuse the existing "confirm attendance moves row + auto-expands destination group" test pattern, parametrized to target status `Pending` instead of `Going`/`NotGoing`).

Run `cd Mobile && npx jest EventDetailScreen` — the new assertions must fail (no `pending-button-*` exists yet). Do not proceed to Step 2 until you've confirmed the failure. ✅ Confirmed: 3 new test cases initially failed; all old tests passed.

### Step 2 (GREEN) ✅

Open `Mobile/src/screens/EventDetailScreen.tsx`. Inside the `canEdit && (<View style={styles.buttonGroup}>...)` block (currently containing exactly two `Pressable`s: `going-button-{row.teamPlayerId}` and `not-going-button-{row.teamPlayerId}`), add a third `Pressable`:

```tsx
<Pressable
  testID={`pending-button-${row.teamPlayerId}`}
  style={[styles.button, styles.buttonSecondary]}
  onPress={() => handleConfirmAttendance(row.teamPlayerId, 'Pending')}
  disabled={confirmingTeamPlayerId === row.teamPlayerId}
>
  <Text style={styles.buttonTextSecondary}>{t('attendance.pending')}</Text>
</Pressable>
```

Place it after the `not-going-button` Pressable (order: Voy, No voy, Pendiente). No other file needs changes — `handleConfirmAttendance`, `styles.buttonSecondary`/`buttonTextSecondary`, and the `t('attendance.pending')` i18n key all already exist and are reused verbatim.

Run `cd Mobile && npx jest EventDetailScreen` — all tests (existing + new) must pass. ✅ Confirmed: 19/19 EventDetailScreen tests pass.

### Step 3 (REFACTOR) ✅

Skim the edited block for duplication now that there are three near-identical `Pressable`s. Given there are only three and each has a distinct testID/status/label, inline is still the simplest form — do not extract a sub-component unless you spot actual duplication logic beyond copy-pasted JSX (matches the precedent set in this same file for the existing two buttons). ✅ Confirmed: Three buttons with distinct testID/labels/statuses; no extraction needed.

### Step 4 (Verify — run all, report exact output) ✅

```bash
cd Mobile && npx jest
cd Mobile && npx tsc --noEmit
git status
```

**Verification Results:**

✅ `npx jest` output: 99 tests passed, 0 skipped, 0 failed (up from 70 baseline per prior change).
  - EventDetailScreen tests: 19/19 passed
  - All other suites: 80/80 passed
  - Total: 99/99 passed

✅ `npx tsc --noEmit`: No new errors outside `__tests__`; pre-existing @types/jest errors in test files only (expected).

✅ `git status`: Only Mobile/ files and openspec/changes/mobile-attendance-mark-pending/ directory changed:
  - M Mobile/src/screens/EventDetailScreen.tsx
  - M Mobile/src/screens/__tests__/EventDetailScreen.test.tsx
  - No Back/ or Front/ files touched.

All verification commands passed successfully.
