export type CategoryKey = "physical" | "technical" | "tactical" | "competitiveness";

export type RatingAnswer = {
  characteristicKey: string;
  /** Level 1–10 */
  level: number;
  /** Descriptive concept text for this level */
  concept: string;
  categoryKey: CategoryKey;
};

export type PlayerRating = {
  id: string;
  teamPlayerId: string;
  isGoalkeeper: boolean;
  /** Average level (1–10) for the physical category */
  physical: number;
  /** Average level (1–10) for the technical category */
  technical: number;
  /** Average level (1–10) for the tactical category */
  tactical: number;
  /** Average level (1–10) for the competitiveness category */
  competitiveness: number;
  /** Individual conceptual answers for all characteristics */
  answers: RatingAnswer[];
  ratedAt: string;
  notes?: string | null;
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getAnswerByKey(
  rating: PlayerRating,
  key: string,
): RatingAnswer | undefined {
  return rating.answers.find((a) => a.characteristicKey === key);
}

export function getAnswerLevel(rating: PlayerRating, key: string): number | null {
  return getAnswerByKey(rating, key)?.level ?? null;
}

export function getAvgLevel(
  rating: PlayerRating,
  categoryKey: CategoryKey,
): number {
  const answers = rating.answers.filter((a) => a.categoryKey === categoryKey);
  if (answers.length === 0) return 0;
  return answers.reduce((sum, a) => sum + a.level, 0) / answers.length;
}
