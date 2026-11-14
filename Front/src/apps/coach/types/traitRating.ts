export type TraitTrend = "up" | "same" | "down";

export type TraitLevel = {
  traitKey: string;
  /** Level 1–5 */
  level: number;
};

export type TraitRating = {
  id: string;
  teamPlayerId: string;
  ratedAt: string;
  trend: TraitTrend;
  levels: TraitLevel[];
};
