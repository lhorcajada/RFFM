import type { RuleResult, RuleContext } from "./types";
import { resolveRule, type DeconvocationRuleConfig } from "./ruleCatalog";
import { DEFAULT_RULES } from "./defaultRules";

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

// Combined metric rule — three independent conditions computed together:
// - `rating` (weightedRating, 0..10)
// - `necessity` (based only on `competitiveness`, 0..10)
// - `weeklyTrainingAccum` (raw season attendance to trainings and friendlies)
// A condition without a configured rule does not contribute. `ctx.necessity` no longer mixes
// starts/calls; it is the competitiveness.
export default function combinedRule(
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  rules: DeconvocationRuleConfig[] = DEFAULT_RULES,
): RuleResult {
  const ratingRule = resolveRule("rating", rules);
  const necessityRule = resolveRule("necessity", rules);
  const trainingRule = resolveRule("weeklyTrainingAccum", rules);

  const factors: RuleResult["factors"] = [];
  let combined = 0;

  if (ratingRule) {
    const ratingNorm = clamp01(ctx.weightedRating / 10);
    const impact = ratingNorm * ratingRule.weights.blockWeight * ratingRule.points.max;
    combined += impact;
    factors.push({
      key: "rating",
      label: ratingRule.text,
      value: Number(ctx.weightedRating.toFixed(2)),
      impact: Number(impact.toFixed(2)),
    });
  }

  if (necessityRule) {
    // Accept decimal competitiveness (e.g. 5.3). If `ctx.competitiveness` is missing,
    // fall back to `ctx.necessity` (0..1) scaled to 0..10.
    const rawLevel = Number.isFinite(Number(ctx.competitiveness))
      ? Number(ctx.competitiveness)
      : Number(ctx.necessity ?? 0) * 10;
    const level = Math.max(0, Math.min(10, rawLevel));
    const impact = clamp01(level / 10) * necessityRule.weights.blockWeight * necessityRule.points.max;
    combined += impact;
    factors.push({
      key: "necessity",
      label: necessityRule.text,
      value: Number(level.toFixed(1)),
      impact: Number(impact.toFixed(2)),
    });
  }

  if (trainingRule) {
    // Raw rate (same figure as the attendance summary): justified absences are not compensated here.
    const attendedSeason = Number.isFinite(ctx.weekStats.attendedTrainingsSeason)
      ? ctx.weekStats.attendedTrainingsSeason
      : 0;
    const totalTrainingsSeason = Number.isFinite(ctx.weekStats.totalTrainingsSeason)
      ? Math.max(0, ctx.weekStats.totalTrainingsSeason)
      : 0;
    const rate = totalTrainingsSeason > 0 ? clamp01(attendedSeason / totalTrainingsSeason) : 0;
    const impact = rate * trainingRule.points.max;
    combined += impact;
    factors.push({
      key: "weeklyTrainingAccum",
      label: trainingRule.text,
      value: Number((rate * 100).toFixed(2)),
      impact: Number(impact.toFixed(2)),
    });
  }

  // Impacts stay floats to preserve small differences between players; only the sum is rounded.
  return { factors, delta: Math.round(combined) };
}
