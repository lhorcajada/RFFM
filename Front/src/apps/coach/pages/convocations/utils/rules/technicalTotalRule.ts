import type { Rule, RuleResult, RuleContext } from "./types";

export default function technicalTotalRule(ctx: RuleContext, _prev: Record<string, RuleResult>): RuleResult {
  const { technicalTotal, maxTechnicalTotal } = ctx;
  // Increased multiplier to give stronger protection for accumulated technical deconvocations
  const MULTIPLIER = 40; // was 20
  const historyDelta = maxTechnicalTotal > 0 ? (technicalTotal / maxTechnicalTotal) * MULTIPLIER : 0;
  const factor = {
    key: "technicalTotal",
    label: "Desconvocatorias técnicas acumuladas",
    value: technicalTotal,
    impact: Number(historyDelta.toFixed(2)),
  };
  return { factors: [factor], delta: historyDelta };
}
