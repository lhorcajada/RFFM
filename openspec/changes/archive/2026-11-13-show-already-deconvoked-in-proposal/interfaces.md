## Step 1: Proposal result returns the already-deconvoked players

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

## Step 2: Proposal panel shows the already-deconvoked players

**Interfaces**: No new exported symbol. `ConvocationTab` (default export in `Front/src/apps/coach/pages/convocations/components/ConvocationTab.tsx`) keeps its props and reads `proposal.alreadyDeconvoked`. New local render function `renderAlreadyDeconvokedCard(item: AlreadyDeconvokedPlayer): JSX.Element` (not exported) and one new CSS Modules class in `ConvocationTab.module.css` for the «Ya desconvocado» chip.

**Test assertions**: All anchored to `openspec/changes/show-already-deconvoked-in-proposal/specs/deconvoke-proposal-positions/spec.md`, requirement «Proposal panel shows already deconvoked players at the top». Panel opened with the «Proponer desconvocados» button.

1. [unit] Scenario «All already-deconvoked players are marked»: `alreadyDeconvoked` with 2 players → the text «Ya desconvocado» appears twice, next to each player's name.
2. [unit] Scenarios «Same block as the proposals» and «Order inside the block»: 2 selected players plus 1 already-deconvoked → the three names are in the same section and the DOM order is selected players by score, then the already-deconvoked player.
3. [unit] Scenario «No already deconvoked players»: `alreadyDeconvoked` equal to `[]` with proposals → no «Ya desconvocado» text, and the section and notices render as before the change.
4. [unit] Scenario «Only already deconvoked players remain»: `players` equal to `[]` and 1 already-deconvoked player → that player and the mark are shown, and neither «No hay convocados para evaluar.» nor «No hace falta desconvocar jugadores con las reglas actuales.» is in the document.
5. [unit] Same panel requirement, no-selection case: `players` not empty, none selected, 1 already-deconvoked player → «No hace falta desconvocar jugadores con las reglas actuales.» is still shown and the already-deconvoked player is listed.
