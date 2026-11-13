## Context

Verified facts:
- The proposal is built in the frontend by `buildDeconvokeProposal` (`utils/deconvokeProposal.ts`): every rule in `utils/rules/*` returns a points `delta` and factors; players are sorted by score and `selectDeconvocations` skips candidates that break a position minimum.
- Position minimums live in `positionRequirements.ts` (`ROLE_MINIMUMS`, `EXTRA_COVER`) with cover by possible demarcations limited to gaps left by mandatory deconvocations.
- Already deconvoked players are filtered out of `calledIds` and shown separately; `targetCount` is computed as `max(forced, calledIds.length - 18)`, so they reduce the called count but the intent "already out counts as deconvoked" is not explicit in the target.
- Injury absences are discounted from the technical streak (`isProtectedStreakAbsence`), which makes a player who missed a match by injury look as if he had not rested.
- Rules are stored per team as a JSON document (`DeconvocationRulesSettings.RulesJson`); the default set lives in the frontend.
- The forecast gives `MatchPrediction.localWinProbability/visitorWinProbability` per round (`matchForecastService`).

Assumption: «carrilero» maps to the same role as full-back (`fullBack`) in the position classification.

## Goals / Non-Goals

Goals:
- Deterministic funnel with one decisive reason per player.
- New protection windows, new position minimums and compensation, rival-dependent use of rating.
- Reasons visible on screen and in the printed report.

Non-goals:
- Moving the computation to the backend.
- Changing how deconvocations are applied or stored.
- Changing the attendance/convocation grid data.

## Decisions

### D1. Lexicographic funnel instead of summed points
A pure function pipeline in `utils/deconvocation/`: `classify` (mandatory / protected / eligible), `selectWithPositions`, `orderByFairness`, `applyDifficultyTiebreak`. Each stage tags the player with a typed `DecisionReason` (`kind`, `params`). Alternative: keep points and add stronger weights; rejected because sums hide the reason, which is the problem to solve. Satisfies the funnel-order and reason requirements.

### D2. Protection windows as team parameters
`technicalWindow` (default 5) and `injuryRestWindow` (default 1) are stored in the existing rules JSON of the team, with defaults in the frontend so teams without configuration behave as specified. The existing rules dialog edits them. Injury and illness absences count as rest: they are excluded from technical totals and counted in the rest window.

### D3. Position minimums with compensation for every candidate
`ROLE_MINIMUMS` becomes 2/3/3/4/2/1 and `EXTRA_COVER` is removed. `selectDeconvocations` drops the `leavesSpecialistGap` restriction so a versatile player (possible demarcation) can cover for any deconvocation, keeping the check that their own role stays at its minimum. Already-out players are excluded from availability and counted in the target (`targetCount = max(forced, squadAvailable - maxCalled)` with already-out subtracted from the remaining to propose).

### D4. Rival difficulty from the forecast
Difficulty = own win probability for the match against the rival (from `useMatchForecast` / simulation matches): hard below a configurable threshold (default 40%), easy above another (default 65%), else medium; unknown forecast gives medium. Used only as last tiebreak and only when hard; for easy/medium the rating is ignored. Alternative: weigh rating always; rejected because ratings change little week to week and would dominate.

### D5. Reason model and UI
`PlayerProposal` gains `decision: { group: "proposed" | "protected" | "notChosen"; reason: DecisionReason; preferredOver?: string }`. `DesconvocatoriasTab` renders three groups with the one-line reason; the factor detail stays in an expandable section. Each proposed card has a collapsible rule detail (native `details`). The proposal print report is removed: the button in `ConvocationTab`, `onPrintProposal` wiring and `printProposal` in `ConvocatoriaPrint` (other print functions stay). The legacy `score` is dropped.

## Target State

The coach opens the proposal and sees proposed players each with the criterion that decided, protected players with the protecting rule, and the not chosen with who was preferred. Position minimums hold and already-out players count. Hard rivals keep the best players.

## Risks / Trade-offs

- Removing points makes the rules dialog partly obsolete → keep only windows, thresholds and mandatory rules, migrate saved JSON by ignoring unknown rule conditions.
- Forecast may be missing or stale → medium fallback with an explicit notice.
- Too strict minimums may make the target unreachable → keep the existing behaviour: the target prevails and unmet minimums are reported.
- «Carrilero» classification may differ from assumption → covered by open question.

## Migration Plan

No database schema change. Saved `RulesJson` is read leniently: unknown or obsolete conditions are ignored; new parameters take defaults when absent. Rollback is reverting the frontend; old saved JSON remains valid.

## Validation Strategy

- Unit tests (Vitest) for each stage: protection windows (5/1), minimum-calls protection, fairness cascade, difficulty tiebreak (hard/easy/unknown), already-out counting in the target.
- Unit tests for position selection: 3 full-backs with one already out, compensation by a versatile player, line at minimum.
- Regression test reproducing the reported case (3 full-backs + 1 centre-back, injury absence last matchday).
- Component tests for the grouped reasons on screen and in print.
- Run only affected tests during development; full suite and build once at the end.

## ADR / DDR Evaluation

Neither: the change is local to the frontend proposal engine and adds no cross-cutting architecture; the rule semantics are recorded in the specs. No project routing guidance for decision records was needed.

## Open Questions

- Does «carrilero» exist as a demarcation id? Assumed to share the full-back role.
- Difficulty thresholds (40% / 65%) are proposed defaults; confirm with the coach.
