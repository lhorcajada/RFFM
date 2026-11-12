import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, type DeconvocationRuleConfig } from "./ruleCatalog";

export default function injuredRule(
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  cfg: DeconvocationRuleConfig = buildDefaultRule("injured"),
): RuleResult {
  const rule = resolveRule("injured", [cfg])!;
  const points = rule.points.value;
  if (ctx.player.isInjured) {
    const factor = {
      key: "injured",
      label: rule.text,
      value: 1,
      impact: points,
    };
    return { factors: [factor], delta: points, forced: true };
  }
  return { factors: [], delta: 0 };
}
