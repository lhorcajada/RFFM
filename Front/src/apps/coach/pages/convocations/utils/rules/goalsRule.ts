import type { Rule, RuleResult, RuleContext } from "./types";

export default function goalsRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const goals = Number(ctx.seasonPlayerStats?.totalGoals ?? 0);
  const POINTS_PER_GOAL = 2; // configurable: puntos otorgados por gol en la temporada
  const goalsDelta = Number((goals * POINTS_PER_GOAL).toFixed(2));

  const factor = {
    key: "goals",
    label: "Goles (temporada)",
    value: goals,
    impact: goalsDelta,
  };

  return { factors: [factor], delta: goalsDelta };
}
