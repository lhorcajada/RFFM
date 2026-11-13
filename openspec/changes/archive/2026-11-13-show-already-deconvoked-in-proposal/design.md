## Target State

The finished shape is a proposal result that carries a separate, flagged list of the already-deconvoked players, and a proposal panel that renders that list at the end of the proposal block.

### Architecture Snapshot

#### External Surfaces

None — no planned externally consumable surfaces

#### Internal Public Surfaces

- `Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts` — new exported type `AlreadyDeconvokedPlayer`; `DeconvokeProposal` gains the required field `alreadyDeconvoked`. `buildDeconvokeProposal` fills it from the squad players whose id is in `alreadyOutIds`.
- `Front/src/apps/coach/pages/convocations/hooks/useConvocationProposal.ts` — returns the same `DeconvokeProposal`, so the list flows to the panel with no new hook signature.
- `Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx` — proposal panel reads `proposal.alreadyDeconvoked` and renders it after the new proposals in the same block.

Resulting shape of the proposal result (fields not shown are unchanged):

```ts
export type AlreadyDeconvokedPlayer = {
  playerId: string;
  displayName: string;
  position: string | null;
  positionRole: PositionRole | null;
};

export type DeconvokeProposal = {
  // ...existing fields unchanged (players, selectedIds, targetCount, calledCount, positionWarnings, ...)
  alreadyDeconvoked: AlreadyDeconvokedPlayer[];
};
```

Resulting proposal block, top to bottom: new proposals (selected players, by score, existing cards) then one light card per already-deconvoked player carrying the mark «Ya desconvocado». The «Resto» section and its cards are unchanged.

### File Manifest

- M Front/package-lock.json (Step 2)
- M Front/package.json (Step 2)
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css (Step 2)
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx (Step 2)
- A Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.alreadyDeconvoked.test.tsx (Step 2)
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.availability.test.tsx (Step 1)
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.emptyZones.test.tsx (Step 1)
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.formStatus.test.tsx (Step 1)
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.groups.test.tsx (Step 1)
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.positionWarnings.test.tsx (Step 1)
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.readiness.test.tsx (Step 1)
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.rules.test.tsx (Step 1)
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.summary.test.tsx (Step 1)
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.touchActions.test.tsx (Step 1)
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useConvocationProposal.alreadyOut.test.tsx (Step 1)
- M Front/src/apps/coach/pages/convocations/hooks/useConvocationProposal.ts (Step 1)
- M Front/src/apps/coach/pages/convocations/utils/__tests__/deconvokeProposal.positions.test.ts (Step 1)
- M Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts (Step 1)

## Context

- `buildDeconvokeProposal` (`utils/deconvokeProposal.ts`) receives the squad (`players`, `calledIds`) and the optional `alreadyOutIds` set. It removes the already-out players from the squad before scoring (line 346), so they never appear in `players`, never count in `targetCount` or `calledCount`, and are not counted by the position minimums. The return object has no trace of them (assembled at lines 603-611).
- `useConvocationProposal` is the only non-test caller of the builder. `ConvocationMatchDetail.tsx` builds `alreadyOutIds` from `mgmtNotCalled` (line 249); `handleApplyProposal` (line 288) already skips players that are in `mgmtNotCalled`.
- The panel in `ConvocationTab.tsx` (lines 585-693) shows a «Propuestos» section (selected players, `renderCard(item, true)`) and a «Resto» section. It shows the empty state «No hay convocados para evaluar.» when `proposal.players` is empty (line 663) and the notice «No hace falta desconvocar jugadores con las reglas actuales.» when no player is selected (line 668).
- `renderCard` reads score, factors, call and start counts and weekly training, so it cannot render a player that has no score data.
- `ConvocatoriaPrint.tsx` prints from `proposal.players` only (lines 630-646).
- Constraint from the specs: the selection algorithm, its results for new proposals, and the score order must stay identical; there is no backend or data-model change.

## Goals / Non-Goals

**Goals**
- `buildDeconvokeProposal` returns the already-deconvoked players as a separate flagged list built from data it already receives.
- The proposal panel shows them after the new proposals, in the same block, each with the mark «Ya desconvocado».
- With no already-deconvoked players the panel behaves as today; with only already-deconvoked players the block shows them and neither empty notice.
- `Front/package.json` minor version bump (`feat`).

**Non-Goals**
- Any change to scoring, target count, position minimums or `handleApplyProposal`.
- A new visual design for the list.
- Out of scope: printing the already-deconvoked players in `ConvocatoriaPrint.tsx` — revisit when the coach asks for them on the printed sheet.
- Any backend, API or data-model change.

## Decisions

