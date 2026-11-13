## Why

The deconvocation proposal ranks players by a sum of points, so the coach cannot tell why one player is out and another stays, and fixed factors (level, competitiveness) outweigh fairness every week. In practice it proposed three full-backs plus a centre-back, did not count a full-back already out as one less, and proposed again a player who had just missed a match through a mild injury.

## What Changes

- Replace the points ranking by a **tiered decision funnel**: protected players first, position minimums second, fairness order third, rival difficulty as the last tiebreak. Each player ends with one clear reason.
- **Protection windows** (configurable per team): a technical deconvocation protects for 5 matchdays; an absence by injury (even mild) counts as rest and protects for 1 matchday. Players who would fall below their minimum of calls are protected too.
- **Position minimums** updated to goalkeepers 2, full-backs and wing-backs 3, centre-backs 3, midfielders (defensive and offensive) 4, wide players 2, forwards 1; players already deconvoked count against the target and the position. A player able to play a position through a possible demarcation can compensate a deconvocation in another position when their own position keeps its minimum.
- **Level and competitiveness depend on the rival**: against a hard rival the lowest-level eligible players go out first; against an easy rival they do not weigh and rotation is purely by fairness; without forecast the rival is treated as medium.
- **Reasons shown per player**: chosen (deciding criterion), protected (rule that protects), candidate not chosen (who was preferred and why), plus a collapsible rule detail on each proposed card.
- **Remove the proposal print report**: the "Imprimir propuesta" button and the proposal printing code (`printProposal` in `ConvocatoriaPrint`) are deleted. The rules dialog stays, reduced to the windows, difficulty thresholds and mandatory rules.
- **BREAKING**: the points of the ranking rules stop deciding the order; the rules configuration keeps only the parameters that still apply (windows, thresholds, mandatory rules).

## Capabilities

### New Capabilities
- `deconvocation-tiered-selection`: funnel of protection, positions, fairness order and rival difficulty, with the explanation of each decision.

### Modified Capabilities
- `deconvoke-proposal-positions`: new minimums per position and compensation by possible demarcations also for non-mandatory deconvocations.

## Impact

- Frontend: `Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts`, `positionRequirements.ts`, `utils/rules/*`, `hooks/useConvocationProposal.ts`, `components/DesconvocatoriasTab.tsx`, `ConvocationTab.tsx` (remove print button), `ConvocatoriaPrint.tsx` (remove `printProposal`), `ConvocationMatchDetail.tsx`, `DeconvocationRulesDialog.tsx`.
- Backend: `DeconvocationRulesSettings.RulesJson` and its get/update/reset features if new parameters (windows, difficulty thresholds) are persisted; no schema change expected (JSON document).
- Data: match forecast (`matchForecastService`) as rival difficulty source.
- Version: `Front/package.json` minor bump (and `Back/ExtractionApi/Directory.Build.props` if the API changes).

## Proposal Research Documentation

**Local files**:
- Front/src/apps/coach/pages/convocations/utils/deconvokeProposal.ts
- Front/src/apps/coach/pages/convocations/utils/positionRequirements.ts
- Front/src/apps/coach/pages/convocations/utils/injuryRecovery.ts
- Front/src/apps/coach/pages/convocations/utils/rules/ruleCatalog.ts
- Front/src/apps/coach/pages/convocations/utils/rules/recentDeconvocationRule.ts
- Front/src/apps/coach/hooks/useMatchForecast.ts
- Front/src/apps/coach/services/matchForecastService.ts
- Back/ExtractionApi/src/RFFM.Api/Domain/Entities/Teams/DeconvocationRulesSettings.cs
- openspec/specs/deconvoke-proposal-positions/spec.md
- openspec/specs/deconvoke-proposal-rules-config/spec.md

**External URLs**:
- None

## Additional Notes

The proposal is computed in the frontend today; the design keeps it there. A "matchday" is a season column of the convocation grid (newest first), as in the current streak and recent-deconvocation rules.
