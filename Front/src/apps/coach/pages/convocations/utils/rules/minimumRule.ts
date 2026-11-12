import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, fillText, type DeconvocationRuleConfig } from "./ruleCatalog";

export default function minimumRule(
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  cfg: DeconvocationRuleConfig = buildDefaultRule("minimum"),
): RuleResult {
  const rule = resolveRule("minimum", [cfg])!;
  const { calledCount, minRequiredCalls } = ctx;
  if (calledCount < minRequiredCalls) {
    const deficit = minRequiredCalls - calledCount;
    const minDelta = Math.min(rule.weights.cap, deficit * rule.points.perMissingCall);
    const factor = {
      key: "minimum",
      label: fillText(rule.text, { deficit, min: minRequiredCalls }),
      value: deficit,
      impact: Number(minDelta.toFixed(2)),
    };
    return { factors: [factor], delta: minDelta };
  }
  return {
    factors: [{ key: "minimum", label: `Cumple el mínimo exigido de convocatorias (${minRequiredCalls})`, value: calledCount, impact: 0 }],
    delta: 0,
  };
}
