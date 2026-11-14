import { TRAIT_CATALOG, calculateFit, type TraitWeight } from "../../squad/rating/ratingTraits";
import type { TraitLevel } from "../../../types/traitRating";

const MULTIPLIER: Record<Exclude<TraitWeight, "indifferent">, number> = { key: 3, sum: 1 };
const WEAK_LEVEL_MAX = 2;

export type FitTraitRow = {
  traitKey: string;
  label: string;
  weight: "key" | "sum";
  /** 3 for a key trait, 1 for one that adds. */
  multiplier: number;
  /** Level 1–5, or null when the trait has not been rated. */
  level: number | null;
  /** Level × multiplier, or null when there is no level. */
  points: number | null;
  /** What the rated level means for the trait (the nearest anchor: 1, 3 or 5). */
  levelMeaning: string | null;
};

export type FitExplanation = {
  rows: FitTraitRow[];
  weightedSum: number;
  totalWeight: number;
  /** Weighted average 1–5 (one decimal), null when no counting trait is rated. */
  fit: number | null;
  /** Key traits rated 1 or 2: why the player does not fit better. */
  weakKeyTraits: string[];
};

function nearestAnchor(level: number): 1 | 3 | 5 {
  if (level <= 2) return 1;
  if (level >= 4) return 5;
  return 3;
}

/**
 * Breaks down the fit of a player in a position: the traits that count (key first), the level of each
 * and the weighted average that gives the fit. Same formula as the server (key ×3, sum ×1).
 */
export function explainFit(levels: TraitLevel[], weights: Record<string, TraitWeight>): FitExplanation {
  const levelByTrait = new Map(levels.map((l) => [l.traitKey, l.level]));
  const counting = TRAIT_CATALOG.filter((t) => weights[t.key] === "key" || weights[t.key] === "sum");
  const ordered = [...counting.filter((t) => weights[t.key] === "key"), ...counting.filter((t) => weights[t.key] === "sum")];

  let weightedSum = 0;
  let totalWeight = 0;
  const rows: FitTraitRow[] = ordered.map((trait) => {
    const weight = weights[trait.key] as "key" | "sum";
    const multiplier = MULTIPLIER[weight];
    const level = levelByTrait.get(trait.key) ?? null;
    if (level != null) {
      weightedSum += level * multiplier;
      totalWeight += multiplier;
    }
    return {
      traitKey: trait.key,
      label: trait.label,
      weight,
      multiplier,
      level,
      points: level != null ? level * multiplier : null,
      levelMeaning: level != null ? trait.anchors[nearestAnchor(level)] : null,
    };
  });

  return {
    rows,
    weightedSum,
    totalWeight,
    fit: calculateFit(Object.fromEntries(levelByTrait), weights),
    weakKeyTraits: rows.filter((r) => r.weight === "key" && r.level != null && r.level <= WEAK_LEVEL_MAX).map((r) => r.label),
  };
}
