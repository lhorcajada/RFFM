import type { Rule, RuleResult, RuleContext } from "./types";

export default function minimumRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const { calledCount, minRequiredCalls } = ctx;
  if (calledCount < minRequiredCalls) {
    const deficit = minRequiredCalls - calledCount;
    const minDelta = Math.min(24, deficit * 4.5);
    const factor = {
      key: "minimum",
      label: `Le faltan ${deficit} convocatorias para llegar al mínimo exigido (${minRequiredCalls})`,
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
