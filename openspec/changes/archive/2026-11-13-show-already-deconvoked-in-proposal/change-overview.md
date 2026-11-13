## Proposal

### Why

The coach's deconvocation proposal silently drops the players already deconvoked before it is generated, so the coach cannot see the whole picture of who is out (issue 15). They must appear in the list as informational entries without changing how new proposals are computed.

### What Changes

- The proposal result additionally returns the already-deconvoked players as a separate, flagged list, taken from `convocation.mgmtNotCalled` with no new data source.
- The proposal panel shows them at the top of the proposal block, marked «Ya desconvocado»: new proposals first (by score), then the already-deconvoked.
- They are never proposed again, never counted as available, never change the target number of deconvocations, and applying the proposal does not deconvoke them again; they keep being subtracted from their position when position minimums are evaluated.
- With no already-deconvoked players the list looks and works as today; when every deconvokable player is already deconvoked and there are no new proposals, the block shows only the already-deconvoked and no empty-list notice.
- Out of this change: the selection algorithm and its results for new proposals, and the new visual design of the list.

## Design

### Target State

The finished shape is a proposal result that carries a separate, flagged list of the already-deconvoked players, and a proposal panel that renders that list at the end of the proposal block.

### Goals / Non-Goals

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

### Decisions

#### D1. Separate `alreadyDeconvoked` list of a lightweight type, not extra `PlayerProposal` entries

The result gets a new required field `alreadyDeconvoked: AlreadyDeconvokedPlayer[]` with only `playerId`, `displayName`, `position`, `positionRole`. Alternatives: (a) add them to `players` with a flag — rejected: `players` feeds target, counts, the «Resto» section and the print, so any filter slip would change algorithm results; (b) build full `PlayerProposal` objects — rejected: all score fields are required and meaningless for a player who is out.

**Provenance**: derived

#### D2. Build the list inside `buildDeconvokeProposal` from the same squad it already filters

The list is the squad players (same collection filtered at line 346) whose id is in `alreadyOutIds`, in squad order, mapped with the same display-name rule used for scored players. The display-name rule (alias, else name plus last name, else «Jugador») is extracted into one small helper used by both paths so the two cannot diverge. `position` is `p.position ?? null` and `positionRole` comes from `toPositionPlayer`, as for scored players. The list is computed before the filtering and never feeds the scoring, target or position code, so new-proposal results are unchanged. Reason for being out is not read, as the spec requires.

**Provenance**: derived

#### D3. The hook is untouched apart from its documentation

`useConvocationProposal` returns the builder result as is, so the field reaches the panel without a new hook signature. Its documentation of `alreadyOutIds` is rewritten: the players are excluded from the proposal logic and returned in `alreadyDeconvoked` for display.

**Provenance**: derived

#### D4. Required field on `DeconvokeProposal`, fixtures updated

The field is required (not optional) so the panel never needs an `?? []` guard against a type that lies. Typed test fixtures of `DeconvokeProposal` add `alreadyDeconvoked: []`; fixtures built with `as unknown as` casts are updated where the panel reads the field.

**Provenance**: derived

#### D5. Dedicated light card and badge in the panel

`ConvocationTab.tsx` gets a local `renderAlreadyDeconvokedCard(item)` rendered after the selected players inside the existing proposal section. It shows the player name, position and a «Ya desconvocado» chip styled with a new class in `ConvocationTab.module.css`, modelled on the existing `proposalForcedBadge` pattern (CSS Modules, MUI theme tokens, no inline style). The card is a stacked card, so it stays usable at 360-400 px and introduces no table. `renderCard` is not changed.

**Provenance**: derived

#### D6. Empty-state conditions use both lists

The empty state «No hay convocados para evaluar.» shows only when `players` and `alreadyDeconvoked` are both empty. The notice «No hace falta desconvocar jugadores con las reglas actuales.» is not shown when `players` is empty and `alreadyDeconvoked` is not. The proposal section renders when there is at least one selected player or one already-deconvoked player. When `players` is not empty and nobody is selected, the notice stays, as today. With an empty `alreadyDeconvoked` the conditions are the same as today.

**Provenance**: user

#### D7. Applying the proposal needs no change

The already-deconvoked players are not in `selectedIds`, and `handleApplyProposal` already skips `mgmtNotCalled` players, so their existing reason is kept. The existing test «al aplicar la propuesta no cambia el motivo de los jugadores que ya estaban desconvocados» in `Front/src/apps/coach/pages/convocations/__tests__/ConvocationMatchDetail.tabsAndProposal.test.tsx` already pins this, so no new production code and no new test are planned.

**Provenance**: codebase-forced

No decision above meets all three ADR/DDR criteria (hard to reverse, surprising without context, real trade-off), so no record family is assigned.

### Risks / Trade-offs

- [A required field breaks typed `DeconvokeProposal` literals in the panel tests] → Mitigation: add `alreadyDeconvoked: []` to those fixtures in the same step as the type change; run the convocations test directories to catch casts that reach the panel.
- [An already-deconvoked entry could leak into scoring or targets through the shared helper extraction] → Mitigation: the list is built from its own pass; tests assert target, `calledCount`, `selectedIds` and position warnings are identical with and without the already-deconvoked players.
- [Both empty notices are suppressed in the wrong case] → Mitigation: panel tests cover the four combinations (none, only proposals, proposals plus already-deconvoked, only already-deconvoked).
- [Print omits the already-deconvoked players] → Mitigation: recorded as a non-goal; printout stays unchanged.