### D1. Separate `alreadyDeconvoked` list of a lightweight type, not extra `PlayerProposal` entries

The result gets a new required field `alreadyDeconvoked: AlreadyDeconvokedPlayer[]` with only `playerId`, `displayName`, `position`, `positionRole`. Alternatives: (a) add them to `players` with a flag — rejected: `players` feeds target, counts, the «Resto» section and the print, so any filter slip would change algorithm results; (b) build full `PlayerProposal` objects — rejected: all score fields are required and meaningless for a player who is out.

**Provenance**: derived

### D2. Build the list inside `buildDeconvokeProposal` from the same squad it already filters

The list is the squad players (same collection filtered at line 346) whose id is in `alreadyOutIds`, in squad order, mapped with the same display-name rule used for scored players. The display-name rule (alias, else name plus last name, else «Jugador») is extracted into one small helper used by both paths so the two cannot diverge. `position` is `p.position ?? null` and `positionRole` comes from `toPositionPlayer`, as for scored players. The list is computed before the filtering and never feeds the scoring, target or position code, so new-proposal results are unchanged. Reason for being out is not read, as the spec requires.

**Provenance**: derived

### D3. The hook is untouched apart from its documentation

`useConvocationProposal` returns the builder result as is, so the field reaches the panel without a new hook signature. Its documentation of `alreadyOutIds` is rewritten: the players are excluded from the proposal logic and returned in `alreadyDeconvoked` for display.

**Provenance**: derived

### D4. Required field on `DeconvokeProposal`, fixtures updated

The field is required (not optional) so the panel never needs an `?? []` guard against a type that lies. Typed test fixtures of `DeconvokeProposal` add `alreadyDeconvoked: []`; fixtures built with `as unknown as` casts are updated where the panel reads the field.

**Provenance**: derived

### D5. Dedicated light card and badge in the panel

`ConvocationTab.tsx` gets a local `renderAlreadyDeconvokedCard(item)` rendered after the selected players inside the existing proposal section. It shows the player name, position and a «Ya desconvocado» chip styled with a new class in `ConvocationTab.module.css`, modelled on the existing `proposalForcedBadge` pattern (CSS Modules, MUI theme tokens, no inline style). The card is a stacked card, so it stays usable at 360-400 px and introduces no table. `renderCard` is not changed.

**Provenance**: derived

### D6. Empty-state conditions use both lists

The empty state «No hay convocados para evaluar.» shows only when `players` and `alreadyDeconvoked` are both empty. The notice «No hace falta desconvocar jugadores con las reglas actuales.» is not shown when `players` is empty and `alreadyDeconvoked` is not. The proposal section renders when there is at least one selected player or one already-deconvoked player. When `players` is not empty and nobody is selected, the notice stays, as today. With an empty `alreadyDeconvoked` the conditions are the same as today.

**Provenance**: user

### D7. Applying the proposal needs no change

The already-deconvoked players are not in `selectedIds`, and `handleApplyProposal` already skips `mgmtNotCalled` players, so their existing reason is kept. The existing test «al aplicar la propuesta no cambia el motivo de los jugadores que ya estaban desconvocados» in `Front/src/apps/coach/pages/convocations/__tests__/ConvocationMatchDetail.tabsAndProposal.test.tsx` already pins this, so no new production code and no new test are planned.

**Provenance**: codebase-forced

No decision above meets all three ADR/DDR criteria (hard to reverse, surprising without context, real trade-off), so no record family is assigned.

## Risks / Trade-offs

- [A required field breaks typed `DeconvokeProposal` literals in the panel tests] → Mitigation: add `alreadyDeconvoked: []` to those fixtures in the same step as the type change; run the convocations test directories to catch casts that reach the panel.
- [An already-deconvoked entry could leak into scoring or targets through the shared helper extraction] → Mitigation: the list is built from its own pass; tests assert target, `calledCount`, `selectedIds` and position warnings are identical with and without the already-deconvoked players.
- [Both empty notices are suppressed in the wrong case] → Mitigation: panel tests cover the four combinations (none, only proposals, proposals plus already-deconvoked, only already-deconvoked).
- [Print omits the already-deconvoked players] → Mitigation: recorded as a non-goal; printout stays unchanged.

## Open Questions

None.

## Manual Verification

- **End-to-end smoke across real runtimes**: in the coach app, open a convocation with at least one player already in the not-called list, open the deconvocation proposal and check at about 360 px and at desktop width that the already-deconvoked cards appear after the proposed players with the «Ya desconvocado» mark and no horizontal scroll. Then deconvoke every deconvokable player and check that the block shows only the marked entries and no empty notice. Layout at narrow width cannot be asserted by Testing Library.
