import type { Rule, RuleResult, RuleContext } from "./types";

const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);

/** Puntos de protección según las jornadas transcurridas desde la última desconvocatoria (1 = la anterior). */
const RECENT_DECONVOCATION_POINTS = [25, 20, 15, 10, 5] as const;

const recentDeconvocationRule: Rule = (ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult => {
  const { seasonColumns, enrichedGrid, playerId } = ctx;

  const window = seasonColumns.slice(0, RECENT_DECONVOCATION_POINTS.length);
  const index = window.findIndex((col) => {
    const cell = enrichedGrid.get(col.eventId)?.get(playerId);
    return !!cell && NOT_CALLED_NAMES.has(cell.statusName);
  });
  if (index === -1) return { factors: [], delta: 0 };

  const jornadasAgo = index + 1;
  const points = RECENT_DECONVOCATION_POINTS[index];
  const factor = {
    key: "recentDeconvocation",
    label: "Desconvocado en las últimas jornadas",
    value: jornadasAgo,
    impact: points,
  };
  return { factors: [factor], delta: points };
};

export default recentDeconvocationRule;
