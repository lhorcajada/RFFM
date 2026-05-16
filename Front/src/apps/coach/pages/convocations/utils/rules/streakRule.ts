import type { Rule, RuleResult, RuleContext } from "./types";

const STREAK_POINTS = [50, 45, 20, 15, 10, 5, 3] as const;

function isTechnicalDecisionLocal(cell: any): boolean {
  if (!cell) return false;
  const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);
  if (!NOT_CALLED_NAMES.has(cell.statusName)) return false;
  if (cell.statusName === "No disponible") return false;
  if (!cell.excuseTypeId) return true;
  return !!cell.excuseName?.toLowerCase().includes("decisi");
}

export default function streakRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const { effectiveStreak, seasonColumns, enrichedGrid, playerId, injuryAbsencesInStreak } = ctx;

  // Smoothed constants: reduce abrupt jumps and lower the low-streak bonus.
  // Increase baseline and scale so differences across jornadas grow.
  // Goal: increase the point gap between low and high streaks.
  const STREAK_OFFSET = 8.5;
  const STREAK_SLOPE = 0.6; // gentler decrease per jornada
  const STREAK_WEIGHT = 1.0; // reduced scale — lower penalties/bonuses
  const STREAK_POSITIVE_CAP = 40; // lower cap to avoid extreme outliers
  const STREAK_NEGATIVE_CAP = 15;
  const STREAK_LOW_BONUS = 22; // slightly stronger protection for jornada 0/1
  const RECENT_TECH_BOOST = 6; // smaller boost for a very recent technical decision

  let recentTechnicalDecision = false;
  if (seasonColumns && seasonColumns.length > 0) {
    const mostRecentCol = seasonColumns[0];
    const recentCell = enrichedGrid.get(mostRecentCol.eventId)?.get(playerId);
    recentTechnicalDecision = isTechnicalDecisionLocal(recentCell);
  }

  const s = Math.max(0, Math.floor(Number(effectiveStreak ?? 0)));

  let streakImpact: number;
  if (s >= 1) {
    if (s <= STREAK_POINTS.length) {
      streakImpact = STREAK_POINTS[s - 1];
    } else {
      streakImpact = STREAK_POINTS[STREAK_POINTS.length - 1];
    }
  } else {
    // Compute continuously and round only at the end to avoid quantization steps for protected players
    let raw = STREAK_OFFSET - STREAK_SLOPE * s;
    if (recentTechnicalDecision) raw += RECENT_TECH_BOOST;
    streakImpact = Math.round(raw * STREAK_WEIGHT);
    if (s <= 1) streakImpact += STREAK_LOW_BONUS;
    streakImpact = Math.max(-STREAK_NEGATIVE_CAP, Math.min(STREAK_POSITIVE_CAP, streakImpact));
  }

  const factor = {
    key: "streak",
    label: injuryAbsencesInStreak > 0
      ? `Jornadas sin desconvocatoria técnica (${injuryAbsencesInStreak} de lesión/enfermedad/familia descontadas)`
      : "Jornadas sin desconvocatoria técnica",
    value: effectiveStreak,
    impact: Number(streakImpact.toFixed(2)),
  };

  return { factors: [factor], delta: streakImpact };
}
