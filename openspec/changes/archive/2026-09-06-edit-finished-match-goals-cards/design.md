# Design: Editar goles, goleadores y tarjetas de un partido finalizado

All paths under `Front/src/apps/coach/pages/convocations/`.

## 1. `hooks/useLiveMatch.ts` — hook changes

- `addGoal(scorerId, scorerName, scorerDorsal, isOwnTeam, pitchZone?, bodyPart?, minute?)`:
  add trailing optional `minute?: number`. When provided, use it instead of
  `currentMinuteRef.current`. Keeps live-match call sites unchanged (they omit it).
- `addCard(teamPlayerId, playerName, isRivalPlayer, rivalDorsal, cardType, minute?, half?)`:
  same idea — optional trailing `minute?`/`half?` override `currentMinuteRef.current`/
  `halfRef.current` when provided.
- New `updateGoal(goalId: string, patch: Partial<Omit<GoalEvent, "id">>)`:
  replaces the matching goal's fields, then recomputes `scoreAtMoment` for *all* goals (same
  recompute loop already used in `removeGoal`) and recomputes `scoreLocal`/`scoreVisitor`
  totals, since editing `isOwnTeam` on a goal changes which side it counts for.
- New `updateCard(cardId: string, patch: Partial<Omit<CardEvent, "id">>)`:
  replaces the matching card's fields in place — no score side effects.
- Export `updateGoal`, `updateCard` from the hook's returned object and its `UseLiveMatchResult`
  interface (near the existing `addGoal`/`removeGoal`/`addCard`/`removeCard` entries).

## 2. `components/simulation/GoalEventDialog.tsx` (new) + `.module.css` (new)

Extracted from the inline dialog currently in `LiveMatchScoreboard.tsx` (lines ~66-130, the
`dialogOpen`/`pendingIsOwn`/`selectedScorer`/`rivalDorsal`/`pitchZone`/`bodyPart` state and the
`<Dialog>` JSX), mirroring `CardEventDialog`'s shape:

```ts
export interface GoalEventSubmitPayload {
  scorerId: string | null;
  scorerName: string | null;
  scorerDorsal: number | null;
  isOwnTeam: boolean;
  pitchZone: { col: number; row: number } | null;
  bodyPart: "head" | "foot" | null;
}

interface GoalEventDialogProps {
  open: boolean;
  players: SimSlotPlayer[];
  /** Which side this dialog is registering a goal for; drives "own goal" vs rival-scorer copy */
  isOwnTeam: boolean;
  onClose: () => void;
  onSubmit: (payload: GoalEventSubmitPayload) => void;
  /** Pre-filled values when editing an existing goal; omitted when adding a new one */
  initialValue?: GoalEventSubmitPayload;
}
```

`LiveMatchScoreboard` keeps `openGoalDialog(isOwnTeam)` / `dialogOpen` / `pendingIsOwn` state,
but renders `<GoalEventDialog>` instead of inline JSX, passing `onSubmit={handleGoalSubmit}`
where `handleGoalSubmit` calls `onAddGoal(...)` exactly as today (no minute override — live
flow keeps using "now").

## 3. `components/simulation/CardEventDialog.tsx` — minor extension

Add optional `initialValue?: CardEventSubmitPayload` prop so the same dialog can be opened
pre-filled for editing. When present, seed `selectedPlayer`/`isRival`/`rivalDorsal`/`cardType`
state from it (via `useState` initializer keyed off `open` transitioning true, same pattern
`LiveMatchManualEditDialog` already uses for its minutes state). No new fields needed — minute
input for post-match cards is handled at the `LiveMatchManualEditDialog` level (see §4), not
inside `CardEventDialog` itself, to avoid touching the live-match card flow's UI.

## 4. `components/simulation/LiveMatchManualEditDialog.tsx` — main change

Rename dialog title to "Edición manual del partido". Add two new sections below the existing
minutes grid, each mirroring the read-only `GoalTimeline`/`CardsTimeline` layout but with
edit/delete affordances:

```ts
interface LiveMatchManualEditDialogProps {
  open: boolean;
  onClose: () => void;
  lineupPlayers: SquadPlayer[];
  currentMinutes: Record<string, number>;
  onSaveMinutes: (overrides: Record<string, number>) => void;
  goals: GoalEvent[];
  onAddGoal: (payload: GoalEventSubmitPayload, minute: number) => void;
  onUpdateGoal: (goalId: string, payload: GoalEventSubmitPayload, minute: number) => void;
  onRemoveGoal: (goalId: string) => void;
  cards: CardEvent[];
  onAddCard: (payload: CardEventSubmitPayload, minute: number, half: 1 | 2) => void;
  onUpdateCard: (cardId: string, payload: CardEventSubmitPayload, minute: number, half: 1 | 2) => void;
  onRemoveCard: (cardId: string) => void;
}
```

(`onSave` renamed `onSaveMinutes` for clarity now that the dialog does more than minutes —
update the one call site in `PartidoEnDirectoTab.tsx`.)

