# Implement: Editar goles, goleadores y tarjetas de un partido finalizado

Execute `tasks.md` in order, strict TDD (Red → Green → Refactor) per `.claude/rules/frontend-testing.md`
and `.claude/rules/react.md`. All work is under
`Front/src/apps/coach/pages/convocations/`. No backend changes.

Read `design.md` for exact prop shapes before writing any code. Read the current content of
every file listed in design.md's "Files touched summary" before editing it — do not guess at
existing code shape.

## Step-by-step

1. **Hook first** (`hooks/useLiveMatch.ts`):
   - Read the full file, especially the `addGoal`/`removeGoal`/`addCard`/`removeCard`
     implementations (~lines 714-800) and the returned object / `UseLiveMatchResult` interface.
   - Write failing tests in `hooks/__tests__/useLiveMatch.enhancements.test.tsx` (read the
     existing file first to match its render/setup pattern) for the new behavior described in
     design.md §1. Run `npm run test -- useLiveMatch.enhancements` and confirm they fail.
   - Implement `updateGoal`/`updateCard` and the optional trailing `minute`/`half` params.
     Reuse the same score-recompute loop pattern already in `removeGoal` for `updateGoal`.
   - Run the tests again, confirm green.

2. **Extract `GoalEventDialog`**:
   - Read `LiveMatchScoreboard.tsx` fully first.
   - Write failing tests for the new `GoalEventDialog.tsx` (design §2) in a new
     `components/simulation/__tests__/GoalEventDialog.test.tsx`, modeled after the existing
     `CardEventDialog` tests if any exist (check
     `components/simulation/__tests__/CardEventDialog.test.tsx`) for setup conventions
     (MemoryRouter not needed for a plain dialog — check what the sibling test does).
   - Create `GoalEventDialog.tsx` + `.module.css`, move state/JSX out of
     `LiveMatchScoreboard.tsx`, wire `handleGoalSubmit` to keep existing `onAddGoal` behavior
     unchanged for the live-match flow (no minute override there).
   - Run the new tests + any existing scoreboard-related tests; confirm all green.

3. **`CardEventDialog` `initialValue`**:
   - Extend its test file with the pre-fill cases from design §3, confirm failing, implement,
     confirm green.

4. **`LiveMatchManualEditDialog` goals & cards sections**:
   - Read the full current file (already shown in this conversation, but re-read to catch any
     drift) and `GoalTimeline.tsx`/`CardsTimeline.tsx` for the read-only rendering pattern to
     mirror visually (dark theme colors: `#19192e` background, `#fb923c` accent, matches the
     rest of this dialog).
   - Write failing tests in
     `components/__tests__/LiveMatchManualEditDialog.goalsAndCards.test.tsx` per tasks.md §4.
   - Implement per design §4: rename `onSave`→`onSaveMinutes`, add the goals/cards props, the
     `SquadPlayer[]`→`SimSlotPlayer[]` adapter, the list UI with edit/delete icon buttons, the
     "Añadir gol"/"Añadir tarjeta" buttons opening `GoalEventDialog`/`CardEventDialog` (with
     `initialValue` when editing), and the minute `TextField` per entry action with the
     existing 0-200 validation pattern reusing the `error` `Alert`.
   - Run the tests, confirm green.

5. **Wire `PartidoEnDirectoTab.tsx`**:
   - Read the current call site (already shown above, but re-read for drift) and update props
     per design §5.
   - Search the repo for any other usage of `LiveMatchManualEditDialog`'s `onSave` prop name
     (`grep -r "LiveMatchManualEditDialog" Front/src`) and update every call site/test.
   - Run `npm run build` and the full `convocations` test directory
     (`npm run test -- src/apps/coach/pages/convocations`), confirm all green.

6. **Coverage check**: for each modified/new file, mentally verify the ≥75% target from
   `CLAUDE.md`/`frontend-testing.md` is plausible (happy path + at least one edge case per new
   branch: own goal vs rival goal vs scorer goal, yellow vs red card, edit vs add, invalid
   minute).

## Verification commands (must all pass before reporting done)
```bash
cd Front
npm run test
npm run build
```

Do not commit or push — per `.claude/rules/git.md` this requires explicit user confirmation,
which will be requested separately after this implementation is verified.
