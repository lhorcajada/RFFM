## Why

The "Estadísticas" tab on a player's Coach profile (`PlayerConvocationSummaryCard`) shows a
single "Total de convocatorias" count that mixes trainings, friendlies and league matches, which
hides how a player's participation splits across event types. The "Última desconvocación" tile is
mislabeled (should read "Última desconvocatoria") and does not show *why* the player was
deconvoked, even though the reason (`ExcuseType`) is already stored on `Convocation`. Separately,
when a player was accepted into a match convocation but simply does not show up, the coach has no
way to record that absence with a reason so it surfaces in the "Última ausencia" tile — the
`ConvocationStatus.Justified` status this tile already reads from is never written by any Coach UI
today (confirmed: only `Accepted`/`Deconvoke` are used in `ConvocationMatchDetail`).

## What Changes

- Backend `GetPlayerConvocationSummary`: split `totalConvocations` into `totalTrainingConvocations`,
  `totalFriendlyConvocations`, `totalLeagueConvocations` (by `SportEvent.EventTypeId`/`MatchCategory`,
  same 3-way split already used for `MatchCategory` elsewhere); add the `ExcuseType` reason name to
  both `lastDeconvokedMatch` and `lastJustifiedAbsenceMatch`.
- Frontend `PlayerConvocationSummaryCard`: replace the single "Convocatorias" tile with 3 tiles
  (Entrenamientos/Amistosos/Liga); rename "Última desconvocación" → "Última desconvocatoria"; show
  the reason text on both absence tiles.
- New Coach action in `ConvocationMatchDetail` (the accepted-players list, e.g. `AlineacionTab`) to
  mark an already-accepted player as absent: sets `ConvocationStatus = Justified` with a required
  `ExcuseTypeId`, reusing the existing `UpdateConvocationStatus` endpoint and motive catalog (no
  backend domain change needed for this part — only a new frontend entry point + confirm dialog,
  per `ConfirmDialog` convention).

## Capabilities

### Modified Capabilities
- `player-convocation-summary` (no existing named spec found; documenting as new capability entry):
  totals broken down by event type, absence reasons surfaced, and Coach-initiated absence marking
  via existing `ConvocationStatus.Justified` + `ExcuseTypeId`.

## Impact

- Backend: `Features/Coaches/Players/Queries/GetPlayerConvocationSummary.cs` (query + DTO change).
  No new entities/migrations — reuses `Convocation.ExcuseTypeId`, `SportEvent.EventTypeId`,
  `ConvocationStatus.Justified`, existing `UpdateConvocationStatus` endpoint.
- Frontend: `apps/coach/services/convocationService.ts` (types), `PlayerConvocationSummaryCard.tsx`
  + `AbsenceTile`, `ConvocationMatchDetail.tsx`/`AlineacionTab` (new "Marcar ausencia" action with
  `ConfirmDialog` + excuse-type selector), corresponding tests (Vitest + xUnit).
