import { useCallback, useEffect, useMemo, useState } from "react";
import { createTeamRatings, getTeamLatestRatings } from "../../../services/playerRatingService";
import { getPlayersByTeam, type PlayerResponse } from "../../../services/teamplayerService";
import type { PlayerRating } from "../../../types/playerRating";
import { buildInitialDraft, planSave, type SavePlan, type SheetDraft } from "./ratingSheet";

export type RatingSheetState = {
  loading: boolean;
  loadError: boolean;
  saving: boolean;
  players: PlayerResponse[];
  draft: SheetDraft;
  plan: SavePlan;
  place: (playerIds: string[], characteristicKey: string, level: number | null) => void;
  /** Guarda los jugadores cambiados y completos. Devuelve cuántos se han guardado. */
  save: (ratedAt: string) => Promise<number>;
};

function byTeamPlayerId(ratings: PlayerRating[]): Record<string, PlayerRating> {
  return Object.fromEntries(ratings.map((rating) => [rating.teamPlayerId, rating]));
}

export function useRatingSheet(teamId: string | null, seasonId: string | null): RatingSheetState {
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [latestRatings, setLatestRatings] = useState<Record<string, PlayerRating>>({});
  const [baseline, setBaseline] = useState<SheetDraft>({});
  const [draft, setDraft] = useState<SheetDraft>({});
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
    Promise.all([getPlayersByTeam(teamId, seasonId ?? undefined), getTeamLatestRatings(teamId)])
      .then(([teamPlayers, ratings]) => {
        if (cancelled) return;
        const ratingsByPlayer = byTeamPlayerId(ratings);
        const initialDraft = buildInitialDraft(teamPlayers, ratingsByPlayer);
        setPlayers(teamPlayers);
        setLatestRatings(ratingsByPlayer);
        setBaseline(initialDraft);
        setDraft(initialDraft);
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

  const plan = useMemo(
    () => planSave(players, draft, baseline, latestRatings),
    [players, draft, baseline, latestRatings],
  );

  const place = useCallback((playerIds: string[], characteristicKey: string, level: number | null) => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const playerId of playerIds) {
        const levels = { ...(next[playerId] ?? {}) };
        if (level == null) delete levels[characteristicKey];
        else levels[characteristicKey] = level;
        next[playerId] = levels;
      }
      return next;
    });
  }, []);

  const save = useCallback(
    async (ratedAt: string) => {
      if (!teamId || plan.items.length === 0) return 0;
      setSaving(true);
      try {
        const created = await createTeamRatings(teamId, {
          ratedAt: ratedAt ? new Date(ratedAt).toISOString() : null,
          ratings: plan.items,
        });
        const savedIds = plan.items.map((item) => item.teamPlayerId);
        setLatestRatings((prev) => ({ ...prev, ...byTeamPlayerId(created) }));
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

  return { loading, loadError, saving, players, draft, plan, place, save };
}
