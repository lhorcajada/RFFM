# Tasks: Permitir editar un partido ya guardado

Strict TDD: Red → Green → Refactor per chunk.

## 1. Hook hydration + race safety (~1.5h)
- [ ] Read `hooks/useLiveMatch.ts` fully, especially `initMatch`, `restoreFromBackup`, and the
  `getMatchParticipation` mount effect.
- [ ] Write failing tests in `hooks/__tests__/useLiveMatch.enhancements.test.tsx` covering both
  fetch-resolution orderings described in design.md.
- [ ] Implement `parseJsonArray`, `hydrateFromSavedParticipation`, the `savedParticipationRef`,
  and wire both call sites (mount effect + `initMatch`) per design.md.
- [ ] `npm run test -- useLiveMatch.enhancements` green.

## 2. Component: seed minutes + fix isStarter on re-save (~1h)
- [ ] Write/extend failing tests asserting the manual-edit dialog shows persisted minutes after
  a simulated reload, and that re-saving sends the persisted `isStarter` per player.
- [ ] Implement the `manualMinuteOverrides` seeding effect and the `isStarter` lookup fix in
  `handleManualSave` per design.md.
- [ ] `npm run test -- src/apps/coach/pages/convocations` green (full directory, catch
  regressions).

## 3. Regression pass
- [ ] `npm run build` in `Front/`.
- [ ] `npm run test` for the whole `convocations` directory (and ideally the full suite if time
  allows) — no skipped tests, no failures.

## Done criteria
Reopening a page for an already-finished, already-saved match shows the same
"Edición manual del partido" flow as finishing it live in-session, pre-filled with the
persisted goals, cards, score and minutes; editing and re-saving works and preserves each
player's original `isStarter` flag.
