import { useCallback, useEffect, useMemo, useState } from "react";
import { createTeamTraitRatings, getTeamLatestTraitRatings, type TraitRatingItem } from "../../../services/traitRatingService";
import { getPlayersByTeam, type PlayerResponse } from "../../../services/teamplayerService";
import type { TraitRating, TraitTrend } from "../../../types/traitRating";
import { isGoalkeeperPosition } from "./positionCategory";
import { TRAIT_CATALOG } from "./ratingTraits";

export type TraitLevels = Record<string, number>;

export type PlayerTraitDraft = {
  levels: TraitLevels;
  trend: TraitTrend;
};

export type TraitDraft = Record<string, PlayerTraitDraft>;

const GOALKEEPER_DEMARCATION_ID = 1;
const TRAIT_ORDER = new Map(TRAIT_CATALOG.map((trait, index) => [trait.key, index]));

function isFieldPlayer(player: PlayerResponse): boolean {
  return player.activePositionId !== GOALKEEPER_DEMARCATION_ID && !isGoalkeeperPosition(player.position);
}

function levelsOf(rating: TraitRating | undefined): TraitLevels {
  return Object.fromEntries((rating?.levels ?? []).map((l) => [l.traitKey, l.level]));
}

function sameLevels(a: TraitLevels, b: TraitLevels): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => a[key] === b[key]);
}

function toItem(playerId: string, draft: PlayerTraitDraft): TraitRatingItem {
  return {
    teamPlayerId: playerId,
    trend: draft.trend,
    levels: Object.entries(draft.levels)
      .sort(([a], [b]) => (TRAIT_ORDER.get(a) ?? 0) - (TRAIT_ORDER.get(b) ?? 0))
      .map(([traitKey, level]) => ({ traitKey, level })),
  };
}

export type TraitRatingState = {
  loading: boolean;
  loadError: boolean;
  saving: boolean;
  players: PlayerResponse[];
  draft: TraitDraft;
  /** Niveles de la valoración guardada de cada jugador, para marcar el nivel anterior. */
  previousLevels: Record<string, TraitLevels>;
  plan: { items: TraitRatingItem[] };
  hasUnsavedChanges: boolean;
  setLevel: (playerId: string, traitKey: string, level: number | null) => void;
  setTrend: (playerId: string, trend: TraitTrend) => void;
  /** Guarda los jugadores cambiados. Devuelve cuántos se han guardado. */
  save: (ratedAt: string) => Promise<number>;
};

export function useTraitRating(teamId: string | null, seasonId: string | null): TraitRatingState {
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [baseline, setBaseline] = useState<TraitDraft>({});
  const [draft, setDraft] = useState<TraitDraft>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    Promise.all([getPlayersByTeam(teamId, seasonId ?? undefined), getTeamLatestTraitRatings(teamId)])
      .then(([teamPlayers, ratings]) => {
        if (cancelled) return;
        const fieldPlayers = teamPlayers.filter(isFieldPlayer);
        const ratingByPlayer = new Map(ratings.map((rating) => [rating.teamPlayerId, rating]));
        const initial: TraitDraft = Object.fromEntries(
          fieldPlayers.map((player) => [
            player.id,
            { levels: levelsOf(ratingByPlayer.get(player.id)), trend: "same" as TraitTrend },
          ]),
        );
        setPlayers(fieldPlayers);
        setBaseline(initial);
        setDraft(initial);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, seasonId]);

  const plan = useMemo(() => {
    const items = players
      .filter((player) => {
        const current = draft[player.id];
        const base = baseline[player.id];
        return current && base && (current.trend !== base.trend || !sameLevels(current.levels, base.levels));
      })
      .map((player) => toItem(player.id, draft[player.id]));
    return { items };
  }, [players, draft, baseline]);

  const previousLevels = useMemo(
    () => Object.fromEntries(Object.entries(baseline).map(([id, d]) => [id, d.levels])),
    [baseline],
  );

  const setLevel = useCallback((playerId: string, traitKey: string, level: number | null) => {
    setDraft((prev) => {
      const current = prev[playerId] ?? { levels: {}, trend: "same" as TraitTrend };
      const levels = { ...current.levels };
      if (level == null) delete levels[traitKey];
      else levels[traitKey] = level;
      return { ...prev, [playerId]: { ...current, levels } };
    });
  }, []);

  const setTrend = useCallback((playerId: string, trend: TraitTrend) => {
    setDraft((prev) => {
      const current = prev[playerId] ?? { levels: {}, trend: "same" as TraitTrend };
      return { ...prev, [playerId]: { ...current, trend } };
    });
  }, []);

  const save = useCallback(
    async (ratedAt: string) => {
      if (!teamId || plan.items.length === 0) return 0;
      setSaving(true);
      try {
        await createTeamTraitRatings(teamId, {
          ratedAt: ratedAt ? new Date(ratedAt).toISOString() : null,
          ratings: plan.items,
        });
        const savedIds = plan.items.map((item) => item.teamPlayerId);
        setBaseline((prev) => ({
          ...prev,
          ...Object.fromEntries(savedIds.map((id) => [id, draft[id]])),
        }));
        return savedIds.length;
      } finally {
        setSaving(false);
      }
    },
    [teamId, plan, draft],
  );

  return {
    loading,
    loadError,
    saving,
    players,
    draft,
    previousLevels,
    plan,
    hasUnsavedChanges: plan.items.length > 0,
    setLevel,
    setTrend,
    save,
  };
}
