import type { PoolPlayer } from "../../SeasonPrep";
import { playerIsGk, FP_ALL_KEYS, GK_ALL_KEYS } from "../evaluationConstants";

/**
 * Computes concept completeness for a player.
 * Returns filled count, total concepts, percentage, and overall average.
 */
export function usePlayerAvgScore(player: PoolPlayer): { filled: number; total: number; pct: number; avg: number } {
  const keys = playerIsGk(player) ? GK_ALL_KEYS : FP_ALL_KEYS;
  const rating = player.rating;
  const total = keys.length;
  const answers = rating ? rating.answers.filter((a) => keys.includes(a.characteristicKey as (typeof keys)[number])) : [];
  const filled = answers.length;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const avg = filled > 0 ? answers.reduce((sum, answer) => sum + answer.level, 0) / filled : 0;
  return { filled, total, pct, avg };
}
