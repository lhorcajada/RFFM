import type { PoolPlayer, ConceptEval } from "../../SeasonPrep";
import { playerIsGk, FP_ALL_KEYS, GK_ALL_KEYS } from "../evaluationConstants";

/**
 * Computes concept completeness for a player.
 * Returns filled count, total concepts, and percentage.
 */
export function usePlayerAvgScore(player: PoolPlayer): { filled: number; total: number; pct: number } {
  const keys = playerIsGk(player) ? GK_ALL_KEYS : FP_ALL_KEYS;
  const eval_ = player.evaluation ?? {};
  const total = keys.length;
  const filled = keys.filter((k) => {
    const v = eval_[k] as ConceptEval | undefined;
    return v?.consistencia !== undefined || v?.tendencia !== undefined;
  }).length;
  return { filled, total, pct: total > 0 ? Math.round((filled / total) * 100) : 0 };
}
