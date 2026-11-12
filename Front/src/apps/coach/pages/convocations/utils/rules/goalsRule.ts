import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, type DeconvocationRuleConfig } from "./ruleCatalog";

export default function goalsRule(
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  cfg: DeconvocationRuleConfig = buildDefaultRule("goals"),
): RuleResult {
  const rule = resolveRule("goals", [cfg])!;
  const goals = Number(ctx.seasonPlayerStats?.leagueGoals ?? 0);
  const goalsDelta = Number((goals * rule.points.perGoal).toFixed(2));

  const factor = {
    key: "goals",
    label: rule.text,
    value: goals,
    impact: goalsDelta,
  };

  return { factors: [factor], delta: goalsDelta };
}