- Map `lineupPlayers: SquadPlayer[]` to `SimSlotPlayer[]` locally (`{ teamPlayerId: p.id,
  displayName: p.displayName, alias: p.alias, dorsal: p.dorsal }`) to pass into
  `GoalEventDialog`/`CardEventDialog`, which both expect `SimSlotPlayer[]`.
- Goals section: list each `GoalEvent` (minute, scorer or "Rival"/"Propia puerta", icon by
  `isOwnTeam`) with "Editar"/"Eliminar" icon buttons, plus an "Añadir gol" button. Both open
  `GoalEventDialog` — add mode has no `initialValue`; edit mode passes the existing event's
  fields as `initialValue` and an additional minute `TextField` (0-200) shown above/below the
  dialog content specifically for the manual editor (simplest: keep the minute field in
  `LiveMatchManualEditDialog` itself, shown alongside the "Añadir/Editar gol" trigger, not
  inside `GoalEventDialog`, so `GoalEventDialog` stays minute-agnostic and reusable as-is for
  the live flow).
- Cards section: same pattern with `CardEventDialog` (`initialValue` when editing) plus a
  sibling minute `TextField` in the manual editor.
- Validation before calling `onAddGoal`/`onUpdateGoal`/`onAddCard`/`onUpdateCard`: minute must
  be an integer 0-200 (same rule as existing minutes validation) — reuse the existing `error`
  `Alert` state for the message.

## 5. `PartidoEnDirectoTab.tsx` — wiring

- Replace the single `onSave={handleManualSave}` prop with the new props from §4, wiring:
  - `onSaveMinutes` → existing `handleManualSave` (unchanged behavior, already reads
    `live.goals`/`live.cards` via closure so edits made in the same dialog session are
    included when minutes are saved).
  - `onAddGoal={(p, minute) => live.addGoal(p.scorerId, p.scorerName, p.scorerDorsal,
    p.isOwnTeam, p.pitchZone, p.bodyPart, minute)}`
  - `onUpdateGoal={(id, p, minute) => live.updateGoal(id, { ...p, minute })}`
  - `onRemoveGoal={live.removeGoal}`
  - `onAddCard={(p, minute, half) => live.addCard(p.teamPlayerId, p.playerName,
    p.isRivalPlayer, p.rivalDorsal, p.cardType, minute, half)}`
  - `onUpdateCard={(id, p, minute, half) => live.updateCard(id, { ...p, minute, half })}`
  - `onRemoveCard={live.removeCard}`
  - `goals={live.goals}`, `cards={live.cards}`
- Editing/adding a goal or card in the dialog does **not** by itself call `saveMatchParticipation`
  — it only updates in-memory `live.goals`/`live.cards` state (consistent with how minutes
  overrides already work: nothing is persisted until "Guardar" is pressed inside the manual
  dialog, which triggers `onSaveMinutes`/`handleManualSave`). The dialog's own "Guardar" button
  (already present) becomes the single commit point for minutes + goals + cards together.

## 6. Tests (TDD — write first)

- `hooks/__tests__/useLiveMatch.enhancements.test.tsx` (extend): `addGoal`/`addCard` respect an
  explicit `minute`/`half` argument; `updateGoal` recomputes `scoreAtMoment` and totals when
  `isOwnTeam` changes; `updateCard` patches fields without touching score.
- `components/simulation/__tests__/GoalEventDialog.test.tsx` (new): renders players + rival
  option, submits correct payload for scorer/own-goal/rival cases, pre-fills from
  `initialValue` when editing.
- `components/simulation/__tests__/CardEventDialog.test.tsx` (extend): pre-fills from
  `initialValue`.
- `components/__tests__/LiveMatchManualEditDialog.goalsAndCards.test.tsx` (new): renders
  existing goals/cards, add/edit/remove flows call the right callbacks with the right minute.
- `components/__tests__/PartidoEnDirectoTab.*.test.tsx`: update any existing test that mounts
  `LiveMatchManualEditDialog`/asserts on its old `onSave` prop name.

## Files touched summary

| File | Change |
|---|---|
| `hooks/useLiveMatch.ts` | extend `addGoal`/`addCard`, add `updateGoal`/`updateCard` |
| `components/simulation/GoalEventDialog.tsx` | new — extracted from `LiveMatchScoreboard` |
| `components/simulation/GoalEventDialog.module.css` | new |
| `components/simulation/LiveMatchScoreboard.tsx` | use `GoalEventDialog` instead of inline JSX |
| `components/simulation/CardEventDialog.tsx` | add `initialValue` prop |
| `components/simulation/LiveMatchManualEditDialog.tsx` | add goals/cards sections |
| `components/simulation/LiveMatchManualEditDialog.module.css` | styles for new sections |
| `components/PartidoEnDirectoTab.tsx` | rewire manual-edit dialog props |
| corresponding `__tests__` files | new/updated per §6 |
