import { useEffect, useMemo, useState } from "react";
import { getTeamLatestTraitRatings } from "../../../services/traitRatingService";
import type { TraitRating } from "../../../types/traitRating";
import type { EffectiveTrait } from "../rating/ratingCatalog";
import { useRatingConfig } from "../rating/useRatingConfig";

export type ConductData = {
  /** Última valoración de conducta de cada jugador. Vacío mientras carga, si está desactivado o si la lectura falla. */
  conductByPlayer: Record<string, TraitRating>;
  /** Rasgos visibles del equipo, los que se pueden filtrar. */
  traits: EffectiveTrait[];
};

/** Conducta en partido para filtrar la plantilla. Solo lee cuando `enabled` (la conducta es interna del cuerpo técnico). */
export function useConductData(teamId: string | null, enabled: boolean): ConductData {
  const [ratings, setRatings] = useState<TraitRating[]>([]);
  const { visibleTraits } = useRatingConfig(enabled ? teamId : null);

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

  const conductByPlayer = useMemo(
    () => Object.fromEntries(ratings.map((rating) => [rating.teamPlayerId, rating])),
    [ratings],
  );

  return { conductByPlayer, traits: enabled ? visibleTraits : [] };
}
