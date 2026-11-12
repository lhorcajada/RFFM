import type { RuleResult, RuleContext } from "./types";
import { buildDefaultRule, resolveRule, type DeconvocationRuleConfig } from "./ruleCatalog";

const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);

const recentDeconvocationRule = (
  ctx: RuleContext,
  _prev: Record<string, RuleResult>,
  cfg: DeconvocationRuleConfig = buildDefaultRule("recentDeconvocation"),
): RuleResult => {
  const rule = resolveRule("recentDeconvocation", [cfg])!;
  // Puntos de protección según las jornadas transcurridas desde la última desconvocatoria (1 = la anterior).
  const pointsByJornada = [rule.points.j1, rule.points.j2, rule.points.j3];
  const { seasonColumns, enrichedGrid, playerId } = ctx;

  const window = seasonColumns.slice(0, pointsByJornada.length);
  const index = window.findIndex((col) => {
    const cell = enrichedGrid.get(col.eventId)?.get(playerId);
    return !!cell && NOT_CALLED_NAMES.has(cell.statusName);
  });
  if (index === -1) return { factors: [], delta: 0 };

  const jornadasAgo = index + 1;
  const points = pointsByJornada[index];
  const factor = {
    key: "recentDeconvocation",
    label: rule.text,
    value: jornadasAgo,
    impact: points,
  };
  return { factors: [factor], delta: points };
};

export default recentDeconvocationRule;
