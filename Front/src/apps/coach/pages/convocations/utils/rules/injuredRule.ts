import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, type DeconvocationRuleConfig } from "./ruleCatalog";

export default function injuredRule(
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  cfg: DeconvocationRuleConfig = buildDefaultRule("injured"),
): RuleResult {
  const rule = resolveRule("injured", [cfg])!;
  if (!ctx.player.isInjured) return { factors: [], delta: 0 };
  return { factors: [{ key: "injured", label: rule.text, value: 1, impact: 0 }], delta: 0, forced: true };
}
