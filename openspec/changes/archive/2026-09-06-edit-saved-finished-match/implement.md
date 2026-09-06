# Implement: Permitir editar un partido ya guardado

Execute `tasks.md` in order, strict TDD, under
`Front/src/apps/coach/pages/convocations/`. No backend changes. Read `design.md` fully before
touching any file — it documents an exact race condition between two existing code paths
(`initMatch` and the `getMatchParticipation` mount effect in `hooks/useLiveMatch.ts`) that the
fix must handle in both orderings.

## Step-by-step

1. Read `hooks/useLiveMatch.ts` in full (it's ~1000+ lines; pay special attention to
   `initMatch` ~line 535, `restoreFromBackup` ~line 474, and the `getMatchParticipation` mount
   effect ~line 385-396 — line numbers are approximate, the file has changed since the last
   OpenSpec change touched it).
2. Write failing tests per design.md's "Tests" section in
   `hooks/__tests__/useLiveMatch.enhancements.test.tsx` — check how existing tests in that file
   mock `getMatchParticipation` (via `services/liveMatchService`) and control async timing
   (`act`, `waitFor`, fake timers if used elsewhere in the file) before writing new ones, to
   match the existing mocking convention exactly rather than inventing a new one.
3. Implement `parseJsonArray`, `hydrateFromSavedParticipation`, `savedParticipationRef`, and
   the two call-site changes exactly as designed. Do not change the hook's public
   `UseLiveMatchReturn` interface — this is purely internal hydration.
4. Run the hook tests, confirm green. Then run the *entire* existing
   `useLiveMatch.enhancements.test.tsx` and any other `useLiveMatch*.test.tsx` files to make
   sure nothing regressed (this hook has other passing tests for the live-match flow that must
   keep passing unchanged).
5. Read `components/PartidoEnDirectoTab.tsx` in full, focusing on `handleManualSave` and the
   `manualMinuteOverrides`/`effectiveMinutes` state.
6. Write failing tests (new file or extend an existing `PartidoEnDirectoTab.*.test.tsx` — check
   what test infrastructure/mocks already exist for this component before creating a new file)
   per design.md's component test bullet.
7. Implement the minute-seeding effect and the `isStarter` fix in `handleManualSave`.
8. Run `npm run test -- src/apps/coach/pages/convocations` — full directory green, zero
   skipped.
9. Run `npm run build` in `Front/` — must succeed.

## Verification commands (must all pass before reporting done)
```bash
cd Front
npm run test
npm run build
```

Do not commit or push — requires explicit user confirmation per `.claude/rules/git.md`.
