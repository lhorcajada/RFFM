import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, type DeconvocationRuleConfig } from "./ruleCatalog";

function isTechnicalDecisionLocal(cell: any): boolean {
  if (!cell) return false;
  const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);
  if (!NOT_CALLED_NAMES.has(cell.statusName)) return false;
  if (cell.statusName === "No disponible") return false;
  if (!cell.excuseTypeId) return true;
  return !!cell.excuseName?.toLowerCase().includes("decisi");
}

export default function streakRule(
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  cfg: DeconvocationRuleConfig = buildDefaultRule("streak"),
): RuleResult {
  const rule = resolveRule("streak", [cfg])!;
  const STREAK_POINTS = [1, 2, 3, 4, 5, 6, 7].map((n) => rule.points[`j${n}`]);
  const { effectiveStreak, seasonColumns, enrichedGrid, playerId, injuryAbsencesInStreak } = ctx;

  const STREAK_OFFSET = rule.weights.offset;
  const STREAK_SLOPE = rule.weights.slope;
  const STREAK_WEIGHT = rule.weights.scale;
  const STREAK_POSITIVE_CAP = rule.weights.positiveCap;
  const STREAK_NEGATIVE_CAP = rule.weights.negativeCap;
  const STREAK_LOW_BONUS = rule.weights.lowBonus;
  const RECENT_TECH_BOOST = rule.weights.recentTechBoost;

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
      ? `${rule.text} (${injuryAbsencesInStreak} de lesión/enfermedad/familia descontadas)`
      : rule.text,
    value: effectiveStreak,
    impact: Number(streakImpact.toFixed(2)),
  };

  return { factors: [factor], delta: streakImpact };
}
