import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, type DeconvocationRuleConfig } from "./ruleCatalog";

export default function technicalTotalRule(
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  cfg: DeconvocationRuleConfig = buildDefaultRule("technicalTotal"),
): RuleResult {
  const rule = resolveRule("technicalTotal", [cfg])!;
  const { technicalTotal, maxTechnicalTotal } = ctx;
  const historyDelta = maxTechnicalTotal > 0 ? (technicalTotal / maxTechnicalTotal) * rule.points.multiplier : 0;
  const factor = {
    key: "technicalTotal",
    label: rule.text,
    value: technicalTotal,
    impact: Number(historyDelta.toFixed(2)),
  };
  return { factors: [factor], delta: historyDelta };
}
