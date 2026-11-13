## Planning Status

Planned from `proposal.md`, the two spec deltas and `design.md`. Nothing is implemented or verified yet. Every step follows TDD (test first, see it fail, then implement).

## Step 1: Position minimums and compensation

- [x] 1.1 Tests: minimums 2/3/3/4/2/1, no extra cover, compensation by a versatile player for non-mandatory deconvocations, line at minimum, already-out not counted (`deconvoke-proposal-positions`).
- [x] 1.2 Update `ROLE_MINIMUMS`, remove `EXTRA_COVER`, drop the specialist-gap restriction in `selectDeconvocations`.

## Step 2: Protection and eligibility

- [x] 2.1 Tests: technical window 5, injury rest window 1, minimum-calls protection, injury absences not counted as technical (`deconvocation-tiered-selection`).
- [x] 2.2 Implement `classify` with typed decision reasons and team-configurable windows (defaults when absent).

## Step 3: Fairness order and rival difficulty

- [x] 3.1 Tests: cascade (consecutive matchdays, call surplus, technical total, attendance), compensation for missed calls, hard/easy/unknown rival tiebreak.
- [x] 3.2 Implement `orderByFairness` and `applyDifficultyTiebreak`; derive difficulty from the forecast with medium fallback.

## Step 4: Engine integration and target

- [x] 4.1 Test reproducing the reported case (3 full-backs + 1 centre-back, mild injury last matchday, one already out counted in the target).
- [x] 4.2 Replace the points sort in `buildDeconvokeProposal` by the funnel; expose `decision` per player and the difficulty used.

## Step 5: Configuration

- [x] 5.1 Tests for the rules dialog: edit windows and difficulty thresholds, restore defaults, lenient read of old saved JSON.
- [x] 5.2 Adapt `ruleCatalog` / dialog and, if needed, backend get/update validation (RFC 7807) for the new parameters.

## Step 6: Reasons in the UI and print

- [x] 6.1 Tests: three groups (proposed, protected, not chosen) with one reason each in `DesconvocatoriasTab`, collapsible rule detail per proposed card, mobile-first cards, no tables, no "Imprimir propuesta" button.
- [x] 6.2 Implement the grouped view with expandable detail following `.design/deconvocation-tiered`; keep Spanish copy.
- [x] 6.3 Remove `onPrintProposal` from `ConvocationTab`/`ConvocationMatchDetail` and `printProposal` from `ConvocatoriaPrint` with its tests.

## Step 7: Closing

- [x] 7.1 Run the full Front suite and `npm run build` once; run affected backend tests if the API changed.
- [x] 7.2 Bump `Front/package.json` minor (and API version if changed); update `GLOSSARY.md` with the new terms (protected, rest by injury, rival difficulty).