### Open Questions

None.

### Manual Verification

- **End-to-end smoke across real runtimes**: in the coach app, open a convocation with at least one player already in the not-called list, open the deconvocation proposal and check at about 360 px and at desktop width that the already-deconvoked cards appear after the proposed players with the «Ya desconvocado» mark and no horizontal scroll. Then deconvoke every deconvokable player and check that the block shows only the marked entries and no empty notice. Layout at narrow width cannot be asserted by Testing Library.

## Step 1: Proposal result returns the already-deconvoked players

### Interfaces

**Interfaces**: In `Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts`:

```ts
export type AlreadyDeconvokedPlayer = {
  playerId: string;
  displayName: string;
  position: string | null;
  positionRole: PositionRole | null;
};

export type DeconvokeProposal = {
  // existing fields unchanged
  alreadyDeconvoked: AlreadyDeconvokedPlayer[]; // new, required
};

// signature unchanged; the returned object now includes `alreadyDeconvoked`
export function buildDeconvokeProposal(input: BuildProposalInput): DeconvokeProposal;
```

`useConvocationProposal(input): DeconvokeProposal` keeps its signature and returns the same object.

**Test assertions**: All anchored to `openspec/changes/show-already-deconvoked-in-proposal/specs/deconvoke-proposal-positions/spec.md`.

1. [unit] Requirement «Proposal returns already deconvoked players as flagged entries», scenarios «Every player already out is returned» and «Reason does not matter»: a squad with `alreadyOutIds` holding two ids (one with a technical-decision reason, one with none) → `alreadyDeconvoked.map(p => p.playerId)` equals those two ids in squad order, each with `displayName` (alias, else name plus last name, else «Jugador»), `position` and `positionRole`.
2. [unit] Same requirement, scenario «Pending players are not returned», and scenario «No already deconvoked players» of the panel requirement: a squad player not in `alreadyOutIds` is absent; with an empty or absent `alreadyOutIds` → `alreadyDeconvoked` equals `[]`.
3. [unit] Requirement «Already deconvoked players do not alter the proposal», scenarios «Never proposed again» and «Target unchanged»: for a squad of 25 with 3 already-out ids and no mandatory player → none of the 3 ids is in `players` or `selectedIds`, and `targetCount` is 4, equal to the value built without those players shown.
4. [unit] Same requirement, scenario «Position minimum still subtracts them»: 4 centre-backs with 2 in `alreadyOutIds` → `positionWarnings` reports centre-backs as «Centrales: quedan 2 de 3» and `calledCount` excludes the 2.
5. [unit] Same requirement, first sentence: for the same input, `selectedIds`, `players` order and scores are equal whether `alreadyOutIds` is passed or the already-out players are removed from the squad beforehand.
6. [unit] Hook `useConvocationProposal` with `alreadyOutIds` of two ids → the returned proposal has `alreadyDeconvoked` with those two ids.

### Tasks

**Files Affected**:

```text
- M Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts
- M Front/src/apps/coach/pages/convocations/hooks/useConvocationProposal.ts
- M Front/src/apps/coach/pages/convocations/utils/__tests__/deconvokeProposal.positions.test.ts
- M Front/src/apps/coach/pages/convocations/hooks/__tests__/useConvocationProposal.alreadyOut.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.rules.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.positionWarnings.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.availability.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.emptyZones.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.formStatus.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.groups.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.readiness.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.summary.test.tsx
- M Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.touchActions.test.tsx
```

## Step 2: Proposal panel shows the already-deconvoked players

### Interfaces

**Interfaces**: No new exported symbol. `ConvocationTab` (default export in `Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx`) keeps its props and reads `proposal.alreadyDeconvoked`. New local render function `renderAlreadyDeconvokedCard(item: AlreadyDeconvokedPlayer): JSX.Element` (not exported) and one new CSS Modules class in `ConvocationTab.module.css` for the «Ya desconvocado» chip.

**Test assertions**: All anchored to `openspec/changes/show-already-deconvoked-in-proposal/specs/deconvoke-proposal-positions/spec.md`, requirement «Proposal panel shows already deconvoked players at the top». Panel opened with the «Proponer desconvocados» button.

1. [unit] Scenario «All already-deconvoked players are marked»: `alreadyDeconvoked` with 2 players → the text «Ya desconvocado» appears twice, next to each player's name.
2. [unit] Scenarios «Same block as the proposals» and «Order inside the block»: 2 selected players plus 1 already-deconvoked → the three names are in the same section and the DOM order is selected players by score, then the already-deconvoked player.
3. [unit] Scenario «No already deconvoked players»: `alreadyDeconvoked` equal to `[]` with proposals → no «Ya desconvocado» text, and the section and notices render as before the change.
4. [unit] Scenario «Only already deconvoked players remain»: `players` equal to `[]` and 1 already-deconvoked player → that player and the mark are shown, and neither «No hay convocados para evaluar.» nor «No hace falta desconvocar jugadores con las reglas actuales.» is in the document.
5. [unit] Same panel requirement, no-selection case: `players` not empty, none selected, 1 already-deconvoked player → «No hace falta desconvocar jugadores con las reglas actuales.» is still shown and the already-deconvoked player is listed.

### Tasks

**Files Affected**:

```text
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx
- M Front/src/apps/coach/pages/convocations/components/ConvocationTab.module.css
- A Front/src/apps/coach/pages/convocations/components/__tests__/ConvocationTab.alreadyDeconvoked.test.tsx
- M Front/package.json
- M Front/package-lock.json
```
