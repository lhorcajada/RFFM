# Tasks: Editar goles, goleadores y tarjetas de un partido finalizado

Strict TDD: Red (failing test) → Green (minimal code) → Refactor, per chunk.

## 1. Hook: `useLiveMatch` — minute/half overrides + update functions (~1.5h)
- [ ] Write failing tests in `hooks/__tests__/useLiveMatch.enhancements.test.tsx` for:
  explicit `minute` on `addGoal`, explicit `minute`/`half` on `addCard`, `updateGoal`
  recomputing `scoreAtMoment`/totals, `updateCard` patching fields.
- [ ] Implement `updateGoal`, `updateCard`, and optional trailing params on `addGoal`/`addCard`
  in `hooks/useLiveMatch.ts`; export both from the hook's return type/object.
- [ ] `npm run test -- useLiveMatch` green.

## 2. Extract `GoalEventDialog` from `LiveMatchScoreboard` (~2h)
- [ ] Write failing tests in `components/simulation/__tests__/GoalEventDialog.test.tsx`:
  scorer selection submits payload, "own goal" quick action, rival + dorsal, `initialValue`
  pre-fills fields for edit mode.
- [ ] Create `GoalEventDialog.tsx` + `.module.css` per design §2; move the dialog JSX/state out
  of `LiveMatchScoreboard.tsx`, keep `openGoalDialog`/`pendingIsOwn` there, render the new
  component.
- [ ] Verify no regression: `npm run test -- LiveMatchScoreboard` (or equivalent existing
  scoreboard tests) still green.

## 3. `CardEventDialog` — `initialValue` support (~0.5h)
- [ ] Extend `components/simulation/__tests__/CardEventDialog.test.tsx`: pre-fills
  player/rival/cardType from `initialValue`.
- [ ] Add the prop and seeding logic.

## 4. `LiveMatchManualEditDialog` — goals & cards sections (~2h)
- [ ] Write failing tests in
  `components/__tests__/LiveMatchManualEditDialog.goalsAndCards.test.tsx`: renders existing
  goals/cards lists; "Añadir gol"/"Añadir tarjeta" open the respective dialog in add mode and
  call `onAddGoal`/`onAddCard` with the entered minute; clicking "Editar" on an item opens the
  dialog pre-filled and calls `onUpdateGoal`/`onUpdateCard`; "Eliminar" calls
  `onRemoveGoal`/`onRemoveCard`; invalid minute (out of 0-200 or non-numeric) shows the
  existing error `Alert` and does not call the callback.
- [ ] Implement the sections and prop changes per design §4 (rename `onSave` →
  `onSaveMinutes`, add `goals`/`cards`/`onAddGoal`/`onUpdateGoal`/`onRemoveGoal`/`onAddCard`/
  `onUpdateCard`/`onRemoveCard`).
- [ ] Add styles to `.module.css`.

## 5. Wire up `PartidoEnDirectoTab.tsx` (~1h)
- [ ] Update the `<LiveMatchManualEditDialog>` call site with the new props per design §5.
- [ ] Fix/extend any existing test in this directory that references the old `onSave` prop or
  mounts the dialog directly.
- [ ] `npm run build` passes; `npm run test` passes for the whole `convocations` directory.

## 6. Manual verification (dev server)
- [ ] Run `npm run dev`, simulate a match to `finished`, open "Edición manual del partido",
  add/edit/remove a goal and a card, save, confirm the "Partido guardado" summary
  (`GoalTimeline`/`CardsTimeline`) reflects the changes after reload of
  `getMatchParticipation`.

## Done criteria
- All new/updated tests green, `npm run build` green, no regression in existing
  `convocations`/`simulation` test suites, coverage on modified files ≥75%.
