import type { Rule, RuleResult, RuleContext } from "./types";

export default function injuredRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  if (ctx.player.isInjured) {
    const factor = {
      key: "injured",
      label: "Lesionado: desconvocatoria automática",
      value: 1,
      impact: -120,
    };
    return { factors: [factor], delta: -120, forced: true };
  }
  return { factors: [], delta: 0 };
}
