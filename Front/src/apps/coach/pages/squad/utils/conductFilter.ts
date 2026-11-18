import type { TraitRating, TraitTrend } from "../../../types/traitRating";

export type ConductFilters = {
  traitKey: string | null;
  minLevel: number;
  maxLevel: number;
  trend: TraitTrend | null;
};

export const EMPTY_CONDUCT_FILTERS: ConductFilters = { traitKey: null, minLevel: 1, maxLevel: 5, trend: null };

export function hasActiveConductFilters(filters: ConductFilters): boolean {
  return filters.traitKey !== null || filters.trend !== null;
}

export function filterPlayersByConduct<T extends { teamPlayerId: string }>(
  players: T[],
  conductByPlayer: Record<string, TraitRating>,
  filters: ConductFilters,
): T[] {
  if (!hasActiveConductFilters(filters)) return players;

  return players.filter((player) => {
    const rating = conductByPlayer[player.teamPlayerId];
    if (!rating) return false;
    if (filters.trend && rating.trend !== filters.trend) return false;
    if (filters.traitKey) {
      const level = rating.levels.find((l) => l.traitKey === filters.traitKey)?.level;
      if (level === undefined || level < filters.minLevel || level > filters.maxLevel) return false;
    }
    return true;
  });
}
