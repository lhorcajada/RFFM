import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, fillText, type DeconvocationRuleConfig } from "./ruleCatalog";

export default function rivalResultRule(
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  cfg: DeconvocationRuleConfig = buildDefaultRule("rivalResult"),
): RuleResult {
  const rule = resolveRule("rivalResult", [cfg])!;
  const { previousRivalResult, necessity } = ctx;
  if (!previousRivalResult) return { factors: [], delta: 0 };

  const resultFactor = previousRivalResult.result === "loss"
    ? rule.points.loss
    : previousRivalResult.result === "draw"
      ? rule.points.draw
      : rule.points.win;
  const isAbultado = previousRivalResult.goalDiff >= rule.weights.bigWinGoalDiff;
  // If the result is abultado (big win), penalize less-needed players
  // proportionally to (1 - necessity). If the result is adjusted (<7),
  // protect the more necessary players by adding points proportional to
  // `necessity` (so higher necessity → more positive impact).
  const rivalDelta = isAbultado
    ? -resultFactor * (1 - necessity)
    : resultFactor * necessity;
  const threshold = rule.weights.bigWinGoalDiff;
  const abultadoLabel = isAbultado
    ? `Resultado abultado (≥${threshold} goles) — se pueden descansar titulares`
    : `Resultado ajustado (<${threshold} goles) — se protege a los más necesarios`;
  const factor = {
    key: "rivalResult",
    label: fillText(rule.text, {
      result: abultadoLabel,
      rival: previousRivalResult.rival,
      score: previousRivalResult.scoreText,
    }),
    value: Number((necessity * 100).toFixed(0)),
    impact: Number(rivalDelta.toFixed(2)),
  };
  return { factors: [factor], delta: rivalDelta };
}
