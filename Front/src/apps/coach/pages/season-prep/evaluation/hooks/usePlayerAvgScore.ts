import type { PoolPlayer, AttributeScore } from "../../SeasonPrep";
import type { AttributeKey } from "../evaluationConstants";
import { playerIsGk, GK_ALL_KEYS, FP_ALL_KEYS, SCORE_COLORS } from "../evaluationConstants";

/**
 * Computes the average evaluation score for a player choosing the right
 * attribute set based on whether they are a goalkeeper or a field player.
 */
export function usePlayerAvgScore(player: PoolPlayer): { avg: number | null; color: string | null } {
  const eval_ = player.evaluation ?? {};
  const keys: AttributeKey[] = playerIsGk(player) ? GK_ALL_KEYS : FP_ALL_KEYS;
  const values = keys
    .map((k) => eval_[k] as AttributeScore | undefined)
    .filter((v): v is AttributeScore => v !== undefined);

  if (values.length === 0) return { avg: null, color: null };

  const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  const color = SCORE_COLORS[Math.round(avg) as AttributeScore];
  return { avg, color };
}
