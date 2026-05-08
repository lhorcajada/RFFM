import type { Rule, RuleResult, RuleContext } from "./types";

export default function rivalResultRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const { previousRivalResult, necessity } = ctx;
  if (!previousRivalResult) return { factors: [], delta: 0 };

  const resultFactor = previousRivalResult.result === "loss" ? 22 : previousRivalResult.result === "draw" ? 14 : 8;
  const isAbultado = previousRivalResult.goalDiff >= 7;
  // If the result is abultado (big win), penalize less-needed players
  // proportionally to (1 - necessity). If the result is adjusted (<7),
  // protect the more necessary players by adding points proportional to
  // `necessity` (so higher necessity → more positive impact).
  const rivalDelta = isAbultado
    ? -resultFactor * (1 - necessity)
    : resultFactor * necessity;
  const abultadoLabel = isAbultado
    ? `Resultado abultado (≥7 goles) — se pueden descansar titulares`
    : `Resultado ajustado (<7 goles) — se protege a los más necesarios`;
  const factor = {
    key: "rivalResult",
    label: `${abultadoLabel} vs ${previousRivalResult.rival} (${previousRivalResult.scoreText})`,
    value: Number((necessity * 100).toFixed(0)),
    impact: Number(rivalDelta.toFixed(2)),
  };
  return { factors: [factor], delta: rivalDelta };
}
