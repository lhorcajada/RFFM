/**
 * Recalculates a player's "Rodaje" (readiness, 0-100) client-side, adding the minutes the
 * player has accumulated in an in-progress match/simulation that is NOT yet saved to the
 * backend (so those minutes are not part of `matchMinutesInWindow` returned by the API).
 *
 * This deliberately mirrors `PlayerReadinessCalculator.Calculate` in
 * `Back/ExtractionApi/src/RFFM.Api/Features/Coaches/Players/Services/PlayerReadinessCalculator.cs`
 * (TrainingWeight = 0.70, MatchWeight = 0.30, matchComponent capped at 100). If the backend
 * ever changes those weights/constants, this function must be updated too — same conscious
 * duplication pattern already used elsewhere in this codebase (e.g. goal counting duplicated
 * across several backend endpoints).
 */

const TRAINING_WEIGHT = 0.7;
const MATCH_WEIGHT = 0.3;

export type LiveReadinessBreakdown = {
  trainingComponent: number;
  matchMinutesInWindow: number;
  matchMinutesExpected: number;
};

export function computeLiveReadiness(
  breakdown: LiveReadinessBreakdown | null | undefined,
  liveMatchMinutes: number,
): number | null {
  if (!breakdown) return null;

  const additionalMinutes = Math.max(0, liveMatchMinutes);
  const matchMinutes = breakdown.matchMinutesInWindow + additionalMinutes;
  const matchComponent =
    breakdown.matchMinutesExpected > 0
      ? Math.min(100, (matchMinutes / breakdown.matchMinutesExpected) * 100)
      : 0;

  return Math.round(TRAINING_WEIGHT * breakdown.trainingComponent + MATCH_WEIGHT * matchComponent);
}
