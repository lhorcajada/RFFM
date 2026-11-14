import { useEffect, useState } from "react";
import { getTeamLatestTraitRatings } from "../../../services/traitRatingService";
import type { TraitRating } from "../../../types/traitRating";

/**
 * Latest trait ratings of every player, to explain the fit in a position. Empty while loading or when the
 * read fails (e.g. the user cannot see trait ratings).
 */
export function useLatestTraitRatings(teamId: string, enabled = true): TraitRating[] {
  const [ratings, setRatings] = useState<TraitRating[]>([]);

  useEffect(() => {
    if (!teamId || !enabled) return;
    let cancelled = false;
    getTeamLatestTraitRatings(teamId)
      .then((data) => {
        if (!cancelled) setRatings(data);
      })
      .catch(() => {
        if (!cancelled) setRatings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, enabled]);

  return ratings;
}
